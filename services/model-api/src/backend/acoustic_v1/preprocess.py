"""Utilidades de audio mono independientes del modelo, sin normalizar amplitud."""

from collections.abc import Iterator
from math import gcd, ulp
from numbers import Integral, Real

import numpy as np
from scipy.signal import resample_poly


def _validate_audio(audio: np.ndarray) -> None:
    """Comprueba que la señal sea mono, numérica, finita y no vacía."""
    if not isinstance(audio, np.ndarray) or audio.ndim != 1:
        raise ValueError("El audio debe ser un array NumPy de una dimensión")
    if audio.size == 0:
        raise ValueError("El audio no debe estar vacío")
    if audio.dtype.kind not in "iuf" or not np.isfinite(audio).all():
        raise ValueError("El audio debe contener muestras numéricas reales y finitas")


def _validate_sample_rate(sample_rate: int) -> None:
    """Comprueba que la frecuencia sea un entero positivo, nunca un booleano."""
    if isinstance(sample_rate, bool) or not isinstance(sample_rate, Integral) or sample_rate <= 0:
        raise ValueError("La frecuencia de muestreo debe ser un entero positivo en Hz")


def _validate_time(value: float, name: str) -> None:
    """Comprueba que un tiempo sea numérico y finito; name identifica el error."""
    if isinstance(value, bool) or not isinstance(value, Real) or not np.isfinite(value):
        raise ValueError(f"{name} debe ser un número finito de segundos")


def _time_to_index(seconds: float, sample_rate: int) -> int:
    """Convierte segundos a índice de muestra, truncando hacia abajo.

    Corrige errores de cálculo cercanos al entero: 1033119.9999999999 pasa
    a 1033120, pero 1.25 sigue dando 1. La tolerancia usa dos pasos de
    precisión binaria (ulp); no redondea una fracción real de muestra.
    """
    position = float(seconds * sample_rate)
    nearest = round(position)


    if abs(position - nearest) <= 2 * ulp(position):
        return nearest
    return int(position)


def resample_audio(
    audio: np.ndarray, source_sample_rate: int, target_sample_rate: int
) -> np.ndarray:
    """Remuestrea audio mono con un filtro polifásico y devuelve float32.

    No normaliza amplitudes, tampoco para muestras enteras.
    Tasas iguales devuelven una copia float32. La longitud es
    ceil(N * frecuencia_destino / frecuencia_origen).
    """
    _validate_audio(audio)
    _validate_sample_rate(source_sample_rate)
    _validate_sample_rate(target_sample_rate)
    samples = audio.astype(np.float32)
    divisor = gcd(source_sample_rate, target_sample_rate)
    return resample_poly(
        samples, target_sample_rate // divisor, source_sample_rate // divisor
    ).astype(np.float32, copy=False)


def slice_audio(
    audio: np.ndarray, start: float, end: float, sample_rate: int
) -> np.ndarray:
    """Devuelve una copia de [start, end), truncando los índices hacia abajo.

    Corrige errores de precisión binaria a dos pasos del entero más cercano,
    por ejemplo en 129.14 * 8000. Rechaza intervalos fuera del audio o sin
    muestras. Conserva el dtype y la escala de amplitud.
    """
    _validate_audio(audio)
    _validate_sample_rate(sample_rate)
    _validate_time(start, "El inicio")
    _validate_time(end, "El final")
    if start < 0 or end <= start:
        raise ValueError("El intervalo debe cumplir start >= 0 y end > start")
    if end > audio.size / sample_rate:
        raise ValueError("El intervalo excede la duración del audio")
    first = _time_to_index(start, sample_rate)
    last = _time_to_index(end, sample_rate)
    if last <= first:
        raise ValueError("El intervalo debe contener al menos una muestra")
    return audio[first:last].copy()


def window_audio(
    audio: np.ndarray, window_seconds: float, hop_seconds: float, sample_rate: int
) -> np.ndarray:
    """Devuelve ventanas copiadas con forma (cantidad, muestras_por_ventana).

    Redondea las duraciones a la muestra más cercana (empates al par).
    Ventana y salto deben abarcar al menos una muestra. El salto puede ser
    menor, igual o mayor que la ventana. Descarta ventanas incompletas,
    sin rellenar. Audio más corto devuelve forma (0, muestras_por_ventana).
    Conserva el dtype y la escala de amplitud originales.
    """
    _validate_audio(audio)
    _validate_sample_rate(sample_rate)
    _validate_time(window_seconds, "La duración de ventana")
    _validate_time(hop_seconds, "La duración del salto")
    if window_seconds <= 0 or hop_seconds <= 0:
        raise ValueError("Las duraciones de ventana y salto deben ser positivas")
    window = round(window_seconds * sample_rate)
    hop = round(hop_seconds * sample_rate)
    if window < 1 or hop < 1:
        raise ValueError("La ventana y el salto deben abarcar al menos una muestra cada uno")
    if audio.size < window:
        return np.empty((0, window), dtype=audio.dtype)
    return np.lib.stride_tricks.sliding_window_view(audio, window)[::hop].copy()


def iter_audio_windows(
    audio: np.ndarray, window_seconds: float, hop_seconds: float,
    sample_rate: int, batch_size: int = 2048,
) -> Iterator[np.ndarray]:
    """Entrega bloques de ventanas completas como vistas, sin copiar la llamada.

    Valida el audio una vez. Las vistas son de solo lectura, conservan dtype
    y amplitud. No aplica padding. Limita la memoria temporal de la FFT al
    número de ventanas del bloque, incluso en llamadas de varios minutos.
    """
    _validate_audio(audio)
    _validate_sample_rate(sample_rate)
    _validate_time(window_seconds, "La duración de ventana")
    _validate_time(hop_seconds, "La duración del salto")
    _validate_sample_rate(batch_size)
    if window_seconds <= 0 or hop_seconds <= 0:
        raise ValueError("Las duraciones de ventana y salto deben ser positivas")
    window, hop = round(window_seconds * sample_rate), round(hop_seconds * sample_rate)
    if window < 1 or hop < 1:
        raise ValueError("La ventana y el salto deben abarcar al menos una muestra")
    if audio.size < window:
        return
    views = np.lib.stride_tricks.sliding_window_view(audio, window)[::hop]
    for first in range(0, len(views), batch_size):
        yield views[first:first + batch_size]
