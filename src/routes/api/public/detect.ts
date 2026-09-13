import { createFileRoute } from "@tanstack/react-router";

import { detectRequestSchema, MAX_JSON_BYTES } from "@/lib/detection";
import { saveDetection } from "@/lib/detections.server";
import { detectionErrorResponse, jsonResponse, runDetection } from "@/lib/model-api";
import { base64ToBytes } from "@/lib/wav";

/**
 * POST /api/public/detect?detector=baseline|w2v2-aasist
 *
 * Mismo contrato que POST /detect de la API galena-live:
 *   { "call_id": "…", "audio_base64": "<WAV completo en base64>", "sample_rate": 8000, "channels": 2 }
 *
 * El sitio valida el JSON y la cabecera del WAV, reenvía la petición a MODEL_API_URL y
 * responde con DetectionResult. Sin MODEL_API_URL responde en modo simulado (simulated: true).
 */
export const Route = createFileRoute("/api/public/detect")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Latencia real: desde que llega la petición (incluye leer el cuerpo) hasta responder.
        const startedAt = Date.now();
        if (Number(request.headers.get("content-length") ?? "0") > MAX_JSON_BYTES) {
          return jsonResponse({ error: "El JSON debe pesar como máximo 16 MiB" }, 413);
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: "JSON inválido" }, 400);
        }

        const parsed = detectRequestSchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse(
            {
              error: "Petición inválida",
              detail: parsed.error.issues.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message,
              })),
            },
            400,
          );
        }

        const wavBytes = base64ToBytes(parsed.data.audio_base64);
        if (!wavBytes)
          return jsonResponse({ error: "audio_base64 no contiene base64 válido" }, 400);

        const url = new URL(request.url);
        try {
          const result = await runDetection({
            callId: parsed.data.call_id,
            audioBase64: parsed.data.audio_base64,
            wavBytes,
            detector: url.searchParams.get("detector") ?? url.searchParams.get("model"),
            inputType: "json",
            source: parsed.data.source ?? "api",
          });
          result.latency_ms = Date.now() - startedAt;
          await saveDetection(request, { result, inputType: "json", wavBytes });
          return jsonResponse(result);
        } catch (error) {
          return detectionErrorResponse(error);
        }
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
    },
  },
});
