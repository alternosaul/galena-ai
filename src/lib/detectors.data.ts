import type { ConfusionCounts, ModelEvaluation, ModelInfo } from "./detection";

/**
 * Catálogo de los 6 detectores ONNX servidos por services/model-api (copiados de
 * lamunuwa/galena-live, rama feat/synthetic-voice-detection-models, commit 307b538).
 *
 * Orden y nombres de montaña: ranking general de MODELS_FINAL_COMPARISON.md (promedio de AUC y
 * balanced accuracy en llamadas Altur y AlternativeData). Métricas: reports/final_models/summary.csv,
 * siempre en datos no vistos por el modelo:
 *   - Llamadas Altur val: 71 llamadas (37 humanas, 34 IA).
 *   - AlternativeData test: 20,122 clips, con generadores (xtts-v1, fish-speech) y speakers nuevos.
 * Mismo contenido que supabase/migrations/20260913000800_reference_data.sql.
 *
 * TODO(Supabase): leer de detectors + detector_evaluations cuando haya credenciales.
 */

const EVALUATED_AT = "2026-09-13T00:00:00Z";

type EvaluationValues = Pick<
  ModelEvaluation,
  | "threshold"
  | "confusion"
  | "accuracy"
  | "balanced_accuracy"
  | "precision"
  | "f1"
  | "auc"
  | "brier"
  | "train_only_reference"
>;

/** Matriz en el orden del reporte: TN · FP · FN · TP (positivo = IA). */
function cm(tn: number, fp: number, fn: number, tp: number): ConfusionCounts {
  return { true_human: tn, false_ai: fp, false_human: fn, true_ai: tp };
}

function callsVal(values: EvaluationValues): ModelEvaluation {
  return {
    dataset: "Altur",
    split: "val",
    evaluated_at: EVALUATED_AT,
    sample_count: 71,
    latency_p95_ms: null,
    ...values,
  };
}

function clipsTest(values: EvaluationValues): ModelEvaluation {
  return {
    dataset: "AlternativeData",
    split: "test",
    evaluated_at: EVALUATED_AT,
    sample_count: 20_122,
    latency_p95_ms: null,
    ...values,
  };
}

const GB_CALIBRATED = {
  es: "Gradient boosting calibrado (sigmoide, 3 folds)",
  en: "Calibrated gradient boosting (sigmoid, 3 folds)",
};

const ACOUSTIC_FEATURES = {
  es: "110 features acoustic-v1-8k del canal del cliente a 8 kHz: energía, cruces por cero, espectro y 13 LFCC, resumidos en media, desviación y percentiles",
  en: "110 acoustic-v1-8k features from the client channel at 8 kHz: energy, zero crossings, spectrum and 13 LFCCs, summarized as mean, std and percentiles",
};

export const DETECTORS: Omit<ModelInfo, "available">[] = [
  {
    id: "everest",
    name: "Everest",
    rank: 1,
    experimental: false,
    family: "galena",
    api_model_name: "synthetic_voice_detector_combined_hist_gb.onnx",
    version: "1.0.0",
    algorithm: {
      es: "Gradient boosting (profundidad 6) con calibración Platt",
      en: "Gradient boosting (depth 6) with Platt calibration",
    },
    features: {
      es: "154 features Galena client_only: MFCC y sus deltas, espectro, pitch y nivel de la voz del cliente, solo en frames con voz (VAD)",
      en: "154 Galena client_only features: MFCCs and deltas, spectrum, pitch and level of the client's voice, speech frames only (VAD)",
    },
    description: {
      es: "El mejor modelo en conjunto. Casi perfecto en llamadas Altur y el que mejor generaliza a voces y generadores nuevos: AUC 0.903 en AlternativeData y 0.863 en generadores no vistos, con 5 % de falsos positivos.",
      en: "The best model overall. Near-perfect on Altur calls and the best at generalizing to new voices and generators: AUC 0.903 on AlternativeData and 0.863 on unseen generators, with 5% false positives.",
    },
    trained_on: {
      es: "Llamadas Altur (train + val) y AlternativeData (train + val)",
      en: "Altur calls (train + val) and AlternativeData (train + val)",
    },
    status: "active",
    threshold: 0.5916,
    is_default: true,
    stereo_only: false,
    evaluations: [
      callsVal({
        threshold: 0.5868,
        train_only_reference: true,
        confusion: cm(37, 0, 3, 31),
        accuracy: 0.9577,
        balanced_accuracy: 0.9559,
        precision: 1,
        f1: 0.9538,
        auc: 1,
        brier: 0.0187,
      }),
      clipsTest({
        threshold: 0.5916,
        train_only_reference: false,
        confusion: cm(1437, 79, 6565, 12041),
        accuracy: 0.6698,
        balanced_accuracy: 0.7975,
        precision: 0.9935,
        f1: 0.7838,
        auc: 0.9033,
        brier: 0.2258,
      }),
    ],
  },
  {
    id: "fuji",
    name: "Fuji",
    rank: 2,
    experimental: false,
    family: "acoustic",
    api_model_name: "acoustic_combined.onnx",
    version: "1.0.0",
    algorithm: GB_CALIBRATED,
    features: ACOUSTIC_FEATURES,
    description: {
      es: "Segundo mejor en conjunto y el más conservador con humanos: solo 4 % de falsos positivos en AlternativeData. Es ligero y no usa VAD, aunque deja pasar más voces de IA que Everest.",
      en: "Second best overall and the most conservative with humans: only 4% false positives on AlternativeData. Lightweight and VAD-free, though it lets more AI voices through than Everest.",
    },
    trained_on: {
      es: "Llamadas Altur (train) y AlternativeData (train)",
      en: "Altur calls (train) and AlternativeData (train)",
    },
    status: "active",
    threshold: 0.7,
    is_default: false,
    stereo_only: false,
    evaluations: [
      callsVal({
        threshold: 0.7,
        train_only_reference: false,
        confusion: cm(37, 0, 6, 28),
        accuracy: 0.9155,
        balanced_accuracy: 0.9118,
        precision: 1,
        f1: 0.9032,
        auc: 0.9984,
        brier: 0.042,
      }),
      clipsTest({
        threshold: 0.7,
        train_only_reference: false,
        confusion: cm(1456, 60, 11287, 7319),
        accuracy: 0.4361,
        balanced_accuracy: 0.6769,
        precision: 0.9919,
        f1: 0.5633,
        auc: 0.7805,
        brier: 0.27,
      }),
    ],
  },
  {
    id: "montblanc",
    name: "Mont Blanc",
    rank: 3,
    experimental: false,
    family: "acoustic",
    api_model_name: "acoustic_hispa.onnx",
    version: "1.0.0",
    algorithm: GB_CALIBRATED,
    features: ACOUSTIC_FEATURES,
    description: {
      es: "Entrenado solo con clips de AlternativeData. Es el que más detecta generadores difíciles (fish-speech 41.9 %) y el mejor calibrado en clips, pero marca como IA a cerca del 27 % de los humanos y en llamadas baja a AUC 0.760.",
      en: "Trained only on AlternativeData clips. It catches the most hard generators (fish-speech 41.9%) and is the best calibrated on clips, but flags about 27% of humans as AI and drops to AUC 0.760 on calls.",
    },
    trained_on: {
      es: "AlternativeData train (subconjunto de speakers)",
      en: "AlternativeData train (speaker subset)",
    },
    status: "active",
    threshold: 0.7,
    is_default: false,
    stereo_only: false,
    evaluations: [
      callsVal({
        threshold: 0.7,
        train_only_reference: false,
        confusion: cm(26, 11, 9, 25),
        accuracy: 0.7183,
        balanced_accuracy: 0.719,
        precision: 0.6944,
        f1: 0.7143,
        auc: 0.7599,
        brier: 0.2481,
      }),
      clipsTest({
        threshold: 0.7,
        train_only_reference: false,
        confusion: cm(1107, 409, 4600, 14006),
        accuracy: 0.7511,
        balanced_accuracy: 0.7415,
        precision: 0.9716,
        f1: 0.8483,
        auc: 0.8218,
        brier: 0.0912,
      }),
    ],
  },
  {
    id: "galena-full",
    name: "Galena Full",
    rank: null,
    experimental: true,
    family: "galena",
    api_model_name: "synthetic_voice_detector_full_logreg.onnx",
    version: "1.0.0",
    algorithm: {
      es: "Regresión logística con calibración Platt",
      en: "Logistic regression with Platt calibration",
    },
    features: {
      es: "30 features Galena full: voz del cliente y dinámica de turnos con el agente (latencias, solapamientos, pausas)",
      en: "30 Galena full features: client voice plus turn-taking dynamics with the agent (latencies, overlaps, pauses)",
    },
    description: {
      es: "Perfecto en llamadas Altur (0 errores en val), pero depende de los turnos con el agente: solo funciona con la llamada estéreo completa y no aplica a clips de otras fuentes.",
      en: "Perfect on Altur calls (0 errors on val), but it relies on turns with the agent: it only works with the full stereo call and does not apply to clips from other sources.",
    },
    trained_on: { es: "Llamadas Altur (train + val)", en: "Altur calls (train + val)" },
    status: "beta",
    threshold: 0.3252,
    is_default: false,
    stereo_only: true,
    evaluations: [
      callsVal({
        threshold: 0.8989,
        train_only_reference: true,
        confusion: cm(37, 0, 0, 34),
        accuracy: 1,
        balanced_accuracy: 1,
        precision: 1,
        f1: 1,
        auc: 1,
        brier: 0,
      }),
    ],
  },
  {
    id: "galena-client-only",
    name: "Galena Client-only",
    rank: null,
    experimental: true,
    family: "galena",
    api_model_name: "synthetic_voice_detector_client_only_hist_gb.onnx",
    version: "1.0.0",
    algorithm: {
      es: "Gradient boosting (profundidad 2)",
      en: "Gradient boosting (depth 2)",
    },
    features: {
      es: "15 features Galena client_only de la voz del cliente (espectro, pitch y nivel en frames con voz)",
      en: "15 Galena client_only features from the client's voice (spectrum, pitch and level on speech frames)",
    },
    description: {
      es: "Perfecto en llamadas Altur, pero con voz de otras fuentes cae al azar (AUC 0.447 en AlternativeData): aprendió rasgos propios de la cadena de grabación de las llamadas.",
      en: "Perfect on Altur calls, but falls to chance on voice from other sources (AUC 0.447 on AlternativeData): it learned traits specific to the calls' recording chain.",
    },
    trained_on: { es: "Llamadas Altur (train + val)", en: "Altur calls (train + val)" },
    status: "beta",
    threshold: 0.8258,
    is_default: false,
    stereo_only: false,
    evaluations: [
      callsVal({
        threshold: 0.7604,
        train_only_reference: true,
        confusion: cm(37, 0, 0, 34),
        accuracy: 1,
        balanced_accuracy: 1,
        precision: 1,
        f1: 1,
        auc: 1,
        brier: 0.0103,
      }),
      clipsTest({
        threshold: 0.8258,
        train_only_reference: false,
        confusion: cm(1082, 434, 13751, 4855),
        accuracy: 0.2951,
        balanced_accuracy: 0.4873,
        precision: 0.9179,
        f1: 0.4064,
        auc: 0.4467,
        brier: 0.5517,
      }),
    ],
  },
  {
    id: "acoustic-baseline",
    name: "Acoustic Baseline",
    rank: null,
    experimental: true,
    family: "acoustic",
    api_model_name: "acoustic_baseline.onnx",
    version: "1.0.0",
    algorithm: GB_CALIBRATED,
    features: ACOUSTIC_FEATURES,
    description: {
      es: "Primer detector acústico del proyecto: AUC 0.990 en llamadas Altur, pero al azar con voz de otras fuentes (AUC 0.477 en AlternativeData).",
      en: "The project's first acoustic detector: AUC 0.990 on Altur calls, but at chance on voice from other sources (AUC 0.477 on AlternativeData).",
    },
    trained_on: { es: "Llamadas Altur (train)", en: "Altur calls (train)" },
    status: "beta",
    threshold: 0.7,
    is_default: false,
    stereo_only: false,
    evaluations: [
      callsVal({
        threshold: 0.7,
        train_only_reference: false,
        confusion: cm(34, 3, 1, 33),
        accuracy: 0.9437,
        balanced_accuracy: 0.9448,
        precision: 0.9167,
        f1: 0.9429,
        auc: 0.9897,
        brier: 0.0691,
      }),
      clipsTest({
        threshold: 0.7,
        train_only_reference: false,
        confusion: cm(1423, 93, 17151, 1455),
        accuracy: 0.143,
        balanced_accuracy: 0.5084,
        precision: 0.9399,
        f1: 0.1444,
        auc: 0.4773,
        brier: 0.615,
      }),
    ],
  },
];

export const DEFAULT_DETECTOR_ID = DETECTORS.find((d) => d.is_default)?.id ?? "everest";

export function findDetector(id: string) {
  return DETECTORS.find((d) => d.id === id);
}
