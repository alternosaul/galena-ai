import { z } from "zod";

import type { DetectionResult } from "./detection";
import { DEFAULT_DETECTOR_ID, DETECTORS, findDetector } from "./detectors.data";
import { alturWavIssues, describeWavIssue, parseWavHeader } from "./wav";

/**
 * Cliente de la API de modelos (services/model-api: 6 detectores ONNX). Solo se usa desde las
 * rutas /api/public/* (servidor); el navegador nunca habla directamente con la API.
 *
 * Variables de entorno (en la VPS: /etc/galena-ai.env):
 *   MODEL_API_URL         URL base, p. ej. http://127.0.0.1:8000.
 *                         Si no está definida, el sitio responde en modo simulado.
 *   MODEL_API_TIMEOUT_MS  Tiempo máximo por detección (por defecto 30000 ms).
 */

const upstreamDetectionSchema = z.object({
  is_synthetic: z.boolean(),
  /** Confianza en el veredicto (versiones anteriores de la API enviaban aquí P(sintético)). */
  confidence: z.number().min(0).max(1),
  /** services/model-api devuelve P(sintético) explícita y el umbral del modelo usado. */
  p_synthetic: z.number().min(0).max(1).optional(),
  threshold: z.number().min(0).max(1).optional(),
});

const upstreamHealthSchema = z.object({
  status: z.string(),
  default_detector: z.string().optional(),
  available_detectors: z.array(z.string()).optional(),
  thresholds: z.record(z.number()).optional(),
});

export type ModelApiHealth = {
  mode: "live" | "simulated";
  ok: boolean;
  latency_ms: number | null;
  default_detector: string | null;
  available_detectors: string[];
  thresholds: Record<string, number>;
  error: string | null;
};

export class DetectionError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type DetectionInput = {
  callId: string;
  audioBase64: string;
  wavBytes: Uint8Array;
  detector: string | null;
  inputType: "json" | "audio_upload";
  source: string;
  fileName?: string | undefined;
};

type Prediction = {
  is_synthetic: boolean;
  confidence: number;
  p_synthetic: number;
  threshold: number | null;
  detector: string;
  detection_id: string | null;
  simulated: boolean;
};

/** Confianza en el veredicto a partir de P(sintético), redondeada a 6 decimales. */
export function verdictConfidence(isSynthetic: boolean, pSynthetic: number) {
  return Number((isSynthetic ? pSynthetic : 1 - pSynthetic).toFixed(6));
}

export function modelApiBaseUrl(): string | null {
  const raw = process.env["MODEL_API_URL"]?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

function detectionTimeoutMs() {
  const value = Number(process.env["MODEL_API_TIMEOUT_MS"]);
  return Number.isFinite(value) && value > 0 ? value : 30_000;
}

/** Valida el WAV, llama a la API de modelos (o simula) y arma la respuesta del sitio. */
export async function runDetection(input: DetectionInput): Promise<DetectionResult> {
  const detector = findDetector(input.detector ?? DEFAULT_DETECTOR_ID);
  if (!detector) throw new DetectionError(`Detector desconocido: ${input.detector}`, 400);

  const info = parseWavHeader(input.wavBytes);
  const issues = alturWavIssues(info);
  if (!info || issues.length > 0) {
    throw new DetectionError(issues.map(describeWavIssue).join("; "), 400);
  }

  const started = Date.now();
  const receivedAt = new Date().toISOString();
  const base = modelApiBaseUrl();
  const prediction = base
    ? await callModelApi(base, input, detector.id)
    : await simulatePrediction(input, detector.id, detector.threshold);

  return {
    call_id: input.callId,
    is_synthetic: prediction.is_synthetic,
    confidence: prediction.confidence,
    p_synthetic: prediction.p_synthetic,
    model: prediction.detector,
    threshold: prediction.threshold ?? detector.threshold,
    ...(prediction.detection_id ? { detection_id: prediction.detection_id } : {}),
    latency_ms: Date.now() - started,
    received_at: receivedAt,
    source: input.source,
    ...(input.fileName ? { file_name: input.fileName } : {}),
    duration_sec: Number(info.durationSec.toFixed(2)),
    sample_rate: info.sampleRate,
    channels: info.channels,
    ...(prediction.simulated ? { simulated: true } : {}),
  };
}

async function callModelApi(base: string, input: DetectionInput, detectorId: string) {
  let res: Response;
  try {
    res = await fetch(`${base}/detect?detector=${encodeURIComponent(detectorId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        call_id: input.callId,
        audio_base64: input.audioBase64,
        sample_rate: 8000,
        channels: 2,
      }),
      signal: AbortSignal.timeout(detectionTimeoutMs()),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    throw new DetectionError(
      timedOut ? "La API de modelos no respondió a tiempo" : "La API de modelos no está disponible",
      timedOut ? 504 : 503,
    );
  }

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const upstreamMessage =
      typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : null;
    throw new DetectionError(
      upstreamMessage ?? `La API de modelos respondió HTTP ${res.status}`,
      [400, 413, 415, 503].includes(res.status) ? res.status : 502,
    );
  }

  const parsed = upstreamDetectionSchema.safeParse(body);
  if (!parsed.success) throw new DetectionError("Respuesta inválida de la API de modelos", 502);

  // Se recalcula desde p_synthetic para no depender de qué semántica de `confidence` use la API.
  const pSynthetic = parsed.data.p_synthetic ?? parsed.data.confidence;
  return {
    is_synthetic: parsed.data.is_synthetic,
    confidence: verdictConfidence(parsed.data.is_synthetic, pSynthetic),
    p_synthetic: pSynthetic,
    threshold: parsed.data.threshold ?? null,
    detector: res.headers.get("X-Detector") ?? detectorId,
    detection_id: res.headers.get("X-Detection-ID"),
    simulated: false,
  } satisfies Prediction;
}

/** Resultado determinista de demostración mientras la API no está conectada. */
async function simulatePrediction(
  input: DetectionInput,
  detectorId: string,
  threshold: number,
): Promise<Prediction> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  let seed = input.wavBytes.length;
  for (const char of `${detectorId}:${input.callId}`) {
    seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  }
  const pSynthetic = Number(((seed % 10_000) / 10_000).toFixed(4));
  const isSynthetic = pSynthetic >= threshold;
  return {
    is_synthetic: isSynthetic,
    confidence: verdictConfidence(isSynthetic, pSynthetic),
    p_synthetic: pSynthetic,
    threshold,
    detector: detectorId,
    detection_id: null,
    simulated: true,
  };
}

/** Estado de la API de modelos (GET /health), o el catálogo local en modo simulado. */
export async function getModelApiHealth(): Promise<ModelApiHealth> {
  const base = modelApiBaseUrl();
  if (!base) {
    return {
      mode: "simulated",
      ok: true,
      latency_ms: null,
      default_detector: DEFAULT_DETECTOR_ID,
      available_detectors: DETECTORS.map((d) => d.id),
      thresholds: Object.fromEntries(DETECTORS.map((d) => [d.id, d.threshold])),
      error: null,
    };
  }

  const started = Date.now();
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5_000) });
    const parsed = upstreamHealthSchema.safeParse(await res.json().catch(() => null));
    if (!res.ok || !parsed.success) throw new Error(`HTTP ${res.status}`);
    return {
      mode: "live",
      ok: parsed.data.status === "ok",
      latency_ms: Date.now() - started,
      default_detector: parsed.data.default_detector ?? null,
      available_detectors: parsed.data.available_detectors ?? [],
      thresholds: parsed.data.thresholds ?? {},
      error: null,
    };
  } catch (error) {
    return {
      mode: "live",
      ok: false,
      latency_ms: null,
      default_detector: null,
      available_detectors: [],
      thresholds: {},
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export function detectionErrorResponse(error: unknown) {
  if (error instanceof DetectionError) return jsonResponse({ error: error.message }, error.status);
  console.error(error);
  return jsonResponse({ error: "Error interno de detección" }, 500);
}
