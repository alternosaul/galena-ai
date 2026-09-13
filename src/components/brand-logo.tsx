import { cn } from "@/lib/utils";

/**
 * Logo de la app: icono sobre el fondo naranja del tema.
 * El icono es blanco en tema claro y negro en tema oscuro (sigue la clase `.dark` de la app).
 */
export function BrandLogo({ className }: { className?: string }) {
  const base = cn("h-10 w-10 shrink-0 select-none", className);
  return (
    <>
      <img
        src="/logo-light.svg"
        alt="VoxGuard"
        width={40}
        height={40}
        draggable={false}
        className={cn(base, "dark:hidden")}
      />
      <img
        src="/logo-dark.svg"
        alt="VoxGuard"
        width={40}
        height={40}
        draggable={false}
        className={cn(base, "hidden dark:block")}
      />
    </>
  );
}
