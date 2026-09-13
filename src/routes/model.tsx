import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { FlaskConical, Mountain } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  CompareChart,
  ConfusionMatrix,
  EmptyChartState,
  GeneralizationChart,
  PrChart,
  RocChart,
  ScoreChart,
  StatTile,
} from "@/components/model-charts";
import { evaluationFor, type ModelDataset, type ModelInfo } from "@/lib/detection";
import { DEFAULT_DETECTOR_ID } from "@/lib/detectors.data";
import { useI18n, type TKey } from "@/lib/i18n";
import { deriveMetrics } from "@/lib/metrics";
import { modelColor } from "@/lib/model-colors";
import { modelsQueryOptions } from "@/lib/models-query";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/model")({
  head: () => ({
    meta: [
      { title: "Model — Galenia" },
      { name: "description", content: "Detectores de voz sintética y sus métricas reales." },
    ],
  }),
  component: ModelPage,
});

type StatFormat = "pct" | "decimal";

function ModelPage() {
  const { t, locale } = useI18n();
  const { data: models = [], isLoading } = useQuery(modelsQueryOptions);
  const [selectedId, setSelectedId] = useState(DEFAULT_DETECTOR_ID);
  const [dataset, setDataset] = useState<ModelDataset>("Altur");

  const selected = models.find((m) => m.id === selectedId) ?? models[0];
  const evaluation = selected ? evaluationFor(selected, dataset) : null;
  const derived = useMemo(() => deriveMetrics(evaluation), [evaluation]);

  if (isLoading || !selected) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const color = modelColor(models, selected.id);
  const recommended = models
    .filter((m) => m.rank !== null)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const experimental = models.filter((m) => m.rank === null);
  const emptyMessage = t("model.notApplicable");
  const chartKey = `${selected.id}-${dataset}`;

  const stats: { key: TKey; desc: TKey; value: number | null; format: StatFormat }[] = [
    {
      key: "metric.balanced",
      desc: "metric.balanced.desc",
      value: derived.balancedAccuracy,
      format: "pct",
    },
    { key: "metric.auc", desc: "metric.auc.desc", value: derived.auc, format: "decimal" },
    { key: "metric.f1", desc: "metric.f1.desc", value: derived.f1, format: "pct" },
    {
      key: "metric.precision",
      desc: "metric.precision.desc",
      value: derived.precision,
      format: "pct",
    },
    {
      key: "metric.fpr",
      desc: "metric.fpr.desc",
      value: derived.falsePositiveRate,
      format: "pct",
    },
    {
      key: "metric.fnr",
      desc: "metric.fnr.desc",
      value: derived.falseNegativeRate,
      format: "pct",
    },
    { key: "metric.brier", desc: "metric.brier.desc", value: derived.brier, format: "decimal" },
    {
      key: "metric.threshold",
      desc: "metric.threshold.desc",
      value: evaluation?.threshold ?? selected.threshold,
      format: "decimal",
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

      <section className="flex flex-col gap-3">
        <SectionTitle>{t("model.recommended")}</SectionTitle>
        <div className="grid gap-3 md:grid-cols-3" role="radiogroup">
          {recommended.map((m) => (
            <ModelCard
              key={m.id}
              model={m}
              models={models}
              active={m.id === selected.id}
              onSelect={() => setSelectedId(m.id)}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>{t("model.experimental")}</SectionTitle>
        <div className="grid gap-3 md:grid-cols-3" role="radiogroup">
          {experimental.map((m) => (
            <ModelCard
              key={m.id}
              model={m}
              models={models}
              active={m.id === selected.id}
              onSelect={() => setSelectedId(m.id)}
              compact
            />
          ))}
        </div>
      </section>

      {/* Filtro: modelo seleccionado + dataset. Controla todo lo que está debajo. */}
      <div className="sticky top-14 z-[5] flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            {selected.name}
            {selected.rank && (
              <span className="font-mono text-xs text-muted-foreground">#{selected.rank}</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {evaluation
              ? t("model.evaluatedOn", {
                  dataset: evaluation.dataset,
                  split: evaluation.split,
                  n: evaluation.sample_count.toLocaleString(locale),
                })
              : emptyMessage}
          </p>
        </div>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={dataset}
          onValueChange={(v) => v && setDataset(v as ModelDataset)}
          aria-label={t("model.dataset")}
        >
          <ToggleGroupItem value="Altur" className="px-3 text-xs">
            {t("model.datasetCalls")}
          </ToggleGroupItem>
          <ToggleGroupItem value="AlternativeData" className="px-3 text-xs">
            {t("model.datasetClips")}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {evaluation?.train_only_reference && (
        <p className="-mt-3 text-xs text-muted-foreground">
          {t("model.trainOnlyNote", { threshold: evaluation.threshold.toFixed(3) })}
        </p>
      )}

      <div key={`stats-${chartKey}`} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <StatTile
            key={s.key}
            label={t(s.key)}
            desc={t(s.desc)}
            value={s.value}
            format={s.format}
            pendingNote={emptyMessage}
            delay={i * 50}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title={t("chart.roc")}
          description={t("chart.rocDesc")}
          aside={
            derived.auc !== null ? (
              <Badge variant="outline">AUC {derived.auc.toFixed(3)}</Badge>
            ) : undefined
          }
        >
          {derived.auc !== null && derived.eer !== null ? (
            <RocChart key={chartKey} auc={derived.auc} eer={derived.eer} color={color} />
          ) : (
            <EmptyChartState message={emptyMessage} height={280} />
          )}
        </ChartCard>
        <ChartCard title={t("chart.pr")} description={t("chart.prDesc")}>
          {derived.auc !== null && derived.positives !== null && derived.negatives !== null ? (
            <PrChart
              key={chartKey}
              auc={derived.auc}
              positives={derived.positives}
              negatives={derived.negatives}
              color={color}
            />
          ) : (
            <EmptyChartState message={emptyMessage} height={280} />
          )}
        </ChartCard>
        <ChartCard title={t("chart.confusion")} description={t("chart.confusionDesc")}>
          {evaluation?.confusion ? (
            <ConfusionMatrix key={chartKey} confusion={evaluation.confusion} />
          ) : (
            <EmptyChartState message={emptyMessage} />
          )}
        </ChartCard>
        <ChartCard title={t("chart.scores")} description={t("chart.scoresDesc")}>
          {derived.auc !== null && derived.positives !== null && derived.negatives !== null ? (
            <ScoreChart
              key={chartKey}
              auc={derived.auc}
              positives={derived.positives}
              negatives={derived.negatives}
              threshold={evaluation?.threshold ?? selected.threshold}
            />
          ) : (
            <EmptyChartState message={emptyMessage} />
          )}
        </ChartCard>
      </div>

      <ChartCard title={t("chart.generalization")} description={t("chart.generalizationDesc")}>
        <GeneralizationChart models={models} selectedId={selected.id} />
      </ChartCard>

      <ChartCard title={t("chart.compare")} description={t("chart.compareDesc")}>
        <CompareChart models={models} selectedId={selected.id} dataset={dataset} />
      </ChartCard>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}

function ModelCard({
  model,
  models,
  active,
  onSelect,
  compact = false,
}: {
  model: ModelInfo;
  models: ModelInfo[];
  active: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  const { t, lang } = useI18n();
  const color = modelColor(models, model.id);
  const calls = evaluationFor(model, "Altur");
  const clips = evaluationFor(model, "AlternativeData");

  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary shadow-md ring-1 ring-primary"
          : "border-border opacity-85 hover:opacity-100",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {model.rank ? (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, color }}
          >
            <Mountain className="h-4 w-4" />
          </span>
        ) : (
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
        )}
        <span className="font-semibold">{model.name}</span>
        {model.rank && (
          <Badge variant="outline" className="font-mono text-[10px]">
            #{model.rank}
          </Badge>
        )}
        <span className="ml-auto flex flex-wrap gap-1.5">
          {model.available !== null && (
            <Badge
              variant="outline"
              className={
                model.available
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }
            >
              {model.available ? t("model.available") : t("model.unavailable")}
            </Badge>
          )}
          {model.experimental && (
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              {t("model.experimentalBadge")}
            </Badge>
          )}
        </span>
      </div>

      <p className={cn("text-xs text-muted-foreground", compact && "line-clamp-3")}>
        {model.description[lang]}
      </p>

      {!compact && (
        <dl className="space-y-1 text-xs">
          <Detail label={t("model.family")} value={t(`model.family.${model.family}` as TKey)} />
          <Detail label={t("model.algorithm")} value={model.algorithm[lang]} />
          <Detail label={t("model.features")} value={model.features[lang]} />
          <Detail label={t("model.trainedOn")} value={model.trained_on[lang]} />
        </dl>
      )}

      <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-2 font-mono text-[11px] text-muted-foreground">
        <span>Altur AUC {calls?.auc?.toFixed(3) ?? "—"}</span>
        <span>AltData AUC {clips?.auc?.toFixed(3) ?? "n/a"}</span>
        {model.stereo_only && <span className="font-sans">{t("model.stereoOnly")}</span>}
      </div>
    </button>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline text-muted-foreground">{label}: </dt>
      <dd className="inline">{value}</dd>
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
