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
        "flex w-full items-center justify-center gap-3 rounded-lg border-2 px-6 py-8 transition-colors",
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
