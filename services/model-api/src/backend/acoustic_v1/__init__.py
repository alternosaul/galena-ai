"""Extractor `acoustic-v1-8k` used by the acoustic_* ONNX models (final_models/acoustic_*.onnx).

Vendored unchanged from branch `feature/audio-pipeline`, commit 70b69c3:
- features.py   <- src/backend/features/acoustic.py
- spectral.py   <- src/backend/audio/spectral.py
- preprocess.py <- src/backend/audio/preprocess.py
Only the import paths were adapted. `load_clip_8k` reproduces src/backend/audio/hispa.py:load_hispa,
the conversion those models were trained with for mono clips. Keep these files byte-identical to the
source so evaluation matches training.
"""

import io
from pathlib import Path

import numpy as np
import soundfile as sf

from .features import FEATURE_NAMES, FEATURE_VERSION, InsufficientAudioError, extract_call_features
from .preprocess import resample_audio

__all__ = ["FEATURE_NAMES", "FEATURE_VERSION", "InsufficientAudioError", "extract_call_features", "load_clip_8k"]


def load_clip_8k(path: str | Path) -> tuple[np.ndarray, int]:
    """Decode a mono clip and convert it to 8 kHz PCM16 in memory (same as load_hispa)."""
    audio, rate = sf.read(path, dtype="float32", always_2d=True)
    if audio.shape[1] != 1:
        raise ValueError(f"Clip must be mono: {path}")
    samples = resample_audio(audio[:, 0], rate, 8000)
    with io.BytesIO() as buffer:
        sf.write(buffer, samples, 8000, format="WAV", subtype="PCM_16")
        buffer.seek(0)
        return sf.read(buffer, dtype="float32")
