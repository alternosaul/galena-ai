# Galena model API

API FastAPI que sirve los **6 detectores ONNX** de voz sintética del equipo. El sitio la consume desde
el servidor (`MODEL_API_URL`); el navegador nunca habla con ella directamente.

| id | Nombre en el sitio | Archivo | Familia |
|---|---|---|---|
| `everest` | Everest (1.º) | `synthetic_voice_detector_combined_hist_gb.onnx` | Galena, `client_only` |
| `fuji` | Fuji (2.º) | `acoustic_combined.onnx` | Acoustic `acoustic-v1-8k` |
| `montblanc` | Mont Blanc (3.º) | `acoustic_hispa.onnx` | Acoustic `acoustic-v1-8k` |
| `galena-full` | Experimental | `synthetic_voice_detector_full_logreg.onnx` | Galena, `full` (solo estéreo) |
| `galena-client-only` | Experimental | `synthetic_voice_detector_client_only_hist_gb.onnx` | Galena, `client_only` |
| `acoustic-baseline` | Experimental | `acoustic_baseline.onnx` | Acoustic `acoustic-v1-8k` |

El orden sigue el ranking general de `MODELS_FINAL_COMPARISON.md` (promedio en llamadas Altur y AlternativeData).

## Procedencia

`final_models/` y `src/backend/` se copiaron **sin cambios** (SHA-256 idénticos) de
`lamunuwa/galena-live`, rama `feat/synthetic-voice-detection-models`, commit `307b538`. Solo `app.py`
es propio de este servicio. Para actualizar los modelos, vuelve a copiar esos archivos.

## Contrato

```http
POST /detect?detector=everest
Content-Type: application/json

{"call_id": "call_0a9c546208d1", "audio_base64": "<WAV 8 kHz PCM16>", "sample_rate": 8000, "channels": 2}
```

Respuesta: `{"call_id", "is_synthetic", "confidence", "p_synthetic", "detector", "threshold"}` más los
headers `X-Detection-ID` y `X-Detector`. `confidence` es P(voz sintética), igual que `p_synthetic`.

Errores: 400 (JSON, base64, WAV o detector inválido), 413 (> 16 MiB), 415 (no JSON), 503 (sin plazas de inferencia).

`GET /health` → `{status, default_detector, available_detectors, thresholds, models}`.

## Desarrollo

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements-dev.txt
.venv/bin/python -m pytest tests
GALENA_TEST_CALL=/ruta/call.wav .venv/bin/python -m pytest tests   # incluye una llamada real
.venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Variables: `GALENA_DEFAULT_DETECTOR` (por defecto `everest`), `GALENA_MODELS_DIR`, `GALENA_INFERENCE_SLOTS` (2).
