import { useEffect } from "react";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { BrandLogo } from "@/components/brand-logo";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

/** Rutas que se muestran sin sidebar ni header. */
const PUBLIC_PATHS = new Set(["/login"]);

/**
 * Demo sin autenticación: se entra directo al dashboard y ninguna ruta exige sesión.
 * /login sigue existiendo y funcionando; quien inicie sesión recupera su perfil y su historial.
 * TODO(auth): para volver a protegerlas, redirigir a /login cuando `status` sea "unauthenticated"
 * (preferiblemente desde `beforeLoad`, con la sesión en cookie).
 */
export function AppShell() {
  const { status } = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const isPublic = PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    // Tras iniciar sesión se sale del panel de login; sin sesión no se redirige a ningún lado.
    if (status === "authenticated" && isPublic) void navigate({ to: "/", replace: true });
  }, [status, isPublic, navigate]);

  if (isPublic) return <Outlet />;
  // Solo se espera mientras Supabase resuelve una sesión previa; si no hay, se entra igual.
  if (status === "loading") return <SplashScreen />;

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
      <BrandLogo className="h-14 w-14 animate-pulse" />
      <p className="text-sm text-muted-foreground">{t("auth.loading")}</p>
    </div>
  );
}
