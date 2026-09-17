import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { Bot, Loader2, User, Hourglass } from "lucide-react";

type State = "loading" | "ai" | "human" | "idle";

export function ResultBadge({ state }: { state: State }) {
  const { t } = useI18n();

  const config = {
    loading: {
      label: t("result.loading"),
      icon: Loader2,
      className: "bg-muted text-muted-foreground border-border",
      spin: true,
    },
    idle: {
      label: t("result.idle"),
      icon: Hourglass,
      className: "border-dashed bg-muted/40 text-muted-foreground border-border",
      spin: false,
    },
    ai: {
      label: t("class.ai"),
      icon: Bot,
      className: "bg-destructive text-destructive-foreground border-destructive",
      spin: false,
    },
    human: {
      label: t("class.human"),
      icon: User,
      className: "bg-success text-success-foreground border-success",
      spin: false,
    },
  }[state];

  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex w-full items-center justify-center gap-3 rounded-lg border-2 px-6 py-8 transition-colors flat:hidden",
        config.className,
        (state === "ai" || state === "human") && "animate-in fade-in-0 zoom-in-95 duration-300",
      )}
    >
      <Icon className={cn("h-8 w-8", config.spin && "animate-spin")} />
      <span className={cn("font-bold tracking-tight", state === "idle" ? "text-xl" : "text-3xl")}>
        {config.label}
      </span>
    </div>
  );
}

/**
 * Veredicto de los temas flat: etiqueta "Veredicto" y la clase en grande. Editorial y nocturne lo
 * enmarcan con reglas; terminal, con una caja del color del veredicto.
 */
export function Verdict({ state }: { state: State }) {
  const { t } = useI18n();
  const decided = state === "ai" || state === "human";
  const Icon =
    state === "ai" ? Bot : state === "human" ? User : state === "loading" ? Loader2 : Hourglass;
  const label =
    state === "ai"
      ? t("class.ai")
      : state === "human"
        ? t("class.human")
        : state === "loading"
          ? t("result.loading")
          : t("result.idle");

  return (
    <div
      className={cn(
        "hidden items-center gap-6 py-8 flat:flex md:gap-9",
        "editorial:border-y editorial:border-b-border editorial:border-t-[3px] editorial:border-t-rule",
        "nocturne:border-y nocturne:border-b-rule nocturne:border-t-2 nocturne:border-t-primary",
        "terminal:border terminal:px-8 md:terminal:px-10",
        state === "ai" && "terminal:border-ai-border terminal:bg-ai-soft",
        state === "human" && "terminal:border-primary/60 terminal:bg-primary/5",
        !decided && "terminal:border-rule",
      )}
    >
      <Icon
        strokeWidth={2.25}
        className={cn(
          "size-12 shrink-0 md:size-14",
          state === "loading" && "animate-spin",
          !decided && "text-muted-foreground",
          state === "ai" && "terminal:text-ai nocturne:text-ai",
          state === "human" && "terminal:text-human nocturne:text-human",
        )}
      />
      <div className="min-w-0">
        <p className="t-label text-sm text-muted-foreground terminal:text-current">
          <span
            className={cn(
              state === "ai" && "terminal:text-ai",
              state === "human" && "terminal:text-human",
            )}
          >
            {t("verdict.label")}
          </span>
        </p>
        <p
          className={cn(
            "mt-2 flex flex-wrap items-baseline gap-x-4 t-display editorial:font-extrabold editorial:tracking-[-0.04em]",
            decided ? "text-6xl md:text-7xl" : "text-3xl md:text-4xl",
            "nocturne:font-normal",
            decided && "md:nocturne:text-8xl",
            state === "ai" && "terminal:text-ai",
            state === "human" && "terminal:text-human",
          )}
        >
          <span>{label}</span>
          {decided && (
            <span
              className={cn(
                "hidden font-display text-4xl italic md:text-5xl nocturne:inline",
                state === "ai" ? "text-ai" : "text-human",
              )}
            >
              {state === "ai" ? t("verdict.aiNote") : t("verdict.humanNote")}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

/** Etiqueta compacta de veredicto para tablas y listas. */
export function VerdictPill({ synthetic }: { synthetic: boolean }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-sans text-xs font-medium",
        synthetic ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success",
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", synthetic ? "bg-destructive" : "bg-success")}
      />
      {synthetic ? t("class.ai") : t("class.human")}
    </span>
  );
}
