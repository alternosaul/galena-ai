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
