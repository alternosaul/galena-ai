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
headers `X-Detection-ID` y `X-Detector`. `p_synthetic` es P(voz sintética) e
`is_synthetic = p_synthetic >= threshold`. `confidence` es la confianza en ese veredicto
(`p_synthetic` si es sintética, `1 - p_synthetic` si es humana), que es como la interpreta el juez.

Errores: 400 (JSON, base64, WAV o detector inválido), 415 (no JSON), 503 (sin plazas de inferencia). Sin límite de tamaño del cuerpo.

`GET /health` → `{status, default_detector, available_detectors, thresholds, models}`.

## Despliegue

`Dockerfile` construye la imagen de servicio. El contenedor escucha en `$PORT` (7860 por defecto):

```bash
docker build -t galena-model-api .
docker run --rm -p 8000:8000 -e PORT=8000 galena-model-api
```

La demo pública corre en **Render** (plan Free, runtime Docker, Root Directory `services/model-api`).
Hugging Face Spaces ya no ofrece Docker en su hardware gratuito.

Medido localmente con los límites que se asumen para Render Free (512 MB, 0.1 CPU), con una llamada
de 100 s:

| Configuración | Arranque | 1.ª detección | Siguientes | Memoria |
|---|---|---|---|---|
| 6 detectores, con calentamiento | ~246 s | ~20 s | ~9–20 s | ~284 MB |
| 6 detectores, `GALENA_WARMUP=0` | ~27 s | ~213 s (Everest) | ~9–20 s | ~210 MB |
| Solo acústicos (`fuji,montblanc,acoustic-baseline`) | ~25 s | ~5 s | ~4 s | ~130 MB |

El costo de los detectores Galena (Everest, Galena Full, Galena Client-only) es numba compilando
las funciones vectorizadas de librosa al importarlas, en cada arranque del proceso: la caché en disco
de numba no lo evitó. `GALENA_WARMUP=0` solo lo mueve del arranque a la primera detección.

Render Free apaga el servicio tras 15 min sin tráfico y tarda ~1 min en volver a encenderlo, y una
función de Vercel se corta a los 300 s. Dos configuraciones funcionan:

1. **Los 6 detectores, siempre despiertos.** Calentamiento activado (por defecto) y un monitor externo
   gratuito (p. ej. UptimeRobot) que haga `GET /health` cada 10 min para que Render no lo apague.
   Un servicio 24/7 usa ~744 de las 750 horas gratuitas al mes. El arranque de ~4 min solo ocurre
   tras un deploy o reinicio.
2. **Solo acústicos, sin monitor.** `GALENA_DETECTORS=fuji,montblanc,acoustic-baseline` y
   `GALENA_DEFAULT_DETECTOR=fuji` (también en Vercel). Aun despertando, la primera detección llega
   en ~1.5 min. El sitio solo ofrece los detectores que la API reporta como cargados.

Notas de operación:

- Con poca CPU conviene `GALENA_INFERENCE_SLOTS=1`.
- Los detectores que no se carguen responden 400, y `GALENA_DEFAULT_DETECTOR` debe estar entre los
  cargados.
- No lleva CORS a propósito: solo la habla el servidor del sitio vía `MODEL_API_URL`, nunca el
  navegador. Si algún día se expone al navegador, hay que añadir `CORSMiddleware`.

## Desarrollo

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements-dev.txt
.venv/bin/python -m pytest tests
GALENA_TEST_CALL=/ruta/call.wav .venv/bin/python -m pytest tests   # incluye una llamada real
.venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Variables: `GALENA_DEFAULT_DETECTOR` (por defecto `everest`), `GALENA_DETECTORS` (todos),
`GALENA_WARMUP` (`1`; `0` omite el calentamiento), `GALENA_MODELS_DIR`, `GALENA_INFERENCE_SLOTS` (2).
