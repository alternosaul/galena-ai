import { useCallback } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Plug, UserRound } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export function useLogout() {
  const { logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  return useCallback(() => {
    logout();
    toast.success(t("user.loggedOut"));
    void navigate({ to: "/login", replace: true });
  }, [logout, navigate, t]);
}

export function UserMenu() {
  const { user } = useAuth();
  const { t } = useI18n();
  const logout = useLogout();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("user.menu")}
          className="rounded-full outline-none ring-offset-2 ring-offset-background transition-shadow hover:ring-2 hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <UserAvatar user={user} className="h-9 w-9" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-3 font-normal">
          <UserAvatar user={user} className="h-10 w-10" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile">
            <UserRound className="mr-2 h-4 w-4" />
            {t("user.profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/api-config">
            <Plug className="mr-2 h-4 w-4" />
            {t("api.title")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          {t("user.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
