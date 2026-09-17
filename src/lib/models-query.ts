import { queryOptions } from "@tanstack/react-query";
import { withBase } from "./base-path";
import type { ModelInfo, ModelsResponse } from "./detection";

export const modelsQueryOptions = queryOptions({
  queryKey: ["models"],
  queryFn: async (): Promise<ModelInfo[]> => {
    const res = await fetch(withBase("/api/public/models"));
    if (!res.ok) throw new Error(`GET /api/public/models → ${res.status}`);
    const body = (await res.json()) as ModelsResponse;
    return body.models;
  },
});

export type ServerHealth = {
  mode: "live" | "simulated";
  ok: boolean;
  latency_ms: number | null;
  default_detector: string | null;
};

/** Estado del servidor de modelos para el pie del menú lateral; se refresca cada minuto. */
export const healthQueryOptions = queryOptions({
  queryKey: ["health"],
  queryFn: async (): Promise<ServerHealth> => {
    const res = await fetch(withBase("/api/public/health"));
    return (await res.json()) as ServerHealth;
  },
  refetchInterval: 60_000,
});
