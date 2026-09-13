import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, History, Plug, Brain } from "lucide-react";

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

const items: {
  title: TKey;
  url: "/" | "/history" | "/api-config" | "/model";
  icon: typeof Activity;
}[] = [
  { title: "nav.detector", url: "/", icon: Activity },
  { title: "nav.history", url: "/history", icon: History },
  { title: "nav.api", url: "/api-config", icon: Plug },
  { title: "nav.model", url: "/model", icon: Brain },
];

export function AppSidebar() {
  const { t } = useI18n();
  const { user } = useAuth();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-3 px-1.5 py-3">
          <BrandLogo className="h-10 w-10" />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-base font-semibold">Galenia</p>
            <p className="truncate text-xs opacity-70">{t("app.tagline")}</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider">
            {t("nav.menu")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    tooltip={t(item.title)}
                    isActive={currentPath === item.url}
                    className="h-11 gap-3 px-3 text-[15px] [&>svg]:size-5 group-data-[collapsible=icon]:!size-11 group-data-[collapsible=icon]:!p-3"
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{t(item.title)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {user && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                size="lg"
                tooltip={t("user.profile")}
                isActive={currentPath === "/profile"}
                className="group-data-[collapsible=icon]:!size-11 group-data-[collapsible=icon]:!p-1.5"
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
        <p className="px-2 py-1 text-[11px] opacity-60 group-data-[collapsible=icon]:hidden">
          {t("app.footer")}
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
