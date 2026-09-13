import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
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

import { getSupabase, setRememberSession } from "./supabase";

/**
 * Autenticación con Supabase Auth (email + contraseña, Google y GitHub).
 * El perfil y las preferencias viven en public.profiles y public.user_preferences
 * (los crea el trigger handle_new_user al registrarse); RLS limita cada fila a su dueño.
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
  /** true tras abrir un enlace de recuperación: permite fijar contraseña sin la actual. */
  recovering: boolean;
  login: (credentials: { email: string; password: string; remember: boolean }) => Promise<User>;
  signUp: (input: { name: string; email: string; password: string }) => Promise<SignUpResult>;
  loginWithProvider: (provider: Exclude<AuthProviderId, "email">) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Devuelve true si el cambio de correo quedó pendiente de confirmación. */
  updateProfile: (
    patch: Partial<Pick<User, "name" | "email" | "avatarUrl" | "preferences">>,
  ) => Promise<{ emailPending: boolean }>;
  changePassword: (current: string, next: string) => Promise<void>;
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

function asProvider(value: unknown): AuthProviderId {
  return value === "google" || value === "github" ? value : "email";
}

function authFailure(error: { code?: string | undefined; message: string }) {
  return new AuthFailure(error.code ?? "unknown", error.message);
}

/** Construye el User de la app a partir de la sesión, el perfil y las preferencias. */
async function loadUser(authUser: SupabaseUser): Promise<User> {
  const supabase = getSupabase();
  const [{ data: profile }, { data: prefs }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle(),
    supabase.from("user_preferences").select("*").eq("user_id", authUser.id).maybeSingle(),
  ]);
  const email = authUser.email ?? profile?.email ?? "";
  const passwordUpdatedAt = authUser.user_metadata?.["password_updated_at"];
  return {
    id: authUser.id,
    name: profile?.full_name || nameFromEmail(email),
    email,
    avatarUrl: profile?.avatar_url ?? null,
    provider: asProvider(profile?.provider ?? authUser.app_metadata?.["provider"]),
    createdAt: profile?.created_at ?? authUser.created_at,
    passwordUpdatedAt: typeof passwordUpdatedAt === "string" ? passwordUpdatedAt : null,
    preferences: prefs
      ? {
          emailNotifications: prefs.email_notifications,
          aiAlerts: prefs.ai_alerts,
          autoSave: prefs.auto_save_history,
        }
      : DEFAULT_PREFERENCES,
  };
}

/** Sube la foto (data URL ya recortada) al bucket avatars y devuelve su URL pública. */
async function uploadAvatar(userId: string, dataUrl: string) {
  const supabase = getSupabase();
  const blob = await (await fetch(dataUrl)).blob();
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: blob.type, upsert: true });
  if (error) throw new AuthFailure("avatar_upload", error.message);
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [recovering, setRecovering] = useState(false);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const applySession = useCallback(async (session: Session | null) => {
    if (!session) {
      setUser(null);
      setStatus("unauthenticated");
      return null;
    }
    try {
      const next = await loadUser(session.user);
      setUser(next);
      setStatus("authenticated");
      return next;
    } catch (error) {
      console.error("No se pudo cargar el perfil", error);
      setUser(null);
      setStatus("unauthenticated");
      return null;
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) void applySession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") setRecovering(false);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        // Supabase recomienda no llamar a su cliente dentro del callback: se difiere un tick.
        setTimeout(() => {
          if (active) void applySession(session);
        }, 0);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [applySession]);

  const login = useCallback<AuthContextValue["login"]>(
    async ({ email, password, remember }) => {
      setRememberSession(remember);
      const { data, error } = await getSupabase().auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw authFailure(error);
      const next = await applySession(data.session);
      if (!next) throw new AuthFailure("profile_unavailable");
      return next;
    },
    [applySession],
  );

  const signUp = useCallback<AuthContextValue["signUp"]>(
    async ({ name, email, password }) => {
      setRememberSession(true);
      const { data, error } = await getSupabase().auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw authFailure(error);
      // Con "Confirm email" activo no hay sesión hasta confirmar; un correo ya registrado
      // devuelve un usuario sin identidades (Supabase no revela si existe).
      if (data.user && data.user.identities?.length === 0) {
        throw new AuthFailure("user_already_exists");
      }
      if (!data.session) return { user: null, needsConfirmation: true };
      return { user: await applySession(data.session), needsConfirmation: false };
    },
    [applySession],
  );

  const loginWithProvider = useCallback<AuthContextValue["loginWithProvider"]>(async (provider) => {
    setRememberSession(true);
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) throw authFailure(error);
  }, []);

  const requestPasswordReset = useCallback<AuthContextValue["requestPasswordReset"]>(
    async (email) => {
      const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/profile`,
      });
      if (error) throw authFailure(error);
    },
    [],
  );

  const logout = useCallback(async () => {
    await getSupabase().auth.signOut();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const updateProfile = useCallback<AuthContextValue["updateProfile"]>(async (patch) => {
    const current = userRef.current;
    if (!current) return { emailPending: false };
    const supabase = getSupabase();
    const profileUpdate: { full_name?: string; avatar_url?: string | null } = {};
    const next: User = { ...current };

    if (patch.name !== undefined && patch.name !== current.name) {
      profileUpdate.full_name = patch.name;
      next.name = patch.name;
    }
    if (patch.avatarUrl !== undefined && patch.avatarUrl !== current.avatarUrl) {
      const url = patch.avatarUrl ? await uploadAvatar(current.id, patch.avatarUrl) : null;
      profileUpdate.avatar_url = url;
      next.avatarUrl = url;
    }
    if (Object.keys(profileUpdate).length) {
      const { error } = await supabase.from("profiles").update(profileUpdate).eq("id", current.id);
      if (error) throw authFailure(error);
    }

    if (patch.preferences) {
      const { error } = await supabase
        .from("user_preferences")
        .update({
          email_notifications: patch.preferences.emailNotifications,
          ai_alerts: patch.preferences.aiAlerts,
          auto_save_history: patch.preferences.autoSave,
        })
        .eq("user_id", current.id);
      if (error) throw authFailure(error);
      next.preferences = patch.preferences;
    }

    let emailPending = false;
    if (patch.email !== undefined && patch.email !== current.email) {
      const { data, error } = await supabase.auth.updateUser({ email: patch.email });
      if (error) throw authFailure(error);
      // Con confirmación de cambio de correo, el correo actual sigue vigente hasta confirmar.
      emailPending = data.user.email !== patch.email;
      if (!emailPending) next.email = patch.email;
    }

    setUser(next);
    return { emailPending };
  }, []);

  const changePassword = useCallback<AuthContextValue["changePassword"]>(
    async (currentPassword, nextPassword) => {
      const current = userRef.current;
      if (!current) return;
      const supabase = getSupabase();
      if (currentPassword) {
        const { error } = await supabase.auth.signInWithPassword({
          email: current.email,
          password: currentPassword,
        });
        if (error) throw new AuthFailure("wrong_password", error.message);
      }
      const passwordUpdatedAt = new Date().toISOString();
      const { error } = await supabase.auth.updateUser({
        password: nextPassword,
        data: { password_updated_at: passwordUpdatedAt },
      });
      if (error) throw authFailure(error);
      setRecovering(false);
      setUser({ ...current, passwordUpdatedAt });
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      recovering,
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
      recovering,
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
