import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  FlaskConical,
  Loader2,
  PlugZap,
  RotateCcw,
  Save,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEFAULT_API_SETTINGS,
  loadApiSettings,
  saveApiSettings,
  type ApiSettings,
} from "@/lib/api-settings";
import { EXAMPLE_PAYLOAD } from "@/lib/detection";
import { useI18n, type TKey } from "@/lib/i18n";
import type { ModelApiHealth } from "@/lib/model-api";
import { modelsQueryOptions } from "@/lib/models-query";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/api-config")({
  head: () => ({
    meta: [
      { title: "API — VoxGuard" },
      { name: "description", content: "Configuración de la conexión a la API de modelos." },
    ],
  }),
  component: ApiConfigPage,
});

const ENDPOINTS: { method: "GET" | "POST"; path: string; desc: TKey }[] = [
  { method: "POST", path: "/api/public/detect", desc: "ep.detect" },
  { method: "POST", path: "/api/public/detect/audio", desc: "ep.audio" },
  { method: "GET", path: "/api/public/models", desc: "ep.models" },
  { method: "GET", path: "/api/public/health", desc: "ep.health" },
];

const EXAMPLE_RESPONSE = `{
  "call_id": "call_0a9c546208d1",
  "is_synthetic": false,
  "confidence": 0.1034,
  "model": "baseline",
  "threshold": 0.7,
  "detection_id": "2f1c7d0e-5a8b-4f7e-9d1a-3c6b8e2f4a10",
  "latency_ms": 842,
  "received_at": "2026-09-13T18:22:05.114Z",
  "source": "api",
  "duration_sec": 74.5,
  "sample_rate": 8000,
  "channels": 2
}`;

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; ms: number; mode: ModelApiHealth["mode"]; detectors: string[] }
  | { status: "fail"; message: string | null };

function ApiConfigPage() {
  const { t } = useI18n();
  const { data: models = [] } = useQuery(modelsQueryOptions);
  const [settings, setSettings] = useState<ApiSettings>(DEFAULT_API_SETTINGS);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [test, setTest] = useState<TestState>({ status: "idle" });
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setSettings(loadApiSettings());
    setOrigin(window.location.origin);
  }, []);

  function update<K extends keyof ApiSettings>(key: K, value: ApiSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  function save() {
    saveApiSettings(settings);
    toast.success(t("api.saved"));
  }

  function reset() {
    setSettings(DEFAULT_API_SETTINGS);
    saveApiSettings(DEFAULT_API_SETTINGS);
    setTest({ status: "idle" });
  }

  async function testConnection() {
    setTest({ status: "testing" });
    const started = performance.now();
    try {
      const res = await fetch("/api/public/health", {
        signal: AbortSignal.timeout(settings.timeoutSec * 1000),
      });
      const health = (await res.json()) as ModelApiHealth;
      if (!res.ok || !health.ok) {
        setTest({ status: "fail", message: health.error });
        return;
      }
      setTest({
        status: "ok",
        ms: Math.round(performance.now() - started),
        mode: health.mode,
        detectors: health.available_detectors,
      });
    } catch {
      setTest({ status: "fail", message: null });
    }
  }

  const detectorName = (id: string) => models.find((m) => m.id === id)?.name ?? id;

  const curl = `# JSON (mismo contrato que la API de modelos)
curl -X POST "${origin}/api/public/detect?detector=${settings.defaultModel}" \\
  -H "Content-Type: application/json" \\
  -d @call.json

# Archivo WAV (estéreo, 8 kHz, PCM 16 bits)
curl -X POST "${origin}/api/public/detect/audio?detector=${settings.defaultModel}" \\
  -F "file=@call_0a9c546208d1.wav"`;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("api.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("api.subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
            <div className="space-y-1.5">
              <CardTitle className="text-base">{t("api.connection")}</CardTitle>
              <CardDescription>{t("api.connectionDesc")}</CardDescription>
            </div>
            <TestBadge state={test} />
          </CardHeader>
          <CardContent className="space-y-5">
            <Field label={t("api.baseUrl")} hint={t("api.baseUrlHint")} htmlFor="base-url">
              <Input
                id="base-url"
                value={settings.baseUrl}
                onChange={(e) => update("baseUrl", e.target.value)}
                className="font-mono text-sm"
                spellCheck={false}
              />
            </Field>

            <Field label={t("api.apiKey")} hint={t("api.apiKeyHint")} htmlFor="api-key">
              <div className="relative">
                <Input
                  id="api-key"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-••••••••••••"
                  className="pr-10 font-mono text-sm"
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2"
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? t("api.hide") : t("api.show")}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={`${t("api.timeout")} · ${settings.timeoutSec}s`}>
                <Slider
                  min={1}
                  max={60}
                  step={1}
                  value={[settings.timeoutSec]}
                  onValueChange={([v]) => update("timeoutSec", v ?? settings.timeoutSec)}
                  className="py-2"
                />
              </Field>
              <Field label={t("api.retries")}>
                <Select
                  value={String(settings.retries)}
                  onValueChange={(v) => update("retries", Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("api.defaultModel")}>
                <Select
                  value={settings.defaultModel}
                  onValueChange={(v) => update("defaultModel", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} v{m.version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("api.inputFormat")}>
                <Select
                  value={settings.inputFormat}
                  onValueChange={(v) => update("inputFormat", v as ApiSettings["inputFormat"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">{t("api.formatJson")}</SelectItem>
                    <SelectItem value="multipart">{t("api.formatMultipart")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {test.status === "ok" && (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs animate-in fade-in-0">
                <p>
                  <span className="text-muted-foreground">{t("api.healthDetectors")}:</span>{" "}
                  {test.detectors.length ? test.detectors.map(detectorName).join(", ") : "—"}
                </p>
                {test.mode === "simulated" && (
                  <p className="mt-1 text-muted-foreground">{t("api.notConfigured")}</p>
                )}
              </div>
            )}
            {test.status === "fail" && test.message && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {test.message}
              </p>
            )}

            <div className="flex flex-wrap gap-2 border-t border-border pt-5">
              <Button onClick={save}>
                <Save className="mr-2 h-4 w-4" />
                {t("api.save")}
              </Button>
              <Button
                variant="outline"
                onClick={testConnection}
                disabled={test.status === "testing"}
              >
                {test.status === "testing" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlugZap className="mr-2 h-4 w-4" />
                )}
                {test.status === "testing" ? t("api.testing") : t("api.test")}
              </Button>
              <Button variant="ghost" onClick={reset} className="ml-auto">
                <RotateCcw className="mr-2 h-4 w-4" />
                {t("api.reset")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("api.endpoints")}</CardTitle>
            <CardDescription>{t("api.endpointsDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ENDPOINTS.map((ep) => (
              <div key={ep.path} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-mono text-[10px]",
                      ep.method === "POST"
                        ? "border-primary text-primary"
                        : "border-success text-success",
                    )}
                  >
                    {ep.method}
                  </Badge>
                  <code className="min-w-0 flex-1 truncate text-xs">{ep.path}</code>
                  <CopyButton text={`${origin}${ep.path}`} />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{t(ep.desc)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("api.example")}</CardTitle>
          <CardDescription>{t("api.exampleDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="request">
            <TabsList className="mb-3">
              <TabsTrigger value="request">{t("api.request")}</TabsTrigger>
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="response">{t("api.response")}</TabsTrigger>
            </TabsList>
            <TabsContent value="request">
              <CodeBlock code={EXAMPLE_PAYLOAD} />
            </TabsContent>
            <TabsContent value="curl">
              <CodeBlock code={curl} />
            </TabsContent>
            <TabsContent value="response">
              <CodeBlock code={EXAMPLE_RESPONSE} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TestBadge({ state }: { state: TestState }) {
  const { t } = useI18n();
  if (state.status === "ok" && state.mode === "simulated")
    return (
      <Badge
        variant="outline"
        className="gap-1 border-primary/40 text-primary animate-in fade-in-0 zoom-in-95"
      >
        <FlaskConical className="h-3 w-3" />
        {t("api.modeSimulated")}
      </Badge>
    );
  if (state.status === "ok")
    return (
      <Badge className="gap-1 bg-success text-success-foreground animate-in fade-in-0 zoom-in-95">
        <Check className="h-3 w-3" />
        {t("api.testOk", { ms: state.ms })}
      </Badge>
    );
  if (state.status === "fail")
    return (
      <Badge variant="destructive" className="gap-1 animate-in fade-in-0 zoom-in-95">
        <X className="h-3 w-3" />
        {t("api.testFail")}
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {state.status === "testing" ? t("api.testing") : t("api.notTested")}
    </Badge>
  );
}

function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      // navigator.clipboard solo existe en contextos seguros (HTTPS o localhost).
      if (navigator.clipboard) await navigator.clipboard.writeText(text);
      else copyWithTextarea(text);
      setCopied(true);
      toast.success(t("api.copied"));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // portapapeles no disponible
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={copy}
      aria-label={t("api.copy")}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

/** Respaldo para HTTP plano: copia mediante un textarea temporal. */
function copyWithTextarea(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!ok) throw new Error("copy command failed");
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 pr-12 font-mono text-xs leading-relaxed [overflow-wrap:anywhere]">
        {code}
      </pre>
      <div className="absolute right-2 top-2">
        <CopyButton text={code} />
      </div>
    </div>
  );
}
