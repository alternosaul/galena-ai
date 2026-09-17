import { ChevronDown, Palette } from "lucide-react";

import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useI18n, type Lang } from "@/lib/i18n";
import { THEMES, useTheme, type ThemeId } from "@/lib/theme";

export function AppHeader() {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur flat:h-20 flat:border-rule flat:bg-background flat:backdrop-blur-none md:flat:h-[6.25rem] md:flat:px-10">
      <SidebarTrigger className="md:flat:hidden" />
      <span className="truncate text-sm font-semibold tracking-tight flat:hidden flat:t-label flat:text-foreground flat:tracking-[0.22em] md:flat:inline md:flat:text-sm">
        {t("app.header")}
      </span>

      <div className="ml-auto flex items-center gap-2 flat:gap-3 md:flat:gap-8">
        <PreferenceControls />
        <Separator orientation="vertical" className="mx-1 h-6 flat:hidden" />
        <UserMenu />
      </div>
    </header>
  );
}

/** Selector de idioma y de tema (header de la app y pantalla de login). */
export function PreferenceControls() {
  const { t, lang, setLang } = useI18n();

  return (
    <div className="flex items-center gap-2 flat:gap-3 md:flat:gap-8">
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={lang}
        onValueChange={(v) => v && setLang(v as Lang)}
        aria-label={t("lang.label")}
        className="flat:gap-0"
      >
        <ToggleGroupItem value="es" className={LANG_ITEM}>
          ES
        </ToggleGroupItem>
        <span aria-hidden className="hidden px-2 t-label text-muted-foreground flat:inline">
          /
        </span>
        <ToggleGroupItem value="en" className={LANG_ITEM}>
          EN
        </ToggleGroupItem>
      </ToggleGroup>

      <ThemeSelect />
    </div>
  );
}

/** En los temas flat el idioma es texto plano: el activo va subrayado o con el color de acento. */
const LANG_ITEM =
  "px-2.5 text-xs font-semibold flat:h-auto flat:min-w-0 flat:border-0 flat:bg-transparent flat:px-0 flat:py-1 flat:t-label flat:text-sm flat:text-muted-foreground flat:shadow-none flat:hover:bg-transparent flat:hover:text-foreground flat:data-[state=on]:bg-transparent flat:data-[state=on]:text-foreground editorial:data-[state=on]:underline editorial:data-[state=on]:decoration-2 editorial:data-[state=on]:underline-offset-8 terminal:data-[state=on]:text-primary";

/** Muestras de color de cada tema: fondo, texto y acento. */
const SWATCHES: Record<ThemeId, [string, string, string]> = {
  editorial: ["oklch(0.957 0.005 95)", "oklch(0.2 0.006 270)", "oklch(0.55 0.17 30)"],
  terminal: ["oklch(0.18 0.008 120)", "oklch(0.9 0.015 100)", "oklch(0.73 0.14 118)"],
  nocturne: ["oklch(0.19 0.008 80)", "oklch(0.93 0.017 80)", "oklch(0.55 0.13 38)"],
  "classic-light": ["oklch(0.975 0.008 45)", "oklch(0.294 0.066 238.5)", "oklch(0.698 0.2 41.5)"],
  "classic-dark": ["oklch(0.176 0.014 258.4)", "oklch(0.93 0.012 40)", "oklch(0.698 0.2 41.5)"],
};

function ThemeSwatch({ id }: { id: ThemeId }) {
  return (
    <span className="flex shrink-0 overflow-hidden rounded-sm border border-border">
      {SWATCHES[id].map((color, index) => (
        <span key={index} className="h-4 w-2.5" style={{ backgroundColor: color }} />
      ))}
    </span>
  );
}

/** Menú desplegable para elegir el tema; se guarda en este navegador. */
export function ThemeSelect() {
  const { t } = useI18n();
  const { themeId, setThemeId } = useTheme();
  const current = THEMES.find((theme) => theme.id === themeId) ?? THEMES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={t("theme.label")}
          className="gap-2 flat:h-auto flat:border-0 flat:bg-transparent flat:px-0 flat:py-1 flat:t-label flat:text-sm flat:text-muted-foreground flat:shadow-none flat:hover:bg-transparent flat:hover:text-foreground flat:hover:shadow-none"
        >
          <Palette className="h-4 w-4 flat:hidden" />
          <ThemeSwatch id={current.id} />
          <span className="hidden sm:inline">{t(current.label)}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 flat:rounded-none">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground flat:t-label">
          {t("theme.label")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={themeId} onValueChange={(v) => setThemeId(v as ThemeId)}>
          {THEMES.map((theme) => (
            <DropdownMenuRadioItem
              key={theme.id}
              value={theme.id}
              className="cursor-pointer gap-3 flat:rounded-none"
            >
              <ThemeSwatch id={theme.id} />
              {t(theme.label)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} />;
}
