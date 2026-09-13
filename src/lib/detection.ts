import { z } from "zod";
import type { LocalizedText } from "./i18n";

/**
 * Contratos compartidos entre el frontend, las rutas /api/public/* del sitio y la
 * API de modelos (services/model-api, POST /detect). Ver src/lib/model-api.ts.
 */

/** Límite de la API de modelos para el cuerpo JSON (16 MiB). */
export const MAX_JSON_BYTES = 16 * 1024 * 1024;
/** Tamaño máximo de un WAV que cabe en ese JSON una vez convertido a base64. */
export const MAX_WAV_BYTES = Math.floor(((MAX_JSON_BYTES - 1024) * 3) / 4);

/** Cuerpo de POST /detect (mismo contrato que la API de modelos; `source` es propio del sitio). */
export const detectRequestSchema = z.object({
  call_id: z.string().trim().min(1, "call_id debe ser texto no vacío"),
  audio_base64: z.string().min(1).max(MAX_JSON_BYTES),
  sample_rate: z.literal(8000),
  channels: z.literal(2),
  source: z.string().max(100).optional(),
});

export type DetectRequest = z.infer<typeof detectRequestSchema>;

export const detectionResultSchema = z.object({
  call_id: z.string(),
  is_synthetic: z.boolean(),
  /** P(voz sintética) según el detector, entre 0 y 1. */
  confidence: z.number().min(0).max(1),
  /** id del detector: everest | fuji | montblanc | galena-full | galena-client-only | acoustic-baseline */
  model: z.string(),
  threshold: z.number().min(0).max(1).optional(),
  /** Header X-Detection-ID de la API de modelos. */
  detection_id: z.string().optional(),
  latency_ms: z.number(),
  received_at: z.string(),
  source: z.string().optional(),
  file_name: z.string().optional(),
  duration_sec: z.number().optional(),
  sample_rate: z.number().optional(),
  channels: z.number().optional(),
  /** true cuando MODEL_API_URL no está configurada y el resultado es de demostración. */
  simulated: z.boolean().optional(),
});

export type DetectionResult = z.infer<typeof detectionResultSchema>;

export type ConfusionCounts = {
  true_ai: number;
  false_ai: number;
  true_human: number;
  false_human: number;
};

/** Conjuntos de evaluación (datos no vistos por cada modelo). */
export type ModelDataset = "Altur" | "AlternativeData";

/** Evaluación de un detector (tabla detector_evaluations en Supabase). */
export type ModelEvaluation = {
  dataset: ModelDataset;
  split: "train" | "val" | "test" | "alternate";
  evaluated_at: string;
  sample_count: number;
  threshold: number;
  confusion: ConfusionCounts | null;
  accuracy: number | null;
  balanced_accuracy: number | null;
  precision: number | null;
  f1: number | null;
  auc: number | null;
  brier: number | null;
  latency_p95_ms: number | null;
  /** Métrica del modelo entrenado solo con train (la versión final se reentrenó con train + val). */
  train_only_reference: boolean;
};

/** Detector de la API de modelos (tabla detectors en Supabase). */
export type ModelInfo = {
  id: string;
  name: string;
  /** 1–3 para los modelos con nombre de montaña; null para los experimentales. */
  rank: 1 | 2 | 3 | null;
  experimental: boolean;
  family: "galena" | "acoustic";
  /** Archivo ONNX en services/model-api/final_models. */
  api_model_name: string;
  version: string;
  algorithm: LocalizedText;
  features: LocalizedText;
  description: LocalizedText;
  trained_on: LocalizedText;
  status: "active" | "beta" | "deprecated";
  threshold: number;
  is_default: boolean;
  /** Solo acepta la llamada estéreo completa (usa los turnos del agente). */
  stereo_only: boolean;
  /** Según GET /health de la API; null cuando la API no está conectada (modo simulado). */
  available: boolean | null;
  evaluations: ModelEvaluation[];
};

export type ModelsResponse = { mode: "live" | "simulated"; models: ModelInfo[] };

export function evaluationFor(model: ModelInfo, dataset: ModelDataset): ModelEvaluation | null {
  return model.evaluations.find((e) => e.dataset === dataset) ?? null;
}

/**
 * Ejemplo de referencia (llamada real call_5e4539a471f6 del reto Altur). El audio (~4 MB en
 * base64) se recorta a su cabecera WAV: sirve para mostrar el formato, no para enviarse.
 */
export const EXAMPLE_PAYLOAD = JSON.stringify(
  {
    call_id: "call_5e4539a471f6",
    audio_base64:
      "UklGRiT+LgBXQVZFZm10IBAAAAABAAIAQB8AAAB9AAAEABAAZGF0YQD+LgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA…",
    sample_rate: 8000,
    channels: 2,
  },
  null,
  2,
);
