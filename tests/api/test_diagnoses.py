import base64
import io

import httpx
import pytest
from PIL import Image

from apps.api.services import inference_client
from tests.conftest import make_image_bytes

GOOD = {
    "label": "Tomato___Early_blight",
    "confidence": 0.93,
    "model_version": "disease-detect-test",
    "severity": "moderate",
    "causes": "test cause",
    "organic_treatment": "test organic",
    "chemical_treatment": "test chemical",
    "prevention_tips": "test prevention",
}


def _png_b64() -> str:
    buf = io.BytesIO()
    Image.new("RGB", (40, 40), (200, 30, 30)).save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


@pytest.fixture()
def fake_inference(monkeypatch):
    """Replace the inference call, so these tests do not need the model service."""
    state = {"result": dict(GOOD), "calls": 0}

    async def fake(diagnosis_type, image_url):
        state["calls"] += 1
        return state["result"]

    monkeypatch.setattr("apps.api.routers.diagnoses.run_inference", fake)
    return state


def _post(client, headers, data: bytes, name="leaf.png", ctype="image/png", path="/detect-disease", **form):
    return client.post(path, headers=headers, files={"file": (name, data, ctype)}, data=form)


def test_successful_diagnosis_is_saved_and_in_history(client, user, fake_inference, image_bytes):
    headers, _, _ = user
    r = _post(client, headers, image_bytes)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["result_label"] == "Tomato___Early_blight"
    assert body["needs_expert_review"] is False
    assert body["organic_treatment"] == "test organic"

    history = client.get("/history", headers=headers).json()
    assert len(history) == 1 and history[0]["id"] == body["id"]


def test_low_confidence_is_flagged_for_review_with_retry_guidance(client, user, fake_inference, image_bytes):
    headers, _, _ = user
    fake_inference["result"] = {**GOOD, "confidence": 0.31}
    body = _post(client, headers, image_bytes).json()
    assert body["needs_expert_review"] is True
    assert body["retry_guidance"]


def test_out_of_range_confidence_is_clamped(client, user, fake_inference, image_bytes):
    headers, _, _ = user
    fake_inference["result"] = {**GOOD, "confidence": 7.5}
    assert _post(client, headers, image_bytes).json()["confidence_score"] == 1.0


def test_heatmap_is_stored_and_url_returned(client, user, fake_inference, image_bytes):
    headers, _, _ = user
    fake_inference["result"] = {**GOOD, "heatmap_png_b64": _png_b64()}
    body = _post(client, headers, image_bytes).json()
    assert body["heatmap_url"] and body["heatmap_url"].endswith("-heatmap.png")
    assert client.get(body["heatmap_url"].replace("http://localhost:8000", "")).status_code == 200


def test_garbage_heatmap_is_ignored_not_fatal(client, user, fake_inference, image_bytes):
    headers, _, _ = user
    fake_inference["result"] = {**GOOD, "heatmap_png_b64": base64.b64encode(b"not a png").decode()}
    r = _post(client, headers, image_bytes)
    assert r.status_code == 200 and r.json()["heatmap_url"] is None


def test_fake_image_with_image_content_type_is_rejected(client, user, fake_inference):
    headers, _, _ = user
    r = _post(client, headers, b"this is not an image", name="x.jpg", ctype="image/jpeg")
    assert r.status_code == 422
    assert fake_inference["calls"] == 0  # never reached the model


def test_wrong_content_type_and_empty_file_rejected(client, user, fake_inference, image_bytes):
    headers, _, _ = user
    assert _post(client, headers, b"hi", name="x.txt", ctype="text/plain").status_code == 415
    assert _post(client, headers, b"", name="x.png", ctype="image/png").status_code == 422


def test_oversized_file_rejected(client, user, fake_inference):
    headers, _, _ = user
    big = make_image_bytes("PNG", (64, 64)) + b"\0" * (10 * 1024 * 1024 + 10)
    assert _post(client, headers, big).status_code == 413


def test_tiny_image_rejected(client, user, fake_inference):
    headers, _, _ = user
    assert _post(client, headers, make_image_bytes("PNG", (8, 8))).status_code == 422


def test_requires_login(client, image_bytes):
    r = client.post("/detect-disease", files={"file": ("a.png", image_bytes, "image/png")})
    assert r.status_code == 403


def test_cannot_attach_diagnosis_to_someone_elses_or_missing_field(client, user, fake_inference, image_bytes):
    headers, _, _ = user
    r = _post(client, headers, image_bytes, field_id="00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


def test_bad_coordinates_rejected(client, user, fake_inference, image_bytes):
    headers, _, _ = user
    assert _post(client, headers, image_bytes, latitude="123", longitude="10").status_code == 422


def test_history_is_private_per_user(client, user, fake_inference, image_bytes):
    headers, _, _ = user
    _post(client, headers, image_bytes)
    other = client.post("/auth/register", json={"name": "Other One", "email": "other.private@example.com", "password": "Passw0rd!test"})
    assert other.status_code in (201, 409)
    tokens = client.post("/auth/login", json={"email": "other.private@example.com", "password": "Passw0rd!test"}).json()
    assert client.get("/history", headers={"Authorization": f"Bearer {tokens['access_token']}"}).json() == []


# ---- inference_client behaviour (the real function, with the network faked) ----------------------

class _FakeClient:
    def __init__(self, outcome):
        self.outcome = outcome

    def __call__(self, *a, **k):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, path, json=None, headers=None):
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return self.outcome


def _resp(status, payload=None, text=None):
    req = httpx.Request("POST", "http://inference/x")
    if payload is not None:
        return httpx.Response(status, json=payload, request=req)
    return httpx.Response(status, text=text or "", request=req)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "outcome,expected",
    [
        (httpx.ConnectError("refused"), 503),
        (httpx.ReadTimeout("slow"), 503),
        (_resp(500, {"detail": "boom"}), 503),
        (_resp(422, {"detail": "bad image"}), 422),
        (_resp(200, text="not json"), 503),
        (_resp(200, {"label": "x"}), 502),  # missing confidence
        (_resp(200, {"label": "x", "confidence": "high", "model_version": "v1"}), 502),
        (_resp(200, {"label": "Early Blight", "confidence": 0.0, "model_version": "disease-stub"}), 503),
    ],
)
async def test_inference_client_error_mapping(monkeypatch, outcome, expected):
    from fastapi import HTTPException

    monkeypatch.setattr(inference_client.httpx, "AsyncClient", _FakeClient(outcome))
    with pytest.raises(HTTPException) as exc:
        await inference_client.run_inference("disease", "http://localhost:8000/uploads/u/a.png")
    assert exc.value.status_code == expected


@pytest.mark.asyncio
async def test_inference_client_returns_valid_result(monkeypatch):
    monkeypatch.setattr(inference_client.httpx, "AsyncClient", _FakeClient(_resp(200, GOOD)))
    out = await inference_client.run_inference("disease", "http://localhost:8000/uploads/u/a.png")
    assert out["label"] == GOOD["label"]


def test_service_down_returns_clean_error_and_leaves_no_files(client, user, image_bytes, monkeypatch):
    headers, _, _ = user
    from apps.api.services import storage_service

    monkeypatch.setattr(inference_client.httpx, "AsyncClient", _FakeClient(httpx.ConnectError("down")))
    before = {p for p in storage_service.UPLOAD_DIR.rglob("*") if p.is_file()}
    r = _post(client, headers, image_bytes)
    assert r.status_code == 503
    assert "temporarily unavailable" in r.json()["detail"]
    after = {p for p in storage_service.UPLOAD_DIR.rglob("*") if p.is_file()}
    assert after == before  # the saved photo was cleaned up
    assert client.get("/history", headers=headers).json() == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "internal,expected",
    [("", "http://localhost:8000/uploads/u/a.png"), ("http://api:8000", "http://api:8000/uploads/u/a.png")],
)
async def test_image_url_sent_to_inference_uses_internal_host_only_when_configured(monkeypatch, internal, expected):
    sent = {}

    class Capture(_FakeClient):
        async def post(self, path, json=None, headers=None):
            sent["url"] = json["image_url"]
            return _resp(200, GOOD)

    monkeypatch.setattr(inference_client.settings, "INTERNAL_API_URL", internal)
    monkeypatch.setattr(inference_client.settings, "API_PUBLIC_URL", "http://localhost:8000")
    monkeypatch.setattr(inference_client.httpx, "AsyncClient", Capture(None))
    await inference_client.run_inference("disease", "http://localhost:8000/uploads/u/a.png")
    assert sent["url"] == expected
