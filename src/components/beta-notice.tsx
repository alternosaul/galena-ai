import { useEffect, useState } from "react";
import { FlaskConical, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const APP_VERSION = "0.0.4";

const STORAGE_KEY = "galena.betaNoticeDismissed";

/** Aviso de versión beta bajo el header; se puede cerrar y no vuelve a salir durante la sesión. */
export function BetaNotice() {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // Sin acceso a sessionStorage: el aviso simplemente se muestra.
    }
  }, []);

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignorado: solo se cierra en esta vista.
    }
  };

  return (
    <div
      role="status"
      className="flex items-start gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 md:px-6 dark:text-amber-200"
    >
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p className="flex-1">{t("beta.notice", { version: APP_VERSION })}</p>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("beta.dismiss")}
        className="rounded p-0.5 opacity-70 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
