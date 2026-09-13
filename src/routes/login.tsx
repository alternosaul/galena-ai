import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Info, Loader2, Mail, Waves } from "lucide-react";

import { GithubIcon, GoogleIcon } from "@/components/brand-icons";
import { LoginHero } from "@/components/login-hero";
import { PasswordInput } from "@/components/password-input";
import { PreferenceControls } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { EMAIL_RE, useAuth, type AuthProviderId } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — VoxGuard" },
      { name: "description", content: "Accede a VoxGuard para analizar llamadas." },
    ],
  }),
  component: LoginPage,
});

type Pending = AuthProviderId | null;
type Errors = Partial<Record<"email" | "password", string>>;

function LoginPage() {
  const { t } = useI18n();
  const { login, loginWithProvider } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState<Pending>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = t("login.errEmail");
    if (password.length < 8) next.password = t("login.errPassword");
    setErrors(next);
    if (Object.keys(next).length) return;

    setPending("email");
    try {
      const user = await login({ email, password, remember });
      toast.success(t("login.welcome", { name: user.name }));
      void navigate({ to: "/", replace: true });
    } catch {
      toast.error(t("login.error"));
      setPending(null);
    }
  }

  async function onProvider(provider: Exclude<AuthProviderId, "email">) {
    setPending(provider);
    try {
      const user = await loginWithProvider(provider);
      toast.success(t("login.welcome", { name: user.name }));
      void navigate({ to: "/", replace: true });
    } catch {
      toast.error(t("login.error"));
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="flex flex-col px-6 py-6 sm:px-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Waves className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">VoxGuard</span>
          </div>
          <PreferenceControls />
        </header>

        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
          <h1 className="text-3xl font-bold tracking-tight">{t("login.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("login.subtitle")}</p>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-11"
              disabled={busy}
              onClick={() => onProvider("google")}
            >
              {pending === "google" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <GoogleIcon className="mr-2 h-4 w-4" />
              )}
              Google
            </Button>
            <Button
              variant="outline"
              className="h-11"
              disabled={busy}
              onClick={() => onProvider("github")}
            >
              {pending === "github" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <GithubIcon className="mr-2 h-4 w-4" />
              )}
              GitHub
            </Button>
          </div>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
            <Separator className="flex-1" />
            {t("login.or")}
            <Separator className="flex-1" />
          </div>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
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
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => toast.info(t("login.forgotSent"))}
                >
                  {t("login.forgot")}
                </button>
              </div>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!errors.password}
                className="h-11"
                disabled={busy}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

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

            <Button type="submit" className="h-11 w-full" disabled={busy}>
              {pending === "email" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pending === "email" ? t("login.submitting") : t("login.submit")}
            </Button>
          </form>

          <p className="mt-4 flex items-start gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            {t("login.demoNote")}
          </p>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("login.noAccount")}{" "}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => toast.success(t("login.requestSent"))}
            >
              {t("login.requestAccess")}
            </button>
          </p>
        </main>

        <footer className="text-center text-xs text-muted-foreground">{t("login.terms")}</footer>
      </div>

      <LoginHero />
    </div>
  );
}
