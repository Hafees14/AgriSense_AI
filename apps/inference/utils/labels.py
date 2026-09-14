import json
from pathlib import Path


def load_labels(path: Path) -> list[str]:
    """
    Loads a class-labels file and always returns a plain, index-ordered list.

    Handles two formats you might get out of a training script:
      - a plain JSON array: ["Early Blight", "Late Blight", ...]
      - a JSON object keyed by class index: {"0": "Early Blight", "35": "...", ...}
        (this is what several training/export scripts produce, e.g. Keras'
        class_indices or a manually built id2label dict)

    Without this, indexing a dict with an int (self._labels[35]) raises
    KeyError, and a dict with unordered/sparse keys would silently give the
    wrong label even if you converted it naively.
    """
    raw = json.loads(path.read_text())

    if isinstance(raw, list):
        return raw

    if isinstance(raw, dict):
        # Sort by the numeric key so index i in the returned list really
        # corresponds to output index i of the model.
        return [raw[key] for key in sorted(raw.keys(), key=lambda k: int(k))]

    raise ValueError(f"Unrecognized labels file format at {path}: expected list or dict, got {type(raw)}")