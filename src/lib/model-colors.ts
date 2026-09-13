import type { ModelInfo } from "./detection";

/**
 * Color fijo por modelo (nunca por ranking de una métrica):
 * - Montañas: --series-1..3 según su posición (Everest, Fuji, Mont Blanc).
 * - Experimentales: gris atenuado con distinta intensidad; no se generan hues nuevos.
 */
export function modelColor(models: Pick<ModelInfo, "id" | "rank">[], id: string) {
  const model = models.find((m) => m.id === id);
  if (model?.rank) return `var(--series-${model.rank})`;
  const experimental = models.filter((m) => m.rank === null);
  const index = Math.max(
    0,
    experimental.findIndex((m) => m.id === id),
  );
  return `color-mix(in oklab, var(--color-muted-foreground) ${80 - index * 20}%, transparent)`;
}
