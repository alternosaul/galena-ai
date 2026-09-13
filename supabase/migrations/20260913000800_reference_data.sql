-- Galena AI · datos de referencia (van en una migración, no en seed.sql, para que
-- también existan en producción).
-- Fuente: lamunuwa/galena-live, rama feat/synthetic-voice-detection-models (commit 307b538):
--   final_models/README.md, MODELS_FINAL_COMPARISON.md y reports/final_models/summary.csv.
-- Mismo contenido que src/lib/detectors.data.ts.

insert into public.detectors (
  id, name, api_model_name, version,
  description_es, description_en, trained_on_es, trained_on_en,
  algorithm_es, algorithm_en, features_es, features_en,
  status, threshold, sample_rate, channels, is_default, sort_order,
  display_rank, experimental, family, feature_set, stereo_only
)
values
  (
    'everest', 'Everest', 'synthetic_voice_detector_combined_hist_gb.onnx', '1.0.0',
    'El mejor modelo en conjunto. Casi perfecto en llamadas Altur y el que mejor generaliza a voces y generadores nuevos.',
    'The best model overall. Near-perfect on Altur calls and the best at generalizing to new voices and generators.',
    'Llamadas Altur (train + val) y AlternativeData (train + val)',
    'Altur calls (train + val) and AlternativeData (train + val)',
    'Gradient boosting (profundidad 6) con calibración Platt', 'Gradient boosting (depth 6) with Platt calibration',
    '154 features Galena client_only (MFCC, espectro, pitch y nivel con VAD)', '154 Galena client_only features (MFCC, spectrum, pitch and level with VAD)',
    'active', 0.592, 8000, 2, true, 1,
    1, false, 'galena', 'client_only', false
  ),
  (
    'fuji', 'Fuji', 'acoustic_combined.onnx', '1.0.0',
    'Segundo mejor en conjunto y el más conservador con humanos (4 % de falsos positivos en AlternativeData).',
    'Second best overall and the most conservative with humans (4% false positives on AlternativeData).',
    'Llamadas Altur (train) y AlternativeData (train)', 'Altur calls (train) and AlternativeData (train)',
    'Gradient boosting calibrado (sigmoide, 3 folds)', 'Calibrated gradient boosting (sigmoid, 3 folds)',
    '110 features acoustic-v1-8k (energía, espectro y 13 LFCC)', '110 acoustic-v1-8k features (energy, spectrum and 13 LFCCs)',
    'active', 0.700, 8000, 2, false, 2,
    2, false, 'acoustic', 'acoustic-v1-8k', false
  ),
  (
    'montblanc', 'Mont Blanc', 'acoustic_hispa.onnx', '1.0.0',
    'Entrenado solo con clips: el que más detecta generadores difíciles, con más falsos positivos en humanos.',
    'Trained only on clips: catches the most hard generators, with more false positives on humans.',
    'AlternativeData train (subconjunto de speakers)', 'AlternativeData train (speaker subset)',
    'Gradient boosting calibrado (sigmoide, 3 folds)', 'Calibrated gradient boosting (sigmoid, 3 folds)',
    '110 features acoustic-v1-8k (energía, espectro y 13 LFCC)', '110 acoustic-v1-8k features (energy, spectrum and 13 LFCCs)',
    'active', 0.700, 8000, 2, false, 3,
    3, false, 'acoustic', 'acoustic-v1-8k', false
  ),
  (
    'galena-full', 'Galena Full', 'synthetic_voice_detector_full_logreg.onnx', '1.0.0',
    'Perfecto en llamadas Altur, pero depende de los turnos con el agente: solo llamada estéreo.',
    'Perfect on Altur calls, but relies on turns with the agent: stereo calls only.',
    'Llamadas Altur (train + val)', 'Altur calls (train + val)',
    'Regresión logística con calibración Platt', 'Logistic regression with Platt calibration',
    '30 features Galena full (voz del cliente + dinámica de turnos)', '30 Galena full features (client voice + turn dynamics)',
    'beta', 0.325, 8000, 2, false, 4,
    null, true, 'galena', 'full', true
  ),
  (
    'galena-client-only', 'Galena Client-only', 'synthetic_voice_detector_client_only_hist_gb.onnx', '1.0.0',
    'Perfecto en llamadas Altur, pero cae al azar con voz de otras fuentes.',
    'Perfect on Altur calls, but falls to chance on voice from other sources.',
    'Llamadas Altur (train + val)', 'Altur calls (train + val)',
    'Gradient boosting (profundidad 2)', 'Gradient boosting (depth 2)',
    '15 features Galena client_only', '15 Galena client_only features',
    'beta', 0.826, 8000, 2, false, 5,
    null, true, 'galena', 'client_only', false
  ),
  (
    'acoustic-baseline', 'Acoustic Baseline', 'acoustic_baseline.onnx', '1.0.0',
    'Primer detector acústico: AUC 0.990 en llamadas, al azar con voz de otras fuentes.',
    'First acoustic detector: AUC 0.990 on calls, at chance on voice from other sources.',
    'Llamadas Altur (train)', 'Altur calls (train)',
    'Gradient boosting calibrado (sigmoide, 3 folds)', 'Calibrated gradient boosting (sigmoid, 3 folds)',
    '110 features acoustic-v1-8k (energía, espectro y 13 LFCC)', '110 acoustic-v1-8k features (energy, spectrum and 13 LFCCs)',
    'beta', 0.700, 8000, 2, false, 6,
    null, true, 'acoustic', 'acoustic-v1-8k', false
  )
on conflict (id) do nothing;

-- Evaluaciones en datos no vistos (reports/final_models/summary.csv).
-- Llamadas Altur val: 71 llamadas. AlternativeData test: 20,122 clips.
-- En los modelos Galena, las llamadas val son la referencia del modelo entrenado solo con train.
insert into public.detector_evaluations (
  detector_id, dataset, split, evaluated_at, sample_count, threshold,
  true_negatives, false_positives, false_negatives, true_positives,
  accuracy, balanced_accuracy, precision, recall, f1, auc, brier, notes, report
)
values
  ('everest', 'Altur', 'val', '2026-09-13T00:00:00Z', 71, 0.587,
   37, 0, 3, 31, 0.95775, 0.95588, 1.00000, 0.91176, 0.95385, 1.00000, 0.01869,
   'Referencia del modelo entrenado solo con train.',
   '{"status": "held_out_train_only_reference", "mcfadden_pseudo_r2": 0.8515}'),
  ('everest', 'AlternativeData', 'test', '2026-09-13T00:00:00Z', 20122, 0.592,
   1437, 79, 6565, 12041, 0.66981, 0.79752, 0.99348, 0.64716, 0.78377, 0.90326, 0.22584,
   'Incluye generadores (xtts-v1, fish-speech) y speakers no vistos.',
   '{"status": "held_out", "mcfadden_pseudo_r2": -1.6396}'),

  ('fuji', 'Altur', 'val', '2026-09-13T00:00:00Z', 71, 0.700,
   37, 0, 6, 28, 0.91549, 0.91176, 1.00000, 0.82353, 0.90323, 0.99841, 0.04199,
   null, '{"status": "held_out", "mcfadden_pseudo_r2": 0.7548}'),
  ('fuji', 'AlternativeData', 'test', '2026-09-13T00:00:00Z', 20122, 0.700,
   1456, 60, 11287, 7319, 0.43609, 0.67689, 0.99187, 0.39337, 0.56332, 0.78047, 0.26998,
   null, '{"status": "held_out", "mcfadden_pseudo_r2": -1.9182}'),

  ('montblanc', 'Altur', 'val', '2026-09-13T00:00:00Z', 71, 0.700,
   26, 11, 9, 25, 0.71831, 0.71900, 0.69444, 0.73529, 0.71429, 0.75994, 0.24813,
   null, '{"status": "held_out", "mcfadden_pseudo_r2": 0.0446}'),
  ('montblanc', 'AlternativeData', 'test', '2026-09-13T00:00:00Z', 20122, 0.700,
   1107, 409, 4600, 14006, 0.75107, 0.74149, 0.97163, 0.75277, 0.84831, 0.82177, 0.09121,
   null, '{"status": "held_out", "mcfadden_pseudo_r2": -0.1459}'),

  ('galena-full', 'Altur', 'val', '2026-09-13T00:00:00Z', 71, 0.899,
   37, 0, 0, 34, 1.00000, 1.00000, 1.00000, 1.00000, 1.00000, 1.00000, 0.00001,
   'Referencia del modelo entrenado solo con train. No aplica a clips (necesita estéreo).',
   '{"status": "held_out_train_only_reference", "mcfadden_pseudo_r2": 0.9989}'),

  ('galena-client-only', 'Altur', 'val', '2026-09-13T00:00:00Z', 71, 0.760,
   37, 0, 0, 34, 1.00000, 1.00000, 1.00000, 1.00000, 1.00000, 1.00000, 0.01030,
   'Referencia del modelo entrenado solo con train.',
   '{"status": "held_out_train_only_reference", "mcfadden_pseudo_r2": 0.9436}'),
  ('galena-client-only', 'AlternativeData', 'test', '2026-09-13T00:00:00Z', 20122, 0.826,
   1082, 434, 13751, 4855, 0.29505, 0.48733, 0.91794, 0.26094, 0.40636, 0.44667, 0.55168,
   null, '{"status": "held_out", "mcfadden_pseudo_r2": -10.2660}'),

  ('acoustic-baseline', 'Altur', 'val', '2026-09-13T00:00:00Z', 71, 0.700,
   34, 3, 1, 33, 0.94366, 0.94475, 0.91667, 0.97059, 0.94286, 0.98967, 0.06912,
   null, '{"status": "held_out", "mcfadden_pseudo_r2": 0.6893}'),
  ('acoustic-baseline', 'AlternativeData', 'test', '2026-09-13T00:00:00Z', 20122, 0.700,
   1423, 93, 17151, 1455, 0.14303, 0.50843, 0.93992, 0.07820, 0.14439, 0.47731, 0.61503,
   null, '{"status": "held_out", "mcfadden_pseudo_r2": -6.9018}');

insert into public.app_settings (id, model_api_url, timeout_seconds, retries, default_detector_id)
values (true, 'http://127.0.0.1:8000', 30, 1, 'everest')
on conflict (id) do nothing;
