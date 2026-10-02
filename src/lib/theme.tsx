import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { TKey } from "./i18n";

/** Modo de color: lo usan las variantes `dark:` y el Toaster. */
export type Theme = "light" | "dark";

/**
 * Temas de la app. Los "classic" son el diseño original (tarjetas redondeadas, sidebar azul).
 * Los demás usan el layout "flat": paneles a sangre separados por reglas, menú lateral de texto y
 * tipografía propia; comparten estructura y cambian tokens (src/styles.css, [data-theme]).
 */
export const THEMES = [
  { id: "editorial", mode: "light", layout: "flat", label: "theme.editorial" },
  { id: "terminal", mode: "dark", layout: "flat", label: "theme.terminal" },
  { id: "nocturne", mode: "dark", layout: "flat", label: "theme.nocturne" },
  { id: "classic-light", mode: "light", layout: "classic", label: "theme.classicLight" },
  { id: "classic-dark", mode: "dark", layout: "classic", label: "theme.classicDark" },
] as const satisfies readonly {
  id: string;
  mode: Theme;
  layout: "flat" | "classic";
  label: TKey;
}[];

export type ThemeId = (typeof THEMES)[number]["id"];
export type ThemeLayout = (typeof THEMES)[number]["layout"];

export const DEFAULT_THEME_ID: ThemeId = "editorial";

const STORAGE_KEY = "galenia.theme";
/** Clave anterior (solo claro/oscuro): se migra a los temas clásicos. */
const LEGACY_STORAGE_KEY = "voxguard.theme";

function findTheme(id: string | null | undefined) {
  return THEMES.find((theme) => theme.id === id);
}

/**
 * Script inline para <head>: aplica data-theme, data-layout y la clase `dark` antes del primer
 * pintado para evitar el parpadeo al recargar. Replica readStoredTheme y applyTheme.
 */
export const themeInitScript = `(function(){try{var T=${JSON.stringify(
  Object.fromEntries(THEMES.map((t) => [t.id, [t.mode, t.layout]])),
)};var id=localStorage.getItem("${STORAGE_KEY}");if(!T[id]){var o=localStorage.getItem("${LEGACY_STORAGE_KEY}");id=o==="dark"?"classic-dark":o==="light"?"classic-light":"${DEFAULT_THEME_ID}"}var d=document.documentElement;d.dataset.theme=id;d.dataset.layout=T[id][1];if(T[id][0]==="dark")d.classList.add("dark")}catch(e){}})();`;

function readStoredTheme(): ThemeId {
  try {
    const stored = findTheme(localStorage.getItem(STORAGE_KEY));
    if (stored) return stored.id;
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy === "dark") return "classic-dark";
    if (legacy === "light") return "classic-light";
  } catch {
    // ignorar
  }
  return DEFAULT_THEME_ID;
}

function resolveTheme(id: ThemeId) {
  return findTheme(id) ?? findTheme(DEFAULT_THEME_ID)!;
}

function applyTheme(id: ThemeId) {
  const theme = resolveTheme(id);
  const root = document.documentElement;
  root.setAttribute("data-theme", theme.id);
  root.setAttribute("data-layout", theme.layout);
  root.classList.toggle("dark", theme.mode === "dark");
}

type ThemeContextValue = {
  /** Tema seleccionado. */
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  /** Modo de color del tema seleccionado. */
  theme: Theme;
  layout: ThemeLayout;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID);

  useEffect(() => {
    setThemeIdState(readStoredTheme());
  }, []);

  const setThemeId = useCallback((next: ThemeId) => {
    setThemeIdState(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignorar
    }
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const current = resolveTheme(themeId);
    return { themeId: current.id, setThemeId, theme: current.mode, layout: current.layout };
  }, [themeId, setThemeId]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}
