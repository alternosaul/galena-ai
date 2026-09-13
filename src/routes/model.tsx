import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { FlaskConical } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CompareChart,
  ConfusionMatrix,
  PrChart,
  RocChart,
  ScoreChart,
  StatTile,
  TrendChart,
} from "@/components/model-charts";
import type { ModelInfo } from "@/lib/detection";
import { useI18n, type TKey } from "@/lib/i18n";
import { deriveMetrics } from "@/lib/metrics";
import { modelColor, modelsQueryOptions } from "@/lib/models-query";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/model")({
  head: () => ({
    meta: [
      { title: "Model — VoxGuard" },
      { name: "description", content: "Métricas de rendimiento de los modelos de detección." },
    ],
  }),
  component: ModelPage,
});

const STATUS_STYLE: Record<ModelInfo["status"], string> = {
  active: "bg-success/15 text-success border-success/30",
  beta: "bg-primary/15 text-primary border-primary/30",
  deprecated: "bg-muted text-muted-foreground border-border",
};

function ModelPage() {
  const { t, lang } = useI18n();
  const { data: models = [], isLoading } = useQuery(modelsQueryOptions);
  const [selectedId, setSelectedId] = useState("voxguard-v2");

  const selected = models.find((m) => m.id === selectedId) ?? models[0];
  const derived = useMemo(() => (selected ? deriveMetrics(selected.metrics) : null), [selected]);

  if (isLoading || !selected || !derived) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const color = modelColor(models, selected.id);

  const stats: { key: TKey; desc: TKey; value: number; format: "pct" | "decimal" | "ms" }[] = [
    {
      key: "metric.accuracy",
      desc: "metric.accuracy.desc",
      value: derived.accuracy,
      format: "pct",
    },
    {
      key: "metric.precision",
      desc: "metric.precision.desc",
      value: derived.precision,
      format: "pct",
    },
    { key: "metric.recall", desc: "metric.recall.desc", value: derived.recall, format: "pct" },
    { key: "metric.f1", desc: "metric.f1.desc", value: derived.f1, format: "pct" },
    { key: "metric.auc", desc: "metric.auc.desc", value: derived.auc, format: "decimal" },
    { key: "metric.eer", desc: "metric.eer.desc", value: derived.eer, format: "pct" },
    { key: "metric.mcc", desc: "metric.mcc.desc", value: derived.mcc, format: "decimal" },
    {
      key: "metric.latency",
      desc: "metric.latency.desc",
      value: selected.metrics.avg_latency_ms,
      format: "ms",
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("model.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("model.subtitle")}</p>
        </div>
        <p className="flex max-w-md items-start gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          {t("model.placeholderNote")}
        </p>
      </div>

      {/* Selector de modelo: filtra todo lo que está debajo */}
      <div className="grid gap-3 md:grid-cols-3" role="radiogroup">
        {models.map((m) => {
          const active = m.id === selected.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelectedId(m.id)}
              className={cn(
                "flex flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-primary shadow-md ring-1 ring-primary"
                  : "border-border opacity-80 hover:opacity-100",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: modelColor(models, m.id) }}
                />
                <span className="font-semibold">{m.name}</span>
                <span className="font-mono text-xs text-muted-foreground">v{m.version}</span>
                <Badge variant="outline" className={cn("ml-auto", STATUS_STYLE[m.status])}>
                  {t(`status.${m.status}` as TKey)}
                </Badge>
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">{m.description[lang]}</p>
              <p className="text-xs">
                <span className="text-muted-foreground">{t("model.trainedOn")}:</span>{" "}
                {m.trained_on[lang]}
              </p>
            </button>
          );
        })}
      </div>

      <div key={`stats-${selected.id}`} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <StatTile
            key={s.key}
            label={t(s.key)}
            desc={t(s.desc)}
            value={s.value}
            format={s.format}
            delay={i * 50}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title={t("chart.roc")}
          description={t("chart.rocDesc")}
          aside={<Badge variant="outline">AUC {derived.auc.toFixed(3)}</Badge>}
        >
          <RocChart key={selected.id} auc={derived.auc} eer={derived.eer} color={color} />
        </ChartCard>
        <ChartCard title={t("chart.pr")} description={t("chart.prDesc")}>
          <PrChart
            key={selected.id}
            auc={derived.auc}
            positives={derived.positives}
            negatives={derived.negatives}
            color={color}
          />
        </ChartCard>
        <ChartCard title={t("chart.confusion")} description={t("chart.confusionDesc")}>
          <ConfusionMatrix key={selected.id} confusion={selected.metrics.confusion} />
        </ChartCard>
        <ChartCard title={t("chart.scores")} description={t("chart.scoresDesc")}>
          <ScoreChart
            key={selected.id}
            auc={derived.auc}
            positives={derived.positives}
            negatives={derived.negatives}
          />
        </ChartCard>
      </div>

      <ChartCard title={t("chart.history")} description={t("chart.historyDesc")}>
        <TrendChart models={models} selectedId={selected.id} />
      </ChartCard>

      <ChartCard title={t("chart.compare")} description={t("chart.compareDesc")}>
        <CompareChart models={models} selectedId={selected.id} />
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  description,
  aside,
  children,
}: {
  title: string;
  description: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="space-y-1.5">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {aside}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
