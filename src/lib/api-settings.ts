import { DEFAULT_DETECTOR_ID, findDetector } from "./detectors.data";

/**
 * Preferencias de conexión editadas en la pantalla API.
 * Solo se guardan valores no sensibles en localStorage. La URL real que usa el servidor
 * es la variable de entorno MODEL_API_URL (ver src/lib/model-api.ts).
 *
 * TODO(Supabase): persistir estos valores en la tabla app_settings.
 */

export type ApiSettings = {
  baseUrl: string;
  timeoutSec: number;
  retries: number;
  defaultModel: string;
  inputFormat: "json" | "multipart";
};

export const DEFAULT_API_SETTINGS: ApiSettings = {
  baseUrl: "http://127.0.0.1:8000",
  timeoutSec: 30,
  retries: 1,
  defaultModel: DEFAULT_DETECTOR_ID,
  inputFormat: "json",
};

const STORAGE_KEY = "voxguard.api-settings";

export function loadApiSettings(): ApiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const settings = raw
      ? { ...DEFAULT_API_SETTINGS, ...(JSON.parse(raw) as Partial<ApiSettings>) }
      : DEFAULT_API_SETTINGS;
    // Preferencias antiguas pueden apuntar a modelos que ya no existen.
    return findDetector(settings.defaultModel)
      ? settings
      : { ...settings, defaultModel: DEFAULT_DETECTOR_ID };
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
