"""Representaciones espectrales genéricas, independientes del detector."""

from numbers import Real

import numpy as np
from scipy.fft import rfft
from scipy.signal.windows import hann

from .preprocess import _validate_sample_rate, window_audio


def fft_frames(frames: np.ndarray, sample_rate: int) -> tuple[np.ndarray, np.ndarray]:
    """Aplica Hann y FFT real a un bloque (ventanas, muestras).

    Devuelve frecuencias y coeficientes (frecuencias, ventanas). SciPy
    conserva precisión simple para entrada float32, reduciendo memoria.
    La escala coincide con stft_audio y no depende del pico de la llamada.
    """
    _validate_sample_rate(sample_rate)
    if (
        not isinstance(frames, np.ndarray) or frames.ndim != 2
        or len(frames) == 0 or frames.shape[1] < 3
        or frames.dtype.kind not in "iuf" or not np.isfinite(frames).all()
    ):
        raise ValueError("Se requieren ventanas reales finitas de al menos tres muestras")
    window = frames.shape[1]
    dtype = np.float32 if frames.dtype == np.float32 else np.float64
    taper = hann(window, sym=False).astype(dtype)
    spectrum = rfft(frames * taper, axis=1, workers=1).T / taper.sum()
    return np.fft.rfftfreq(window, d=1 / sample_rate), spectrum


def stft_audio(
    audio: np.ndarray,
    sample_rate: int,
    window_seconds: float = 0.025,
    hop_seconds: float = 0.010,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Devuelve frecuencias (Hz), centros de ventana (s) y STFT compleja.

    La matriz tiene forma (frecuencias, ventanas). Aplica Hann periódica
    y FFT real a cada ventana completa, sin rellenar extremos ni quitar DC.
    Divide por la suma de Hann para mantener una escala fija independiente
    del tamaño de ventana; no normaliza por el pico del audio.
    No duplica los coeficientes del espectro unilateral.
    """
    frames = window_audio(audio, window_seconds, hop_seconds, sample_rate)
    window = frames.shape[1]
    hop = round(hop_seconds * sample_rate)
    if window < 3:
        raise ValueError("La STFT requiere ventanas de al menos tres muestras")
    if hop > window:
        raise ValueError("El salto de la STFT no debe superar la ventana")
    if len(frames) == 0:
        raise ValueError("El audio es más corto que una ventana de STFT")

    frequencies, spectrum = fft_frames(frames, sample_rate)
    times = (np.arange(len(frames)) * hop + window / 2) / sample_rate
    return frequencies, times, spectrum


def power_spectrogram(spectrum: np.ndarray) -> np.ndarray:
    """Calcula |STFT|²: potencia por celda, sin expresar densidad por Hz."""
    if (
        not isinstance(spectrum, np.ndarray)
        or spectrum.ndim != 2
        or spectrum.size == 0
        or spectrum.dtype.kind not in "iufc"
        or not np.isfinite(spectrum).all()
    ):
        raise ValueError("La STFT debe ser una matriz numérica finita y no vacía")
    return np.abs(spectrum.astype(np.complex128)) ** 2


def log_spectrogram(power: np.ndarray, floor_db: float = -100.0) -> np.ndarray:
    """Convierte potencia a 10*log10(P/1), con un piso solo para visualizar.

    La referencia es fija (potencia 1), compartida entre canales y llamadas.
    No son dB SPL ni probabilidades de síntesis. El piso evita log10(0).
    Se recorta después del logaritmo para admitir pisos muy negativos sin
    calcular 10**(piso/10), que podría perder precisión hasta convertirse en cero.
    """
    if (
        not isinstance(power, np.ndarray)
        or power.ndim != 2
        or power.size == 0
        or power.dtype.kind not in "iuf"
        or not np.isfinite(power).all()
        or np.any(power < 0)
    ):
        raise ValueError("La potencia debe ser una matriz real, finita y no negativa")
    if (
        isinstance(floor_db, bool)
        or not isinstance(floor_db, Real)
        or not np.isfinite(floor_db)
        or floor_db >= 0
    ):
        raise ValueError("El piso debe ser un número finito negativo en dB")

    safe_power = np.maximum(power.astype(np.float64), np.finfo(np.float64).tiny)
    return np.maximum(10 * np.log10(safe_power), floor_db)
