import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AUTENTICACIÓN (SIMULADA)
 * ─────────────────────────────────────────────────────────────────────────────
 * Hoy la sesión vive en el navegador: localStorage si el usuario marca
 * "mantener sesión", sessionStorage si no. NUNCA se guardan contraseñas.
 * Cualquier correo válido + contraseña de 8+ caracteres inicia sesión.
 *
 * CÓMO CONECTAR AUTENTICACIÓN REAL:
 * 1. Elegir proveedor (Better Auth, Auth.js, Supabase Auth, Clerk…) y registrar
 *    las apps OAuth de Google y GitHub (GOOGLE_CLIENT_ID/SECRET, GITHUB_CLIENT_ID/SECRET).
 * 2. `login` → POST al endpoint de sign-in, que responde con cookie httpOnly.
 *    `loginWithProvider` → redirección al flujo OAuth del proveedor.
 * 3. Validar la sesión en el servidor (`beforeLoad` en rutas protegidas) en lugar
 *    del redireccionamiento del lado del cliente de src/components/app-shell.tsx.
 * 4. `updateProfile` y `changePassword` → server functions. Subir el avatar a
 *    un storage (S3, R2…) y guardar solo la URL.
 * La interfaz pública de este archivo (useAuth) no necesita cambiar.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type AuthProviderId = "email" | "google" | "github";

export type UserPreferences = {
  emailNotifications: boolean;
  aiAlerts: boolean;
  autoSave: boolean;
};

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  provider: AuthProviderId;
  createdAt: string;
  passwordUpdatedAt: string | null;
  preferences: UserPreferences;
};

type Status = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: Status;
  user: User | null;
  login: (credentials: { email: string; password: string; remember: boolean }) => Promise<User>;
  loginWithProvider: (provider: Exclude<AuthProviderId, "email">) => Promise<User>;
  logout: () => void;
  updateProfile: (
    patch: Partial<Pick<User, "name" | "email" | "avatarUrl" | "preferences">>,
  ) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const STORAGE_KEY = "voxguard.session";

const DEFAULT_PREFERENCES: UserPreferences = {
  emailNotifications: true,
  aiAlerts: true,
  autoSave: true,
};

const MOCK_OAUTH_PROFILES: Record<
  Exclude<AuthProviderId, "email">,
  { name: string; email: string }
> = {
  google: { name: "Demo User", email: "demo.user@gmail.com" },
  github: { name: "demo-dev", email: "demo-dev@users.noreply.github.com" },
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `crypto.randomUUID` solo existe en contextos seguros (HTTPS o localhost).
 * Mientras el sitio se sirva por HTTP plano se usa `getRandomValues`, que sí está disponible.
 */
function createId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

function nameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "";
  const name = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return name || "User";
}

function readSession(): { user: User; remember: boolean } | null {
  try {
    for (const [storage, remember] of [
      [localStorage, true],
      [sessionStorage, false],
    ] as const) {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) {
        const user = JSON.parse(raw) as User;
        return {
          user: { ...user, preferences: { ...DEFAULT_PREFERENCES, ...user.preferences } },
          remember,
        };
      }
    }
  } catch {
    // almacenamiento no disponible o sesión corrupta
  }
  return null;
}

function writeSession(user: User | null, remember: boolean) {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    if (user) (remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    // ignorar (p. ej. cuota excedida por un avatar grande)
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    const session = readSession();
    if (session) {
      setUser(session.user);
      setRemember(session.remember);
      setStatus("authenticated");
    } else {
      setStatus("unauthenticated");
    }
  }, []);

  const startSession = useCallback((next: User, keep: boolean) => {
    setUser(next);
    setRemember(keep);
    setStatus("authenticated");
    writeSession(next, keep);
    return next;
  }, []);

  const login = useCallback<AuthContextValue["login"]>(
    async ({ email, remember: keep }) => {
      // TODO(auth): POST /api/auth/sign-in con { email, password }
      await delay(800);
      const normalized = email.trim().toLowerCase();
      return startSession(
        {
          id: createId(),
          name: nameFromEmail(normalized),
          email: normalized,
          avatarUrl: null,
          provider: "email",
          createdAt: new Date().toISOString(),
          passwordUpdatedAt: null,
          preferences: DEFAULT_PREFERENCES,
        },
        keep,
      );
    },
    [startSession],
  );

  const loginWithProvider = useCallback<AuthContextValue["loginWithProvider"]>(
    async (provider) => {
      // TODO(auth): redirigir al flujo OAuth de `provider`
      await delay(1000);
      return startSession(
        {
          id: createId(),
          ...MOCK_OAUTH_PROFILES[provider],
          avatarUrl: null,
          provider,
          createdAt: new Date().toISOString(),
          passwordUpdatedAt: null,
          preferences: DEFAULT_PREFERENCES,
        },
        true,
      );
    },
    [startSession],
  );

  const logout = useCallback(() => {
    // TODO(auth): POST /api/auth/sign-out para invalidar la cookie
    setUser(null);
    setStatus("unauthenticated");
    writeSession(null, false);
  }, []);

  const updateProfile = useCallback<AuthContextValue["updateProfile"]>(
    async (patch) => {
      if (!user) return;
      const next = { ...user, ...patch };
      setUser(next);
      writeSession(next, remember);
      // TODO(auth): PATCH /api/me con `patch`
      await delay(400);
    },
    [user, remember],
  );

  const changePassword = useCallback<AuthContextValue["changePassword"]>(
    async (current, next) => {
      if (!user) return;
      // TODO(auth): POST /api/me/password con { current, next }
      await delay(700);
      if (current && current === next) throw new Error("same-password");
      const updated = { ...user, passwordUpdatedAt: new Date().toISOString() };
      setUser(updated);
      writeSession(updated, remember);
    },
    [user, remember],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, loginWithProvider, logout, updateProfile, changePassword }),
    [status, user, login, loginWithProvider, logout, updateProfile, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
