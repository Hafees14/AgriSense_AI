import asyncio
import base64
import io
from pathlib import Path

import numpy as np
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from PIL import Image

from apps.inference.models import disease_detect, pest_detect
from apps.inference.models.disease_detect import DiseaseDetector, get_disease_info
from apps.inference.models.pest_detect import PestDetector, decode_detections, get_pest_info
from apps.inference.preprocessing import image_pipeline as ip
from apps.inference.utils.labels import load_labels
from apps.inference.utils.weights import is_lfs_pointer
from tests.conftest import make_image_bytes

WEIGHTS = Path("apps/inference/weights")
HAVE_REAL_WEIGHTS = not is_lfs_pointer(WEIGHTS / "disease_detect.onnx") and not is_lfs_pointer(WEIGHTS / "pest_detect.onnx")
real_weights = pytest.mark.skipif(
    not HAVE_REAL_WEIGHTS, reason="ONNX weights are Git LFS pointers here (run: git lfs pull)"
)


# ---- labels and advice (no model needed) -----------------------------------------------------------

def test_disease_labels_are_52_in_index_order():
    labels = load_labels(WEIGHTS / "disease_labels.json")
    assert len(labels) == 52 and len(set(labels)) == 52


def test_every_disease_label_has_complete_advice():
    for label in load_labels(WEIGHTS / "disease_labels.json"):
        info = get_disease_info(label)
        for key in ("severity", "causes", "organic_treatment", "chemical_treatment", "prevention_tips"):
            assert info.get(key), f"{label} has no {key}"


def test_every_pest_label_has_advice():
    for label in load_labels(WEIGHTS / "pest_labels.json"):
        assert get_pest_info(label).get("causes"), label


def test_coconut_gray_leaf_spot_is_not_mixed_up_with_corn():
    coconut = get_disease_info("Coconut___Gray_leaf_spot")["causes"]
    corn = get_disease_info("Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot")["causes"]
    assert coconut != corn


# ---- image handling --------------------------------------------------------------------------------

def test_classification_tensor_shape_and_dtype():
    t = ip.preprocess_for_classification(Image.new("RGB", (500, 321), (10, 200, 10)))
    assert t.shape == (1, 3, 300, 300) and t.dtype == np.float32


def test_letterbox_keeps_aspect_ratio_and_reports_padding():
    t, scale, (px, py) = ip.letterbox(Image.new("RGB", (800, 400), "green"), 640)
    assert t.shape == (1, 3, 640, 640)
    assert scale == pytest.approx(0.8) and px == 0 and py == pytest.approx(160)


def test_corrupt_and_truncated_images_give_422():
    for data in (b"garbage", make_image_bytes()[:40]):
        with pytest.raises(HTTPException) as e:
            ip.decode_image(data)
        assert e.value.status_code == 422


@pytest.mark.parametrize(
    "url",
    [
        "http://169.254.169.254/latest/meta-data/",
        "http://evil.example.com/x.png",
        "file:///etc/passwd",
        "ftp://api/x.png",
        "not a url",
    ],
)
def test_ssrf_urls_are_blocked(url):
    with pytest.raises(HTTPException):
        ip.check_image_url(url)


def test_allowed_hosts_pass_and_env_can_extend(monkeypatch):
    ip.check_image_url("http://api:8000/uploads/u/a.png")
    ip.check_image_url("http://localhost:8000/uploads/u/a.png")
    monkeypatch.setenv("INFERENCE_ALLOWED_IMAGE_HOSTS", "files.example.org")
    ip.check_image_url("https://files.example.org/a.png")
    with pytest.raises(HTTPException):
        ip.check_image_url("http://api:8000/a.png")


# ---- LFS pointer detection -------------------------------------------------------------------------

def test_lfs_pointer_is_detected_and_service_falls_back_to_stub(tmp_path, monkeypatch):
    pointer = tmp_path / "disease_detect.onnx"
    pointer.write_text("version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 1\n")
    labels = tmp_path / "disease_labels.json"
    labels.write_text('{"0": "A"}')
    assert is_lfs_pointer(pointer)
    monkeypatch.setattr(disease_detect, "WEIGHTS_PATH", pointer)
    monkeypatch.setattr(disease_detect, "LABELS_PATH", labels)
    d = DiseaseDetector()
    assert d._session is None and "LFS" in d.stub_reason


# ---- pest decoding (synthetic tensors, no model) ---------------------------------------------------

def _yolo_output(rows, n_anchors=50, n_classes=5):
    """rows: list of (cx, cy, w, h, class_id, score) in 640px letterbox space."""
    out = np.zeros((1, 4 + n_classes, n_anchors), dtype=np.float32)
    for i, (cx, cy, w, h, cls, score) in enumerate(rows):
        out[0, :4, i] = (cx, cy, w, h)
        out[0, 4 + cls, i] = score
    return out


LABELS = ["a", "b", "c", "d", "e"]


def test_nms_merges_overlapping_boxes_and_keeps_separate_ones():
    out = _yolo_output(
        [
            (320, 320, 100, 100, 1, 0.90),
            (322, 322, 100, 100, 1, 0.80),  # same pest, almost same box -> removed
            (100, 100, 60, 60, 3, 0.70),  # different place and class -> kept
            (500, 500, 40, 40, 0, 0.10),  # below threshold -> dropped
        ]
    )
    found = decode_detections(out, LABELS, 0.25, 0.45, scale=1.0, pad=(0, 0), original_size=(640, 640))
    assert [(d.label, round(d.confidence, 2)) for d in found] == [("b", 0.9), ("d", 0.7)]
    assert found[0].box == [270.0, 270.0, 370.0, 370.0]


def test_boxes_are_mapped_back_through_letterbox_padding():
    # original 800x400 -> scale 0.8, pad_y 160; a box centred at (320, 320) in letterbox space
    out = _yolo_output([(320, 320, 80, 80, 2, 0.9)])
    d = decode_detections(out, LABELS, 0.25, 0.45, scale=0.8, pad=(0, 160), original_size=(800, 400))[0]
    assert d.box == [350.0, 150.0, 450.0, 250.0]


def test_nothing_above_threshold_gives_empty_list():
    assert decode_detections(_yolo_output([(1, 1, 1, 1, 0, 0.1)]), LABELS, 0.25, 0.45, 1.0, (0, 0), (640, 640)) == []


# ---- service wiring --------------------------------------------------------------------------------

def test_inference_key_is_enforced_when_configured(monkeypatch):
    from apps.inference.main import app

    monkeypatch.setenv("INFERENCE_API_KEY", "secret-key")
    c = TestClient(app)
    assert c.post("/detect-disease", json={"image_url": "http://api:8000/x.png"}).status_code == 401
    assert c.post("/detect-disease", json={"image_url": "http://api:8000/x.png"}, headers={"X-Inference-Key": "nope"}).status_code == 401
    # with the right key the request gets past auth (and then fails to fetch, which is fine here)
    r = c.post("/detect-disease", json={"image_url": "http://evil.example.com/x.png"}, headers={"X-Inference-Key": "secret-key"})
    assert r.status_code == 422


def test_health_reports_model_state():
    from apps.inference.main import app

    body = TestClient(app).get("/health").json()
    assert set(body["models"]) == {"disease", "pest", "plant_id"}
    assert body["status"] in ("ok", "degraded")
    assert body["models"]["plant_id"]["loaded"] is False  # no trained plant-ID model exists yet


# ---- REAL model checks (skipped without the weights) ----------------------------------------------

@real_weights
def test_real_disease_model_matches_label_file_and_is_repeatable(monkeypatch):
    d = DiseaseDetector()
    assert d._session is not None
    out_shape = d._session.get_outputs()[0].shape
    assert out_shape[-1] == len(d._labels) == 52

    img = Image.new("RGB", (400, 300), (40, 140, 50))

    async def fake(_url):
        return img

    monkeypatch.setattr(disease_detect, "download_image", fake)
    a = asyncio.run(d.predict("x"))
    b = asyncio.run(d.predict("x"))
    assert a.label in d._labels and 0.0 <= a.confidence <= 1.0
    assert a.confidence == b.confidence and a.label == b.label
    assert a.model_version == disease_detect.MODEL_VERSION and not a.model_version.endswith("-stub")


@real_weights
def test_real_disease_model_confidence_is_not_inflated_on_junk(monkeypatch):
    d = DiseaseDetector()
    rng = np.random.default_rng(0)
    img = Image.fromarray(rng.integers(0, 255, (300, 300, 3), dtype=np.uint8))

    async def fake(_url):
        return img

    monkeypatch.setattr(disease_detect, "download_image", fake)
    assert asyncio.run(d.predict("x")).confidence < 0.7


@real_weights
def test_real_heatmap_is_a_valid_png_when_confident():
    d = DiseaseDetector()
    t = ip.preprocess_for_classification(Image.new("RGB", (300, 300), (30, 120, 40)))
    png = disease_detect.occlusion_heatmap_png(d._session, d._session.get_inputs()[0].name, t, 0, Image.new("RGB", (300, 300), "green"))
    assert Image.open(io.BytesIO(png)).size == (300, 300)


@real_weights
def test_real_pest_model_loads_and_runs(monkeypatch):
    p = PestDetector()
    assert p._session is not None
    meta = p._session.get_modelmeta().custom_metadata_map
    for i, name in enumerate(p._labels):
        assert f"{i}: '{name}'" in meta["names"]  # label file order == order the model was trained with

    async def fake(_url):
        return Image.new("RGB", (640, 480), (90, 160, 70))

    monkeypatch.setattr(pest_detect, "download_image", fake)
    r = asyncio.run(p.predict("x"))
    assert 0.0 <= r.confidence <= 1.0 and not r.model_version.endswith("-stub")
    assert r.detection_count is not None
