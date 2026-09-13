# final_models — los 6 detectores de voz sintética en ONNX

Todos responden a la misma pregunta: **¿la voz del cliente (canal 0 de la llamada) es humana o
generada por IA?** Todos se ejecutan con ONNX Runtime, sin scikit-learn.

Hay dos familias. Cada una tiene **su propio extractor de features**, y no son intercambiables:

| Familia | Modelos | Extractor | Origen |
|---|---|---|---|
| **Galena** | `full`, `client_only`, `combined` | `src/backend/features/extract.py` | Este repositorio (`README_MODELS.md`) |
| **Acoustic** | `acoustic_baseline`, `acoustic_hispa`, `acoustic_combined` | `src/backend/acoustic_v1/` (`acoustic-v1-8k`) | Rama `feature/audio-pipeline`, commit `70b69c3` |

La comparación de rendimiento de los 6 en ambos datasets está en
[`MODELS_FINAL_COMPARISON.md`](../MODELS_FINAL_COMPARISON.md).

---

## Inventario

| Archivo | Algoritmo | Entrada del grafo | Features / audio usado | Umbral | Entrenado con | Tamaño |
|---|---|---|---|---|---|---|
| `synthetic_voice_detector_full_logreg.onnx` | Regresión logística + calibración Platt | `features` float32 [N, 30] | Galena `full`: voz del cliente + turnos (necesita llamada estéreo) | 0.325 | Llamadas train + val | 3 KB |
| `synthetic_voice_detector_client_only_hist_gb.onnx` | Gradient boosting (profundidad 2) | `features` float32 [N, 15] | Galena `client_only`: solo voz del cliente | 0.826 | Llamadas train + val | 40 KB |
| `synthetic_voice_detector_combined_hist_gb.onnx` | Gradient boosting (profundidad 6) + calibración Platt | `features` float32 [N, 154] | Galena `client_only` | 0.592 | Llamadas train + val y AlternativeData train + val | 673 KB |
| `acoustic_baseline.onnx` | Gradient boosting calibrado (sigmoide, 3 folds) | `features` float32 [N, 110] | `acoustic-v1-8k`: canal 0 a 8 kHz | 0.70 | Llamadas train | 148 KB |
| `acoustic_hispa.onnx` | Gradient boosting calibrado (sigmoide, 3 folds) | `features` float32 [N, 110] | `acoustic-v1-8k` | 0.70 | AlternativeData train (subconjunto de speakers; "HISPA") | 216 KB |
| `acoustic_combined.onnx` | Gradient boosting calibrado (sigmoide, 3 folds) | `features` float32 [N, 110] | `acoustic-v1-8k` | 0.70 | Llamadas train + AlternativeData train | 216 KB |

"HISPA" es el nombre que usan los scripts de la rama para `hispapoof/train`. Tiene los mismos 5 orígenes
que la carpeta `train` de AlternativeData (natural, elevenlabs, your-tts, xtts-v2, f5-tts).

---

## Cómo usar cada familia

### Galena (`synthetic_voice_detector_*.onnx`)

- **Entrada:** solo las features seleccionadas, en el orden guardado en el metadato `input_features`.
- **Salidas:** `p_synthetic` [N] e `is_synthetic` [N] (el umbral ya se aplica dentro del grafo).
- **Metadatos:** `feature_set`, `threshold`, `family`, `params`, `calibrated`.

```python
import pandas as pd
from src.backend.audio.io import load_call
from src.backend.features.extract import extract
from src.backend.models.onnx_runtime import load_onnx_artifact

artifact = load_onnx_artifact("final_models/synthetic_voice_detector_combined_hist_gb.onnx")
audio, sr = load_call("notebooks/audio/call_0181ce113ebe.wav")          # estéreo 8 kHz
features = pd.DataFrame([extract(audio, sr, artifact["feature_set"])])  # "full" o "client_only"
p = artifact["detector"].predict_proba(features)[0]
is_synthetic = p >= artifact["threshold"]
```

También se puede servir con la API: `MODEL_PATH=final_models/<archivo>.onnx uvicorn src.backend.api.app:app`.

### Acoustic (`acoustic_*.onnx`)

- **Entrada:** las 110 features de `acoustic-v1-8k`, en el orden del metadato `feature_names`.
- **Salidas:** `label` [N] y `probabilities` [N, 2]. La columna 1 es P(synthetic).
- **Importante:** `label` usa argmax (umbral 0.5). El umbral operativo es **0.70** (metadato `threshold`), así que
  hay que aplicarlo sobre `probabilities[:, 1]`.
- **Audio sin señal suficiente:** el extractor lanza `InsufficientAudioError`. La API original devuelve entonces
  el metadato `train_prior_synthetic` (baseline 0.599, hispa 0.799, combined 0.500).

```python
import json
import numpy as np
import onnxruntime as ort
from src.backend.acoustic_v1 import InsufficientAudioError, extract_call_features, load_clip_8k
from src.backend.audio.io import load_call

session = ort.InferenceSession("final_models/acoustic_combined.onnx", providers=["CPUExecutionProvider"])
meta = session.get_modelmeta().custom_metadata_map

audio, sr = load_call("notebooks/audio/call_0181ce113ebe.wav")  # llamada: usar el canal 0
signal = audio[:, 0]
# clip mono de otra fuente: signal, sr = load_clip_8k("ruta/clip.wav")

try:
    x = extract_call_features(signal, sr)[None, :].astype(np.float32)
    p = float(session.run(["probabilities"], {"features": x})[0][0, 1])
except InsufficientAudioError:
    p = float(meta["train_prior_synthetic"])
is_synthetic = p >= float(meta["threshold"])  # 0.70
```

---

## Evaluación

`python scripts/evaluate_final_models.py` evalúa los 6 archivos de esta carpeta sobre las llamadas Altur y
AlternativeData con las mismas reglas: mismos conjuntos, métricas y criterio de "datos no vistos".
Los resultados quedan en `reports/final_models/` y el resumen en `MODELS_FINAL_COMPARISON.md`.

## Procedencia

| Archivos | Fuente | Verificación |
|---|---|---|
| `synthetic_voice_detector_*.onnx` | `models/<nombre>/` (`scripts/export_onnx.py`) | SHA-256 idéntico a `models/` |
| `acoustic_*.onnx` | Descargas, iguales a `models/*.onnx` del commit `70b69c3` (rama `feature/audio-pipeline`) | SHA-256 idéntico al commit |
