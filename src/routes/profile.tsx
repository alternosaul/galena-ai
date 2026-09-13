import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Camera, Check, KeyRound, Loader2, LogOut, Moon, Sun, Trash2, X } from "lucide-react";

import { GithubIcon, GoogleIcon } from "@/components/brand-icons";
import { PasswordInput } from "@/components/password-input";
import { useLogout } from "@/components/user-menu";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DEFAULT_API_SETTINGS, loadApiSettings, saveApiSettings } from "@/lib/api-settings";
import { AuthFailure, EMAIL_RE, useAuth, type User, type UserPreferences } from "@/lib/auth";
import { useI18n, type Lang, type TKey } from "@/lib/i18n";
import { resizeImageToSquare } from "@/lib/image";
import { modelsQueryOptions } from "@/lib/models-query";
import { PASSWORD_RULES, passwordScore } from "@/lib/password";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Perfil — Galenia" },
      { name: "description", content: "Cuenta, preferencias y seguridad." },
    ],
  }),
  component: ProfilePage,
});

type FieldErrors<K extends string> = Partial<Record<K, string>>;

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const PROVIDER_LABEL: Record<User["provider"], string> = {
  email: "Email",
  google: "Google",
  github: "GitHub",
};

function ProfilePage() {
  const { t } = useI18n();
  const { user } = useAuth();

  // AppShell solo renderiza esta ruta con sesión activa.
  if (!user) return null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("profile.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("profile.subtitle")}</p>
      </div>

      <ProfileHeader user={user} />

      <div className="grid gap-6 lg:grid-cols-2">
        <PersonalInfoCard key={user.id} user={user} />
        <PreferencesCard user={user} />
      </div>

      <SecurityCard user={user} />
      <SessionCard />
    </div>
  );
}

// ── Encabezado con foto ──────────────────────────────────────────────────────

function ProfileHeader({ user }: { user: User }) {
  const { t, locale } = useI18n();
  const { updateProfile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const memberSince = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(user.createdAt)),
    [locale, user.createdAt],
  );

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > MAX_PHOTO_BYTES) {
      toast.error(t("profile.photoError"));
      return;
    }
    setUploading(true);
    try {
      await updateProfile({ avatarUrl: await resizeImageToSquare(file) });
      toast.success(t("profile.photoUpdated"));
    } catch {
      toast.error(t("profile.photoError"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Card className="overflow-hidden py-0">
      <div
        className="h-28 sm:h-32"
        style={{ background: "linear-gradient(120deg, #FF671F 0%, #b3400f 35%, #003049 100%)" }}
      />
      <CardContent className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end">
        <div className="relative -mt-14 w-fit">
          <UserAvatar user={user} className="h-28 w-28 text-3xl ring-4 ring-card" />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-label={t("profile.upload")}
            className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-md transition-transform hover:scale-110 disabled:opacity-70"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold">{user.name}</h2>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1.5">
              {user.provider === "google" && <GoogleIcon className="h-3 w-3" />}
              {user.provider === "github" && <GithubIcon className="h-3 w-3" />}
              {t("profile.signedInWith", { provider: PROVIDER_LABEL[user.provider] })}
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">
              {t("profile.memberSince", { date: memberSince })}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col items-start gap-1 sm:items-end">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <Camera className="mr-2 h-4 w-4" />
              {t("profile.upload")}
            </Button>
            {user.avatarUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateProfile({ avatarUrl: null })}
                disabled={uploading}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("profile.removePhoto")}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t("profile.photoHint")}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Información personal ─────────────────────────────────────────────────────

function PersonalInfoCard({ user }: { user: User }) {
  const { t } = useI18n();
  const { updateProfile } = useAuth();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [errors, setErrors] = useState<FieldErrors<"name" | "email">>({});
  const [saving, setSaving] = useState(false);

  const dirty = name.trim() !== user.name || email.trim().toLowerCase() !== user.email;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: FieldErrors<"name" | "email"> = {};
    if (!name.trim()) next.name = t("profile.errName");
    if (!EMAIL_RE.test(email.trim())) next.email = t("login.errEmail");
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const { emailPending } = await updateProfile({
        name: name.trim(),
        email: email.trim().toLowerCase(),
      });
      if (emailPending) toast.info(t("profile.emailPending"));
      else toast.success(t("profile.saved"));
    } catch {
      toast.error(t("profile.errSave"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("profile.personal")}</CardTitle>
        <CardDescription>{t("profile.personalDesc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormField id="profile-name" label={t("profile.name")} error={errors.name}>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              aria-invalid={!!errors.name}
            />
          </FormField>
          <FormField id="profile-email" label={t("profile.email")} error={errors.email}>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              aria-invalid={!!errors.email}
            />
          </FormField>
          <div className="flex justify-end">
            <Button type="submit" disabled={!dirty || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("profile.save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Preferencias ─────────────────────────────────────────────────────────────

const PREFERENCE_ROWS: { key: keyof UserPreferences; label: TKey; desc: TKey }[] = [
  { key: "autoSave", label: "profile.pref.autoSave", desc: "profile.pref.autoSaveDesc" },
  { key: "aiAlerts", label: "profile.pref.aiAlerts", desc: "profile.pref.aiAlertsDesc" },
  {
    key: "emailNotifications",
    label: "profile.pref.emailNotifications",
    desc: "profile.pref.emailNotificationsDesc",
  },
];

function PreferencesCard({ user }: { user: User }) {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { updateProfile } = useAuth();
  const { data: models = [] } = useQuery(modelsQueryOptions);
  const [defaultModel, setDefaultModel] = useState(DEFAULT_API_SETTINGS.defaultModel);

  useEffect(() => {
    setDefaultModel(loadApiSettings().defaultModel);
  }, []);

  function onModelChange(id: string) {
    setDefaultModel(id);
    saveApiSettings({ ...loadApiSettings(), defaultModel: id });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("profile.preferences")}</CardTitle>
        <CardDescription>{t("profile.preferencesDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("profile.language")}</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={lang}
              onValueChange={(v) => v && setLang(v as Lang)}
              className="w-full"
            >
              <ToggleGroupItem value="es" className="flex-1">
                Español
              </ToggleGroupItem>
              <ToggleGroupItem value="en" className="flex-1">
                English
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="space-y-1.5">
            <Label>{t("profile.theme")}</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={theme}
              onValueChange={(v) => v && setTheme(v as "light" | "dark")}
              className="w-full"
            >
              <ToggleGroupItem value="light" className="flex-1 gap-1.5">
                <Sun className="h-4 w-4" />
                {t("theme.lightShort")}
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" className="flex-1 gap-1.5">
                <Moon className="h-4 w-4" />
                {t("theme.darkShort")}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>{t("profile.defaultModel")}</Label>
          <Select value={defaultModel} onValueChange={onModelChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name} v{m.version}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 border-t border-border pt-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            {t("profile.notifications")}
          </p>
          {PREFERENCE_ROWS.map((row) => (
            <label
              key={row.key}
              htmlFor={`pref-${row.key}`}
              className="flex cursor-pointer items-center justify-between gap-4 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
            >
              <span>
                <span className="block text-sm font-medium">{t(row.label)}</span>
                <span className="block text-xs text-muted-foreground">{t(row.desc)}</span>
              </span>
              <Switch
                id={`pref-${row.key}`}
                checked={user.preferences[row.key]}
                onCheckedChange={(checked) =>
                  updateProfile({ preferences: { ...user.preferences, [row.key]: checked } }).catch(
                    () => toast.error(t("profile.errSave")),
                  )
                }
              />
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Seguridad / contraseña ───────────────────────────────────────────────────

function SecurityCard({ user }: { user: User }) {
  const { t, locale } = useI18n();
  const { changePassword, recovering } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors<"current" | "next" | "confirm">>({});
  const [saving, setSaving] = useState(false);

  // Una cuenta OAuth que nunca definió contraseña no tiene "contraseña actual", y quien abrió
  // un enlace de recuperación la está restableciendo.
  const needsCurrent =
    !recovering && (user.provider === "email" || user.passwordUpdatedAt !== null);
  const score = passwordScore(next);
  const level =
    score <= 1
      ? { label: t("pw.weak"), color: "bg-destructive" }
      : score <= 3
        ? { label: t("pw.medium"), color: "bg-chart-4" }
        : { label: t("pw.strong"), color: "bg-success" };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const nextErrors: FieldErrors<"current" | "next" | "confirm"> = {};
    if (needsCurrent && !current) nextErrors.current = t("profile.errCurrent");
    if (score < PASSWORD_RULES.length) nextErrors.next = t("profile.errWeak");
    else if (needsCurrent && current === next) nextErrors.next = t("profile.errSame");
    if (next !== confirm) nextErrors.confirm = t("profile.errMatch");
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success(t("profile.passwordChanged"));
    } catch (error) {
      const code = error instanceof AuthFailure ? error.code : "";
      toast.error(
        t(
          code === "wrong_password"
            ? "profile.errWrongPassword"
            : code === "same_password"
              ? "profile.errSame"
              : code === "weak_password"
                ? "profile.errWeak"
                : "profile.errSave",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" />
            {t("profile.security")}
          </CardTitle>
          <CardDescription>{t("profile.securityDesc")}</CardDescription>
        </div>
        <Badge variant="outline" className="text-muted-foreground">
          {user.passwordUpdatedAt
            ? t("profile.passwordUpdatedAt", {
                date: new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(user.passwordUpdatedAt)),
              })
            : t("profile.passwordNever")}
        </Badge>
      </CardHeader>
      <CardContent>
        {!needsCurrent && (
          <p className="mb-4 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
            {t("profile.oauthNote", { provider: PROVIDER_LABEL[user.provider] })}
          </p>
        )}
        <form onSubmit={onSubmit} noValidate className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            {needsCurrent && (
              <FormField
                id="pw-current"
                label={t("profile.currentPassword")}
                error={errors.current}
              >
                <PasswordInput
                  id="pw-current"
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  aria-invalid={!!errors.current}
                />
              </FormField>
            )}
            <FormField id="pw-new" label={t("profile.newPassword")} error={errors.next}>
              <PasswordInput
                id="pw-new"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                aria-invalid={!!errors.next}
              />
            </FormField>
            <FormField id="pw-confirm" label={t("profile.confirmPassword")} error={errors.confirm}>
              <PasswordInput
                id="pw-confirm"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-invalid={!!errors.confirm}
              />
            </FormField>
            <Button type="submit" disabled={saving || !next}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("profile.changePassword")}
            </Button>
          </div>

          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="uppercase tracking-wide text-muted-foreground">
                {t("profile.strength")}
              </span>
              {next && <span className="font-medium">{level.label}</span>}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {PASSWORD_RULES.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-colors duration-300",
                    next && i < score ? level.color : "bg-border",
                  )}
                />
              ))}
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {PASSWORD_RULES.map((rule) => {
                const ok = rule.test(next);
                return (
                  <li
                    key={rule.key}
                    className={cn(
                      "flex items-center gap-2 transition-colors",
                      ok ? "text-success" : "text-muted-foreground",
                    )}
                  >
                    {ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    {t(rule.key)}
                  </li>
                );
              })}
            </ul>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Sesión ───────────────────────────────────────────────────────────────────

function SessionCard() {
  const { t } = useI18n();
  const logout = useLogout();

  return (
    <Card className="border-destructive/30">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
        <div>
          <p className="font-medium">{t("profile.session")}</p>
          <p className="text-sm text-muted-foreground">{t("profile.sessionDesc")}</p>
        </div>
        <Button
          variant="outline"
          className="border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t("user.logout")}
        </Button>
      </CardContent>
    </Card>
  );
}

function FormField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
