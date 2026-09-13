import io
from pathlib import Path

import numpy as np
import soundfile as sf

CLIENT_CHANNEL = 0
ALTUR_CHANNEL = 1
SAMPLE_RATE = 8000


def _read_validated(source_arg, name: str, allowed_channels: tuple[int, ...] = (2,)) -> tuple[np.ndarray, int]:
    """Open a WAV (path or file-like), validate the Altur format and read it."""
    try:
        with sf.SoundFile(source_arg) as source:
            if source.format != "WAV":
                raise ValueError(f"Expected WAV audio, received {source.format}: {name}")
            if source.channels not in allowed_channels:
                expected = " or ".join(str(c) for c in allowed_channels)
                raise ValueError(
                    f"Expected audio with {expected} channel(s), received {source.channels}: {name}"
                )
            if source.samplerate != SAMPLE_RATE:
                raise ValueError(
                    f"Expected sample rate of 8000 Hz, received {source.samplerate} Hz: {name}"
                )
            if source.subtype != "PCM_16":
                raise ValueError(
                    f"Expected 16-bit PCM (PCM_16), received {source.subtype}: {name}"
                )
            if source.frames == 0:
                raise ValueError(f"Audio file is empty: {name}")

            sample_rate = source.samplerate
            audio = source.read(always_2d=True, dtype="float32")
    except sf.LibsndfileError as exc:
        raise ValueError(f"Cannot read audio file {name}: {exc}") from exc

    return audio, sample_rate


def load_call(path: str | Path, allowed_channels: tuple[int, ...] = (2,)) -> tuple[np.ndarray, int]:
    """
    Load a nonempty Altur WAV (8 kHz, 16-bit PCM), stereo by default.

    Expected stereo format:
        channel 0 -> client
        channel 1 -> Altur

    Pass allowed_channels=(1, 2) to also accept an already separated mono client clip.

    Returns:
        audio: float32 numpy array with shape (samples, channels)
        sample_rate: sampling frequency in Hz
    """

    path = Path(path)

    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {path}")

    if not path.is_file():
        raise ValueError(f"Audio path is not a file: {path}")

    return _read_validated(path, str(path), allowed_channels)


def load_call_bytes(data: bytes, name: str = "<bytes>", allowed_channels: tuple[int, ...] = (2,)) -> tuple[np.ndarray, int]:
    """Same as load_call, for the raw bytes of a WAV file (e.g. decoded base64)."""
    if not data:
        raise ValueError(f"Audio file is empty: {name}")
    return _read_validated(io.BytesIO(data), name, allowed_channels)


def split_channels(
    audio: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Split an Altur stereo call.

    Channel 0: client
    Channel 1: Altur
    """

    client = audio[:, CLIENT_CHANNEL]
    altur = audio[:, ALTUR_CHANNEL]

    return client, altur
