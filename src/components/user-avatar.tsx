import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function UserAvatar({
  user,
  className,
}: {
  user: Pick<User, "name" | "avatarUrl">;
  className?: string;
}) {
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

  return (
    <Avatar className={cn("shrink-0", className)}>
      {user.avatarUrl && (
        <AvatarImage src={user.avatarUrl} alt={user.name} className="object-cover" />
      )}
      <AvatarFallback className="bg-primary font-semibold text-primary-foreground">
        {initials || "?"}
      </AvatarFallback>
    </Avatar>
  );
}
