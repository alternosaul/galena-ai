import { createFileRoute } from "@tanstack/react-router";

import type { ModelInfo, ModelsResponse } from "@/lib/detection";
import { DETECTORS } from "@/lib/detectors.data";
import { getModelApiHealth } from "@/lib/model-api";

/**
 * GET /api/public/models
 * Catálogo de detectores con sus métricas y, si la API de modelos está conectada,
 * cuáles tienen pesos cargados (según GET /health) y sus umbrales reales.
 *
 * TODO(Supabase): leer el catálogo de detectors + detector_evaluations.
 */
export const Route = createFileRoute("/api/public/models")({
  server: {
    handlers: {
      GET: async () => {
        const health = await getModelApiHealth();
        const models: ModelInfo[] = DETECTORS.map((detector) => ({
          ...detector,
          threshold: health.thresholds[detector.id] ?? detector.threshold,
          available:
            health.mode === "live"
              ? health.ok && health.available_detectors.includes(detector.id)
              : null,
        }));
        return Response.json({ mode: health.mode, models } satisfies ModelsResponse);
      },
    },
  },
});
