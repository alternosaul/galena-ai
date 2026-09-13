import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { Upload, Play, FileJson } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfidenceGauge } from "@/components/confidence-gauge";
import { ResultBadge, VerdictPill } from "@/components/result-badge";
import { loadApiSettings } from "@/lib/api-settings";
import { useAuth } from "@/lib/auth";
import { EXAMPLE_PAYLOAD, type DetectionResult } from "@/lib/detection";
import { useI18n } from "@/lib/i18n";
import { modelsQueryOptions } from "@/lib/models-query";
import { addDetection } from "@/lib/tigerdata";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Detector — VoxGuard" },
      {
        name: "description",
        content:
          "Envía los datos de una llamada y descubre al instante si la voz es de una IA o de una persona.",
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

function DetectorPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [model, setModel] = useState("voxguard-v2");
  const [json, setJson] = useState(EXAMPLE_PAYLOAD);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);

  const { data: models } = useQuery(modelsQueryOptions);

  useEffect(() => {
    setModel(loadApiSettings().defaultModel);
  }, []);

  async function handleResponse(res: Response) {
    const body = await res.json();
    if (!res.ok) {
      toast.error(body.error ?? t("toast.analysisError"));
      return;
    }
    setResult(body as DetectionResult);
    if (user?.preferences.autoSave !== false) addDetection(body as DetectionResult);
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
      const res = await fetch(`/api/public/detect?model=${encodeURIComponent(model)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      await handleResponse(res);
    } catch {
      toast.error(t("toast.networkError"));
    } finally {
      setLoading(false);
    }
  }

  async function analyzeAudio() {
    if (!file) {
      toast.error(t("toast.selectFile"));
      return;
    }
    const form = new FormData();
    form.append("file", file);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/public/detect/audio?model=${encodeURIComponent(model)}`, {
        method: "POST",
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
    if (dropped) setFile(dropped);
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
              {(models ?? []).map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name} v{m.version}
                </SelectItem>
              ))}
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
                  rows={12}
                  spellCheck={false}
                  className="font-mono text-xs"
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
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <Button onClick={analyzeAudio} disabled={loading} className="w-full sm:w-auto">
                  <Play className="mr-2 h-4 w-4" />
                  {t("detector.analyzeAudio")}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("detector.result")}</CardTitle>
            <CardDescription>
              {state === "idle" ? t("detector.idleHint") : t("detector.resultDesc")}
            </CardDescription>
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
                placeholder="call_00000"
                loading={loading}
              />
              <Row
                label={t("field.model")}
                value={result?.model ?? (loading ? undefined : model)}
                placeholder={model}
                loading={loading}
              />
              <Row
                label={t("field.duration")}
                value={result ? (result.duration_sec ? `${result.duration_sec}s` : "—") : undefined}
                placeholder="0.0s"
                loading={loading}
              />
              <Row
                label={t("field.source")}
                value={result ? (result.source ?? "—") : undefined}
                placeholder="inbound-pstn"
                loading={loading}
              />
              <Row
                label={t("field.latency")}
                value={result ? `${result.latency_ms} ms` : undefined}
                placeholder="000 ms"
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
      <dt className="text-muted-foreground">{label}</dt>
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
