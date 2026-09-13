import { useSyncExternalStore } from "react";
import type { DetectionResult } from "./detection";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CAPA DE HISTORIAL (TigerData)
 * ─────────────────────────────────────────────────────────────────────────────
 * Hoy el historial vive solo en memoria del navegador (se pierde al recargar)
 * y arranca con registros de ejemplo para poder visualizar la tabla.
 *
 * CÓMO CONECTAR TIGERDATA CUANDO LA BASE DE DATOS ESTÉ LISTA:
 *
 * 1. Guardar la cadena de conexión como secreto del proyecto:
 *      TIGERDATA_URL  (ej. postgres://user:pass@host:5432/db?sslmode=require)
 *
 * 2. Crear `src/lib/history.functions.ts` con dos server functions
 *    (TanStack `createServerFn`) que hablen con TigerData desde el servidor.
 *    NUNCA conectes a la base de datos desde el navegador.
 *
 *      export const saveDetection = createServerFn({ method: "POST" })
 *        .inputValidator((d: DetectionResult) => detectionResultSchema.parse(d))
 *        .handler(async ({ data }) => {
 *          const url = process.env["TIGERDATA_URL"]!; // leer dentro del handler
 *          // INSERT INTO detections (call_id, is_synthetic, confidence, model,
 *          //   latency_ms, received_at, source, duration_sec) VALUES (...)
 *        });
 *
 *      export const listDetections = createServerFn({ method: "GET" })
 *        .handler(async () => {
 *          // SELECT * FROM detections ORDER BY received_at DESC LIMIT 200
 *        });
 *
 * 3. Sustituir el cuerpo de `addDetection` por una llamada a `saveDetection`
 *    y alimentar `useDetectionHistory` con `listDetections` vía TanStack Query.
 *    Eliminar `sampleHistory()`. La interfaz pública de este archivo no cambia.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const SAMPLE_BASE = Date.parse("2026-09-12T15:30:00Z");
const SAMPLE_MODELS = ["voxguard-v2", "voxguard-lite", "prosody-x"];
const SAMPLE_SOURCES = ["inbound-pstn", "outbound-sip", "webrtc", "upload"];

/** Pseudoaleatorio determinista: mismo resultado en servidor y cliente. */
function pseudo(n: number) {
  const x = Math.sin(n * 9301.7) * 10000;
  return x - Math.floor(x);
}

function sampleHistory(): DetectionResult[] {
  return Array.from({ length: 24 }, (_, i) => {
    const r1 = pseudo(i + 1);
    const r2 = pseudo(i * 7 + 3);
    const model = SAMPLE_MODELS[i % SAMPLE_MODELS.length] ?? "voxguard-v2";
    return {
      call_id: `call_${10290 - i * 3}`,
      is_synthetic: r1 > 0.55,
      confidence: Number((0.55 + r2 * 0.44).toFixed(4)),
      model,
      latency_ms: Math.round((model === "voxguard-lite" ? 60 : 250) + r1 * 320),
      received_at: new Date(SAMPLE_BASE - i * 7 * 60_000 - Math.round(r2 * 120_000)).toISOString(),
      source: SAMPLE_SOURCES[(i * 5) % SAMPLE_SOURCES.length] ?? "upload",
      duration_sec: Number((20 + r2 * 140).toFixed(1)),
    };
  });
}

let history: DetectionResult[] = sampleHistory();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function addDetection(result: DetectionResult) {
  // TODO(TigerData): reemplazar por `await saveDetection({ data: result })`
  history = [result, ...history].slice(0, 200);
  emit();
}

export function clearHistory() {
  // TODO(TigerData): reemplazar por un DELETE server-side si se requiere
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
  // TODO(TigerData): cambiar por useQuery({ queryKey: ["detections"], queryFn: listDetections })
  return useSyncExternalStore(subscribe, getHistory, getHistory);
}
