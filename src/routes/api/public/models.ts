import { createFileRoute } from "@tanstack/react-router";
import { MODELS } from "@/lib/models.data";

/**
 * GET /api/public/models
 * Catálogo de modelos y sus métricas de rendimiento.
 *
 * CUANDO EL BACKEND REAL ESTÉ LISTO, sustituir por:
 *
 *   const base = process.env["MODEL_API_URL"]!;   // leer dentro del handler
 *   const key = process.env["MODEL_API_KEY"]!;
 *   const res = await fetch(`${base}/models`, {
 *     headers: { Authorization: `Bearer ${key}` },
 *   });
 *   return Response.json(await res.json());
 */
export const Route = createFileRoute("/api/public/models")({
  server: {
    handlers: {
      GET: async () => Response.json({ models: MODELS }),
    },
  },
});
