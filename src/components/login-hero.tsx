import type { CSSProperties, ReactNode } from "react";
import { Check } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { useI18n, type TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Alturas fijas (no aleatorias) para que SSR y cliente coincidan. */
const EQ_BARS = [
  0.35, 0.6, 0.9, 0.55, 0.75, 1, 0.65, 0.4, 0.8, 0.95, 0.5, 0.7, 0.45, 0.85, 0.6, 0.9, 0.35, 0.75,
  0.55, 1, 0.65, 0.4,
];

const FEATURES: TKey[] = ["hero.feature1", "hero.feature2", "hero.feature3"];

const HERO_MODELS = [
  { name: "VoxGuard", version: "2.4.1", color: "#ff8a4c" },
  { name: "VoxGuard Lite", version: "1.8.0", color: "#6fb6e0" },
  { name: "Prosody-X", version: "0.9.3", color: "#f0c14b" },
];

/** Mitad derecha del login: degradado de marca con bento de tarjetas "liquid glass". */
export function LoginHero() {
  const { t } = useI18n();

  return (
    <aside
      className="relative hidden overflow-hidden lg:flex lg:items-center"
      style={{
        background: "linear-gradient(140deg, #FF671F 0%, #b3400f 24%, #003049 62%, #0D1117 100%)",
      }}
    >
      {/* Manchas de luz animadas */}
      <div className="animate-blob absolute -left-24 -top-10 h-[26rem] w-[26rem] rounded-full bg-[#ff8a4c]/60 blur-3xl" />
      <div className="animate-blob absolute -bottom-24 -right-16 h-[30rem] w-[30rem] rounded-full bg-[#1d6fa3]/45 blur-3xl [animation-delay:-6s]" />
      <div className="animate-blob absolute left-1/3 top-1/2 h-72 w-72 rounded-full bg-[#EAD7D1]/25 blur-3xl [animation-delay:-12s]" />
      {/* Retícula sutil */}
      <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative z-10 mx-auto w-full max-w-2xl px-10 py-16 text-white xl:px-14">
        <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 py-1 pl-1 pr-3 text-xs font-medium backdrop-blur-md">
            <BrandLogo className="h-5 w-5" />
            VoxGuard · {t("app.tagline")}
          </span>
          <h2 className="mt-5 text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            {t("hero.title")}
          </h2>
          <p className="mt-4 max-w-md text-white/75">{t("hero.subtitle")}</p>
        </div>

        {/*
          Bento 2×2: columnas iguales y filas de altura uniforme para que bordes y
          separaciones coincidan. El flotado se aplica a toda la cuadrícula para que
          las tarjetas no se desalineen entre sí durante la animación.
        */}
        <div className="animate-float mt-10">
          <div className="grid grid-cols-2 gap-4">
            <Enter delay={150}>
              <GlassCard>
                <CardLabel>
                  {t("hero.liveResult")}
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                  </span>
                </CardLabel>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="font-mono text-sm text-white/90">call_10293</span>
                  <span className="rounded-full border border-emerald-200/40 bg-emerald-400/25 px-2.5 py-0.5 text-xs font-semibold">
                    {t("class.human")}
                  </span>
                </div>
                <div className="mt-4 flex h-10 items-end gap-[3px]" aria-hidden="true">
                  {EQ_BARS.map((h, i) => (
                    <span
                      key={i}
                      className="animate-eq w-full rounded-full bg-white/70"
                      style={{ height: `${h * 100}%`, animationDelay: `${-i * 0.11}s` }}
                    />
                  ))}
                </div>
                <div className="mt-auto flex items-center gap-3 pt-4">
                  <span className="text-2xl font-semibold">0.887</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
                    <span className="block h-full w-[88.7%] rounded-full bg-emerald-300" />
                  </span>
                </div>
              </GlassCard>
            </Enter>

            <Enter delay={250}>
              <GlassCard>
                <CardLabel>
                  {t("hero.models")}
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal">
                    {HERO_MODELS.length}
                  </span>
                </CardLabel>
                <ul className="mt-auto space-y-2.5 pt-4">
                  {HERO_MODELS.map((m) => (
                    <li key={m.name} className="flex items-center gap-2.5 text-sm">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: m.color }}
                      />
                      <span className="truncate font-medium">{m.name}</span>
                      <span className="ml-auto font-mono text-xs text-white/65">v{m.version}</span>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </Enter>

            <Enter delay={350}>
              <GlassCard>
                <dl className="flex h-full flex-col justify-between gap-3">
                  <Stat label={t("hero.accuracy")} value="95.0%" />
                  <Stat label="AUC-ROC" value="0.984" />
                  <Stat label={t("hero.latency")} value="312 ms" />
                </dl>
              </GlassCard>
            </Enter>

            <Enter delay={450}>
              <GlassCard>
                <p className="text-sm font-semibold">{t("hero.featuresTitle")}</p>
                <ul className="mt-auto space-y-2.5 pt-3 text-sm text-white/85">
                  {FEATURES.map((key) => (
                    <li key={key} className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/20">
                        <Check className="h-3 w-3" />
                      </span>
                      {t(key)}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </Enter>
          </div>
        </div>
      </div>
    </aside>
  );
}

/** Tarjeta de vidrio que ocupa toda la celda; el contenido es una columna flex. */
function GlassCard({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-full overflow-hidden rounded-2xl border border-white/25 bg-white/10 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_24px_60px_-20px_rgba(0,0,0,0.55)] backdrop-blur-xl backdrop-saturate-150">
      {/* Reflejo del vidrio */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/30 via-white/[0.04] to-transparent" />
      <div className="pointer-events-none absolute -left-1/4 -top-3/4 h-full w-[150%] rotate-12 bg-gradient-to-b from-white/25 to-transparent opacity-40 blur-2xl" />
      <div className="relative flex h-full flex-col">{children}</div>
    </div>
  );
}

function CardLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs uppercase tracking-wider text-white/70">
      {children}
    </div>
  );
}

/** Animación de entrada por tarjeta, en un contenedor que llena la celda del grid. */
function Enter({ delay, children }: { delay: number; children: ReactNode }) {
  const style: CSSProperties = { animationDelay: `${delay}ms` };
  return (
    <div
      className={cn(
        "h-full animate-in fade-in-0 slide-in-from-bottom-6 fill-mode-both duration-700",
      )}
      style={style}
    >
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs uppercase tracking-wider text-white/70">{label}</dt>
      <dd className="text-xl font-semibold">{value}</dd>
    </div>
  );
}
