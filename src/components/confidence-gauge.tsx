type Props = {
  value: number; // 0 - 1
  loading?: boolean;
  size?: number;
};

const R = 80;
const CX = 100;
const CY = 100;
const STROKE = 18;

function polar(angleDeg: number, radius = R) {
  const rad = (Math.PI * angleDeg) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

/** Velocímetro semicircular de rojo (0) a verde (1). */
export function ConfidenceGauge({ value, loading = false, size = 260 }: Props) {
  const v = Math.min(1, Math.max(0, value));
  const angle = 180 + v * 180; // 180° (izq) -> 360° (der)
  const start = polar(180);
  const end = polar(360);
  const needle = polar(angle, R - 14);
  const tip = polar(angle, R + 6);

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 200 120"
        width={size}
        height={size * 0.6}
        role="img"
        aria-label={`Confianza ${Math.round(v * 100)} por ciento`}
      >
        <defs>
          <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="oklch(0.58 0.222 27.3)" />
            <stop offset="50%" stopColor="oklch(0.78 0.16 75)" />
            <stop offset="100%" stopColor="oklch(0.62 0.16 150)" />
          </linearGradient>
        </defs>

        <path
          d={`M ${start.x} ${start.y} A ${R} ${R} 0 0 1 ${end.x} ${end.y}`}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        <path
          d={`M ${start.x} ${start.y} A ${R} ${R} 0 0 1 ${end.x} ${end.y}`}
          fill="none"
          stroke="url(#gauge-grad)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={Math.PI * R}
          strokeDashoffset={loading ? Math.PI * R : Math.PI * R * (1 - v)}
          style={{ transition: "stroke-dashoffset 800ms cubic-bezier(.22,1,.36,1)" }}
        />

        {!loading && (
          <g style={{ transition: "transform 800ms cubic-bezier(.22,1,.36,1)" }}>
            <line
              x1={CX}
              y1={CY}
              x2={tip.x}
              y2={tip.y}
              stroke="var(--color-foreground)"
              strokeWidth={3}
              strokeLinecap="round"
            />
            <circle cx={needle.x} cy={needle.y} r={0} />
            <circle cx={CX} cy={CY} r={6} fill="var(--color-foreground)" />
          </g>
        )}

        <text x={20} y={116} fontSize={9} fill="var(--color-muted-foreground)">
          0.0
        </text>
        <text x={168} y={116} fontSize={9} fill="var(--color-muted-foreground)">
          1.0
        </text>
      </svg>

      <div className="-mt-6 text-center">
        <p className="text-4xl font-semibold tabular-nums">{loading ? "—" : v.toFixed(3)}</p>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Confianza</p>
      </div>
    </div>
  );
}
