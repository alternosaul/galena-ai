import { createFileRoute } from "@tanstack/react-router";

import { getModelApiHealth } from "@/lib/model-api";

/**
 * GET /api/public/health
 * Estado de la API de modelos: modo (live/simulated), detectores cargados y umbrales.
 */
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const health = await getModelApiHealth();
        return Response.json(health, { status: health.ok ? 200 : 503 });
      },
    },
  },
});
