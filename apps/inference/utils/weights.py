"""Helpers for checking that model weight files are real, not Git LFS pointer stubs."""
import logging
from pathlib import Path

logger = logging.getLogger("agrisense.inference")

_LFS_MAGIC = b"version https://git-lfs"


def is_lfs_pointer(path: Path) -> bool:
    """True if the file is a tiny Git LFS pointer text file instead of the real model."""
    try:
        if path.stat().st_size > 1024:
            return False
        return path.read_bytes()[:64].startswith(_LFS_MAGIC)
    except OSError:
        return False


def weights_usable(weights: Path, labels: Path, name: str) -> bool:
    """Return True only when both files exist and the weights are the real model file."""
    if not weights.exists() or not labels.exists():
        logger.warning("%s: weights or labels file missing, running in stub mode", name)
        return False
    if is_lfs_pointer(weights):
        logger.error(
            "%s: %s is a Git LFS pointer, not the model. Run 'git lfs install && git lfs pull' "
            "(or download the weights) and restart. Running in stub mode.",
            name,
            weights.name,
        )
        return False
    return True
