"""Energy-based voice activity detection per channel.

Rebuilds speaker turns ({"channel", "start", "end"}, same shape as turns/*.json)
from the stereo audio, so the API can compute conversation-dynamics features
without the turn JSON.
"""

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

FRAME_LENGTH = 200  # 25 ms at 8 kHz
HOP_LENGTH = 80  # 10 ms at 8 kHz

# Threshold = noise floor + max(MIN_MARGIN_DB, REL_MARGIN * (speech peak - noise floor))
FLOOR_PERCENTILE = 10
PEAK_PERCENTILE = 99
MIN_MARGIN_DB = 6.0
REL_MARGIN = 0.3  # best median IoU vs turns/*.json (client 0.98, altur 0.99)
MIN_GAP_S = 0.3  # silences shorter than this stay inside the turn
MIN_SPEECH_S = 0.12  # bursts shorter than this are dropped


def frame_rms_db(x: np.ndarray, frame_length: int = FRAME_LENGTH, hop_length: int = HOP_LENGTH) -> np.ndarray:
    """Frame RMS in dBFS, centered frames (same framing as librosa with center=True)."""
    pad = frame_length // 2
    x = np.pad(np.asarray(x, dtype=np.float32), (pad, pad))
    frames = sliding_window_view(x, frame_length)[::hop_length]
    rms = np.sqrt(np.mean(frames.astype(np.float64) ** 2, axis=1))
    return 20.0 * np.log10(rms + 1e-5)


def runs(mask: np.ndarray) -> list[tuple[int, int]]:
    """[start, end) index pairs of consecutive True values."""
    padded = np.concatenate([[False], mask.astype(bool), [False]])
    edges = np.flatnonzero(np.diff(padded.astype(np.int8)))
    return list(zip(edges[::2], edges[1::2]))


def speech_mask(
    rms_db: np.ndarray,
    hop_s: float,
    rel_margin: float = REL_MARGIN,
    min_margin_db: float = MIN_MARGIN_DB,
    min_gap_s: float = MIN_GAP_S,
    min_speech_s: float = MIN_SPEECH_S,
) -> np.ndarray:
    floor = np.percentile(rms_db, FLOOR_PERCENTILE)
    peak = np.percentile(rms_db, PEAK_PERCENTILE)
    threshold = floor + max(min_margin_db, rel_margin * (peak - floor))
    mask = rms_db > threshold

    min_gap = int(round(min_gap_s / hop_s))
    min_speech = int(round(min_speech_s / hop_s))

    # Close short gaps between speech runs.
    speech_runs = runs(mask)
    for (_, prev_end), (next_start, _) in zip(speech_runs, speech_runs[1:]):
        if next_start - prev_end < min_gap:
            mask[prev_end:next_start] = True
    # Drop short isolated bursts.
    for start, end in runs(mask):
        if end - start < min_speech:
            mask[start:end] = False
    return mask


def detect_turns(audio: np.ndarray, sr: int, **mask_kwargs) -> tuple[list[dict], dict[int, np.ndarray], dict[int, np.ndarray]]:
    """Detect speech turns on every channel of a (samples, channels) array.

    Returns (turns sorted by start, speech mask per channel, frame dB per channel).
    """
    hop_s = HOP_LENGTH / sr
    turns, masks, levels = [], {}, {}
    for ch in range(audio.shape[1]):
        rms_db = frame_rms_db(audio[:, ch])
        mask = speech_mask(rms_db, hop_s, **mask_kwargs)
        levels[ch], masks[ch] = rms_db, mask
        for start, end in runs(mask):
            turns.append({"channel": ch, "start": round(start * hop_s, 2), "end": round(end * hop_s, 2)})
    turns.sort(key=lambda t: t["start"])
    return turns, masks, levels
