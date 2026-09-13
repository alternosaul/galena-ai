import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, Mail, UserRound } from "lucide-react";

import { GithubIcon, GoogleIcon } from "@/components/brand-icons";
import { BrandLogo } from "@/components/brand-logo";
import { LoginHero } from "@/components/login-hero";
import { PasswordInput } from "@/components/password-input";
import { PreferenceControls } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AuthFailure, EMAIL_RE, useAuth, type AuthProviderId } from "@/lib/auth";
import { useI18n, type TKey } from "@/lib/i18n";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — VoxGuard" },
      { name: "description", content: "Accede a VoxGuard para analizar llamadas." },
    ],
  }),
  component: LoginPage,
});

type Mode = "signin" | "signup";
type Pending = AuthProviderId | "reset" | null;
type Errors = Partial<Record<"name" | "email" | "password", string>>;

const PROVIDER_LABEL = { google: "Google", github: "GitHub" } as const;

/** Mensaje para los códigos de error de Supabase Auth. */
function errorKey(error: unknown, fallback: TKey): TKey {
  const code = error instanceof AuthFailure ? error.code : "";
  if (code === "invalid_credentials") return "login.errCredentials";
  if (code === "user_already_exists" || code === "email_exists") return "login.errExists";
  if (code === "weak_password") return "login.errPassword";
  if (code.startsWith("over_") && code.endsWith("rate_limit")) return "login.errRateLimit";
  return fallback;
}

function LoginPage() {
  const { t } = useI18n();
  const { login, signUp, loginWithProvider, requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState<Pending>(null);

  const signup = mode === "signup";

  function switchMode(next: Mode) {
    setMode(next);
    setErrors({});
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (signup && !name.trim()) next.name = t("login.errName");
    if (!EMAIL_RE.test(email.trim())) next.email = t("login.errEmail");
    if (password.length < 8) next.password = t("login.errPassword");
    setErrors(next);
    if (Object.keys(next).length) return;

    setPending("email");
    try {
      if (signup) {
        const { user, needsConfirmation } = await signUp({ name, email, password });
        if (needsConfirmation || !user) {
          toast.info(t("login.checkEmail"));
          switchMode("signin");
          setPending(null);
          return;
        }
        toast.success(t("login.welcome", { name: user.name }));
      } else {
        const user = await login({ email, password, remember });
        toast.success(t("login.welcome", { name: user.name }));
      }
      void navigate({ to: "/", replace: true });
    } catch (error) {
      toast.error(t(errorKey(error, signup ? "login.errSignup" : "login.error")));
      setPending(null);
    }
  }

  async function onProvider(provider: Exclude<AuthProviderId, "email">) {
    setPending(provider);
    try {
      // Redirige al proveedor; al volver, Supabase restaura la sesión desde la URL.
      await loginWithProvider(provider);
    } catch {
      toast.error(t("login.errProvider", { provider: PROVIDER_LABEL[provider] }));
      setPending(null);
    }
  }

  async function onForgot() {
    if (!EMAIL_RE.test(email.trim())) {
      setErrors({ email: t("login.forgotNeedEmail") });
      return;
    }
    setPending("reset");
    try {
      await requestPasswordReset(email);
      toast.success(t("login.forgotSent"));
    } catch (error) {
      toast.error(t(errorKey(error, "login.error")));
    } finally {
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="flex flex-col px-6 py-6 sm:px-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandLogo className="h-10 w-10" />
            <span className="text-lg font-semibold tracking-tight">VoxGuard</span>
          </div>
          <PreferenceControls />
        </header>

        <main
          key={mode}
          className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10 animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
        >
          <h1 className="text-3xl font-bold tracking-tight">
            {t(signup ? "login.signupTitle" : "login.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t(signup ? "login.signupSubtitle" : "login.subtitle")}
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3">
            {(["google", "github"] as const).map((provider) => (
              <Button
                key={provider}
                variant="outline"
                className="h-11"
                disabled={busy}
                onClick={() => onProvider(provider)}
              >
                {pending === provider ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : provider === "google" ? (
                  <GoogleIcon className="mr-2 h-4 w-4" />
                ) : (
                  <GithubIcon className="mr-2 h-4 w-4" />
                )}
                {PROVIDER_LABEL[provider]}
              </Button>
            ))}
          </div>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
            <Separator className="flex-1" />
            {t("login.or")}
            <Separator className="flex-1" />
          </div>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {signup && (
              <div className="space-y-1.5">
                <Label htmlFor="name">{t("login.name")}</Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={!!errors.name}
                    className="h-11 pl-9"
                    disabled={busy}
                  />
                </div>
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">{t("login.email")}</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nombre@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!errors.email}
                  className="h-11 pl-9"
                  disabled={busy}
                />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t("login.password")}</Label>
                {!signup && (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline disabled:opacity-60"
                    onClick={onForgot}
                    disabled={busy}
                  >
                    {pending === "reset" && (
                      <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                    )}
                    {t("login.forgot")}
                  </button>
                )}
              </div>
              <PasswordInput
                id="password"
                autoComplete={signup ? "new-password" : "current-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!errors.password}
                className="h-11"
                disabled={busy}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            {!signup && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={remember}
                  onCheckedChange={(v) => setRemember(v === true)}
                  disabled={busy}
                />
                <Label htmlFor="remember" className="text-sm font-normal">
                  {t("login.remember")}
                </Label>
              </div>
            )}

            <Button type="submit" className="h-11 w-full" disabled={busy}>
              {pending === "email" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pending === "email"
                ? t(signup ? "login.signupSubmitting" : "login.submitting")
                : t(signup ? "login.signupSubmit" : "login.submit")}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t(signup ? "login.haveAccount" : "login.noAccount")}{" "}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => switchMode(signup ? "signin" : "signup")}
              disabled={busy}
            >
              {t(signup ? "login.submit" : "login.signupSubmit")}
            </button>
          </p>
        </main>

        <footer className="text-center text-xs text-muted-foreground">{t("login.terms")}</footer>
      </div>

      <LoginHero />
    </div>
  );
}
