import { cn } from "@/lib/utils";

/** Logo de la app: el mismo SVG del favicon (icono sobre el fondo naranja del tema). */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src="/favicon.svg"
      alt="VoxGuard"
      width={40}
      height={40}
      draggable={false}
      className={cn("h-10 w-10 shrink-0 select-none", className)}
    />
  );
}
