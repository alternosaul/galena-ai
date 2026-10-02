import { useI18n } from "@/lib/i18n";

type Props = {
  value: number; // 0 - 1
  loading?: boolean;
  size?: number;
};

const R = 80;
const CX = 100;
const CY = 100;

function polar(angleDeg: number, radius = R) {
  const rad = (Math.PI * angleDeg) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

/**
 * Velocímetro semicircular. Los colores y el grosor salen del tema (--gauge-* en src/styles.css):
 * en los temas clásicos va de rojo (0) a verde (1); en los flat, de verde (humano) a rojo (IA).
 * En los temas flat el número se muestra fuera, junto al velocímetro.
 */
export function ConfidenceGauge({ value, loading = false, size = 260 }: Props) {
  const { t } = useI18n();
  const v = Math.min(1, Math.max(0, value));
  const angle = 180 + v * 180; // 180° (izq) -> 360° (der)
  const start = polar(180);
  const end = polar(360);
  const tip = polar(angle, R + 6);
  const arc = `M ${start.x} ${start.y} A ${R} ${R} 0 0 1 ${end.x} ${end.y}`;

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 200 120"
        width={size}
        height={size * 0.6}
        role="img"
        aria-label={`${t("field.confidence")} ${Math.round(v * 100)}%`}
        className="max-w-full"
      >
        <defs>
          <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: "var(--gauge-start)" }} />
            <stop offset="50%" style={{ stopColor: "var(--gauge-mid)" }} />
            <stop offset="100%" style={{ stopColor: "var(--gauge-end)" }} />
          </linearGradient>
        </defs>

        <path
          d={arc}
          fill="none"
          stroke="var(--gauge-track)"
          strokeLinecap="round"
          style={{ strokeWidth: "calc(var(--gauge-stroke) + 6px)" }}
          className="hidden flat:block"
        />
        <path
          d={arc}
          fill="none"
          stroke="var(--color-muted)"
          strokeLinecap="round"
          style={{ strokeWidth: "var(--gauge-stroke)" }}
          className="flat:hidden"
        />
        <path
          d={arc}
          fill="none"
          stroke="url(#gauge-grad)"
          strokeLinecap="round"
          strokeDasharray={Math.PI * R}
          strokeDashoffset={loading ? Math.PI * R : Math.PI * R * (1 - v)}
          style={{
            strokeWidth: "var(--gauge-stroke)",
            transition: "stroke-dashoffset 800ms cubic-bezier(.22,1,.36,1)",
          }}
        />

        {!loading && (
          <g>
            <line
              x1={CX}
              y1={CY}
              x2={tip.x}
              y2={tip.y}
              stroke="var(--color-foreground)"
              strokeWidth={3}
              strokeLinecap="round"
            />
            <circle
              cx={CX}
              cy={CY}
              r={6}
              fill="var(--color-foreground)"
              className="flat:fill-background flat:stroke-foreground flat:[stroke-width:3px]"
            />
          </g>
        )}

        <text
          x={20}
          y={116}
          fontSize={9}
          fill="var(--color-muted-foreground)"
          className="flat:font-mono"
        >
          0.0
        </text>
        <text
          x={168}
          y={116}
          fontSize={9}
          fill="var(--color-muted-foreground)"
          className="flat:font-mono"
        >
          1.0
        </text>
      </svg>

      <div className="-mt-6 text-center flat:hidden">
        <p className="text-4xl font-semibold tabular-nums">{loading ? "—" : v.toFixed(3)}</p>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {t("field.confidence")}
        </p>
      </div>
    </div>
  );
}
