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
          "grid size-11 shrink-0 cursor-pointer place-items-center border border-rule text-foreground transition-all duration-200",
          "hover:bg-foreground hover:text-background motion-safe:active:scale-95",
          "terminal:border-primary terminal:text-primary terminal:hover:bg-primary terminal:hover:text-primary-foreground",
          "nocturne:rounded-full nocturne:border-primary nocturne:text-primary nocturne:hover:bg-primary nocturne:hover:text-primary-foreground",
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
        className="group flex h-10 min-w-0 flex-1 cursor-pointer items-center justify-between gap-[3px]"
      >
        {BARS.map((height, index) => (
          <span
            key={index}
            style={{ height: `${Math.round(height * 100)}%` }}
            className={cn(
              "w-[2px] shrink-0 transition-colors duration-300",
              // En pantallas angostas basta la mitad de las barras.
              index % 2 === 1 && "max-sm:hidden",
              index / BARS.length < progress
                ? "bg-foreground terminal:bg-primary nocturne:bg-primary"
                : "bg-foreground/80 group-hover:bg-foreground terminal:bg-primary/55 nocturne:bg-muted-foreground/45",
              playing && "motion-safe:animate-pulse",
            )}
          />
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
