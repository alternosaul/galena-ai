"""Features acústicas por cuadro y agregación por llamada para el baseline."""

from functools import lru_cache

import numpy as np
from scipy.fft import dct

from .preprocess import iter_audio_windows
from .spectral import fft_frames

FEATURE_VERSION = "acoustic-v1-8k"
FRAME_SECONDS = 0.025
HOP_SECONDS = 0.010
BASE_NAMES = (
    "rms_db", "zcr", "crest", "centroid_hz", "bandwidth_hz",
    "rolloff_hz", "flatness", "flux", "high_band_ratio",
) + tuple(f"lfcc_{i}" for i in range(13))
STATS = ("mean", "std", "p25", "p50", "p75")
FEATURE_NAMES = tuple(f"{name}_{stat}" for stat in STATS for name in BASE_NAMES)


class InsufficientAudioError(ValueError):
    """El WAV es válido pero no hay señal suficiente para extraer features."""


@lru_cache(maxsize=1)
def _linear_filters() -> np.ndarray:
    """Construye 20 filtros triangulares de frecuencia entre 80 y 3800 Hz.

    Cada fila pondera los bins de la FFT de un cuadro de 200 muestras a 8 kHz.
    El extractor usa esas energías para calcular los 13 LFCC. lru_cache guarda
    el banco porque sus parámetros son fijos y no hace falta volver a calcularlo.
    """
    frequencies = np.fft.rfftfreq(200, d=1 / 8000)
    edges = np.linspace(80, 3800, 22)
    bank = []
    for left, center, right in zip(edges[:-2], edges[1:-1], edges[2:]):
        triangle = np.maximum(0, np.minimum(
            (frequencies - left) / (center - left),
            (right - frequencies) / (right - center),
        ))
        bank.append(triangle / triangle.sum())
    return np.asarray(bank, dtype=np.float32)


def extract_call_features(caller: np.ndarray, sample_rate: int) -> np.ndarray:
    """Produce 110 features usando solamente el canal del caller.

    No usa call_id, etiquetas, agente ni JSON de turns. Trabaja a 8 kHz.
    RMS selecciona cuadros con energía; es una heurística de actividad,
    no un detector de habla. No modifica ni normaliza el waveform.
    Una llamada sin señal útil produce InsufficientAudioError; el consumidor
    decide qué hacer con esa falta de evidencia.

    Por cuadro calcula RMS en dB, cruces por cero, pico/RMS, centro y anchura
    espectral, frecuencia que acumula 85% de potencia, planitud, cambio entre
    espectros, proporción de potencia desde 3 kHz y 13 LFCC.
    Duplica la potencia de los bins interiores para representar las frecuencias
    negativas de la FFT real; no duplica DC ni Nyquist. La planitud excluye DC.
    El cambio espectral conserva el último cuadro del bloque anterior.
    Selecciona cuadros con RMS >= max(0.0005, p95(RMS)*0.05), igual en train
    y en inferencia. Agrega media, desviación y percentiles 25/50/75: 22 * 5 = 110.
    """
    if sample_rate != 8000:
        raise ValueError("El baseline acústico requiere audio original a 8000 Hz")
    blocks = []
    energies = []
    previous = None
    eps = np.float32(1e-12)
    for frames in iter_audio_windows(caller, FRAME_SECONDS, HOP_SECONDS, sample_rate):
        rms = np.sqrt(np.mean(frames * frames, axis=1))
        frequencies, spectrum = fft_frames(frames, sample_rate)
        magnitude = np.abs(spectrum.T)
        power = magnitude * magnitude

        weights = power.copy()
        weights[:, 1:-1] *= 2
        total = weights.sum(axis=1) + eps
        distribution = weights / total[:, None]
        centroid = distribution @ frequencies
        bandwidth = np.sqrt(np.sum(
            distribution * (frequencies[None, :] - centroid[:, None]) ** 2, axis=1,
        ))
        rolloff = frequencies[np.argmax(np.cumsum(distribution, axis=1) >= .85, axis=1)]

        power_without_dc = power[:, 1:]
        geometric_mean = np.exp(np.mean(np.log(power_without_dc + eps), axis=1))
        arithmetic_mean = np.mean(power_without_dc, axis=1) + eps
        flatness = geometric_mean / arithmetic_mean
        magnitude_norm = np.sqrt(np.sum(magnitude * magnitude, axis=1))
        normalized = magnitude / (magnitude_norm[:, None] + eps)
        first = normalized[:1] if previous is None else previous[None, :]
        differences = normalized - np.concatenate((first, normalized[:-1]), axis=0)
        flux = np.sqrt(np.sum(differences * differences, axis=1))
        previous = normalized[-1].copy()
        band_power = power @ _linear_filters().T
        lfcc = dct(np.log(band_power + eps), type=2, norm="ortho", axis=1)[:, :13]
        values = np.column_stack((
            20 * np.log10(rms + eps),
            np.mean(np.signbit(frames[:, 1:]) != np.signbit(frames[:, :-1]), axis=1),
            np.max(np.abs(frames), axis=1) / (rms + eps),
            centroid, bandwidth, rolloff, flatness, flux,
            weights[:, frequencies >= 3000].sum(axis=1) / total, lfcc,
        ))
        blocks.append(values)
        energies.append(rms)
    if not blocks:
        raise InsufficientAudioError("Audio demasiado corto: se requiere al menos un cuadro de 25 ms")
    rms = np.concatenate(energies)

    threshold = max(0.0005, float(np.percentile(rms, 95)) * 0.05)
    active = rms >= threshold
    if not np.any(active):
        raise InsufficientAudioError("El canal del caller no contiene suficiente señal para evaluar")
    values = np.concatenate(blocks)[active]
    aggregated = np.concatenate((
        values.mean(axis=0), values.std(axis=0),
        *np.percentile(values, [25, 50, 75], axis=0),
    )).astype(np.float32)
    if not np.isfinite(aggregated).all():
        raise ValueError("Las features acústicas contienen valores no finitos")
    return aggregated
