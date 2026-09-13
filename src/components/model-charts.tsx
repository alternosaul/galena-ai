import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
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
import type { ModelInfo, ModelMetrics } from "@/lib/detection";
import { useI18n, type TKey } from "@/lib/i18n";
import { deriveMetrics, prCurve, rocCurve, scoreDistribution } from "@/lib/metrics";
import { modelColor } from "@/lib/models-query";
import { cn } from "@/lib/utils";

/*
 * Colores de serie: --series-1..3 en styles.css, validados con el checker de
 * paletas (CVD ΔE ≥ 19 claro/oscuro). El color sigue a la entidad (posición
 * del modelo en el catálogo), nunca al ranking. IA/Humano usan los tokens de
 * estado destructive/success, igual que el resto de la app.
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
  delay = 0,
}: {
  label: string;
  desc: string;
  value: number;
  format: StatFormat;
  delay?: number;
}) {
  const animated = useCountUp(value);
  const text =
    format === "pct"
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
          <TooltipContent className="max-w-60">{desc}</TooltipContent>
        </Tooltip>
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{text}</p>
    </div>
  );
}

// ── Curva ROC ────────────────────────────────────────────────────────────────

export function RocChart({ auc, eer, color }: { auc: number; eer: number; color: string }) {
  const { t } = useI18n();
  const data = useMemo(() => rocCurve(auc), [auc]);

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
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Curva Precisión-Recall ───────────────────────────────────────────────────

export function PrChart({
  auc,
  positives,
  negatives,
  color,
}: {
  auc: number;
  positives: number;
  negatives: number;
  color: string;
}) {
  const { t } = useI18n();
  const data = useMemo(() => prCurve(auc, positives, negatives), [auc, positives, negatives]);
  const baseline = positives / (positives + negatives);

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
        <YAxis type="number" domain={[0, 1]} ticks={UNIT_TICKS} width={40} {...AXIS} />
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

export function ConfusionMatrix({ confusion }: { confusion: ModelMetrics["confusion"] }) {
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

export function ScoreChart({
  auc,
  positives,
  negatives,
}: {
  auc: number;
  positives: number;
  negatives: number;
}) {
  const { t, locale } = useI18n();
  const data = useMemo(
    () => scoreDistribution(auc, positives, negatives),
    [auc, positives, negatives],
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
          <YAxis width={44} {...AXIS} tickFormatter={(v: number) => v.toLocaleString(locale)} />
          <ReferenceLine
            x={0.5}
            stroke="var(--color-foreground)"
            strokeOpacity={0.5}
            label={{
              value: `${t("chart.threshold")} 0.5`,
              position: "insideTopRight",
              ...AXIS_LABEL,
            }}
          />
          <ChartTip
            cursor={{ stroke: "var(--color-muted-foreground)", strokeWidth: 1 }}
            content={
              <ChartTooltip
                title={(l) => `${t("chart.score")} ≈ ${Number(l).toFixed(2)}`}
                format={(v) => `${v.toLocaleString(locale)} ${t("chart.calls").toLowerCase()}`}
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

// ── Evolución mensual ────────────────────────────────────────────────────────

type TrendMetric = "accuracy" | "f1" | "auc";
const TREND_LABELS: Record<TrendMetric, TKey> = {
  accuracy: "metric.accuracy",
  f1: "metric.f1",
  auc: "metric.auc",
};

export function TrendChart({ models, selectedId }: { models: ModelInfo[]; selectedId: string }) {
  const { t, locale } = useI18n();
  const [metric, setMetric] = useState<TrendMetric>("accuracy");

  const data = useMemo(() => {
    const months = [
      ...new Set(models.flatMap((m) => m.metrics.history.map((h) => h.month))),
    ].sort();
    return months.map((month) => {
      const row: Record<string, string | number> = { month };
      for (const m of models) {
        const point = m.metrics.history.find((h) => h.month === month);
        if (point) row[m.id] = point[metric];
      }
      return row;
    });
  }, [models, metric]);

  const monthFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit" }),
    [locale],
  );
  const formatMonth = (month: string | number) =>
    monthFormat.format(new Date(`${month}-15T00:00:00Z`));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Legend
          line
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
          onValueChange={(v) => v && setMetric(v as TrendMetric)}
          aria-label={t("chart.metric")}
        >
          {(Object.keys(TREND_LABELS) as TrendMetric[]).map((k) => (
            <ToggleGroupItem key={k} value={k} className="px-3 text-xs">
              {t(TREND_LABELS[k])}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="month"
            {...AXIS}
            tickFormatter={formatMonth}
            padding={{ left: 12, right: 12 }}
          />
          <YAxis
            width={44}
            {...AXIS}
            domain={[(min: number) => Math.floor((min - 0.02) * 50) / 50, 1]}
            tickFormatter={(v: number) => v.toFixed(2)}
          />
          <ChartTip
            cursor={{ stroke: "var(--color-muted-foreground)", strokeWidth: 1 }}
            content={
              <ChartTooltip title={(l) => `${t(TREND_LABELS[metric])} · ${formatMonth(l ?? "")}`} />
            }
          />
          {models.map((m, i) => {
            const active = m.id === selectedId;
            return (
              <Line
                key={`${m.id}-${metric}`}
                type="monotone"
                dataKey={m.id}
                name={m.name}
                stroke={modelColor(models, m.id)}
                strokeWidth={active ? 3 : 1.75}
                strokeOpacity={active ? 1 : 0.45}
                dot={{
                  r: active ? 4 : 3,
                  strokeWidth: 2,
                  stroke: "var(--color-card)",
                  fill: modelColor(models, m.id),
                }}
                activeDot={{ r: 6, stroke: "var(--color-card)", strokeWidth: 2 }}
                {...ANIMATION}
                animationBegin={i * 150}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Comparación de modelos ───────────────────────────────────────────────────

const COMPARE_METRICS = ["accuracy", "precision", "recall", "f1", "auc", "mcc"] as const;

export function CompareChart({ models, selectedId }: { models: ModelInfo[]; selectedId: string }) {
  const { t } = useI18n();
  const [view, setView] = useState<"chart" | "table">("chart");

  const derived = useMemo(
    () => models.map((m) => ({ model: m, d: deriveMetrics(m.metrics) })),
    [models],
  );
  const data = useMemo(
    () =>
      COMPARE_METRICS.map((key) => {
        const row: Record<string, string | number> = { metric: t(`metric.${key}` as TKey) };
        for (const { model, d } of derived) row[model.id] = Number(d[key].toFixed(4));
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
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data}
            margin={{ top: 10, right: 8, bottom: 4, left: 4 }}
            barGap={2}
            barCategoryGap="22%"
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
                key={m.id}
                dataKey={m.id}
                name={m.name}
                fill={modelColor(models, m.id)}
                fillOpacity={m.id === selectedId ? 1 : 0.5}
                radius={[4, 4, 0, 0]}
                maxBarSize={30}
                {...ANIMATION}
                animationBegin={i * 120}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
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
                      {Number(row[m.id]).toFixed(3)}
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
