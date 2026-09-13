"""Per-call feature extraction shared by training (scripts/build_features.py) and the /detect API.

Input is the full stereo call (channel 0 = client, channel 1 = altur). Features describe the
client only, plus the turn-taking dynamics between client and Altur. Altur voice features are
left out on purpose: Altur is the same TTS voice in every call, so they carry no label signal.
"""

import numpy as np
import librosa

from src.backend.audio.io import ALTUR_CHANNEL, CLIENT_CHANNEL
from src.backend.features.vad import HOP_LENGTH, detect_turns, frame_rms_db, runs, speech_mask

N_FFT = 256
N_MFCC = 20
N_MELS = 40
F0_MIN, F0_MAX = 60.0, 400.0
MIN_FRAMES = 10


def _stats(out: dict, prefix: str, values, which=("mean", "std")) -> None:
    v = np.asarray(values, dtype=np.float64)
    v = v[np.isfinite(v)]
    funcs = {
        "mean": np.mean,
        "std": np.std,
        "median": np.median,
        "min": np.min,
        "max": np.max,
        "p10": lambda a: np.percentile(a, 10),
        "p90": lambda a: np.percentile(a, 90),
        "cv": lambda a: np.std(a) / (abs(np.mean(a)) + 1e-9),
    }
    for name in which:
        out[f"{prefix}_{name}"] = float(funcs[name](v)) if v.size else 0.0


def response_latencies(turns: list[dict], from_channel: int, to_channel: int) -> list[float]:
    """Gap from the end of a `from_channel` turn to the start of the next turn when it is `to_channel`.

    Negative values mean the speaker started before the other one finished (overlap/barge-in).
    `turns` must be sorted by start.
    """
    return [b["start"] - a["end"] for a, b in zip(turns, turns[1:])
            if a["channel"] == from_channel and b["channel"] == to_channel]


def _dynamics(turns: list[dict], masks: dict, duration_s: float, hop_s: float) -> dict:
    out: dict = {}
    minutes = max(duration_s / 60.0, 1e-6)
    client = [t for t in turns if t["channel"] == CLIENT_CHANNEL]
    altur = [t for t in turns if t["channel"] == ALTUR_CHANNEL]

    client_lat = response_latencies(turns, ALTUR_CHANNEL, CLIENT_CHANNEL)
    altur_lat = response_latencies(turns, CLIENT_CHANNEL, ALTUR_CHANNEL)
    _stats(out, "dyn_client_latency", client_lat, ("mean", "median", "std", "p10", "p90"))
    _stats(out, "dyn_altur_latency", altur_lat, ("mean", "median", "std"))
    lat = np.asarray(client_lat)
    out["dyn_client_fast_response_frac"] = float(np.mean(lat < 0.3)) if lat.size else 0.0
    out["dyn_client_negative_latency_frac"] = float(np.mean(lat < 0)) if lat.size else 0.0

    client_mask, altur_mask = masks[CLIENT_CHANNEL], masks[ALTUR_CHANNEL]
    both = client_mask & altur_mask
    out["dyn_overlap_ratio_client"] = float(both.sum() / max(client_mask.sum(), 1))
    out["dyn_overlap_ratio_call"] = float(both.mean())
    overlap_runs = [r for r in runs(both) if (r[1] - r[0]) * hop_s >= 0.1]
    out["dyn_overlap_events_per_min"] = len(overlap_runs) / minutes

    # Client turns that start while Altur is still talking.
    barge = [altur_mask[min(int(t["start"] / hop_s), len(altur_mask) - 1)] for t in client]
    out["dyn_client_barge_in_frac"] = float(np.mean(barge)) if barge else 0.0

    client_durs = [t["end"] - t["start"] for t in client]
    altur_durs = [t["end"] - t["start"] for t in altur]
    _stats(out, "dyn_client_turn_dur", client_durs, ("mean", "median", "std", "max", "cv"))
    _stats(out, "dyn_altur_turn_dur", altur_durs, ("mean", "median", "std"))
    out["dyn_client_turns_per_min"] = len(client) / minutes
    out["dyn_altur_turns_per_min"] = len(altur) / minutes
    out["dyn_client_short_turn_frac"] = float(np.mean(np.asarray(client_durs) < 1.0)) if client_durs else 0.0
    out["dyn_client_speech_ratio"] = float(client_mask.mean())
    out["dyn_altur_speech_ratio"] = float(altur_mask.mean())
    out["dyn_client_altur_speech_balance"] = float(client_mask.sum() / max(altur_mask.sum(), 1))

    # Pauses between two consecutive client turns with no Altur turn in between.
    client_pauses = [b["start"] - a["end"] for a, b in zip(turns, turns[1:])
                     if a["channel"] == CLIENT_CHANNEL and b["channel"] == CLIENT_CHANNEL]
    _stats(out, "dyn_client_pause", client_pauses, ("mean", "std"))
    out["dyn_client_pause_per_turn"] = len(client_pauses) / max(len(client), 1)

    first_altur_end = altur[0]["end"] if altur else 0.0
    out["dyn_first_client_start_after_altur"] = (client[0]["start"] - first_altur_end) if client else duration_s
    return out


def _client_acoustics(
    y: np.ndarray, sr: int, speech: np.ndarray, rms_db: np.ndarray, altur_speech: np.ndarray | None = None
) -> dict:
    out: dict = {}
    power = np.abs(librosa.stft(y, n_fft=N_FFT, hop_length=HOP_LENGTH)) ** 2
    n = min(power.shape[1], len(speech))
    power, speech, rms_db = power[:, :n], speech[:n], rms_db[:n]
    altur_speech = np.zeros(n, dtype=bool) if altur_speech is None else altur_speech[:n]
    sel = speech if speech.sum() >= MIN_FRAMES else np.ones(n, dtype=bool)
    mag = np.sqrt(power)

    mel_db = librosa.power_to_db(librosa.feature.melspectrogram(S=power, sr=sr, n_mels=N_MELS, fmax=sr / 2))
    mfcc = librosa.feature.mfcc(S=mel_db, n_mfcc=N_MFCC)
    d1 = librosa.feature.delta(mfcc)
    d2 = librosa.feature.delta(mfcc, order=2)
    for name, mat in (("mfcc", mfcc), ("mfcc_d1", d1), ("mfcc_d2", d2)):
        m = mat[:, sel]
        for i in range(N_MFCC):
            out[f"sp_{name}_{i + 1:02d}_mean"] = float(m[i].mean())
            out[f"sp_{name}_{i + 1:02d}_std"] = float(m[i].std())

    _stats(out, "sp_centroid", librosa.feature.spectral_centroid(S=mag, sr=sr)[0, sel])
    _stats(out, "sp_bandwidth", librosa.feature.spectral_bandwidth(S=mag, sr=sr)[0, sel])
    _stats(out, "sp_rolloff", librosa.feature.spectral_rolloff(S=mag, sr=sr, roll_percent=0.85)[0, sel])
    _stats(out, "sp_flatness", librosa.feature.spectral_flatness(S=mag)[0, sel])
    contrast = librosa.feature.spectral_contrast(S=mag, sr=sr, n_bands=4, fmin=100.0)[:, sel]
    for i, band in enumerate(contrast):
        _stats(out, f"sp_contrast_b{i}", band)
    zcr = librosa.feature.zero_crossing_rate(y, frame_length=N_FFT, hop_length=HOP_LENGTH)[0, :n]
    _stats(out, "sp_zcr", zcr[sel])
    _stats(out, "sp_flux", librosa.onset.onset_strength(S=mel_db, sr=sr)[:n][sel], ("mean", "std", "cv"))

    freqs = librosa.fft_frequencies(sr=sr, n_fft=N_FFT)
    band_power = power[:, sel].sum(axis=1)
    total = band_power.sum() + 1e-12
    out["sp_energy_below_300hz"] = float(band_power[freqs < 300].sum() / total)
    out["sp_energy_300_1000hz"] = float(band_power[(freqs >= 300) & (freqs < 1000)].sum() / total)
    out["sp_energy_1000_2500hz"] = float(band_power[(freqs >= 1000) & (freqs < 2500)].sum() / total)
    out["sp_energy_above_2500hz"] = float(band_power[freqs >= 2500].sum() / total)

    # Prosody: F0 track on client speech frames.
    f0 = librosa.yin(y, fmin=F0_MIN, fmax=F0_MAX, sr=sr, frame_length=512, hop_length=HOP_LENGTH)[:n]
    voiced = sel & (f0 > F0_MIN * 1.05) & (f0 < F0_MAX * 0.95)
    f0_v = f0[voiced]
    _stats(out, "pr_f0", f0_v, ("mean", "median", "std", "p10", "p90", "cv"))
    out["pr_f0_range_semitones"] = (
        float(12 * np.log2(np.percentile(f0_v, 95) / np.percentile(f0_v, 5))) if f0_v.size else 0.0
    )
    out["pr_voiced_ratio"] = float(voiced.sum() / max(sel.sum(), 1))
    # Jitter-like: relative F0 change between consecutive voiced frames.
    consecutive = voiced[1:] & voiced[:-1]
    rel_f0_change = np.abs(np.diff(f0))[consecutive] / f0[1:][consecutive]
    _stats(out, "pr_jitter", rel_f0_change, ("mean", "median"))
    # Shimmer-like: dB change between consecutive speech frames.
    speech_pairs = sel[1:] & sel[:-1]
    _stats(out, "pr_shimmer_db", np.abs(np.diff(rms_db))[speech_pairs], ("mean", "median"))

    # Level / channel characteristics.
    _stats(out, "ch_speech_db", rms_db[sel], ("mean", "std", "p90"))
    silence = ~speech & ~altur_speech
    silence_db = rms_db[silence] if silence.sum() >= MIN_FRAMES else rms_db[~speech]
    _stats(out, "ch_silence_db", silence_db, ("mean", "std", "p10"))
    out["ch_snr_db"] = out["ch_speech_db_mean"] - out["ch_silence_db_mean"]
    # Level on the client channel while only Altur speaks (echo / crosstalk path).
    altur_only = altur_speech & ~speech
    out["ch_crosstalk_db"] = (
        float(np.median(rms_db[altur_only]) - out["ch_silence_db_mean"]) if altur_only.sum() >= MIN_FRAMES else 0.0
    )
    out["ch_digital_silence_frac"] = float(np.mean(rms_db < -90.0))
    out["ch_zero_sample_frac"] = float(np.mean(y == 0.0))
    out["ch_clip_frac"] = float(np.mean(np.abs(y) > 0.99))
    return out


def extract_features(audio: np.ndarray, sr: int) -> dict[str, float]:
    """Feature vector for one stereo call, shape (samples, 2), float in [-1, 1]."""
    audio = np.asarray(audio, dtype=np.float32)
    duration_s = audio.shape[0] / sr
    hop_s = HOP_LENGTH / sr
    turns, masks, levels = detect_turns(audio, sr)

    features = {"call_duration_s": duration_s}
    features.update(_dynamics(turns, masks, duration_s, hop_s))
    features.update(
        _client_acoustics(
            audio[:, CLIENT_CHANNEL],
            sr,
            masks[CLIENT_CHANNEL],
            levels[CLIENT_CHANNEL],
            altur_speech=masks[ALTUR_CHANNEL],
        )
    )
    return {k: (float(v) if np.isfinite(v) else 0.0) for k, v in features.items()}


# Features that need the Altur channel or the silences between the client's speech
# (noise floor, SNR, crosstalk). The client-only set drops them, so it describes the client's
# speech frames alone and gives the same answer on audio that was separated or silence-trimmed.
CLIENT_ONLY_EXCLUDED = ("ch_silence_", "ch_snr_", "ch_crosstalk_", "ch_digital_silence_", "ch_zero_sample_")

FEATURE_SETS = ("full", "client_only")


def extract_client_features(client: np.ndarray, sr: int) -> dict[str, float]:
    """Client-only features: spectral, prosody and speech level on the client's speech frames.

    No turn timing, no call duration, no altur channel, no silence statistics. Accepts the client
    channel of a stereo call or an already separated mono clip.
    """
    client = np.asarray(client, dtype=np.float32).reshape(-1)
    rms_db = frame_rms_db(client)
    speech = speech_mask(rms_db, HOP_LENGTH / sr)
    features = _client_acoustics(client, sr, speech, rms_db)
    return {
        k: (float(v) if np.isfinite(v) else 0.0)
        for k, v in features.items()
        if not k.startswith(CLIENT_ONLY_EXCLUDED)
    }


def extract(audio: np.ndarray, sr: int, feature_set: str = "full") -> dict[str, float]:
    """Dispatch to the extractor a model was trained with.

    "full" needs the stereo call (shape (samples, 2)). "client_only" takes a stereo call (uses
    channel 0) or a mono client clip (shape (samples,) or (samples, 1)).
    """
    audio = np.asarray(audio, dtype=np.float32)
    if feature_set == "full":
        if audio.ndim != 2 or audio.shape[1] != 2:
            raise ValueError("The full feature set needs the stereo call (client + altur channels).")
        return extract_features(audio, sr)
    if feature_set == "client_only":
        client = audio[:, CLIENT_CHANNEL] if audio.ndim == 2 and audio.shape[1] > 1 else audio.reshape(-1)
        return extract_client_features(client, sr)
    raise ValueError(f"Unknown feature set {feature_set!r}; expected one of {FEATURE_SETS}")
