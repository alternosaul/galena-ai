import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfidenceGauge } from "@/components/confidence-gauge";
import { ResultBadge, VerdictPill } from "@/components/result-badge";
import type { DetectionResult } from "@/lib/detection";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useClearHistory, useDetectionHistory } from "@/lib/history";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — VoxGuard" },
      { name: "description", content: "Registro de las últimas solicitudes de detección." },
    ],
  }),
  component: HistoryPage,
});

type Verdict = "all" | "ai" | "human";

function HistoryPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const historyQuery = useDetectionHistory(user?.id);
  const history = useMemo(() => historyQuery.data ?? [], [historyQuery.data]);
  const clear = useClearHistory(user?.id);
  const [query, setQuery] = useState("");
  const [verdict, setVerdict] = useState<Verdict>("all");
  const [model, setModel] = useState("all");
  const [selected, setSelected] = useState<DetectionResult | null>(null);

  const modelIds = useMemo(() => [...new Set(history.map((h) => h.model))], [history]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return history.filter(
      (h) =>
        (verdict === "all" || (verdict === "ai") === h.is_synthetic) &&
        (model === "all" || h.model === model) &&
        (!q || [h.call_id, h.model, h.source ?? ""].some((f) => f.toLowerCase().includes(q))),
    );
  }, [history, query, verdict, model]);

  const stats = useMemo(() => {
    const n = filtered.length;
    const avg = (pick: (h: DetectionResult) => number) =>
      n ? filtered.reduce((acc, h) => acc + pick(h), 0) / n : 0;
    return {
      n,
      aiRate: avg((h) => (h.is_synthetic ? 1 : 0)),
      confidence: avg((h) => h.confidence),
      latency: avg((h) => h.latency_ms),
    };
  }, [filtered]);

  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "medium" }),
    [locale],
  );

  function exportJson() {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voxguard-history-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("history.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("history.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportJson} disabled={!filtered.length}>
            <Download className="mr-2 h-4 w-4" />
            {t("history.export")}
          </Button>
          <Button
            variant="outline"
            onClick={() => clear.mutate()}
            disabled={!history.length || clear.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("history.clear")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("history.total")} value={stats.n.toLocaleString(locale)} />
        <Stat label={t("history.aiRate")} value={`${(stats.aiRate * 100).toFixed(1)}%`} />
        <Stat label={t("history.avgConfidence")} value={stats.confidence.toFixed(3)} />
        <Stat label={t("history.avgLatency")} value={`${Math.round(stats.latency)} ms`} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("history.search")}
            className="pl-9"
          />
        </div>
        <Select value={verdict} onValueChange={(v) => setVerdict(v as Verdict)}>
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("history.filterAll")}</SelectItem>
            <SelectItem value="ai">{t("class.ai")}</SelectItem>
            <SelectItem value="human">{t("class.human")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("history.allModels")}</SelectItem>
            {modelIds.map((id) => (
              <SelectItem key={id} value={id}>
                {id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden py-0">
        <CardContent className="p-0">
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-[1] bg-muted/80 backdrop-blur">
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("field.time")}</TableHead>
                  <TableHead>{t("field.callId")}</TableHead>
                  <TableHead>{t("field.model")}</TableHead>
                  <TableHead>{t("field.result")}</TableHead>
                  <TableHead className="text-right">{t("field.confidence")}</TableHead>
                  <TableHead className="text-right">{t("field.latency")}</TableHead>
                  <TableHead>{t("field.source")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((h) => (
                  <TableRow
                    key={`${h.call_id}-${h.received_at}`}
                    tabIndex={0}
                    onClick={() => setSelected(h)}
                    onKeyDown={(e) => e.key === "Enter" && setSelected(h)}
                    className="cursor-pointer font-mono text-xs focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <TableCell
                      className="whitespace-nowrap text-muted-foreground"
                      suppressHydrationWarning
                    >
                      {timeFormat.format(new Date(h.received_at))}
                    </TableCell>
                    <TableCell className="font-medium">{h.call_id}</TableCell>
                    <TableCell>{h.model}</TableCell>
                    <TableCell>
                      <VerdictPill synthetic={h.is_synthetic} />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center justify-end gap-2">
                        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                          <span
                            className={cn(
                              "block h-full rounded-full",
                              h.is_synthetic ? "bg-destructive" : "bg-success",
                            )}
                            style={{ width: `${h.confidence * 100}%` }}
                          />
                        </span>
                        {h.confidence.toFixed(3)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{h.latency_ms} ms</TableCell>
                    <TableCell className="text-muted-foreground">{h.source ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {!filtered.length && (
              <p className="px-6 py-16 text-center text-sm text-muted-foreground">
                {historyQuery.isPending
                  ? t("history.loading")
                  : historyQuery.isError
                    ? t("history.loadError")
                    : history.length
                      ? t("history.noMatches")
                      : t("history.empty")}
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            <span>{t("history.showing", { shown: filtered.length, total: history.length })}</span>
            <span>{t("history.sampleNote")}</span>
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{t("history.detail")}</SheetTitle>
                <SheetDescription className="font-mono">{selected.call_id}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <ResultBadge state={selected.is_synthetic ? "ai" : "human"} />
                <ConfidenceGauge value={selected.confidence} size={220} />
                <dl className="space-y-2 border-t border-border pt-4 text-sm">
                  <DetailRow
                    label={t("field.time")}
                    value={timeFormat.format(new Date(selected.received_at))}
                  />
                  <DetailRow label={t("field.model")} value={selected.model} />
                  <DetailRow
                    label={t("field.duration")}
                    value={selected.duration_sec !== undefined ? `${selected.duration_sec}s` : "—"}
                  />
                  <DetailRow label={t("field.source")} value={selected.source ?? "—"} />
                  <DetailRow label={t("field.latency")} value={`${selected.latency_ms} ms`} />
                </dl>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                    {t("history.raw")}
                  </p>
                  <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                    {JSON.stringify(selected, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-1 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
