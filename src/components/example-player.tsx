import { Pause, Play } from "lucide-react";
import { useRef, useState, type MouseEvent } from "react";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Alturas fijas de la forma de onda decorativa (0..1), iguales en servidor y cliente. */
const BARS = Array.from(
  { length: 44 },
  (_, i) => 0.5 + 0.5 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.45)),
);

function clock(seconds: number) {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * Reproductor del audio de ejemplo en los temas flat: botón, forma de onda (clic para buscar) y
 * tiempo. No descarga nada hasta reproducir; la duración inicial viene de `durationSec`.
 */
export function ExamplePlayer({
  src,
  durationSec,
  className,
}: {
  src: string;
  durationSec: number;
  className?: string;
}) {
  const { t } = useI18n();
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(durationSec);
  const progress = duration > 0 ? current / duration : 0;

  function toggle() {
    const element = audio.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => setPlaying(false));
    else element.pause();
  }

  function seek(event: MouseEvent<HTMLButtonElement>) {
    const element = audio.current;
    if (!element || !duration) return;
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    element.currentTime = ratio * duration;
    setCurrent(element.currentTime);
    if (element.paused) void element.play().catch(() => setPlaying(false));
  }

  return (
    <div className={cn("min-w-0 flex-1 items-center gap-4", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t("player.pause") : t("player.play")}
        className={cn(
          "grid size-11 shrink-0 cursor-pointer place-items-center border border-cta bg-cta text-cta-foreground shadow-[0_8px_20px_-10px_var(--cta)] transition-all duration-200",
          "hover:brightness-110 motion-safe:hover:scale-105 motion-safe:active:scale-95 nocturne:rounded-full",
        )}
      >
        {playing ? (
          <Pause className="size-4 fill-current" />
        ) : (
          <Play className="ml-0.5 size-4 fill-current" />
        )}
      </button>

      <button
        type="button"
        onClick={seek}
        aria-label={t("player.seek")}
        className="group flex h-10 min-w-0 flex-1 cursor-pointer items-center overflow-hidden"
      >
        {/* Cada barra ocupa una celda flexible (sin gap fijo): se reparten el ancho disponible y
            nunca invaden el tiempo ni el botón. En cajas angostas se muestra la mitad. */}
        {BARS.map((height, index) => (
          <span
            key={index}
            className={cn(
              "flex h-full min-w-[3px] flex-1 items-center justify-center",
              index % 2 === 1 && "@max-md:hidden",
            )}
          >
            <span
              style={{ height: `${Math.round(height * 100)}%` }}
              className={cn(
                "w-[2px] transition-colors duration-300",
                index / BARS.length < progress
                  ? "bg-cta"
                  : "bg-foreground/60 group-hover:bg-foreground/85 terminal:bg-primary/55 nocturne:bg-muted-foreground/45",
                playing && "motion-safe:animate-pulse",
              )}
            />
          </span>
        ))}
      </button>

      <span className="shrink-0 font-mono text-sm tabular-nums">
        {clock(playing || current > 0 ? current : duration)}
      </span>

      <audio
        ref={audio}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          if (Number.isFinite(event.currentTarget.duration))
            setDuration(event.currentTarget.duration);
        }}
      />
    </div>
  );
}
