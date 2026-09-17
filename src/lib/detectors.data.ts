import type { ConfusionCounts, EvaluationSubset, ModelEvaluation, ModelInfo } from "./detection";
import report from "./evaluations.generated.json";

/**
 * Catálogo de los detectores públicos: los 3 con nombre de montaña (Everest, Fuji, Mont Blanc), de
 * los 6 ONNX de lamunuwa/galena-live (rama feat/synthetic-voice-detection-models, commit 307b538).
 * Los experimentales (galena-full, galena-client-only, acoustic-baseline) no se ofrecen en el sitio
 * ni en su API.
 *
 * Métricas y curvas: evaluations.generated.json, generado con
 * galena-live/scripts/evaluate_mountain_models.py --fresh. Cada modelo ONNX servido (los mismos
 * archivos de services/model-api/final_models) se ejecutó sobre los 20,122 clips de AlternativeData
 * test (18,606 IA, 1,516 humanos), extrayendo las features desde el audio. Ningún modelo usó ese
 * split para entrenar; incluye generadores (xtts-v1, fish-speech) y speakers que no vieron.
 * Es la fuente del catálogo: la demo no usa base de datos.
 */

type ReportModel = keyof typeof report.models;

/** Evaluación real de un modelo en AlternativeData test, leída del reporte generado. */
function clipsTest(id: ReportModel): ModelEvaluation {
  const r = report.models[id];
  return {
    dataset: "AlternativeData",
    split: "test",
    evaluated_at: report.evaluated_at,
    sample_count: r.n,
    threshold: r.threshold,
    confusion: r.confusion as ConfusionCounts,
    accuracy: r.accuracy,
    balanced_accuracy: r.balanced_accuracy,
    precision: r.precision,
    recall: r.recall,
    f1: r.f1,
    auc: r.auc,
    average_precision: r.average_precision,
    brier: r.brier,
    eer: r.eer,
    latency_p95_ms: null,
    roc: r.roc as [number, number][],
    pr: r.pr as [number, number][],
    scores: r.scores,
    subsets: r.subsets as ModelEvaluation["subsets"] satisfies Record<EvaluationSubset, unknown>,
    generators: r.generators,
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
      es: "El mejor modelo en conjunto y el que mejor generaliza: AUC 0.903 en los 20,122 clips de prueba, 0.942 con speakers nuevos y 0.863 con generadores nuevos, marcando como IA solo al 5.2 % de los humanos. Su punto débil es fish-speech (16 %).",
      en: "The best model overall and the one that generalizes best: AUC 0.903 on the 20,122 test clips, 0.942 on new speakers and 0.863 on new generators, flagging only 5.2% of humans as AI. Its weak spot is fish-speech (16%).",
    },
    trained_on: {
      es: "Llamadas de voz (train + val) y AlternativeData (train + val)",
      en: "Voice calls (train + val) and AlternativeData (train + val)",
    },
    status: "active",
    threshold: report.models.everest.threshold,
    is_default: true,
    stereo_only: false,
    evaluations: [clipsTest("everest")],
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
      es: "El más conservador con humanos: solo 4.0 % de falsos positivos en los clips de prueba. Es ligero y no usa VAD, pero deja pasar el 60.7 % de las voces de IA (AUC 0.781).",
      en: "The most conservative with humans: only 4.0% false positives on the test clips. Lightweight and VAD-free, but it lets 60.7% of AI voices through (AUC 0.781).",
    },
    trained_on: {
      es: "Llamadas de voz (train) y AlternativeData (train)",
      en: "Voice calls (train) and AlternativeData (train)",
    },
    status: "active",
    threshold: 0.7,
    is_default: false,
    stereo_only: false,
    evaluations: [clipsTest("fuji")],
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
      es: "Entrenado solo con clips de AlternativeData. Es el que más detecta generadores difíciles (fish-speech 41.9 %, xtts-v1 94.8 %) y el mejor calibrado (Brier 0.091), pero marca como IA al 27.0 % de los humanos (AUC 0.822).",
      en: "Trained only on AlternativeData clips. It catches the most hard generators (fish-speech 41.9%, xtts-v1 94.8%) and is the best calibrated (Brier 0.091), but flags 27.0% of humans as AI (AUC 0.822).",
    },
    trained_on: {
      es: "AlternativeData train (subconjunto de speakers)",
      en: "AlternativeData train (speaker subset)",
    },
    status: "active",
    threshold: 0.7,
    is_default: false,
    stereo_only: false,
    evaluations: [clipsTest("montblanc")],
  },
];

export const DEFAULT_DETECTOR_ID = DETECTORS.find((d) => d.is_default)?.id ?? "everest";

export function findDetector(id: string) {
  return DETECTORS.find((d) => d.id === id);
}
