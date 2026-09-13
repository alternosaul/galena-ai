import { useEffect } from "react";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Waves } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

/** Rutas accesibles sin sesión; se muestran sin sidebar ni header. */
const PUBLIC_PATHS = new Set(["/login"]);

/**
 * Protege las rutas del lado del cliente mientras la autenticación es simulada.
 * TODO(auth): con sesión real en cookie, mover esta verificación a `beforeLoad`.
 */
export function AppShell() {
  const { status } = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const isPublic = PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    if (status === "unauthenticated" && !isPublic) void navigate({ to: "/login", replace: true });
    if (status === "authenticated" && isPublic) void navigate({ to: "/", replace: true });
  }, [status, isPublic, navigate]);

  if (isPublic) return <Outlet />;
  if (status !== "authenticated") return <SplashScreen />;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="flex-1 p-4 md:p-6">
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function SplashScreen() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <span className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <Waves className="h-7 w-7" />
      </span>
      <p className="text-sm text-muted-foreground">{t("auth.loading")}</p>
    </div>
  );
}
