import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { DetectionResult } from "./detection";

/**
 * Historial de detecciones de la demo, guardado en este navegador (localStorage), sin backend.
 * El detector agrega cada resultado exitoso salvo que la preferencia autoSave esté apagada.
 */

export const HISTORY_LIMIT = 500;

const STORAGE_KEY = "galena.history";
const QUERY_KEY = ["detections"] as const;

function readHistory(): DetectionResult[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as DetectionResult[]) : [];
  } catch {
    return [];
  }
}

function writeHistory(items: DetectionResult[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, HISTORY_LIMIT)));
  } catch {
    // Almacenamiento lleno o no disponible: la detección se muestra pero no se guarda.
  }
}

export const historyQueryOptions = queryOptions({
  queryKey: QUERY_KEY,
  queryFn: async () => readHistory(),
});

export function useDetectionHistory() {
  return useQuery(historyQueryOptions);
}

/** Agrega una detección al inicio del historial y refresca la vista. */
export function useAddToHistory() {
  const queryClient = useQueryClient();
  return (result: DetectionResult) => {
    writeHistory([result, ...readHistory()]);
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  };
}

export function useClearHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // almacenamiento no disponible
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
