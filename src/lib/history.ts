import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Database } from "./database.types";
import type { DetectionResult } from "./detection";
import { getSupabase } from "./supabase";

/**
 * Historial de detecciones leído de Supabase (public.detections).
 * Las filas las inserta el servidor en /api/public/detect*; RLS devuelve solo las del
 * usuario con sesión (o todas, si es admin).
 */

type DetectionRow = Database["public"]["Tables"]["detections"]["Row"];

export const HISTORY_LIMIT = 500;

function toResult(row: DetectionRow): DetectionResult {
  const metadata = row.request_metadata;
  const simulated =
    typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)
      ? metadata["simulated"] === true
      : false;
  // La columna confidence guarda P(sintético); la app muestra la confianza en el veredicto.
  const isSynthetic = row.is_synthetic ?? false;
  const pSynthetic = row.confidence ?? 0;
  return {
    call_id: row.call_id,
    is_synthetic: isSynthetic,
    confidence: Number((isSynthetic ? pSynthetic : 1 - pSynthetic).toFixed(6)),
    p_synthetic: pSynthetic,
    model: row.detector_id,
    latency_ms: row.latency_ms ?? 0,
    received_at: row.created_at,
    ...(row.threshold !== null ? { threshold: row.threshold } : {}),
    ...(row.api_detection_id ? { detection_id: row.api_detection_id } : {}),
    ...(row.source ? { source: row.source } : {}),
    ...(row.file_name ? { file_name: row.file_name } : {}),
    ...(row.duration_sec !== null ? { duration_sec: row.duration_sec } : {}),
    ...(row.sample_rate !== null ? { sample_rate: row.sample_rate } : {}),
    ...(row.channels !== null ? { channels: row.channels } : {}),
    ...(simulated ? { simulated: true } : {}),
  };
}

export const historyQueryOptions = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["detections", userId ?? "anonymous"],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("detections")
        .select("*")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT);
      if (error) throw new Error(error.message);
      return data.map(toResult);
    },
  });

export function useDetectionHistory(userId: string | undefined) {
  return useQuery(historyQueryOptions(userId));
}

/** Tras una detección nueva: vuelve a leer el historial. */
export function useInvalidateHistory() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["detections"] });
}

/** Borra el historial propio (RLS: "users delete own detections"). */
export function useClearHistory(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { error } = await getSupabase().from("detections").delete().eq("user_id", userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["detections"] }),
  });
}
