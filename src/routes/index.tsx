import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Clock,
  Copy,
  FileAudio,
  FileJson,
  FlaskConical,
  Loader2,
  Mountain,
  Play,
  Upload,
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
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfidenceGauge } from "@/components/confidence-gauge";
import { ResultBadge, VerdictPill } from "@/components/result-badge";
import { hasStoredApiSettings, loadApiSettings } from "@/lib/api-settings";
import { useAuth } from "@/lib/auth";
import { withBase } from "@/lib/base-path";
import type { DetectionResult } from "@/lib/detection";
import { DEFAULT_DETECTOR_ID } from "@/lib/detectors.data";
import { useI18n, type TKey } from "@/lib/i18n";
import { modelsQueryOptions } from "@/lib/models-query";
import { useAddToHistory } from "@/lib/history";
import { cn } from "@/lib/utils";
import {
  ALTUR_CHANNELS,
  ALTUR_SAMPLE_RATE,
  MAX_REQUEST_BYTES,
  alturWavIssues,
  base64ToBytes,
  bytesToBase64,
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
const LIMIT_MB = (MAX_REQUEST_BYTES / 1_000_000).toFixed(1);
/** Margen para la cabecera multipart al subir el archivo. */
const MAX_AUDIO_BYTES = MAX_REQUEST_BYTES - 2_000;

const megabytes = (bytes: number) => (bytes / 1_000_000).toFixed(2);

function DetectorPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [model, setModel] = useState(DEFAULT_DETECTOR_ID);
  const [tab, setTab] = useState<InputTab>("audio");
  const [callId, setCallId] = useState(DEFAULT_CALL_ID);
  const [base64, setBase64] = useState("");
  const [converting, setConverting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<WavInfo | null>(null);
  const [fileIssues, setFileIssues] = useState<WavIssue[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);

  const { data: models } = useQuery(modelsQueryOptions);
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
      const res = await fetch(
        withBase(`/api/public/detect?detector=${encodeURIComponent(model)}`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        },
      );
      await handleResponse(res);
    } catch {
      toast.error(t("toast.networkError"));
    } finally {
      setLoading(false);
    }
  }

  async function selectFile(next: File | null) {
    setFile(next);
    setFileInfo(null);
    setFileIssues([]);
    if (!next) return;
    // La cabecera WAV está al inicio; basta con leer el primer MB.
    const head = new Uint8Array(await next.slice(0, 1024 * 1024).arrayBuffer());
    const info = parseWavHeader(head);
    setFileInfo(info);
    const issues = alturWavIssues(info);
    if (next.size > MAX_AUDIO_BYTES) issues.push({ code: "tooLarge", value: Number(LIMIT_MB) });
    setFileIssues(issues);
  }

  /** Convierte un WAV válido a Base64, lo pone en el campo y abre la pestaña de Base64. */
  async function convertToBase64(source: File) {
    const head = new Uint8Array(await source.slice(0, 1024 * 1024).arrayBuffer());
    const issues = alturWavIssues(parseWavHeader(head));
    if (issues.length > 0) {
      toast.error(issues.map((issue) => wavIssueText(t, issue)).join(" · "));
      return;
    }
    setConverting(true);
    try {
      setBase64(bytesToBase64(new Uint8Array(await source.arrayBuffer())));
      setCallId(source.name.replace(/\.wav$/i, "") || DEFAULT_CALL_ID);
      setTab("base64");
      toast.success(t("toast.base64Ready"));
    } catch {
      toast.error(t("toast.convertError"));
    } finally {
      setConverting(false);
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
    const form = new FormData();
    form.append("file", file);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(
        withBase(`/api/public/detect/audio?detector=${encodeURIComponent(model)}`),
        {
          method: "POST",
          body: form,
        },
      );
      await handleResponse(res);
    } catch {
      toast.error(t("toast.networkError"));
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) void selectFile(dropped);
  }

  const state = loading ? "loading" : result ? (result.is_synthetic ? "ai" : "human") : "idle";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("detector.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("detector.subtitle")}</p>
        </div>
        <div className="w-full sm:w-64">
          <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
            {t("detector.model")}
          </Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger>
              <SelectValue placeholder={t("detector.modelPlaceholder")} />
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
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>{t("detector.experimental")}</SelectLabel>
                {(offered ?? [])
                  .filter((m) => m.rank === null)
                  .map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">{t("detector.input")}</CardTitle>
            <CardDescription>{t("detector.inputDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <FileAudio className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                {t("detector.noteWav")}
              </li>
              <li className="flex gap-2">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                {t("detector.noteColdStart")}
              </li>
            </ul>

            <Tabs value={tab} onValueChange={(value) => setTab(value as InputTab)}>
              <TabsList className="mb-4">
                <TabsTrigger value="audio">
                  <Upload className="mr-2 h-4 w-4" /> Audio
                </TabsTrigger>
                <TabsTrigger value="base64">
                  <FileJson className="mr-2 h-4 w-4" /> JSON · Base64
                </TabsTrigger>
              </TabsList>

              <TabsContent value="audio" className="space-y-3">
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-secondary/40 px-6 py-12 text-center transition-colors hover:border-primary",
                    dragging && "border-primary bg-primary/10",
                  )}
                >
                  <Upload className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">
                    {file ? file.name : t("detector.dropFile")}
                  </span>
                  <span className="text-xs text-muted-foreground">{t("detector.fileHint")}</span>
                  <input
                    type="file"
                    accept=".wav,audio/wav,audio/x-wav"
                    className="hidden"
                    onChange={(e) => void selectFile(e.target.files?.[0] ?? null)}
                  />
                </label>

                {file && fileInvalid && (
                  <ul className="space-y-1 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {fileIssues.map((issue) => (
                      <li key={issue.code} className="flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        {wavIssueText(t, issue)}
                      </li>
                    ))}
                  </ul>
                )}
                {file && !fileInvalid && fileInfo && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileAudio className="h-3.5 w-3.5 text-success" />
                    {t("detector.wavInfo", {
                      rate: fileInfo.sampleRate,
                      channels: fileInfo.channels,
                      duration: fileInfo.durationSec.toFixed(1),
                    })}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={analyzeAudio}
                    disabled={loading || !file || fileInvalid}
                    className="w-full sm:w-auto"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    {t("detector.analyzeAudio")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => file && void convertToBase64(file)}
                    disabled={!file || fileInvalid || converting}
                    className="w-full sm:w-auto"
                  >
                    {converting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileJson className="mr-2 h-4 w-4" />
                    )}
                    {t("detector.toBase64")}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="base64" className="space-y-4">
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
                        accept=".wav,audio/wav,audio/x-wav"
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

                <div className="flex flex-wrap gap-2">
                  <Button onClick={analyzeBase64} disabled={loading} className="w-full sm:w-auto">
                    <Play className="mr-2 h-4 w-4" />
                    {t("detector.analyzeCall")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void copyBase64()}
                    disabled={!cleanBase64}
                    className="w-full sm:w-auto"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    {t("detector.copyBase64")}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div className="space-y-1.5">
              <CardTitle className="text-base">{t("detector.result")}</CardTitle>
              <CardDescription>
                {state === "idle"
                  ? t("detector.idleHint")
                  : result?.simulated
                    ? t("detector.simulatedHint")
                    : t("detector.resultDesc")}
              </CardDescription>
            </div>
            {result?.simulated && (
              <Badge variant="outline" className="shrink-0 gap-1 border-primary/40 text-primary">
                <FlaskConical className="h-3 w-3" />
                {t("detector.simulated")}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <ResultBadge state={state} />
            <div className={cn(state === "loading" && "animate-pulse")}>
              <ConfidenceGauge value={result?.confidence ?? 0} loading={!result} />
            </div>
            {loading && (
              <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("detector.loadingHint")}
              </p>
            )}

            <dl className="space-y-2.5 border-t border-border pt-4 text-sm">
              <Row
                label={t("field.callId")}
                value={result?.call_id}
                placeholder="call_5e4539a471f6"
                loading={loading}
              />
              <Row
                label={t("field.detector")}
                value={
                  result ? detectorName(result.model) : loading ? undefined : detectorName(model)
                }
                placeholder={detectorName(model)}
                loading={loading}
              />
              <Row
                label={t("field.threshold")}
                value={result?.threshold !== undefined ? result.threshold.toFixed(2) : undefined}
                placeholder="0.70"
                loading={loading}
              />
              <Row
                label={t("field.pSynthetic")}
                value={
                  result
                    ? result.p_synthetic !== undefined
                      ? result.p_synthetic.toFixed(4)
                      : "—"
                    : undefined
                }
                placeholder="0.0000"
                loading={loading}
              />
              <Row
                label={t("field.duration")}
                value={
                  result
                    ? result.duration_sec !== undefined
                      ? `${result.duration_sec.toFixed(1)} s`
                      : "—"
                    : undefined
                }
                placeholder="0.0 s"
                loading={loading}
              />
              <Row
                label={t("field.format")}
                value={
                  result
                    ? result.sample_rate
                      ? `${result.sample_rate} Hz · ${result.channels} ch`
                      : "—"
                    : undefined
                }
                placeholder="8000 Hz · 2 ch"
                loading={loading}
              />
              <Row
                label={t("field.latency")}
                value={result ? `${result.latency_ms} ms` : undefined}
                placeholder="000 ms"
                loading={loading}
              />
              <Row
                label={t("field.detectionId")}
                value={result ? (result.detection_id ?? "—") : undefined}
                placeholder="—"
                loading={loading}
              />
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">is_synthetic</dt>
                <dd>
                  {loading ? (
                    <Skeleton className="h-5 w-16 rounded-full" />
                  ) : result ? (
                    <span className="flex items-center gap-2">
                      <code className="text-xs text-muted-foreground">
                        {String(result.is_synthetic)}
                      </code>
                      <VerdictPill synthetic={result.is_synthetic} />
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
  }
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
