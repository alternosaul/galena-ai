"""API multimodelo de Galena: ¿la voz del cliente (canal 0 de la llamada) es sintética?

    uvicorn app:app --host 127.0.0.1 --port 8000

    POST /detect?detector=everest
         {"call_id": "...", "audio_base64": "<WAV en base64>", "sample_rate": 8000, "channels": 2}
    GET  /health

Respuesta de /detect: `p_synthetic` es P(voz sintética) y `is_synthetic = p_synthetic >= threshold`.
`confidence` es la confianza en ese veredicto (p_synthetic si es sintética, 1 - p_synthetic si es
humana), que es como la interpreta el juez (scripts/check_endpoint.py).

Sirve los 6 detectores ONNX de `final_models/`. Los extractores de features y los modelos se
copiaron sin cambios de lamunuwa/galena-live (rama feat/synthetic-voice-detection-models,
commit 307b538). Cada familia usa su propio extractor y la inferencia reproduce
scripts/evaluate_final_models.py::predict de esa rama.
"""

import base64
import binascii
import json
import logging
import os
import threading
import time
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import onnxruntime as ort
import pandas as pd
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.backend.acoustic_v1 import InsufficientAudioError, extract_call_features
from src.backend.audio.io import CLIENT_CHANNEL, SAMPLE_RATE, load_call_bytes
from src.backend.features.extract import extract
from src.backend.models.onnx_runtime import load_onnx_artifact

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(name)s: %(message)s")
logger = logging.getLogger("galena.model_api")

ROOT = Path(__file__).resolve().parent
MODELS_DIR = Path(os.environ.get("GALENA_MODELS_DIR", ROOT / "final_models"))
DEFAULT_DETECTOR = os.environ.get("GALENA_DEFAULT_DETECTOR", "everest")
INFERENCE_SLOTS = int(os.environ.get("GALENA_INFERENCE_SLOTS", "2"))
MAX_JSON_BYTES = 16 * 1024 * 1024
MAX_SECONDS = 300


@dataclass(frozen=True)
class DetectorSpec:
    file: str
    family: str  # "galena" | "acoustic"
    feature_set: str | None = None  # solo familia galena: "full" | "client_only"


# Orden = ranking general de MODELS_FINAL_COMPARISON.md; los 3 primeros llevan nombre de montaña.
DETECTORS: dict[str, DetectorSpec] = {
    "everest": DetectorSpec("synthetic_voice_detector_combined_hist_gb.onnx", "galena", "client_only"),
    "fuji": DetectorSpec("acoustic_combined.onnx", "acoustic"),
    "montblanc": DetectorSpec("acoustic_hispa.onnx", "acoustic"),
    "galena-full": DetectorSpec("synthetic_voice_detector_full_logreg.onnx", "galena", "full"),
    "galena-client-only": DetectorSpec(
        "synthetic_voice_detector_client_only_hist_gb.onnx", "galena", "client_only"
    ),
    "acoustic-baseline": DetectorSpec("acoustic_baseline.onnx", "acoustic"),
}


class LoadedDetector:
    """Un detector ONNX cargado una vez, con el extractor de su familia."""

    def __init__(self, detector_id: str, spec: DetectorSpec):
        self.id = detector_id
        self.spec = spec
        path = MODELS_DIR / spec.file
        if not path.is_file():
            raise FileNotFoundError(f"Modelo no encontrado: {path}")

        if spec.family == "galena":
            self.artifact = load_onnx_artifact(path)
            self.threshold = float(self.artifact["threshold"])
            return

        options = ort.SessionOptions()
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        self.session = ort.InferenceSession(
            str(path), sess_options=options, providers=["CPUExecutionProvider"]
        )
        meta = self.session.get_modelmeta().custom_metadata_map
        self.threshold = float(meta["threshold"])
        self.prior = float(meta["train_prior_synthetic"])
        self.probability_output = meta["probability_output"]
        self.synthetic_index = json.loads(meta["classes"]).index(1)
        self.input_name = self.session.get_inputs()[0].name

    @property
    def allowed_channels(self) -> tuple[int, ...]:
        # "full" mide turnos entre cliente y agente: necesita la llamada estéreo.
        return (2,) if self.spec.feature_set == "full" else (1, 2)

    def predict(self, audio: np.ndarray, sample_rate: int) -> float:
        """P(sintético) para el canal del cliente."""
        if self.spec.family == "galena":
            features = pd.DataFrame([extract(audio, sample_rate, self.spec.feature_set)])
            return float(self.artifact["detector"].predict_proba(features)[0])

        signal = audio[:, CLIENT_CHANNEL] if audio.ndim == 2 else audio
        try:
            x = extract_call_features(signal, sample_rate)[None, :].astype(np.float32)
        except InsufficientAudioError:
            logger.warning("%s: audio sin señal suficiente; se usa el prior %.3f", self.id, self.prior)
            return self.prior
        probabilities = self.session.run([self.probability_output], {self.input_name: x})[0]
        return float(probabilities[0, self.synthetic_index])


class DetectRequest(BaseModel):
    model_config = ConfigDict(strict=True)

    call_id: str = Field(min_length=1)
    audio_base64: str = Field(min_length=1, max_length=MAX_JSON_BYTES)
    sample_rate: int = Field(ge=SAMPLE_RATE, le=SAMPLE_RATE)
    channels: int = Field(ge=1, le=2)


class DetectResponse(BaseModel):
    call_id: str
    is_synthetic: bool
    confidence: float = Field(
        description="Confianza en el veredicto: p_synthetic si is_synthetic, si no 1 - p_synthetic."
    )
    p_synthetic: float = Field(description="P(voz sintética) según el detector.")
    detector: str
    threshold: float


@asynccontextmanager
async def lifespan(app: FastAPI):
    if DEFAULT_DETECTOR not in DETECTORS:
        raise ValueError(f"GALENA_DEFAULT_DETECTOR debe ser uno de {list(DETECTORS)}")
    detectors = {detector_id: LoadedDetector(detector_id, spec) for detector_id, spec in DETECTORS.items()}

    # Calienta librosa/numba y ONNX Runtime para que la primera petición real no sea lenta.
    rng = np.random.default_rng(0)
    warm = (rng.standard_normal((SAMPLE_RATE * 3, 2)) * 0.05).astype(np.float32)
    for detector in detectors.values():
        detector.predict(warm, SAMPLE_RATE)
        logger.info("Detector cargado: %s (%s, umbral %.3f)", detector.id, detector.spec.file, detector.threshold)

    app.state.detectors = detectors
    app.state.slots = threading.BoundedSemaphore(INFERENCE_SLOTS)
    yield


app = FastAPI(title="Galena model API", version="2.0.0", lifespan=lifespan)


@app.middleware("http")
async def limit_detect_body(request: Request, call_next):
    """Rechaza POST /detect sin JSON o con cuerpo declarado mayor a 16 MiB antes de leerlo."""
    if request.method == "POST" and request.url.path == "/detect":
        media_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
        if media_type != "application/json":
            return JSONResponse({"error": "Content-Type debe ser application/json"}, status_code=415)
        try:
            length = int(request.headers.get("content-length", "0"))
        except ValueError:
            return JSONResponse({"error": "Content-Length inválido"}, status_code=400)
        if not 0 < length <= MAX_JSON_BYTES:
            return JSONResponse({"error": "El JSON debe contener entre 1 byte y 16 MiB"}, status_code=413)
    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    detail = [{"field": ".".join(str(p) for p in e["loc"]), "message": e["msg"]} for e in exc.errors()]
    return JSONResponse({"error": "Petición inválida", "detail": detail}, status_code=400)


@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc: StarletteHTTPException):
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code, headers=exc.headers)


@app.get("/health")
def health(request: Request) -> dict:
    detectors: dict[str, LoadedDetector] = request.app.state.detectors
    return {
        "status": "ok",
        "default_detector": DEFAULT_DETECTOR,
        "available_detectors": list(detectors),
        "thresholds": {detector_id: d.threshold for detector_id, d in detectors.items()},
        "models": {
            detector_id: {"file": d.spec.file, "family": d.spec.family, "feature_set": d.spec.feature_set}
            for detector_id, d in detectors.items()
        },
    }


@app.post("/detect", response_model=DetectResponse)
def detect(
    payload: DetectRequest,
    request: Request,
    response: Response,
    detector: str = Query(default=DEFAULT_DETECTOR, description=f"Uno de: {', '.join(DETECTORS)}"),
) -> DetectResponse:
    model: LoadedDetector | None = request.app.state.detectors.get(detector)
    if model is None:
        raise HTTPException(400, f"Detector desconocido: {detector}")

    try:
        raw = base64.b64decode(payload.audio_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(400, "audio_base64 no contiene base64 válido") from exc
    try:
        audio, sample_rate = load_call_bytes(raw, payload.call_id, model.allowed_channels)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if audio.shape[0] / sample_rate > MAX_SECONDS:
        raise HTTPException(400, f"El WAV excede el límite de {MAX_SECONDS} segundos")

    slots: threading.BoundedSemaphore = request.app.state.slots
    if not slots.acquire(blocking=False):
        raise HTTPException(503, "Servidor ocupado; reintenta la petición")
    started = time.perf_counter()
    try:
        p = model.predict(audio, sample_rate)
    finally:
        slots.release()

    is_synthetic = p >= model.threshold
    detection_id = str(uuid.uuid4())
    response.headers["X-Detection-ID"] = detection_id
    response.headers["X-Detector"] = detector
    logger.info(
        "%s call=%s detector=%s p=%.4f synthetic=%s %.2fs",
        detection_id, payload.call_id, detector, p, is_synthetic, time.perf_counter() - started,
    )
    return DetectResponse(
        call_id=payload.call_id,
        is_synthetic=bool(is_synthetic),
        confidence=round(p if is_synthetic else 1.0 - p, 6),
        p_synthetic=round(p, 6),
        detector=detector,
        threshold=model.threshold,
    )
