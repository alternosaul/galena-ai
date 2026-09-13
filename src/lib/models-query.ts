import { queryOptions } from "@tanstack/react-query";
import type { ModelInfo } from "./detection";

export const modelsQueryOptions = queryOptions({
  queryKey: ["models"],
  queryFn: async (): Promise<ModelInfo[]> => {
    const res = await fetch("/api/public/models");
    if (!res.ok) throw new Error(`GET /api/public/models → ${res.status}`);
    const body = (await res.json()) as { models: ModelInfo[] };
    return body.models;
  },
});

/** Color de serie fijo por posición en el catálogo (nunca por ranking). */
export function modelColor(models: ModelInfo[], id: string) {
  const index = Math.max(
    0,
    models.findIndex((m) => m.id === id),
  );
  return `var(--series-${(index % 3) + 1})`;
}
