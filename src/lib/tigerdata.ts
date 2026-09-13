import { useSyncExternalStore } from "react";
import type { DetectionResult } from "./detection";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CAPA DE HISTORIAL
 * ─────────────────────────────────────────────────────────────────────────────
 * Hoy el historial vive solo en memoria del navegador (se pierde al recargar)
 * y arranca con registros de ejemplo para poder visualizar la tabla.
 *
 * CÓMO CONECTAR SUPABASE (tabla public.detections, ver supabase/migrations):
 *
 * 1. Variables de entorno del servidor: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 *    (mientras la autenticación sea simulada; después, la sesión del usuario + RLS).
 *    NUNCA uses la service role key en el navegador.
 *
 * 2. Crear server functions (TanStack `createServerFn`):
 *      saveDetection  → insert en detections (sin audio_base64: la tabla lo rechaza)
 *      listDetections → select * from detections order by created_at desc limit 200
 *    Tipos generados en src/lib/database.types.ts.
 *
 * 3. Sustituir el cuerpo de `addDetection` por `saveDetection` y alimentar
 *    `useDetectionHistory` con `listDetections` vía TanStack Query.
 *    Eliminar `sampleHistory()`. La interfaz pública de este archivo no cambia.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const SAMPLE_BASE = Date.parse("2026-09-12T15:30:00Z");
const SAMPLE_DETECTORS = [
  { id: "everest", threshold: 0.592, latency: [900, 2600] },
  { id: "fuji", threshold: 0.7, latency: [250, 800] },
  { id: "montblanc", threshold: 0.7, latency: [250, 800] },
] as const;
const SAMPLE_SOURCES = ["api", "upload"];

/** Pseudoaleatorio determinista: mismo resultado en servidor y cliente. */
function pseudo(n: number) {
  const x = Math.sin(n * 9301.7) * 10000;
  return x - Math.floor(x);
}

function sampleHistory(): DetectionResult[] {
  return Array.from({ length: 24 }, (_, i) => {
    const r1 = pseudo(i + 1);
    const r2 = pseudo(i * 7 + 3);
    const detector = SAMPLE_DETECTORS[i % SAMPLE_DETECTORS.length] ?? SAMPLE_DETECTORS[0];
    const confidence = Number(r2.toFixed(4));
    const [minLatency, maxLatency] = detector.latency;
    return {
      call_id: `call_${Math.floor(r1 * 0xffffffffffff)
        .toString(16)
        .padStart(12, "0")}`,
      is_synthetic: confidence >= detector.threshold,
      confidence,
      model: detector.id,
      threshold: detector.threshold,
      latency_ms: Math.round(minLatency + r1 * (maxLatency - minLatency)),
      received_at: new Date(SAMPLE_BASE - i * 7 * 60_000 - Math.round(r2 * 120_000)).toISOString(),
      source: SAMPLE_SOURCES[i % SAMPLE_SOURCES.length] ?? "api",
      duration_sec: Number((20 + r2 * 140).toFixed(1)),
      sample_rate: 8000,
      channels: 2,
    };
  });
}

let history: DetectionResult[] = sampleHistory();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function addDetection(result: DetectionResult) {
  // TODO(Supabase): reemplazar por `await saveDetection({ data: result })`
  history = [result, ...history].slice(0, 200);
  emit();
}

export function clearHistory() {
  // TODO(Supabase): reemplazar por un DELETE server-side si se requiere
  history = [];
  emit();
}

export function getHistory() {
  return history;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDetectionHistory() {
  // TODO(Supabase): cambiar por useQuery({ queryKey: ["detections"], queryFn: listDetections })
  return useSyncExternalStore(subscribe, getHistory, getHistory);
}
