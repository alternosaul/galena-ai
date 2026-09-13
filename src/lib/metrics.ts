import type { ModelEvaluation } from "./detection";

/**
 * Métricas de clasificación binaria (clase positiva = IA).
 *
 * Mientras el backend no entregue curvas reales, la ROC, la PR y la
 * distribución de puntajes se aproximan con un modelo binormal a partir
 * del AUC: puntajes humanos ~ N(-d/2, 1), puntajes IA ~ N(d/2, 1),
 * con d = √2 · Φ⁻¹(AUC). Cuando el backend exponga los puntos reales,
 * basta con sustituir estas funciones manteniendo la forma de salida.
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
    // Aproximación binormal a partir del AUC.
    eer: auc === null ? null : normCdf(-separation(auc) / 2),
    brier: evaluation?.brier ?? null,
    falsePositiveRate: fromConfusion ? 1 - fromConfusion.specificity : null,
    falseNegativeRate: fromConfusion ? 1 - fromConfusion.recall : null,
    positives: confusion ? confusion.true_ai + confusion.false_human : null,
    negatives: confusion ? confusion.true_human + confusion.false_ai : null,
  };
}

export function rocCurve(auc: number, steps = 48) {
  const d = separation(auc);
  return Array.from({ length: steps + 1 }, (_, i) => {
    // Más resolución cerca de FPR = 0, donde la curva cambia más rápido.
    const fpr = (i / steps) ** 2;
    const tpr = fpr === 0 ? 0 : fpr === 1 ? 1 : normCdf(d + normInv(fpr));
    return { fpr: round(fpr), tpr: round(tpr) };
  });
}

export function prCurve(auc: number, positives: number, negatives: number, steps = 48) {
  const points = rocCurve(auc, steps)
    .filter((p) => p.tpr > 0)
    .map(({ fpr, tpr }) => ({
      recall: tpr,
      precision: round((tpr * positives) / (tpr * positives + fpr * negatives)),
    }));
  // Umbral máximo: sin predicciones positivas, precisión 1 por convención.
  return [{ recall: 0, precision: 1 }, ...points];
}

/** Histograma de llamadas por puntaje (0-1) para cada clase real. */
export function scoreDistribution(auc: number, positives: number, negatives: number, bins = 25) {
  const d = separation(auc);
  const spread = 1.6;
  const cdf = (s: number, mean: number) =>
    s <= 0 ? 0 : s >= 1 ? 1 : normCdf(spread * normInv(s) - mean);

  return Array.from({ length: bins }, (_, i) => {
    const lo = i / bins;
    const hi = (i + 1) / bins;
    return {
      score: round((lo + hi) / 2),
      human: Math.round(negatives * (cdf(hi, -d / 2) - cdf(lo, -d / 2))),
      ai: Math.round(positives * (cdf(hi, d / 2) - cdf(lo, d / 2))),
    };
  });
}

function separation(auc: number) {
  return Math.SQRT2 * normInv(Math.min(0.9999, Math.max(0.5001, auc)));
}

function ratio(a: number, b: number) {
  return b ? a / b : 0;
}

function round(n: number) {
  return Math.round(n * 10000) / 10000;
}

/** Φ(x) — aproximación de Abramowitz & Stegun 7.1.26. */
export function normCdf(x: number) {
  const t = 1 / (1 + (0.3275911 * Math.abs(x)) / Math.SQRT2);
  const poly =
    t *
    (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/** Φ⁻¹(p) — algoritmo de Acklam. */
export function normInv(p: number) {
  const a = [
    -39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716,
    2.506628277459239,
  ] as const;
  const b = [
    -54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972,
    -13.28068155288572,
  ] as const;
  const c = [
    -0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ] as const;
  const dd = [
    0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416,
  ] as const;
  const low = 0.02425;

  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((dd[0] * q + dd[1]) * q + dd[2]) * q + dd[3]) * q + 1)
    );
  }
  if (p > 1 - low) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((dd[0] * q + dd[1]) * q + dd[2]) * q + dd[3]) * q + 1)
    );
  }
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}
