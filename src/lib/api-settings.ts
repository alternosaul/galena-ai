/**
 * Preferencias de conexión editadas en la pantalla API.
 * Solo se guardan valores no sensibles en localStorage; la clave del modelo
 * vive como secreto MODEL_API_KEY en el servidor (ver src/routes/api/public/detect.ts).
 *
 * TODO(backend): persistir estos valores del lado del servidor cuando exista
 * un endpoint de configuración.
 */

export type ApiSettings = {
  baseUrl: string;
  timeoutSec: number;
  retries: number;
  defaultModel: string;
  inputFormat: "json" | "multipart";
};

export const DEFAULT_API_SETTINGS: ApiSettings = {
  baseUrl: "https://api.voxguard.example.com",
  timeoutSec: 15,
  retries: 2,
  defaultModel: "voxguard-v2",
  inputFormat: "json",
};

const STORAGE_KEY = "voxguard.api-settings";

export function loadApiSettings(): ApiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw
      ? { ...DEFAULT_API_SETTINGS, ...(JSON.parse(raw) as Partial<ApiSettings>) }
      : DEFAULT_API_SETTINGS;
  } catch {
    return DEFAULT_API_SETTINGS;
  }
}

export function saveApiSettings(settings: ApiSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignorar
  }
}
