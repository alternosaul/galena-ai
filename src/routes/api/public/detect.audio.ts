import { createFileRoute } from "@tanstack/react-router";
import type { DetectionResult } from "@/lib/detection";

/**
 * POST /api/public/detect/audio
 * Recibe un archivo de audio (multipart/form-data, campo `file`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO CONECTAR EL MODELO REAL
 * ─────────────────────────────────────────────────────────────────────────────
 * Reemplazar el bloque `SIMULACIÓN` por el reenvío del archivo al backend:
 *
 *   const base = process.env["MODEL_API_URL"]!;  // leer dentro del handler
 *   const key = process.env["MODEL_API_KEY"]!;
 *   const upstream = await fetch(`${base}/predict/audio`, {
 *     method: "POST",
 *     headers: { Authorization: `Bearer ${key}` }, // sin Content-Type: lo pone FormData
 *     body: form,                                   // el mismo FormData recibido
 *   });
 *   const prediction = await upstream.json();
 *   // se espera { is_synthetic: boolean, confidence: number (0-1) }
 * ─────────────────────────────────────────────────────────────────────────────
 */
const MAX_BYTES = 25 * 1024 * 1024;

export const Route = createFileRoute("/api/public/detect/audio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ error: "Se esperaba multipart/form-data" }, { status: 400 });
        }

        const file = form.get("file");
        if (!(file instanceof File)) {
          return Response.json({ error: "Falta el archivo `file`" }, { status: 400 });
        }
        if (file.size > MAX_BYTES) {
          return Response.json({ error: "El archivo supera 25 MB" }, { status: 413 });
        }

        const model = new URL(request.url).searchParams.get("model") ?? "voxguard-v2";
        const started = Date.now();

        // ── SIMULACIÓN (reemplazar por el reenvío al modelo real) ──────────────
        await new Promise((r) => setTimeout(r, 900));
        const seed = file.size + file.name.length;
        const rand = ((seed * 9301 + 49297) % 233280) / 233280;
        const is_synthetic = rand > 0.5;
        const confidence = Number((0.55 + rand * 0.44).toFixed(4));
        // ───────────────────────────────────────────────────────────────────────

        const result: DetectionResult = {
          call_id: file.name,
          is_synthetic,
          confidence,
          model,
          latency_ms: Date.now() - started,
          received_at: new Date().toISOString(),
          source: "upload",
        };

        return Response.json(result);
      },
    },
  },
});
