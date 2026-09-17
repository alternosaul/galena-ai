import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bot,
  Clock,
  Copy,
  Eye,
  FileAudio,
  FileJson,
  FlaskConical,
  Loader2,
  Mountain,
  Play,
  Upload,
  User,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfidenceGauge } from "@/components/confidence-gauge";
import { ExamplePlayer } from "@/components/example-player";
import { ResultBadge, Verdict, VerdictPill } from "@/components/result-badge";
import { hasStoredApiSettings, loadApiSettings } from "@/lib/api-settings";
import { useAuth } from "@/lib/auth";
import { withBase } from "@/lib/base-path";
import type { DetectionResult } from "@/lib/detection";
import { DEFAULT_DETECTOR_ID, findDetector } from "@/lib/detectors.data";
import { normalizeAudio, type AudioSource } from "@/lib/audio-normalize";
import { useI18n, type TKey } from "@/lib/i18n";
import { modelsQueryOptions } from "@/lib/models-query";
import { useAddToHistory } from "@/lib/history";
import { UploadError, postWithProgress, type UploadPhase } from "@/lib/upload";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  ALTUR_CHANNELS,
  ALTUR_SAMPLE_RATE,
  MAX_REQUEST_BYTES,
  alturWavIssues,
  base64ToBytes,
  bytesToBase64,
  clientChannelWav,
  parseWavHeader,
  type WavInfo,
  type WavIssue,
} from "@/lib/wav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Detector — Galenia" },
      {
        name: "description",
        content:
          "Envía una llamada y descubre al instante si la voz es de una IA o de una persona.",
      },
      { property: "og:title", content: "Detector — Galenia" },
      {
        property: "og:description",
        content: "Detección de voz sintética con velocímetro de confianza en tiempo real.",
      },
    ],
  }),
  component: DetectorPage,
});

type ErrorBody = { error?: string; detail?: { field: string; message: string }[] };
type InputTab = "audio" | "base64";

const DEFAULT_CALL_ID = "call_demo_001";

/** Llamadas reales del set de validación (etiquetadas en el manifiesto), servidas desde public/examples. */
const EXAMPLES = [
  {
    id: "human",
    file: "/examples/ejemplo-humano.json",
    label: "detector.exampleHuman",
    icon: UserRound,
  },
  { id: "ai", file: "/examples/ejemplo-ia.json", label: "detector.exampleAi", icon: Bot },
] as const;
/**
 * Vista previa antes de analizar nada: el audio de ejemplo de IA y la respuesta real de Everest con
 * ese audio (call_5e4539a471f6), medida contra el despliegue.
 */
const PREVIEW_AUDIO = "/examples/ejemplo-ia.wav";
const PREVIEW_RESULT: DetectionResult = {
  call_id: "call_5e4539a471f6",
  is_synthetic: true,
  confidence: 0.9747,
  p_synthetic: 0.9747,
  model: "everest",
  threshold: 0.5916,
  latency_ms: 5647,
  received_at: "2026-09-17T00:00:00.000Z",
  duration_sec: 96.24,
  sample_rate: 8000,
  channels: 2,
};
const LIMIT_MB = (MAX_REQUEST_BYTES / 1_000_000).toFixed(1);
/** Margen para la cabecera multipart al subir el archivo. */
const MAX_AUDIO_BYTES = MAX_REQUEST_BYTES - 2_000;

const megabytes = (bytes: number) => (bytes / 1_000_000).toFixed(2);
/** Acepta WAV y cualquier audio que el navegador pueda decodificar; se convierte antes de enviarse. */
const AUDIO_ACCEPT = "audio/*,.wav,.mp3,.m4a,.aac,.ogg,.oga,.opus,.flac,.webm";

/**
 * Archivo que se sube: solo el canal del cliente (mono) salvo para detectores que miden turnos
 * (stereo_only). Esos detectores solo leen el canal 0, así que el resultado es el mismo con la mitad
 * de bytes.
 */
async function uploadFileFor(file: File, detectorId: string): Promise<File> {
  if (findDetector(detectorId)?.stereo_only !== false) return file;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = parseWavHeader(bytes);
  if (!info || info.channels !== ALTUR_CHANNELS || info.bitsPerSample !== 16) return file;
  return new File([clientChannelWav(bytes, info)], file.name, { type: "audio/wav" });
}

function DetectorPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [model, setModel] = useState(DEFAULT_DETECTOR_ID);
  const [tab, setTab] = useState<InputTab>("audio");
  const [callId, setCallId] = useState(DEFAULT_CALL_ID);
  const [base64, setBase64] = useState("");
  const [converting, setConverting] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [normalizing, setNormalizing] = useState(false);
  const [conversion, setConversion] = useState<AudioSource | null>(null);
  const [loadingExample, setLoadingExample] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<WavInfo | null>(null);
  const [fileIssues, setFileIssues] = useState<WavIssue[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase | null>(null);
  const [result, setResult] = useState<DetectionResult | null>(null);

  const { data: models } = useQuery(modelsQueryOptions);
  const { layout } = useTheme();
  // Si la API de modelos reporta qué detectores cargó (GALENA_DETECTORS), solo se ofrecen esos. Si
  // no respondió (p. ej. mientras el servidor despierta), se muestran todos.
  const offered = models?.some((m) => m.available === true)
    ? models.filter((m) => m.available !== false)
    : models;
  const addToHistory = useAddToHistory();

  useEffect(() => {
    setModel(loadApiSettings().defaultModel);
  }, []);

  // Sin preferencia guardada, arranca una sola vez con el detector por defecto del servidor.
  const serverDefaultApplied = useRef(false);
  useEffect(() => {
    const serverDefault = models?.find((m) => m.is_default)?.id;
    if (!serverDefault || serverDefaultApplied.current) return;
    serverDefaultApplied.current = true;
    if (!hasStoredApiSettings()) setModel(serverDefault);
  }, [models]);

  // Si la preferencia guardada apunta a un detector inexistente, usa el predeterminado.
  useEffect(() => {
    if (offered && offered.length > 0 && !offered.some((m) => m.id === model)) {
      setModel(offered.find((m) => m.is_default)?.id ?? offered[0]?.id ?? DEFAULT_DETECTOR_ID);
    }
  }, [offered, model]);

  const detectorName = (id: string) => models?.find((m) => m.id === id)?.name ?? id;
  const fileInvalid = fileIssues.length > 0;

  async function handleResponse(res: Response) {
    const body = (await res.json().catch(() => ({}))) as ErrorBody | DetectionResult;
    if (!res.ok) {
      const { error, detail } = body as ErrorBody;
      const description = detail?.map((d) => `${d.field}: ${d.message}`).join(" · ");
      toast.error(error ?? t("toast.analysisError"), description ? { description } : undefined);
      return;
    }
    const detection = body as DetectionResult;
    setResult(detection);
    // La demo guarda el historial en este navegador; la preferencia autoSave lo desactiva.
    if (user?.preferences.autoSave !== false) addToHistory(detection);
    toast.success(t("toast.success"));
  }

  function requestErrorToast(error: unknown) {
    const reason = error instanceof UploadError ? error.reason : "network";
    toast.error(
      t(
        reason === "stalled"
          ? "toast.uploadStalled"
          : reason === "timeout"
            ? "toast.timeout"
            : "toast.networkError",
      ),
    );
  }

  // Solo se pide el audio en Base64; el resto del contrato de la API se completa aquí.
  const cleanBase64 = base64.replace(/\s+/g, "");
  const payload = {
    call_id: callId.trim() || DEFAULT_CALL_ID,
    audio_base64: cleanBase64,
    sample_rate: ALTUR_SAMPLE_RATE,
    channels: ALTUR_CHANNELS,
  };
  const payloadPreview = JSON.stringify(
    {
      ...payload,
      audio_base64: cleanBase64
        ? `${cleanBase64.slice(0, 40)}… (${cleanBase64.length.toLocaleString()})`
        : t("detector.payloadPending"),
    },
    null,
    2,
  );

  async function analyzeBase64() {
    if (!cleanBase64) {
      toast.error(t("toast.missingBase64"));
      return;
    }
    const bytes = base64ToBytes(cleanBase64);
    if (!bytes) {
      toast.error(t("toast.invalidBase64"));
      return;
    }
    const issues = alturWavIssues(parseWavHeader(bytes));
    if (issues.length > 0) {
      toast.error(issues.map((issue) => wavIssueText(t, issue)).join(" · "));
      return;
    }
    const body = JSON.stringify(payload);
    if (body.length > MAX_REQUEST_BYTES) {
      toast.error(t("toast.tooLarge", { value: megabytes(body.length), limit: LIMIT_MB }));
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await postWithProgress(
        withBase(`/api/public/detect?detector=${encodeURIComponent(model)}`),
        body,
        { headers: { "Content-Type": "application/json" }, onProgress: setUploadPhase },
      );
      await handleResponse(res);
    } catch (error) {
      requestErrorToast(error);
    } finally {
      setLoading(false);
      setUploadPhase(null);
    }
  }

  async function selectFile(next: File | null) {
    setFile(next);
    setFileInfo(null);
    setFileIssues([]);
    setConversion(null);
    if (!next) return;
    setNormalizing(true);
    try {
      // Si no es WAV estéreo de 8 kHz y 16 bits, se convierte aquí antes de validarlo y enviarlo.
      const normalized = await normalizeAudio(next);
      const head = new Uint8Array(await normalized.file.slice(0, 1024 * 1024).arrayBuffer());
      const info = parseWavHeader(head);
      const issues = alturWavIssues(info);
      if (normalized.file.size > MAX_AUDIO_BYTES) {
        issues.push({ code: "tooLarge", value: Number(LIMIT_MB) });
      }
      setFile(normalized.file);
      setFileInfo(info);
      setFileIssues(issues);
      setConversion(normalized.source);
    } catch {
      setFileIssues([{ code: "unsupported" }]);
    } finally {
      setNormalizing(false);
    }
  }

  /** Convierte un audio a WAV de 8 kHz y a Base64, lo pone en el campo y abre la pestaña de Base64. */
  async function convertToBase64(source: File) {
    setConverting(true);
    try {
      let normalized;
      try {
        normalized = await normalizeAudio(source);
      } catch {
        toast.error(wavIssueText(t, { code: "unsupported" }));
        return;
      }
      const head = new Uint8Array(await normalized.file.slice(0, 1024 * 1024).arrayBuffer());
      const issues = alturWavIssues(parseWavHeader(head));
      if (issues.length > 0) {
        toast.error(issues.map((issue) => wavIssueText(t, issue)).join(" · "));
        return;
      }
      setBase64(bytesToBase64(new Uint8Array(await normalized.file.arrayBuffer())));
      setCallId(source.name.replace(/\.[^.]+$/, "") || DEFAULT_CALL_ID);
      setTab("base64");
      toast.success(t("toast.base64Ready"));
    } catch {
      toast.error(t("toast.convertError"));
    } finally {
      setConverting(false);
    }
  }

  /** Carga el audio de ejemplo de la vista previa en la pestaña Audio. */
  async function loadPreviewAudio() {
    setLoadingPreview(true);
    try {
      const res = await fetch(withBase(PREVIEW_AUDIO));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      await selectFile(new File([blob], `${PREVIEW_RESULT.call_id}.wav`, { type: "audio/wav" }));
    } catch {
      toast.error(t("toast.exampleError"));
    } finally {
      setLoadingPreview(false);
    }
  }

  /** Carga un ejemplo de demostración: su audio en Base64 y su call_id. */
  async function loadExample(example: (typeof EXAMPLES)[number]) {
    setLoadingExample(example.id);
    try {
      const res = await fetch(withBase(example.file));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { call_id?: unknown; audio_base64?: unknown };
      if (typeof data.audio_base64 !== "string") throw new Error("audio_base64 ausente");
      setBase64(data.audio_base64);
      if (typeof data.call_id === "string") setCallId(data.call_id);
      setTab("base64");
      toast.success(t("toast.exampleLoaded", { name: t(example.label) }));
    } catch {
      toast.error(t("toast.exampleError"));
    } finally {
      setLoadingExample(null);
    }
  }

  async function copyBase64() {
    try {
      await navigator.clipboard.writeText(cleanBase64);
      toast.success(t("toast.base64Copied"));
    } catch {
      toast.error(t("toast.copyFailed"));
    }
  }

  async function analyzeAudio() {
    if (!file) {
      toast.error(t("toast.selectFile"));
      return;
    }
    if (fileInvalid) return;
    setLoading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", await uploadFileFor(file, model));
      const res = await postWithProgress(
        withBase(`/api/public/detect/audio?detector=${encodeURIComponent(model)}`),
        form,
        { onProgress: setUploadPhase },
      );
      await handleResponse(res);
    } catch (error) {
      requestErrorToast(error);
    } finally {
      setLoading(false);
      setUploadPhase(null);
    }
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) void selectFile(dropped);
  }

  // Antes de analizar nada, el panel de resultado muestra la vista previa del ejemplo de IA.
  const preview = !loading && !result;
  const shown = result ?? (preview ? PREVIEW_RESULT : null);
  const state = loading ? "loading" : shown ? (shown.is_synthetic ? "ai" : "human") : "idle";
  const selectedModel = models?.find((m) => m.id === model);
  // Los temas flat dibujan el velocímetro de humano (0) a IA (1): la aguja marca P(sintético).
  const pSynthetic = shown
    ? (shown.p_synthetic ?? (shown.is_synthetic ? shown.confidence : 1 - shown.confidence))
    : 0;
  const gaugeValue = layout === "flat" ? pSynthetic : (shown?.confidence ?? 0);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 flat:-m-4 flat:max-w-none flat:gap-0 md:flat:-m-10">
      <div className="flex flex-wrap items-end justify-between gap-4 flat:gap-8 flat:border-b flat:border-rule flat:px-6 flat:py-10 md:flat:px-10 md:flat:py-14">
        <div className="motion-safe:flat:animate-in motion-safe:flat:fade-in motion-safe:flat:slide-in-from-bottom-2 motion-safe:flat:duration-700">
          <h1 className="text-2xl font-bold tracking-tight flat:t-display flat:text-6xl md:flat:text-[5.5rem] editorial:font-extrabold editorial:tracking-[-0.045em] md:terminal:text-[4.5rem] md:nocturne:text-[6.25rem]">
            {t("detector.title")}
          </h1>
          <p className="text-sm text-muted-foreground flat:mt-6 flat:text-lg md:flat:text-2xl editorial:text-foreground/75 terminal:font-mono terminal:tracking-wide md:terminal:text-xl">
            {t("detector.subtitle")}
          </p>
        </div>
        <div className="w-full sm:w-64 flat:w-auto md:flat:text-right terminal:border terminal:border-rule terminal:px-6 terminal:py-4 terminal:transition-colors terminal:hover:border-cta md:terminal:text-left">
          <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground flat:mb-3 flat:t-label flat:text-sm">
            {t("detector.model")}
          </Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="flat:h-auto flat:w-auto flat:gap-3 flat:border-0 flat:bg-transparent flat:p-0 flat:t-display flat:text-3xl flat:text-cta flat:shadow-none flat:transition-all flat:duration-200 flat:hover:opacity-80 flat:focus:ring-0 flat:focus-visible:ring-2 flat:focus-visible:ring-cta flat:focus-visible:ring-offset-4 flat:focus-visible:ring-offset-background motion-safe:flat:hover:-translate-y-0.5 md:flat:ml-auto md:flat:text-4xl md:nocturne:text-5xl flat:[&>svg]:hidden md:terminal:ml-0">
              <SelectValue placeholder={t("detector.modelPlaceholder")}>
                {selectedModel ? (
                  <span className="flex items-center gap-2 flat:gap-[0.3em]">
                    <Mountain className="h-3.5 w-3.5 text-primary flat:hidden" />
                    {selectedModel.name}
                    {selectedModel.rank !== null && (
                      <span className="font-mono text-xs text-muted-foreground flat:font-[inherit] flat:text-[length:inherit] flat:text-current">
                        #{selectedModel.rank}
                      </span>
                    )}
                  </span>
                ) : undefined}
              </SelectValue>
              {/* <i> y no <span>: SelectTrigger fuerza display en sus <span> hijos (line-clamp). */}
              <i
                aria-hidden
                className="hidden size-0 shrink-0 border-x-[0.3em] border-t-[0.36em] border-x-transparent border-t-current flat:block"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>{t("detector.recommended")}</SelectLabel>
                {(offered ?? [])
                  .filter((m) => m.rank !== null)
                  .map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="flex items-center gap-2">
                        <Mountain className="h-3.5 w-3.5 text-primary" />
                        {m.name}
                        <span className="font-mono text-xs text-muted-foreground">#{m.rank}</span>
                      </span>
                    </SelectItem>
                  ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5 flat:gap-0 lg:flat:grid-cols-2">
        <Card className="min-w-0 lg:col-span-3 flat:border-0 flat:border-b flat:bg-transparent lg:flat:col-span-1 lg:flat:border-b-0 lg:flat:border-r">
          <CardHeader className={PANEL_HEADER}>
            <CardTitle className={PANEL_TITLE}>{t("detector.input")}</CardTitle>
            <CardDescription className={PANEL_DESCRIPTION}>
              {t("detector.inputDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className={cn("space-y-4", PANEL_CONTENT)}>
            <Tabs value={tab} onValueChange={(value) => setTab(value as InputTab)}>
              <TabsList className="mb-4 flat:mb-8 flat:grid flat:h-14 flat:w-full flat:grid-cols-2">
                <TabsTrigger value="audio">
                  <Upload className="mr-2 h-4 w-4 flat:hidden" /> Audio
                </TabsTrigger>
                <TabsTrigger value="base64">
                  <FileJson className="mr-2 h-4 w-4 flat:hidden" /> JSON · Base64
                </TabsTrigger>
              </TabsList>

              <TabsContent value="audio" className="space-y-3 flat:space-y-7">
                <div className="space-y-2 rounded-md border border-dashed border-border p-3 transition-colors hover:border-primary/50 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-500 flat:space-y-4 flat:border-solid flat:border-rule flat:px-6 flat:py-5 flat:hover:border-cta">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flat:flex flat:items-center flat:gap-2.5 flat:t-label flat:text-sm">
                    <span
                      aria-hidden
                      className="hidden size-2 rounded-full bg-cta flat:inline-block motion-safe:animate-pulse"
                    />
                    {t("detector.previewAudio")}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 flat:gap-4 sm:flat:flex-nowrap sm:flat:gap-5">
                    <audio
                      controls
                      preload="none"
                      src={withBase(PREVIEW_AUDIO)}
                      className="h-9 min-w-0 flex-1 flat:hidden"
                    />
                    <ExamplePlayer
                      src={withBase(PREVIEW_AUDIO)}
                      durationSec={PREVIEW_RESULT.duration_sec ?? 0}
                      className="hidden flat:flex"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void loadPreviewAudio()}
                      disabled={loadingPreview || normalizing}
                      className="flat:h-11 flat:shrink-0 flat:border flat:border-cta flat:bg-transparent flat:px-5 flat:text-sm flat:text-cta flat:shadow-none flat:hover:bg-cta flat:hover:text-cta-foreground terminal:font-mono"
                    >
                      {loadingPreview ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4 flat:hidden" />
                      )}
                      <span className="terminal:hidden nocturne:hidden">
                        {t("detector.useExample")}
                      </span>
                      <span className="hidden terminal:inline nocturne:inline">
                        {t("detector.useExampleShort")}
                      </span>
                    </Button>
                  </div>
                </div>

                <label
                  data-state={dragging ? "dragging" : file && !fileInvalid ? "ready" : "idle"}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={cn(
                    "dropzone-warp group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-secondary/40 px-6 py-12 text-center transition-all duration-300 hover:border-primary hover:bg-primary/5 hover:shadow-md motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500",
                    "flat:gap-5 flat:border-[1.5px] flat:border-rule/50 flat:bg-transparent flat:px-8 flat:py-16 flat:hover:border-transparent flat:hover:bg-cta/5 flat:hover:shadow-none",
                    dragging &&
                      "border-primary bg-primary/10 motion-safe:scale-[1.02] flat:bg-cta/10",
                  )}
                >
                  <Upload
                    className={cn(
                      "h-6 w-6 text-primary transition-transform duration-300 motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:scale-110 flat:h-9 flat:w-9 flat:text-cta",
                      dragging && "motion-safe:animate-bounce",
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm font-medium flat:t-display flat:text-2xl flat:leading-tight flat:transition-all flat:duration-300 flat:group-hover:text-cta motion-safe:flat:group-hover:-translate-y-1 md:flat:text-[1.75rem] editorial:font-bold editorial:tracking-[-0.02em] terminal:font-semibold md:nocturne:text-[2.5rem]",
                      file && !fileInvalid && "flat:text-cta",
                    )}
                  >
                    {file ? file.name : t("detector.dropFile")}
                  </span>
                  <span className="text-xs text-muted-foreground flat:t-label flat:max-w-lg flat:text-sm flat:leading-7 editorial:tracking-[0.1em] terminal:normal-case terminal:tracking-wide nocturne:normal-case nocturne:tracking-wide">
                    {t("detector.fileHint")}
                  </span>
                  <span
                    aria-hidden
                    className="hidden items-center gap-2 border border-cta px-5 py-2.5 t-label text-sm text-cta transition-colors duration-200 group-hover:bg-cta group-hover:text-cta-foreground flat:inline-flex terminal:font-mono"
                  >
                    {file ? t("detector.browseAgain") : t("detector.browse")}
                  </span>
                  <input
                    type="file"
                    accept={AUDIO_ACCEPT}
                    className="hidden"
                    onChange={(e) => void selectFile(e.target.files?.[0] ?? null)}
                  />
                </label>

                <ul className="space-y-1.5 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground flat:space-y-2 flat:border-0 flat:border-l-2 flat:border-cta flat:bg-cta/5 flat:px-5 flat:py-4 flat:text-base flat:leading-7 editorial:text-foreground/85 terminal:font-mono nocturne:text-foreground/85">
                  <li className="flex items-center gap-2 flat:items-start flat:gap-3">
                    <FileAudio className="h-3.5 w-3.5 shrink-0 text-primary flat:mt-1.5 flat:h-4 flat:w-4 flat:text-cta" />
                    {t("detector.noteWav")}
                  </li>
                  <li className="flex items-center gap-2 flat:items-start flat:gap-3">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-primary flat:mt-1.5 flat:h-4 flat:w-4 flat:text-cta" />
                    {t("detector.noteColdStart")}
                  </li>
                </ul>

                {normalizing && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("detector.normalizing")}
                  </p>
                )}
                {file && fileInvalid && (
                  <ul className="space-y-1 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1">
                    {fileIssues.map((issue) => (
                      <li key={issue.code} className="flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        {wavIssueText(t, issue)}
                      </li>
                    ))}
                  </ul>
                )}
                {file && !fileInvalid && fileInfo && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1">
                    <FileAudio className="h-3.5 w-3.5 text-success" />
                    {t("detector.wavInfo", {
                      rate: fileInfo.sampleRate,
                      channels: fileInfo.channels,
                      duration: fileInfo.durationSec.toFixed(1),
                    })}
                  </p>
                )}
                {file && conversion && !normalizing && (
                  <p className="text-xs text-muted-foreground">
                    {t("detector.normalized", {
                      source: `${conversion.sampleRate ? `${conversion.sampleRate} Hz` : conversion.format} · ${conversion.channels} ch`,
                    })}
                    {conversion.channels === 1 && ` ${t("detector.monoNote")}`}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 flat:grid flat:grid-cols-1 flat:gap-4 sm:flat:grid-cols-2">
                  <Button
                    onClick={analyzeAudio}
                    disabled={loading || normalizing || !file || fileInvalid}
                    className={cn(
                      "w-full sm:w-auto",
                      ACTION_BUTTON,
                      PRIMARY_ACTION,
                      file && !fileInvalid && !loading && "cta-ready",
                    )}
                  >
                    <Play className="mr-2 h-4 w-4 flat:hidden" />
                    {t("detector.analyzeAudio")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => file && void convertToBase64(file)}
                    disabled={!file || fileInvalid || converting || normalizing}
                    className={cn("w-full sm:w-auto", ACTION_BUTTON)}
                  >
                    {converting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileJson className="mr-2 h-4 w-4 flat:hidden" />
                    )}
                    {t("detector.toBase64")}
                  </Button>
                </div>
                {(!file || fileInvalid) && !normalizing && (
                  <p className="hidden t-label text-xs normal-case tracking-normal text-muted-foreground flat:block">
                    {t("detector.analyzeHint")}
                  </p>
                )}
              </TabsContent>

              <TabsContent value="base64" className="space-y-4 flat:space-y-7">
                <div className="space-y-2 rounded-md border border-dashed border-border p-3 flat:space-y-4 flat:border-solid flat:border-rule flat:px-6 flat:py-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flat:t-label flat:text-sm">
                    {t("detector.demo")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {EXAMPLES.map((example) => {
                      const Icon = example.icon;
                      return (
                        <Button
                          key={example.id}
                          variant="secondary"
                          size="sm"
                          onClick={() => void loadExample(example)}
                          disabled={loadingExample !== null}
                        >
                          {loadingExample === example.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Icon className="mr-2 h-4 w-4" />
                          )}
                          {t(example.label)}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("detector.demoHint")}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="call-id">{t("detector.callId")}</Label>
                    <Input
                      id="call-id"
                      value={callId}
                      onChange={(e) => setCallId(e.target.value)}
                      className="font-mono text-sm"
                      spellCheck={false}
                    />
                  </div>
                  <Button variant="outline" asChild>
                    <label
                      className={cn(
                        "cursor-pointer",
                        converting && "pointer-events-none opacity-50",
                      )}
                    >
                      {converting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {t("detector.convertWav")}
                      <input
                        type="file"
                        accept={AUDIO_ACCEPT}
                        className="hidden"
                        onChange={(e) => {
                          const picked = e.target.files?.[0];
                          e.target.value = "";
                          if (picked) void convertToBase64(picked);
                        }}
                      />
                    </label>
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <Label htmlFor="audio-base64">{t("detector.base64Label")}</Label>
                    {cleanBase64 && (
                      <span className="text-xs text-muted-foreground">
                        {t("detector.base64Size", {
                          chars: cleanBase64.length.toLocaleString(),
                          mb: megabytes(cleanBase64.length),
                        })}
                      </span>
                    )}
                  </div>
                  <Textarea
                    id="audio-base64"
                    value={base64}
                    onChange={(e) => setBase64(e.target.value)}
                    placeholder={t("detector.base64Placeholder")}
                    rows={6}
                    spellCheck={false}
                    className="font-mono text-xs [overflow-wrap:anywhere]"
                  />
                  <p className="text-xs text-muted-foreground">{t("detector.base64Hint")}</p>
                </div>

                <div className="space-y-1.5">
                  <Label>{t("detector.payloadPreview")}</Label>
                  <pre className="max-h-48 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs">
                    {payloadPreview}
                  </pre>
                </div>

                <div className="flex flex-wrap gap-2 flat:grid flat:grid-cols-1 flat:gap-4 sm:flat:grid-cols-2">
                  <Button
                    onClick={analyzeBase64}
                    disabled={loading}
                    className={cn(
                      "w-full sm:w-auto",
                      ACTION_BUTTON,
                      PRIMARY_ACTION,
                      cleanBase64 && !loading && "cta-ready",
                    )}
                  >
                    <Play className="mr-2 h-4 w-4 flat:hidden" />
                    {t("detector.analyzeCall")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void copyBase64()}
                    disabled={!cleanBase64}
                    className={cn("w-full sm:w-auto", ACTION_BUTTON)}
                  >
                    <Copy className="mr-2 h-4 w-4 flat:hidden" />
                    {t("detector.copyBase64")}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="min-w-0 lg:col-span-2 flat:border-0 flat:bg-transparent lg:flat:col-span-1">
          <CardHeader
            className={cn("flex flex-row items-start justify-between gap-2", PANEL_HEADER)}
          >
            <div className="space-y-1.5">
              <CardTitle className={PANEL_TITLE}>{t("detector.result")}</CardTitle>
              <CardDescription className={PANEL_DESCRIPTION}>
                {preview
                  ? t("detector.previewDesc")
                  : shown?.simulated
                    ? t("detector.simulatedHint")
                    : t("detector.resultDesc")}
              </CardDescription>
            </div>
            {shown?.simulated && (
              <Badge
                variant="outline"
                className={cn("shrink-0 gap-1 border-primary/40 text-primary", PANEL_BADGE)}
              >
                <FlaskConical className="h-3 w-3 flat:hidden" />
                {t("detector.simulated")}
              </Badge>
            )}
            {preview && (
              <Badge
                variant="outline"
                className={cn("shrink-0 gap-1 border-primary/40 text-primary", PANEL_BADGE)}
              >
                <Eye className="h-3 w-3 flat:hidden" />
                {t("detector.previewBadge")}
              </Badge>
            )}
          </CardHeader>
          <CardContent className={cn("space-y-6 flat:space-y-8", PANEL_CONTENT)}>
            <div
              key={`${state}-${shown?.detection_id ?? shown?.call_id ?? ""}`}
              className="motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500 motion-safe:flat:zoom-in-100 motion-safe:flat:slide-in-from-bottom-2"
            >
              <ResultBadge state={state} />
              <Verdict state={state} />
            </div>
            <div
              className={cn(
                "flat:grid flat:items-center flat:gap-6 sm:flat:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]",
                state === "loading" && "animate-pulse",
              )}
            >
              <ConfidenceGauge
                value={gaugeValue}
                loading={!shown}
                size={layout === "flat" ? 300 : 260}
              />
              <div className="hidden flat:block">
                <p className="font-mono text-6xl leading-none tabular-nums md:text-7xl terminal:tracking-[0.06em] nocturne:font-display md:nocturne:text-8xl">
                  {shown ? shown.confidence.toFixed(3) : "—"}
                </p>
                <p className="mt-4 t-label text-sm text-muted-foreground">
                  {t("field.confidence")}
                </p>
                <div className="mt-6 flex flex-wrap gap-5 terminal:gap-3">
                  <VerdictChip active={state === "human"} tone="human" label={t("class.human")} />
                  <VerdictChip active={state === "ai"} tone="ai" label={t("class.ai")} />
                </div>
              </div>
            </div>
            {loading && (
              <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {uploadPhase?.phase === "uploading"
                  ? t("detector.uploadingHint", { percent: uploadPhase.percent })
                  : t("detector.loadingHint")}
              </p>
            )}

            <dl className="hidden flat:block">
              <FlatRow
                label={t("field.callId")}
                value={shown?.call_id}
                placeholder="call_5e4539a471f6"
                loading={loading}
              />
              <FlatRow
                label={`${t("field.threshold")} · ${t("field.pSyntheticShort")}`}
                value={
                  shown
                    ? `${shown.threshold !== undefined ? shown.threshold.toFixed(2) : "—"} · ${shown.p_synthetic !== undefined ? shown.p_synthetic.toFixed(4) : "—"}`
                    : undefined
                }
                placeholder="0.70 · 0.0000"
                loading={loading}
              />
              <FlatRow
                label={`${t("field.duration")} · ${t("field.format")}`}
                value={
                  shown
                    ? [
                        shown.duration_sec !== undefined
                          ? `${shown.duration_sec.toFixed(1)} s`
                          : "—",
                        shown.sample_rate ? `${shown.sample_rate} Hz · ${shown.channels} ch` : "—",
                      ].join(" · ")
                    : undefined
                }
                placeholder="0.0 s · 8000 Hz · 2 ch"
                loading={loading}
              />
              <FlatRow
                label={t("field.latency")}
                value={shown ? `${shown.latency_ms} ms` : undefined}
                placeholder="000 ms"
                loading={loading}
              />
              <FlatRow
                label="is_synthetic"
                value={
                  shown ? (
                    <span
                      className={cn(
                        "editorial:font-semibold",
                        shown.is_synthetic
                          ? "terminal:text-ai nocturne:text-ai"
                          : "terminal:text-human nocturne:text-human",
                      )}
                    >
                      {String(shown.is_synthetic)}
                      <span className="hidden editorial:hidden flat:inline">
                        {" · "}
                        {shown.is_synthetic ? t("class.ai") : t("class.human")}
                      </span>
                    </span>
                  ) : undefined
                }
                placeholder="true | false"
                loading={loading}
              />
            </dl>

            <dl className="space-y-2.5 border-t border-border pt-4 text-sm flat:hidden">
              <Row
                label={t("field.callId")}
                value={shown?.call_id}
                placeholder="call_5e4539a471f6"
                loading={loading}
              />
              <Row
                label={t("field.detector")}
                value={
                  shown ? detectorName(shown.model) : loading ? undefined : detectorName(model)
                }
                placeholder={detectorName(model)}
                loading={loading}
              />
              <Row
                label={t("field.threshold")}
                value={shown?.threshold !== undefined ? shown.threshold.toFixed(2) : undefined}
                placeholder="0.70"
                loading={loading}
              />
              <Row
                label={t("field.pSynthetic")}
                value={
                  shown
                    ? shown.p_synthetic !== undefined
                      ? shown.p_synthetic.toFixed(4)
                      : "—"
                    : undefined
                }
                placeholder="0.0000"
                loading={loading}
              />
              <Row
                label={t("field.duration")}
                value={
                  shown
                    ? shown.duration_sec !== undefined
                      ? `${shown.duration_sec.toFixed(1)} s`
                      : "—"
                    : undefined
                }
                placeholder="0.0 s"
                loading={loading}
              />
              <Row
                label={t("field.format")}
                value={
                  shown
                    ? shown.sample_rate
                      ? `${shown.sample_rate} Hz · ${shown.channels} ch`
                      : "—"
                    : undefined
                }
                placeholder="8000 Hz · 2 ch"
                loading={loading}
              />
              <Row
                label={t("field.latency")}
                value={shown ? `${shown.latency_ms} ms` : undefined}
                placeholder="000 ms"
                loading={loading}
              />
              <Row
                label={t("field.detectionId")}
                value={shown ? (shown.detection_id ?? "—") : undefined}
                placeholder="—"
                loading={loading}
              />
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">is_synthetic</dt>
                <dd>
                  {loading ? (
                    <Skeleton className="h-5 w-16 rounded-full" />
                  ) : shown ? (
                    <span className="flex items-center gap-2">
                      <code className="text-xs text-muted-foreground">
                        {String(shown.is_synthetic)}
                      </code>
                      <VerdictPill synthetic={shown.is_synthetic} />
                    </span>
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground/60">true | false</span>
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function wavIssueText(
  t: (key: TKey, vars?: Record<string, string | number>) => string,
  issue: WavIssue,
) {
  switch (issue.code) {
    case "invalid":
      return t("wav.invalid");
    case "format":
      return t("wav.format");
    case "sampleRate":
      return t("wav.sampleRate", { value: issue.value });
    case "channels":
      return t("wav.channels", { value: issue.value });
    case "duration":
      return t("wav.duration", { value: issue.value });
    case "empty":
      return t("wav.empty");
    case "tooLarge":
      return t("wav.tooLarge", { value: issue.value });
    case "unsupported":
      return t("wav.unsupported");
  }
}

/** Espaciado y tipografía de los paneles en los temas flat. */
const PANEL_HEADER = "flat:space-y-0 flat:px-6 flat:pb-8 flat:pt-10 md:flat:px-10";
const PANEL_TITLE =
  "text-base flat:text-3xl md:flat:text-4xl editorial:tracking-[-0.03em] md:nocturne:text-5xl";
const PANEL_DESCRIPTION =
  "flat:mt-3 flat:text-base flat:leading-relaxed md:flat:text-lg editorial:text-foreground/80 terminal:font-mono terminal:tracking-wide";
const PANEL_CONTENT = "flat:px-6 flat:pb-12 md:flat:px-10";
const PANEL_BADGE =
  "flat:rounded-none flat:border-rule flat:px-4 flat:py-2 flat:t-label flat:text-sm flat:text-foreground terminal:text-muted-foreground";
/**
 * Acción principal de cada pestaña (Analizar): color de CTA del tema. Deshabilitada se ve como un
 * contorno punteado, no como un botón roto, y un texto debajo explica cómo activarla.
 */
const PRIMARY_ACTION =
  "flat:border flat:border-cta flat:bg-cta flat:text-cta-foreground flat:shadow-[0_12px_32px_-14px_var(--cta)] flat:hover:bg-cta/90 flat:hover:shadow-[0_16px_36px_-12px_var(--cta)] flat:disabled:border-dashed flat:disabled:border-rule flat:disabled:bg-transparent flat:disabled:text-muted-foreground flat:disabled:opacity-100 flat:disabled:shadow-none";
const ACTION_BUTTON =
  "flat:h-auto flat:min-h-16 flat:whitespace-normal flat:px-6 flat:py-4 flat:text-base terminal:text-xl";

/** Leyenda humano / IA junto al velocímetro de los temas flat. */
function VerdictChip({
  active,
  tone,
  label,
}: {
  active: boolean;
  tone: "human" | "ai";
  label: string;
}) {
  const Icon = tone === "ai" ? Bot : User;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 t-label text-sm text-muted-foreground transition-colors duration-300",
        "terminal:border terminal:border-rule terminal:px-4 terminal:py-2.5",
        active && "text-foreground underline decoration-2 underline-offset-8 terminal:no-underline",
        active && tone === "ai" && "terminal:border-ai-border terminal:text-ai nocturne:text-ai",
        active &&
          tone === "human" &&
          "terminal:border-primary terminal:text-human nocturne:text-human",
      )}
    >
      <Icon className="size-4" />
      {label}
    </span>
  );
}

/** Fila de detalle de los temas flat: etiqueta y valor en mono separados por una regla. */
function FlatRow({
  label,
  value,
  placeholder,
  loading,
}: {
  label: string;
  value?: ReactNode;
  placeholder: string;
  loading: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-5 font-mono text-base md:text-lg">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      {loading ? (
        <Skeleton className="h-5 w-28" />
      ) : value !== undefined ? (
        <dd className="min-w-0 text-right animate-in fade-in-0 sm:truncate">{value}</dd>
      ) : (
        <dd className="truncate text-right text-muted-foreground/60">{placeholder}</dd>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  placeholder,
  loading,
}: {
  label: string;
  value?: string | undefined;
  placeholder: string;
  loading: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      {loading ? (
        <Skeleton className="h-4 w-24" />
      ) : value !== undefined ? (
        <dd className="truncate font-medium animate-in fade-in-0">{value}</dd>
      ) : (
        <dd className="truncate font-mono text-xs text-muted-foreground/60">{placeholder}</dd>
      )}
    </div>
  );
}
