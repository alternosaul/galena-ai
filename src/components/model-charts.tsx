import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as ChartTip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/chart-tooltip";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCountUp } from "@/hooks/use-count-up";
import {
  evaluationFor,
  type ConfusionCounts,
  type EvaluationSubset,
  type ModelEvaluation,
  type ModelInfo,
} from "@/lib/detection";
import { useI18n, type TKey } from "@/lib/i18n";
import { deriveMetrics } from "@/lib/metrics";
import { modelColor } from "@/lib/model-colors";
import { cn } from "@/lib/utils";

/*
 * Colores de serie: --series-1..3 en styles.css (validados CVD ΔE ≥ 19 claro/oscuro) para las
 * montañas y gris atenuado para los experimentales (ver src/lib/model-colors.ts). El color sigue
 * a la entidad, nunca al ranking de una métrica. IA/Humano usan los tokens destructive/success.
 */

const AXIS = {
  tick: { fill: "var(--color-muted-foreground)", fontSize: 11 },
  axisLine: { stroke: "var(--color-border)" },
  tickLine: false,
} as const;

const AXIS_LABEL = { fill: "var(--color-muted-foreground)", fontSize: 11 };
const ANIMATION = { animationDuration: 1100, animationEasing: "ease-out" } as const;
const UNIT_TICKS = [0, 0.25, 0.5, 0.75, 1];

const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;

// ── Tarjetas de métricas ─────────────────────────────────────────────────────

type StatFormat = "pct" | "decimal" | "ms";

export function StatTile({
  label,
  desc,
  value,
  format,
  pendingNote,
  delay = 0,
}: {
  label: string;
  desc: string;
  /** null = métrica no disponible para este modelo/dataset. */
  value: number | null;
  format: StatFormat;
  pendingNote: string;
  delay?: number;
}) {
  const animated = useCountUp(value ?? 0);
  const text =
    value === null
      ? "—"
      : format === "pct"
        ? pct(animated)
        : format === "ms"
          ? `${Math.round(animated)} ms`
          : animated.toFixed(3);

  return (
    <div
      className="group rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="rounded text-muted-foreground/60 transition-colors hover:text-foreground"
              aria-label={desc}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-60">
            <p>{desc}</p>
            {value === null && <p className="mt-1 opacity-80">{pendingNote}</p>}
          </TooltipContent>
        </Tooltip>
      </div>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tracking-tight",
          value === null && "text-muted-foreground",
        )}
      >
        {text}
      </p>
    </div>
  );
}

/** Estado vacío para gráficas sin datos aplicables. */
export function EmptyChartState({ message, height = 250 }: { message: string; height?: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-6 text-center text-sm text-muted-foreground"
      style={{ height }}
    >
      <Info className="h-5 w-5" />
      <p className="max-w-sm">{message}</p>
    </div>
  );
}

// ── Curva ROC ────────────────────────────────────────────────────────────────

/** Curva ROC real, con el punto EER y el punto de operación del umbral del modelo. */
export function RocChart({
  points,
  eer,
  operating,
  color,
}: {
  points: [number, number][];
  eer: number;
  operating: { fpr: number; tpr: number } | null;
  color: string;
}) {
  const { t } = useI18n();
  const data = useMemo(() => points.map(([fpr, tpr]) => ({ fpr, tpr })), [points]);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 16, bottom: 22, left: 4 }}>
        <defs>
          <linearGradient id="roc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.35 }} />
            <stop offset="100%" style={{ stopColor: color, stopOpacity: 0.03 }} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--color-border)" />
        <XAxis
          type="number"
          dataKey="fpr"
          domain={[0, 1]}
          ticks={UNIT_TICKS}
          {...AXIS}
          label={{ value: t("chart.fpr"), position: "insideBottom", offset: -14, ...AXIS_LABEL }}
        />
        <YAxis type="number" domain={[0, 1]} ticks={UNIT_TICKS} width={40} {...AXIS} />
        <ReferenceLine
          segment={[
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ]}
          stroke="var(--color-muted-foreground)"
          strokeOpacity={0.45}
          strokeDasharray="4 4"
          label={{ value: t("chart.random"), position: "insideBottomRight", ...AXIS_LABEL }}
        />
        <ChartTip
          cursor={{ stroke: "var(--color-muted-foreground)", strokeWidth: 1 }}
          content={<ChartTooltip title={(l) => `${t("chart.fpr")}: ${Number(l).toFixed(3)}`} />}
        />
        <Area
          type="monotone"
          dataKey="tpr"
          name={t("chart.tpr")}
          stroke={color}
          strokeWidth={2}
          fill="url(#roc-fill)"
          activeDot={{ r: 5, stroke: "var(--color-card)", strokeWidth: 2 }}
          {...ANIMATION}
        />
        <ReferenceDot
          x={eer}
          y={1 - eer}
          r={5}
          fill={color}
          stroke="var(--color-card)"
          strokeWidth={2}
          label={{
            value: `EER ${pct(eer)}`,
            position: "right",
            fill: "var(--color-foreground)",
            fontSize: 11,
          }}
        />
        {operating && (
          <ReferenceDot
            x={operating.fpr}
            y={operating.tpr}
            r={5}
            fill="var(--color-card)"
            stroke={color}
            strokeWidth={2.5}
            label={{
              value: t("chart.operatingPoint"),
              position: "bottom",
              fill: "var(--color-foreground)",
              fontSize: 11,
            }}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Curva Precisión-Recall ───────────────────────────────────────────────────

/** Curva precisión-recall real; la línea base es la proporción de IA en el conjunto. */
export function PrChart({
  points,
  positives,
  negatives,
  color,
}: {
  points: [number, number][];
  positives: number;
  negatives: number;
  color: string;
}) {
  const { t } = useI18n();
  const data = useMemo(
    () => points.map(([recall, precision]) => ({ recall, precision })),
    [points],
  );
  const baseline = positives / (positives + negatives);
  // Con mucha más IA que humanos la precisión vive cerca de 1: el eje empieza bajo la línea base.
  const lowest = Math.min(baseline, ...points.map(([, precision]) => precision));
  const yMin = Math.max(0, Math.floor((lowest - 0.02) * 20) / 20);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Number((yMin + (1 - yMin) * f).toFixed(3)));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 16, bottom: 22, left: 4 }}>
        <defs>
          <linearGradient id="pr-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: color, stopOpacity: 0.03 }} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--color-border)" />
        <XAxis
          type="number"
          dataKey="recall"
          domain={[0, 1]}
          ticks={UNIT_TICKS}
          {...AXIS}
          label={{ value: "Recall", position: "insideBottom", offset: -14, ...AXIS_LABEL }}
        />
        <YAxis
          type="number"
          domain={[yMin, 1]}
          ticks={yTicks}
          width={44}
          allowDataOverflow
          {...AXIS}
          tickFormatter={(v: number) => v.toFixed(2)}
        />
        <ReferenceLine
          y={baseline}
          stroke="var(--color-muted-foreground)"
          strokeOpacity={0.45}
          strokeDasharray="4 4"
          label={{
            value: `${t("chart.baseline")} ${baseline.toFixed(2)}`,
            position: "insideBottomLeft",
            ...AXIS_LABEL,
          }}
        />
        <ChartTip
          cursor={{ stroke: "var(--color-muted-foreground)", strokeWidth: 1 }}
          content={<ChartTooltip title={(l) => `Recall: ${Number(l).toFixed(3)}`} />}
        />
        <Area
          type="monotone"
          dataKey="precision"
          name={t("metric.precision")}
          stroke={color}
          strokeWidth={2}
          fill="url(#pr-fill)"
          activeDot={{ r: 5, stroke: "var(--color-card)", strokeWidth: 2 }}
          {...ANIMATION}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Matriz de confusión ──────────────────────────────────────────────────────

export function ConfusionMatrix({ confusion }: { confusion: ConfusionCounts }) {
  const { t, locale } = useI18n();
  const { true_ai: tp, false_ai: fp, true_human: tn, false_human: fn } = confusion;
  const actualAi = tp + fn;
  const actualHuman = tn + fp;

  const rows = [
    {
      actual: t("class.ai"),
      cells: [
        { abbr: "TP", label: t("cm.tp"), value: tp, rate: tp / actualAi, cls: t("class.ai") },
        { abbr: "FN", label: t("cm.fn"), value: fn, rate: fn / actualAi, cls: t("class.ai") },
      ],
    },
    {
      actual: t("class.human"),
      cells: [
        { abbr: "FP", label: t("cm.fp"), value: fp, rate: fp / actualHuman, cls: t("class.human") },
        { abbr: "TN", label: t("cm.tn"), value: tn, rate: tn / actualHuman, cls: t("class.human") },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[auto_1fr_1fr] gap-2 text-xs">
        <div />
        <p className="text-center text-muted-foreground">
          {t("chart.predicted")}:{" "}
          <span className="font-medium text-foreground">{t("class.ai")}</span>
        </p>
        <p className="text-center text-muted-foreground">
          {t("chart.predicted")}:{" "}
          <span className="font-medium text-foreground">{t("class.human")}</span>
        </p>

        {rows.map((row, r) => (
          <div key={row.actual} className="contents">
            <p className="flex items-center justify-end pr-1 text-muted-foreground [writing-mode:vertical-rl] rotate-180 sm:rotate-0 sm:[writing-mode:horizontal-tb]">
              {t("chart.actual")}:&nbsp;
              <span className="font-medium text-foreground">{row.actual}</span>
            </p>
            {row.cells.map((cell, c) => {
              const strong = cell.rate > 0.5;
              return (
                <Tooltip key={cell.abbr}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex aspect-[4/3] flex-col items-center justify-center gap-0.5 rounded-lg outline-none transition-all duration-200 hover:scale-[1.03] hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring animate-in fade-in-0 zoom-in-90 fill-mode-both",
                        strong ? "text-primary-foreground" : "text-foreground",
                      )}
                      style={{
                        background: `color-mix(in oklab, var(--color-primary) ${Math.round(8 + cell.rate * 87)}%, var(--color-muted))`,
                        animationDelay: `${(r * 2 + c) * 90}ms`,
                        animationDuration: "500ms",
                      }}
                    >
                      <span className="text-[11px] font-semibold opacity-80">{cell.abbr}</span>
                      <span className="text-2xl font-semibold">
                        {cell.value.toLocaleString(locale)}
                      </span>
                      <span className="text-xs opacity-80">{pct(cell.rate)}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-semibold">
                      {cell.value.toLocaleString(locale)} · {cell.label}
                    </p>
                    <p className="opacity-80">
                      {t("cm.ofActual", { pct: pct(cell.rate), cls: cell.cls })}
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </div>

      <div className="ml-auto flex w-48 items-center gap-2 text-[11px] text-muted-foreground">
        0%
        <span
          className="h-2 flex-1 rounded-full"
          style={{
            background:
              "linear-gradient(to right, color-mix(in oklab, var(--color-primary) 8%, var(--color-muted)), var(--color-primary))",
          }}
        />
        100%
      </div>
    </div>
  );
}

// ── Distribución de puntajes ─────────────────────────────────────────────────

/**
 * Histograma real de P(sintético) por clase. Cada clase se muestra como porcentaje de su total:
 * hay muchas más voces de IA que humanas y con conteos la curva humana no se vería.
 */
export function ScoreChart({
  scores,
  threshold,
}: {
  scores: ModelEvaluation["scores"];
  threshold: number;
}) {
  const { t } = useI18n();
  const data = useMemo(() => {
    const humanTotal = scores.human.reduce((a, b) => a + b, 0) || 1;
    const aiTotal = scores.ai.reduce((a, b) => a + b, 0) || 1;
    return scores.human.map((human, i) => ({
      score: ((scores.bins[i] ?? 0) + (scores.bins[i + 1] ?? 1)) / 2,
      human: human / humanTotal,
      ai: (scores.ai[i] ?? 0) / aiTotal,
    }));
  }, [scores]);
  const peak = Math.max(...data.map((d) => Math.max(d.human, d.ai)));
  const step = peak > 0.4 ? 0.1 : 0.05;
  const yTicks = Array.from({ length: Math.ceil(peak / step) + 1 }, (_, i) =>
    Number((i * step).toFixed(2)),
  );

  return (
    <div className="flex flex-col gap-2">
      <Legend
        items={[
          { label: t("class.human"), color: "var(--color-success)" },
          { label: t("class.ai"), color: "var(--color-destructive)" },
        ]}
      />
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data} margin={{ top: 10, right: 16, bottom: 22, left: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis
            type="number"
            dataKey="score"
            domain={[0, 1]}
            ticks={UNIT_TICKS}
            {...AXIS}
            label={{
              value: t("chart.score"),
              position: "insideBottom",
              offset: -14,
              ...AXIS_LABEL,
            }}
          />
          <YAxis
            width={44}
            domain={[0, yTicks[yTicks.length - 1] ?? 1]}
            ticks={yTicks}
            {...AXIS}
            tickFormatter={(v: number) => pct(v, 0)}
          />
          <ReferenceLine
            x={threshold}
            stroke="var(--color-foreground)"
            strokeOpacity={0.5}
            label={{
              value: `${t("chart.threshold")} ${threshold.toFixed(2)}`,
              position: "insideTopRight",
              ...AXIS_LABEL,
            }}
          />
          <ChartTip
            cursor={{ stroke: "var(--color-muted-foreground)", strokeWidth: 1 }}
            content={
              <ChartTooltip
                title={(l) => `${t("chart.score")} ≈ ${Number(l).toFixed(3)}`}
                format={(v) => pct(v)}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="human"
            name={t("class.human")}
            stroke="var(--color-success)"
            fill="var(--color-success)"
            fillOpacity={0.18}
            strokeWidth={2}
            {...ANIMATION}
          />
          <Area
            type="monotone"
            dataKey="ai"
            name={t("class.ai")}
            stroke="var(--color-destructive)"
            fill="var(--color-destructive)"
            fillOpacity={0.18}
            strokeWidth={2}
            {...ANIMATION}
            animationBegin={200}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Generalización: subconjuntos del test ────────────────────────────────────

type GeneralizationMetric = "auc" | "balanced_accuracy";
const GENERALIZATION_LABELS: Record<GeneralizationMetric, TKey> = {
  auc: "metric.auc",
  balanced_accuracy: "metric.balanced",
};
const SUBSETS: EvaluationSubset[] = [
  "all",
  "seen_generators",
  "unseen_speakers",
  "unseen_generators",
];
const SUBSET_LABELS: Record<EvaluationSubset, TKey> = {
  all: "subset.all",
  seen_generators: "subset.seenGenerators",
  unseen_speakers: "subset.unseenSpeakers",
  unseen_generators: "subset.unseenGenerators",
};

/** Cada modelo en el test completo y en los subconjuntos con speakers o generadores nuevos. */
export function GeneralizationChart({
  models,
  selectedId,
}: {
  models: ModelInfo[];
  selectedId: string;
}) {
  const { t } = useI18n();
  const [metric, setMetric] = useState<GeneralizationMetric>("auc");

  const data = useMemo(
    () =>
      SUBSETS.map((subset) => {
        const row: Record<string, string | number> = { subset: t(SUBSET_LABELS[subset]) };
        for (const m of models) {
          const value = evaluationFor(m)?.subsets[subset]?.[metric];
          if (value !== null && value !== undefined) row[m.id] = value;
        }
        return row;
      }),
    [models, metric, t],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Legend
          items={models.map((m) => ({
            label: m.name,
            color: modelColor(models, m.id),
            muted: m.id !== selectedId,
          }))}
        />
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={metric}
          onValueChange={(v) => v && setMetric(v as GeneralizationMetric)}
          aria-label={t("chart.metric")}
        >
          {(Object.keys(GENERALIZATION_LABELS) as GeneralizationMetric[]).map((k) => (
            <ToggleGroupItem key={k} value={k} className="px-3 text-xs">
              {t(GENERALIZATION_LABELS[k])}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <ModelBars
        data={data}
        category="subset"
        models={models}
        selectedId={selectedId}
        barKey={metric}
        format={(v) => v.toFixed(3)}
      />
    </div>
  );
}

// ── Detección por generador ──────────────────────────────────────────────────

/** Porcentaje de clips clasificados correctamente por origen, con el umbral de cada modelo. */
export function GeneratorChart({
  models,
  selectedId,
}: {
  models: ModelInfo[];
  selectedId: string;
}) {
  const { t, locale } = useI18n();

  const data = useMemo(() => {
    const reference = evaluationFor(models.find((m) => m.id === selectedId) ?? models[0]!);
    const generators = [...(reference?.generators ?? [])].sort(
      (a, b) => Number(b.synthetic) - Number(a.synthetic) || b.n - a.n,
    );
    return generators.map((g) => {
      const label = g.synthetic ? g.generator : t("chart.humanVoices");
      const row: Record<string, string | number> = {
        generator: g.seen_in_training ? label : `${label} *`,
        n: g.n,
      };
      for (const m of models) {
        const value = evaluationFor(m)?.generators.find((x) => x.generator === g.generator);
        if (value) row[m.id] = value.correct_rate;
      }
      return row;
    });
  }, [models, selectedId, t]);

  return (
    <div className="flex flex-col gap-3">
      <Legend
        items={models.map((m) => ({
          label: m.name,
          color: modelColor(models, m.id),
          muted: m.id !== selectedId,
        }))}
      />
      <ModelBars
        data={data}
        category="generator"
        models={models}
        selectedId={selectedId}
        barKey="generators"
        format={(v) => pct(v)}
        tickFormatter={(v) => pct(v, 0)}
      />
      <p className="text-xs text-muted-foreground">
        {t("chart.generatorsNote", {
          n: data.reduce((sum, row) => sum + Number(row["n"] ?? 0), 0).toLocaleString(locale),
        })}
      </p>
    </div>
  );
}

/** Barras agrupadas por categoría, una por modelo (el seleccionado a opacidad completa). */
function ModelBars({
  data,
  category,
  models,
  selectedId,
  barKey,
  format,
  tickFormatter,
}: {
  data: Record<string, string | number>[];
  category: string;
  models: ModelInfo[];
  selectedId: string;
  barKey: string;
  format: (v: number) => string;
  tickFormatter?: (v: number) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data}
            margin={{ top: 10, right: 8, bottom: 4, left: 4 }}
            barGap={2}
            barCategoryGap="20%"
          >
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis dataKey={category} {...AXIS} interval={0} />
            <YAxis
              width={44}
              domain={[0, 1]}
              ticks={UNIT_TICKS}
              {...(tickFormatter ? { tickFormatter } : {})}
              {...AXIS}
            />
            <ChartTip
              cursor={{ fill: "var(--color-muted)", fillOpacity: 0.5 }}
              content={<ChartTooltip title={(l) => String(l)} format={format} />}
            />
            {models.map((m, i) => (
              <Bar
                key={`${m.id}-${barKey}`}
                dataKey={m.id}
                name={m.name}
                fill={modelColor(models, m.id)}
                fillOpacity={m.id === selectedId ? 1 : 0.6}
                radius={[4, 4, 0, 0]}
                maxBarSize={26}
                {...ANIMATION}
                animationBegin={i * 80}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Comparación de modelos ───────────────────────────────────────────────────

const COMPARE_METRICS = [
  "balancedAccuracy",
  "auc",
  "accuracy",
  "precision",
  "recall",
  "f1",
] as const;
const COMPARE_LABELS: Record<(typeof COMPARE_METRICS)[number], TKey> = {
  balancedAccuracy: "metric.balanced",
  auc: "metric.auc",
  accuracy: "metric.accuracy",
  precision: "metric.precision",
  recall: "metric.recall",
  f1: "metric.f1",
};

export function CompareChart({ models, selectedId }: { models: ModelInfo[]; selectedId: string }) {
  const { t } = useI18n();
  const [view, setView] = useState<"chart" | "table">("chart");

  const derived = useMemo(
    () => models.map((m) => ({ model: m, d: deriveMetrics(evaluationFor(m)) })),
    [models],
  );

  const data = useMemo(
    () =>
      COMPARE_METRICS.filter((key) => derived.some(({ d }) => d[key] !== null)).map((key) => {
        const row: Record<string, string | number> = { metric: t(COMPARE_LABELS[key]) };
        for (const { model, d } of derived) {
          const value = d[key];
          if (value !== null) row[model.id] = Number(value.toFixed(4));
        }
        return row;
      }),
    [derived, t],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Legend
          items={models.map((m) => ({
            label: m.name,
            color: modelColor(models, m.id),
            muted: m.id !== selectedId,
          }))}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setView((v) => (v === "chart" ? "table" : "chart"))}
        >
          {view === "chart" ? t("chart.tableView") : t("chart.chartView")}
        </Button>
      </div>

      {view === "chart" ? (
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data}
                margin={{ top: 10, right: 8, bottom: 4, left: 4 }}
                barGap={2}
                barCategoryGap="18%"
              >
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="metric" {...AXIS} />
                <YAxis width={40} domain={[0, 1]} ticks={UNIT_TICKS} {...AXIS} />
                <ChartTip
                  cursor={{ fill: "var(--color-muted)", fillOpacity: 0.5 }}
                  content={<ChartTooltip title={(l) => String(l)} />}
                />
                {models.map((m, i) => (
                  <Bar
                    key={`${m.id}-compare`}
                    dataKey={m.id}
                    name={m.name}
                    fill={modelColor(models, m.id)}
                    fillOpacity={m.id === selectedId ? 1 : 0.65}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={22}
                    {...ANIMATION}
                    animationBegin={i * 80}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("chart.metric")}</TableHead>
                {models.map((m) => (
                  <TableHead key={m.id} className="text-right">
                    {m.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={String(row["metric"])}>
                  <TableCell className="font-medium">{row["metric"]}</TableCell>
                  {models.map((m) => (
                    <TableCell key={m.id} className="text-right font-mono tabular-nums">
                      {row[m.id] === undefined ? "—" : Number(row[m.id]).toFixed(3)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Leyenda ──────────────────────────────────────────────────────────────────

function Legend({
  items,
  line = false,
}: {
  items: { label: string; color: string; muted?: boolean }[];
  line?: boolean;
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      {items.map((item) => (
        <li
          key={item.label}
          className={cn("flex items-center gap-1.5", item.muted && "text-muted-foreground")}
        >
          <span
            className={cn(line ? "h-0.5 w-4 rounded-full" : "h-2.5 w-2.5 rounded-[3px]")}
            style={{ background: item.color, opacity: item.muted ? 0.55 : 1 }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
