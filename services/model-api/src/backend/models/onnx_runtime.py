"""Run an exported detector (models/<name>/synthetic_voice_detector_<name>_<algorithm>.onnx) with ONNX Runtime.

`OnnxDetector` has the same `predict_proba(DataFrame)` interface as the scikit-learn Detector, so the
API and evaluation code can use either. Only onnxruntime is needed (no scikit-learn model objects).
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd


class OnnxDetector:
    def __init__(self, path: str | Path):
        import onnxruntime as ort

        self.path = Path(path)
        self.session = ort.InferenceSession(str(self.path), providers=["CPUExecutionProvider"])
        self.metadata = dict(self.session.get_modelmeta().custom_metadata_map)
        self.feature_names = json.loads(self.metadata["input_features"])
        self.threshold = float(self.metadata["threshold"])
        self.input_name = self.session.get_inputs()[0].name

    def run(self, X: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
        """(P(synthetic) as float64, decision computed inside the graph as int)."""
        x = X[self.feature_names].to_numpy(dtype=np.float32)
        p, decision = self.session.run(["p_synthetic", "is_synthetic"], {self.input_name: x})
        return p.astype(np.float64), decision.astype(int)

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        return self.run(X)[0]

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return self.run(X)[1]


def load_onnx_artifact(path: str | Path) -> dict:
    """Same keys the API reads from a joblib artifact."""
    detector = OnnxDetector(path)
    meta = detector.metadata
    return {
        "detector": detector,
        "format": "onnx",
        "feature_set": meta["feature_set"],
        "family": meta["family"],
        "threshold": detector.threshold,
        "feature_names": detector.feature_names,
        "selected_features": detector.feature_names,
        "created_at": meta.get("exported_at", ""),
    }
