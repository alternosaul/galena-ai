import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, History, Brain } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@/lib/auth";
import { useI18n, type TKey } from "@/lib/i18n";
import { healthQueryOptions } from "@/lib/models-query";

const items: {
  title: TKey;
  url: "/" | "/history" | "/model";
  icon: typeof Activity;
}[] = [
  { title: "nav.detector", url: "/", icon: Activity },
  { title: "nav.history", url: "/history", icon: History },
  { title: "nav.model", url: "/model", icon: Brain },
];

/**
 * Estilos del menú en los temas flat: editorial numera y separa con reglas, terminal marca el activo
 * con una barra de acento y nocturne usa la serif grande. En modo ícono (colapsado) vuelven los íconos.
 */
const FLAT_MENU_BUTTON = [
  "flat:h-auto flat:gap-4 flat:rounded-none flat:px-0 flat:py-5 flat:text-2xl flat:hover:bg-transparent flat:data-[active=true]:bg-transparent flat:[&>svg]:hidden group-data-[collapsible=icon]:flat:[&>svg]:block",
  "editorial:border-b editorial:border-border editorial:data-[active=true]:font-bold",
  "terminal:mb-1.5 terminal:border-l-[3px] terminal:border-rule terminal:px-6 terminal:py-4 terminal:font-display terminal:text-xl terminal:font-semibold terminal:uppercase terminal:tracking-wide terminal:hover:bg-sidebar-accent terminal:data-[active=true]:border-primary terminal:data-[active=true]:bg-sidebar-accent",
  "nocturne:border-b nocturne:border-rule nocturne:font-display nocturne:text-4xl nocturne:text-muted-foreground nocturne:hover:text-foreground nocturne:data-[active=true]:text-foreground",
].join(" ");

export function AppSidebar() {
  const { t } = useI18n();
  const { user } = useAuth();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon" className="flat:border-rule">
      <SidebarHeader className="flat:px-10 flat:pb-6 flat:pt-10">
        <div className="flex items-center gap-3 px-1.5 py-3 flat:px-0 flat:py-0">
          <BrandLogo className="h-10 w-10 flat:hidden group-data-[collapsible=icon]:flat:block" />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-base font-semibold flat:t-display flat:text-3xl editorial:uppercase editorial:tracking-normal terminal:tracking-wider nocturne:text-5xl">
              Galenia
            </p>
            <p className="truncate text-xs opacity-70 flat:mt-3 flat:t-label flat:text-sm flat:text-muted-foreground flat:opacity-100">
              {t("app.tagline")}
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="flat:px-8">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider flat:mb-4 flat:h-auto flat:rounded-none flat:px-0 flat:t-label flat:text-sm flat:text-muted-foreground editorial:border-b-2 editorial:border-rule editorial:pb-4 nocturne:border-b nocturne:border-rule nocturne:pb-4">
            {t("nav.menu")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5 flat:gap-0">
              {items.map((item, index) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    tooltip={t(item.title)}
                    isActive={currentPath === item.url}
                    className={`h-11 gap-3 px-3 text-[15px] [&>svg]:size-5 group-data-[collapsible=icon]:!size-11 group-data-[collapsible=icon]:!p-3 ${FLAT_MENU_BUTTON}`}
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span className="hidden tabular-nums editorial:inline group-data-[collapsible=icon]:!hidden">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>{t(item.title)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="flat:px-10 flat:pb-10">
        {user && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                size="lg"
                tooltip={t("user.profile")}
                isActive={currentPath === "/profile"}
                className="group-data-[collapsible=icon]:!size-11 group-data-[collapsible=icon]:!p-1.5 flat:rounded-none"
              >
                <Link to="/profile">
                  <UserAvatar user={user} className="h-8 w-8" />
                  <span className="grid min-w-0 leading-tight">
                    <span className="truncate text-sm font-medium">{user.name}</span>
                    <span className="truncate text-xs opacity-70">{user.email}</span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
        <ServerStatus />
        <p className="px-2 py-1 text-[11px] opacity-60 flat:hidden group-data-[collapsible=icon]:hidden">
          {t("app.footer")}
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}

/** Estado del servidor de modelos, solo en los temas flat; cada tema lo presenta a su manera. */
function ServerStatus() {
  const { t } = useI18n();
  const { data: health, isPending } = useQuery(healthQueryOptions);

  const online = health?.ok === true;
  const status = isPending
    ? t("server.checking")
    : online
      ? t("server.online")
      : t("server.offline");
  const latency =
    health?.latency_ms != null ? `${(health.latency_ms / 1000).toFixed(1)} s` : undefined;

  return (
    <div className="hidden text-muted-foreground flat:block group-data-[collapsible=icon]:!hidden">
      <p className="t-label text-sm leading-7 terminal:hidden">
        <span className="block">
          {t("server.label")}
          <span className="hidden nocturne:inline"> {status}</span>
        </span>
        <span className="block nocturne:hidden">
          {status}
          {latency && ` · ${latency}`}
        </span>
      </p>
      <dl className="hidden border border-rule px-5 py-4 font-mono text-sm uppercase leading-8 tracking-wider terminal:block">
        <TerminalLine label="SRV" value={status} />
        <TerminalLine label="NODE" value={(health?.default_detector ?? "—").toUpperCase()} />
        <TerminalLine
          label="RTT"
          value={health?.latency_ms != null ? `${health.latency_ms}ms` : "—"}
        />
      </dl>
    </div>
  );
}

function TerminalLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 overflow-hidden whitespace-nowrap">
        {label} {".".repeat(12)}
      </dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}
