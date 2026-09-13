import { createFileRoute } from "@tanstack/react-router";

import { saveDetection } from "@/lib/detections.server";
import { detectionErrorResponse, jsonResponse, runDetection } from "@/lib/model-api";
import { bytesToBase64 } from "@/lib/wav";

/**
 * POST /api/public/detect/audio?detector=baseline|w2v2-aasist
 * multipart/form-data con `file` (WAV estéreo 8 kHz PCM16) y `call_id` opcional.
 *
 * El sitio convierte el WAV a base64 y usa el mismo flujo que /api/public/detect.
 */
export const Route = createFileRoute("/api/public/detect/audio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Latencia real: desde que llega la petición (incluye la subida del WAV) hasta responder.
        const startedAt = Date.now();
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return jsonResponse({ error: "Se esperaba multipart/form-data" }, 400);
        }

        const file = form.get("file");
        if (!(file instanceof File)) {
          return jsonResponse({ error: "Falta el archivo `file`" }, 400);
        }

        const rawCallId = form.get("call_id");
        const callId =
          (typeof rawCallId === "string" && rawCallId.trim()) ||
          file.name.replace(/\.[^.]+$/, "") ||
          "upload";

        const wavBytes = new Uint8Array(await file.arrayBuffer());
        const url = new URL(request.url);
        try {
          const result = await runDetection({
            callId,
            audioBase64: bytesToBase64(wavBytes),
            wavBytes,
            detector: url.searchParams.get("detector") ?? url.searchParams.get("model"),
            inputType: "audio_upload",
            source: "upload",
            fileName: file.name,
          });
          result.latency_ms = Date.now() - startedAt;
          await saveDetection(request, { result, inputType: "audio_upload", wavBytes });
          return jsonResponse(result);
        } catch (error) {
          return detectionErrorResponse(error);
        }
      },
    },
  },
});
