import type { ModelInfo } from "./detection";

/**
 * Catálogo de modelos con métricas SIMULADAS.
 *
 * CUANDO EL BACKEND REAL ESTÉ LISTO:
 * borrar este archivo y hacer que `GET /api/public/models`
 * (src/routes/api/public/models.ts) consulte
 * `${process.env["MODEL_API_URL"]}/models` y devuelva la misma forma.
 */
export const MODELS: ModelInfo[] = [
  {
    id: "voxguard-v2",
    name: "VoxGuard",
    version: "2.4.1",
    description: {
      es: "Modelo principal de detección de voz sintética. Combina características espectrales con un clasificador transformer sobre embeddings de hablante.",
      en: "Main synthetic-voice detection model. Combines spectral features with a transformer classifier over speaker embeddings.",
    },
    status: "active",
    trained_on: { es: "412k llamadas etiquetadas (ES/EN)", en: "412k labeled calls (ES/EN)" },
    metrics: {
      auc: 0.984,
      avg_latency_ms: 312,
      confusion: { true_ai: 4720, false_ai: 243, true_human: 5180, false_human: 280 },
      history: [
        { month: "2026-03", accuracy: 0.912, f1: 0.902, auc: 0.951 },
        { month: "2026-04", accuracy: 0.921, f1: 0.915, auc: 0.958 },
        { month: "2026-05", accuracy: 0.93, f1: 0.924, auc: 0.965 },
        { month: "2026-06", accuracy: 0.937, f1: 0.933, auc: 0.971 },
        { month: "2026-07", accuracy: 0.944, f1: 0.941, auc: 0.978 },
        { month: "2026-08", accuracy: 0.95, f1: 0.947, auc: 0.984 },
      ],
    },
  },
  {
    id: "voxguard-lite",
    name: "VoxGuard Lite",
    version: "1.8.0",
    description: {
      es: "Versión ligera optimizada para latencia baja en tiempo real. Menor exactitud, respuesta por debajo de 100 ms.",
      en: "Lightweight version optimized for low real-time latency. Lower accuracy, responses under 100 ms.",
    },
    status: "active",
    trained_on: { es: "180k llamadas etiquetadas (ES)", en: "180k labeled calls (ES)" },
    metrics: {
      auc: 0.943,
      avg_latency_ms: 84,
      confusion: { true_ai: 4310, false_ai: 489, true_human: 4980, false_human: 576 },
      history: [
        { month: "2026-03", accuracy: 0.852, f1: 0.844, auc: 0.901 },
        { month: "2026-04", accuracy: 0.864, f1: 0.856, auc: 0.911 },
        { month: "2026-05", accuracy: 0.876, f1: 0.865, auc: 0.92 },
        { month: "2026-06", accuracy: 0.884, f1: 0.874, auc: 0.929 },
        { month: "2026-07", accuracy: 0.891, f1: 0.883, auc: 0.937 },
        { month: "2026-08", accuracy: 0.897, f1: 0.89, auc: 0.943 },
      ],
    },
  },
  {
    id: "prosody-x",
    name: "Prosody-X",
    version: "0.9.3",
    description: {
      es: "Modelo experimental basado en ritmo, entonación y micro-pausas. En evaluación para llamadas con ruido alto.",
      en: "Experimental model based on rhythm, intonation and micro-pauses. Under evaluation for high-noise calls.",
    },
    status: "beta",
    trained_on: {
      es: "96k llamadas etiquetadas (multi-idioma)",
      en: "96k labeled calls (multilingual)",
    },
    metrics: {
      auc: 0.921,
      avg_latency_ms: 528,
      confusion: { true_ai: 4402, false_ai: 712, true_human: 4690, false_human: 474 },
      history: [
        { month: "2026-03", accuracy: 0.79, f1: 0.781, auc: 0.842 },
        { month: "2026-04", accuracy: 0.812, f1: 0.805, auc: 0.863 },
        { month: "2026-05", accuracy: 0.834, f1: 0.831, auc: 0.881 },
        { month: "2026-06", accuracy: 0.851, f1: 0.856, auc: 0.897 },
        { month: "2026-07", accuracy: 0.869, f1: 0.872, auc: 0.911 },
        { month: "2026-08", accuracy: 0.885, f1: 0.881, auc: 0.921 },
      ],
    },
  },
];
