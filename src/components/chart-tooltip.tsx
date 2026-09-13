type TooltipEntry = {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
};

type Props = {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  title?: (label: string | number | undefined) => string;
  format?: (value: number, entry: TooltipEntry) => string;
};

/** Tooltip de Recharts: el valor manda, el nombre de la serie es secundario. */
export function ChartTooltip({ active, payload, label, title, format }: Props) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-36 rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-lg animate-in fade-in-0 zoom-in-95">
      {title && <p className="mb-1.5 text-muted-foreground">{title(label)}</p>}
      <ul className="space-y-1">
        {payload.map((entry) => (
          <li key={String(entry.dataKey ?? entry.name)} className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded-full" style={{ background: entry.color }} />
            <span className="font-semibold text-popover-foreground tabular-nums">
              {typeof entry.value === "number"
                ? format
                  ? format(entry.value, entry)
                  : entry.value.toFixed(3)
                : entry.value}
            </span>
            <span className="text-muted-foreground">{entry.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
