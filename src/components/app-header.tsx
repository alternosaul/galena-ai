import { Moon, Sun } from "lucide-react";

import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n, type Lang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

export function AppHeader() {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger />
      <span className="truncate text-sm font-semibold tracking-tight">{t("app.header")}</span>

      <div className="ml-auto flex items-center gap-2">
        <PreferenceControls />
        <Separator orientation="vertical" className="mx-1 h-6" />
        <UserMenu />
      </div>
    </header>
  );
}

/** Selector de idioma y botón de tema (header de la app y pantalla de login). */
export function PreferenceControls() {
  const { t, lang, setLang } = useI18n();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={lang}
        onValueChange={(v) => v && setLang(v as Lang)}
        aria-label={t("lang.label")}
      >
        <ToggleGroupItem value="es" className="px-2.5 text-xs font-semibold">
          ES
        </ToggleGroupItem>
        <ToggleGroupItem value="en" className="px-2.5 text-xs font-semibold">
          EN
        </ToggleGroupItem>
      </ToggleGroup>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={toggleTheme}>
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform duration-300 dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform duration-300 dark:rotate-0 dark:scale-100" />
            <span className="sr-only">{t("theme.toggle")}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{theme === "dark" ? t("theme.light") : t("theme.dark")}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} />;
}
