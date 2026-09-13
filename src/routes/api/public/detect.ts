import { createFileRoute } from "@tanstack/react-router";
import { callPayloadSchema, type DetectionResult } from "@/lib/detection";

/**
 * POST /api/public/detect
 * Recibe el JSON de una llamada y devuelve si fue hecha por una IA o un humano.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO CONECTAR EL MODELO REAL
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Guardar como secretos del proyecto:
 *      MODEL_API_URL   (ej. https://mi-backend.com)
 *      MODEL_API_KEY   (token del backend)
 * 2. Sustituir el bloque `SIMULACIÓN` por:
 *
 *      const base = process.env["MODEL_API_URL"]!;   // leer dentro del handler
 *      const key = process.env["MODEL_API_KEY"]!;
 *      const upstream = await fetch(`${base}/predict`, {
 *        method: "POST",
 *        headers: {
 *          "Content-Type": "application/json",
 *          Authorization: `Bearer ${key}`,
 *        },
 *        body: JSON.stringify({ model, ...payload }),
 *      });
 *      if (!upstream.ok) {
 *        return Response.json({ error: "Modelo no disponible" }, { status: 502 });
 *      }
 *      const prediction = await upstream.json();
 *      // se espera { is_synthetic: boolean, confidence: number (0-1) }
 *
 * 3. Mantener la misma forma de respuesta (DetectionResult) para no tocar la UI.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const Route = createFileRoute("/api/public/detect")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "JSON inválido" }, { status: 400 });
        }

        const parsed = callPayloadSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "Payload inválido", issues: parsed.error.issues },
            { status: 400 },
          );
        }
        const payload = parsed.data;
        const model = new URL(request.url).searchParams.get("model") ?? "voxguard-v2";

        const started = Date.now();

        // ── SIMULACIÓN (reemplazar por la llamada al modelo real) ──────────────
        await new Promise((r) => setTimeout(r, 600));
        const seed = [...payload.call_id].reduce((a, c) => a + c.charCodeAt(0), 0);
        const rand = ((seed * 9301 + 49297) % 233280) / 233280;
        const is_synthetic = rand > 0.5;
        const confidence = Number((0.55 + rand * 0.44).toFixed(4));
        // ───────────────────────────────────────────────────────────────────────

        const result: DetectionResult = {
          call_id: payload.call_id,
          is_synthetic,
          confidence,
          model,
          latency_ms: Date.now() - started,
          received_at: new Date().toISOString(),
          ...(payload.source ? { source: payload.source } : {}),
          ...(payload.duration_sec !== undefined ? { duration_sec: payload.duration_sec } : {}),
        };

        return Response.json(result);
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
