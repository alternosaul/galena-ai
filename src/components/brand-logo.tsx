import { withBase } from "@/lib/base-path";
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
        src={withBase("/logo-light.svg")}
        alt="Galenia"
        width={40}
        height={40}
        draggable={false}
        className={cn(base, "dark:hidden")}
      />
      <img
        src={withBase("/logo-dark.svg")}
        alt="Galenia"
        width={40}
        height={40}
        draggable={false}
        className={cn(base, "hidden dark:block")}
      />
    </>
  );
}
