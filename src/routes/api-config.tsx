import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Eye, EyeOff, Loader2, PlugZap, RotateCcw, Save, X } from "lucide-react";

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
import { modelsQueryOptions } from "@/lib/models-query";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/api-config")({
  head: () => ({
    meta: [
      { title: "API — VoxGuard" },
      { name: "description", content: "Configuración de la conexión al modelo." },
    ],
  }),
  component: ApiConfigPage,
});

const ENDPOINTS: { method: "GET" | "POST"; path: string; desc: TKey }[] = [
  { method: "POST", path: "/api/public/detect", desc: "ep.detect" },
  { method: "POST", path: "/api/public/detect/audio", desc: "ep.audio" },
  { method: "GET", path: "/api/public/models", desc: "ep.models" },
];

const EXAMPLE_RESPONSE = `{
  "call_id": "call_10293",
  "is_synthetic": true,
  "confidence": 0.8108,
  "model": "voxguard-v2",
  "latency_ms": 602,
  "received_at": "2026-09-12T22:48:16.189Z",
  "source": "inbound-pstn",
  "duration_sec": 74.5
}`;

type TestState =
  { status: "idle" } | { status: "testing" } | { status: "ok"; ms: number } | { status: "fail" };

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
      // TODO(backend): exponer un endpoint del servidor que pruebe `${MODEL_API_URL}/health`.
      // Por ahora se prueba el endpoint propio de la app, que responde con datos simulados.
      const res = await fetch("/api/public/models", {
        signal: AbortSignal.timeout(settings.timeoutSec * 1000),
      });
      if (!res.ok) throw new Error(String(res.status));
      setTest({ status: "ok", ms: Math.round(performance.now() - started) });
    } catch {
      setTest({ status: "fail" });
    }
  }

  const curl = `curl -X POST "${origin}/api/public/detect?model=${settings.defaultModel}" \\
  -H "Content-Type: application/json" \\
  -d @call.json`;

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
      await navigator.clipboard.writeText(text);
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

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md bg-muted p-4 pr-12 font-mono text-xs leading-relaxed">
        {code}
      </pre>
      <div className="absolute right-2 top-2">
        <CopyButton text={code} />
      </div>
    </div>
  );
}
