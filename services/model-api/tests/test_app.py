import base64
import io
import os
import wave
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import DETECTORS, app

REAL_CALL = os.environ.get("GALENA_TEST_CALL")


def wav_base64(channels: int = 2, seconds: float = 3.0, rate: int = 8000) -> str:
    """Tono con ruido en memoria (PCM16), suficiente para ejercitar ambos extractores."""
    t = np.arange(int(rate * seconds)) / rate
    rng = np.random.default_rng(1)
    signal = 0.3 * np.sin(2 * np.pi * 220 * t) + 0.02 * rng.standard_normal(t.size)
    frames = np.repeat((signal * 32767).astype(np.int16)[:, None], channels, axis=1)
    with io.BytesIO() as buffer:
        with wave.open(buffer, "wb") as wav:
            wav.setnchannels(channels)
            wav.setsampwidth(2)
            wav.setframerate(rate)
            wav.writeframes(frames.tobytes())
        return base64.b64encode(buffer.getvalue()).decode("ascii")


def body(audio_base64: str, channels: int = 2, **overrides) -> dict:
    return {"call_id": "test", "audio_base64": audio_base64, "sample_rate": 8000, "channels": channels, **overrides}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_health_lists_all_detectors(client):
    data = client.get("/health").json()
    assert data["status"] == "ok"
    assert data["default_detector"] == "everest"
    assert data["available_detectors"] == list(DETECTORS)
    assert set(data["thresholds"]) == set(DETECTORS)


@pytest.mark.parametrize("detector", list(DETECTORS))
def test_detect_each_detector(client, detector):
    resp = client.post(f"/detect?detector={detector}", json=body(wav_base64()))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert 0.0 <= data["p_synthetic"] <= 1.0
    assert data["confidence"] == data["p_synthetic"]
    assert data["is_synthetic"] == (data["p_synthetic"] >= data["threshold"])
    assert data["detector"] == detector
    assert resp.headers["X-Detector"] == detector
    assert resp.headers["X-Detection-ID"]


def test_default_detector_is_everest(client):
    resp = client.post("/detect", json=body(wav_base64()))
    assert resp.status_code == 200, resp.text
    assert resp.json()["detector"] == "everest"


def test_unknown_detector_is_400(client):
    resp = client.post("/detect?detector=k2", json=body(wav_base64()))
    assert resp.status_code == 400
    assert "Detector desconocido" in resp.json()["error"]


def test_bad_base64_is_400(client):
    resp = client.post("/detect", json=body("%%%"))
    assert resp.status_code == 400


def test_non_wav_is_400(client):
    resp = client.post("/detect", json=body(base64.b64encode(b"no es WAV").decode()))
    assert resp.status_code == 400


def test_wrong_sample_rate_field_is_400(client):
    resp = client.post("/detect", json=body(wav_base64(), sample_rate=16000))
    assert resp.status_code == 400


def test_wrong_wav_rate_is_400(client):
    resp = client.post("/detect", json=body(wav_base64(rate=16000)))
    assert resp.status_code == 400


def test_full_rejects_mono(client):
    resp = client.post("/detect?detector=galena-full", json=body(wav_base64(channels=1), channels=1))
    assert resp.status_code == 400


@pytest.mark.parametrize("detector", ["everest", "fuji"])
def test_other_detectors_accept_mono_client_clip(client, detector):
    resp = client.post(f"/detect?detector={detector}", json=body(wav_base64(channels=1), channels=1))
    assert resp.status_code == 200, resp.text


def test_missing_content_type_is_415(client):
    resp = client.post("/detect", content=b"{}", headers={"Content-Type": "text/plain"})
    assert resp.status_code == 415


@pytest.mark.skipif(not REAL_CALL, reason="GALENA_TEST_CALL no apunta a un WAV real de Altur")
@pytest.mark.parametrize("detector", list(DETECTORS))
def test_real_call(client, detector):
    audio = base64.b64encode(Path(REAL_CALL).read_bytes()).decode("ascii")
    resp = client.post(f"/detect?detector={detector}", json=body(audio, call_id=Path(REAL_CALL).stem))
    assert resp.status_code == 200, resp.text
