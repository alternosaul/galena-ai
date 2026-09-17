import type { ModelEvaluation } from "./detection";

/**
 * Métricas de clasificación binaria (clase positiva = IA) derivadas de una evaluación real.
 * Las curvas (ROC, PR, distribución de puntajes) vienen calculadas en la evaluación; aquí solo se
 * completan tasas a partir de la matriz de confusión.
 */

/** null = la evaluación no trae los datos necesarios (p. ej. sin matriz de confusión). */
export type DerivedMetrics = {
  accuracy: number | null;
  balancedAccuracy: number | null;
  precision: number | null;
  recall: number | null;
  specificity: number | null;
  f1: number | null;
  mcc: number | null;
  auc: number | null;
  eer: number | null;
  brier: number | null;
  /** Humanos marcados como IA / humanos. */
  falsePositiveRate: number | null;
  /** IA que pasa como humana / IA. */
  falseNegativeRate: number | null;
  positives: number | null;
  negatives: number | null;
};

export function deriveMetrics(evaluation: ModelEvaluation | null): DerivedMetrics {
  const confusion = evaluation?.confusion ?? null;
  let fromConfusion: {
    accuracy: number;
    balancedAccuracy: number;
    precision: number;
    recall: number;
    specificity: number;
    f1: number;
    mcc: number;
  } | null = null;

  if (confusion) {
    const { true_ai: tp, false_ai: fp, true_human: tn, false_human: fn } = confusion;
    const precision = ratio(tp, tp + fp);
    const recall = ratio(tp, tp + fn);
    const specificity = ratio(tn, tn + fp);
    const mccDen = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn));
    fromConfusion = {
      accuracy: ratio(tp + tn, tp + fp + tn + fn),
      balancedAccuracy: (recall + specificity) / 2,
      precision,
      recall,
      specificity,
      f1: ratio(2 * precision * recall, precision + recall),
      mcc: mccDen ? (tp * tn - fp * fn) / mccDen : 0,
    };
  }

  const auc = evaluation?.auc ?? null;
  return {
    accuracy: evaluation?.accuracy ?? fromConfusion?.accuracy ?? null,
    balancedAccuracy: evaluation?.balanced_accuracy ?? fromConfusion?.balancedAccuracy ?? null,
    precision: evaluation?.precision ?? fromConfusion?.precision ?? null,
    recall: fromConfusion?.recall ?? null,
    specificity: fromConfusion?.specificity ?? null,
    f1: evaluation?.f1 ?? fromConfusion?.f1 ?? null,
    mcc: fromConfusion?.mcc ?? null,
    auc,
    eer: evaluation?.eer ?? null,
    brier: evaluation?.brier ?? null,
    falsePositiveRate: fromConfusion ? 1 - fromConfusion.specificity : null,
    falseNegativeRate: fromConfusion ? 1 - fromConfusion.recall : null,
    positives: confusion ? confusion.true_ai + confusion.false_human : null,
    negatives: confusion ? confusion.true_human + confusion.false_ai : null,
  };
}

function ratio(a: number, b: number) {
  return b ? a / b : 0;
}
