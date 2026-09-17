import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Autenticación de demostración, sin backend. El panel de login acepta cualquier correo y
 * contraseña que pasen la validación del formulario (y los botones de Google/GitHub) y guarda un
 * usuario de demo en este navegador (localStorage). Ninguna ruta exige sesión: iniciarla solo
 * personaliza el perfil y las preferencias.
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

/** Error de auth con código estable para mostrar el mensaje adecuado. */
export class AuthFailure extends Error {
  readonly code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

type SignUpResult = { user: User | null; needsConfirmation: boolean };

type AuthContextValue = {
  status: Status;
  user: User | null;
  /** true tras un enlace de recuperación de contraseña; la demo no los envía, así que siempre es false. */
  recovering: boolean;
  login: (credentials: { email: string; password: string; remember: boolean }) => Promise<User>;
  signUp: (input: { name: string; email: string; password: string }) => Promise<SignUpResult>;
  loginWithProvider: (provider: Exclude<AuthProviderId, "email">) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Devuelve true si el cambio de correo quedó pendiente de confirmación (nunca, en la demo). */
  updateProfile: (
    patch: Partial<Pick<User, "name" | "email" | "avatarUrl" | "preferences">>,
  ) => Promise<{ emailPending: boolean }>;
  changePassword: (current: string, next: string) => Promise<void>;
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const STORAGE_KEY = "galena.demo-user";

const DEFAULT_PREFERENCES: UserPreferences = {
  emailNotifications: true,
  aiAlerts: true,
  autoSave: true,
};

function nameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "";
  const name = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return name || "User";
}

function demoUser(input: { email: string; provider: AuthProviderId; name?: string }): User {
  const email = input.email.trim().toLowerCase();
  return {
    id: `demo:${email}`,
    name: input.name?.trim() || nameFromEmail(email),
    email,
    avatarUrl: null,
    provider: input.provider,
    createdAt: new Date().toISOString(),
    passwordUpdatedAt: null,
    preferences: DEFAULT_PREFERENCES,
  };
}

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function storeUser(user: User | null) {
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Almacenamiento lleno o no disponible: la sesión dura lo que dure la pestaña.
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  // localStorage solo existe en el navegador: se lee después de hidratar.
  useEffect(() => {
    const stored = readStoredUser();
    setUser(stored);
    setStatus(stored ? "authenticated" : "unauthenticated");
  }, []);

  const signIn = useCallback((next: User) => {
    storeUser(next);
    setUser(next);
    setStatus("authenticated");
    return next;
  }, []);

  const login = useCallback<AuthContextValue["login"]>(
    async ({ email }) => signIn(demoUser({ email, provider: "email" })),
    [signIn],
  );

  const signUp = useCallback<AuthContextValue["signUp"]>(
    async ({ name, email }) => ({
      user: signIn(demoUser({ name, email, provider: "email" })),
      needsConfirmation: false,
    }),
    [signIn],
  );

  const loginWithProvider = useCallback<AuthContextValue["loginWithProvider"]>(
    async (provider) => {
      signIn(demoUser({ email: `demo.${provider}@galenia.demo`, provider }));
    },
    [signIn],
  );

  const requestPasswordReset = useCallback<
    AuthContextValue["requestPasswordReset"]
  >(async () => {}, []);

  const logout = useCallback(async () => {
    storeUser(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const updateProfile = useCallback<AuthContextValue["updateProfile"]>(
    async (patch) => {
      const current = userRef.current;
      if (!current) return { emailPending: false };
      signIn({
        ...current,
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
        ...(patch.preferences !== undefined ? { preferences: patch.preferences } : {}),
      });
      return { emailPending: false };
    },
    [signIn],
  );

  const changePassword = useCallback<AuthContextValue["changePassword"]>(async () => {
    const current = userRef.current;
    if (!current) return;
    signIn({ ...current, passwordUpdatedAt: new Date().toISOString() });
  }, [signIn]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      recovering: false,
      login,
      signUp,
      loginWithProvider,
      requestPasswordReset,
      logout,
      updateProfile,
      changePassword,
    }),
    [
      status,
      user,
      login,
      signUp,
      loginWithProvider,
      requestPasswordReset,
      logout,
      updateProfile,
      changePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
