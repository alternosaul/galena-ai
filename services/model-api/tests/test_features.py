import numpy as np
import librosa
import pytest

from src.backend.features.extract import F0_MAX, F0_MIN, YIN_CHUNK_FRAMES, _yin_chunked
from src.backend.features.vad import HOP_LENGTH


@pytest.mark.parametrize("seconds", [0.05, 9.99, 10.0, 10.005, 25.3])
def test_yin_chunked_matches_librosa_yin(seconds):
    """Por chunks debe dar exactamente el mismo F0 que librosa.yin sobre la señal completa."""
    rng = np.random.default_rng(3)
    t = np.arange(int(8000 * seconds)) / 8000
    y = (0.3 * np.sin(2 * np.pi * (120 + 40 * np.sin(t)) * t) + 0.05 * rng.standard_normal(t.size)).astype(np.float32)
    kwargs = dict(fmin=F0_MIN, fmax=F0_MAX, sr=8000, frame_length=512, hop_length=HOP_LENGTH)
    expected = librosa.yin(y, **kwargs)
    assert np.array_equal(_yin_chunked(y, **kwargs), expected)
    assert np.array_equal(_yin_chunked(y, **kwargs, chunk_frames=7), expected)
    assert YIN_CHUNK_FRAMES >= 1
