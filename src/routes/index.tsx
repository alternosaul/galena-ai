import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type DragEvent } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  FileAudio,
  FileJson,
  FlaskConical,
  Mountain,
  Play,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { loadApiSettings } from "@/lib/api-settings";
import { useAuth } from "@/lib/auth";
import { EXAMPLE_PAYLOAD, MAX_WAV_BYTES, type DetectionResult } from "@/lib/detection";
import { DEFAULT_DETECTOR_ID } from "@/lib/detectors.data";
import { useI18n, type TKey } from "@/lib/i18n";
import { modelsQueryOptions } from "@/lib/models-query";
import { useInvalidateHistory } from "@/lib/history";
import { authHeaders } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { alturWavIssues, parseWavHeader, type WavInfo, type WavIssue } from "@/lib/wav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Detector — VoxGuard" },
      {
        name: "description",
        content:
          "Envía una llamada y descubre al instante si la voz es de una IA o de una persona.",
      },
      { property: "og:title", content: "Detector — VoxGuard" },
      {
        property: "og:description",
        content: "Detección de voz sintética con velocímetro de confianza en tiempo real.",
      },
    ],
  }),
  component: DetectorPage,
});

type ErrorBody = { error?: string; detail?: { field: string; message: string }[] };

function DetectorPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [model, setModel] = useState(DEFAULT_DETECTOR_ID);
  const [json, setJson] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<WavInfo | null>(null);
  const [fileIssues, setFileIssues] = useState<WavIssue[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);

  const { data: models } = useQuery(modelsQueryOptions);
  const invalidateHistory = useInvalidateHistory();

  /** Token de sesión (el servidor guarda la detección a tu nombre) y preferencia de historial. */
  async function requestHeaders(): Promise<Record<string, string>> {
    return {
      ...(await authHeaders()),
      ...(user?.preferences.autoSave === false ? { "X-Galena-Save": "0" } : {}),
    };
  }

  useEffect(() => {
    setModel(loadApiSettings().defaultModel);
  }, []);

  // Si la preferencia guardada apunta a un detector inexistente, usa el predeterminado.
  useEffect(() => {
    if (models && models.length > 0 && !models.some((m) => m.id === model)) {
      setModel(models.find((m) => m.is_default)?.id ?? DEFAULT_DETECTOR_ID);
    }
  }, [models, model]);

  const detectorName = (id: string) => models?.find((m) => m.id === id)?.name ?? id;
  const fileTooLarge = file ? file.size > MAX_WAV_BYTES : false;
  const fileInvalid = fileTooLarge || fileIssues.length > 0;

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
    void invalidateHistory();
    toast.success(t("toast.success"));
  }

  async function analyzeJson() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      toast.error(t("toast.invalidJson"));
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/public/detect?detector=${encodeURIComponent(model)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await requestHeaders()) },
        body: JSON.stringify(parsed),
      });
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
    setFileIssues(alturWavIssues(info));
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
      const res = await fetch(`/api/public/detect/audio?detector=${encodeURIComponent(model)}`, {
        method: "POST",
        headers: await requestHeaders(),
        body: form,
      });
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
                {(models ?? [])
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
                {(models ?? [])
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
          <CardContent>
            <Tabs defaultValue="json">
              <TabsList className="mb-4">
                <TabsTrigger value="json">
                  <FileJson className="mr-2 h-4 w-4" /> JSON
                </TabsTrigger>
                <TabsTrigger value="audio">
                  <Upload className="mr-2 h-4 w-4" /> Audio
                </TabsTrigger>
              </TabsList>

              <TabsContent value="json" className="space-y-3">
                <Textarea
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                  placeholder={EXAMPLE_PAYLOAD}
                  rows={12}
                  spellCheck={false}
                  className="font-mono text-xs [overflow-wrap:anywhere]"
                />
                <Button onClick={analyzeJson} disabled={loading} className="w-full sm:w-auto">
                  <Play className="mr-2 h-4 w-4" />
                  {t("detector.analyzeCall")}
                </Button>
              </TabsContent>

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
                    {fileTooLarge && (
                      <li className="flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        {t("wav.tooLarge", { value: (MAX_WAV_BYTES / 1024 / 1024).toFixed(0) })}
                      </li>
                    )}
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

                <Button
                  onClick={analyzeAudio}
                  disabled={loading || !file || fileInvalid}
                  className="w-full sm:w-auto"
                >
                  <Play className="mr-2 h-4 w-4" />
                  {t("detector.analyzeAudio")}
                </Button>
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
