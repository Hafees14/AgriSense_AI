import uuid

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from apps.api.db import seed


@pytest.fixture(scope="session")
def client():
    # Build the schema the real way (alembic migrations) so migrations are tested too.
    cfg = Config("apps/api/alembic.ini")
    command.upgrade(cfg, "head")
    seed_main = getattr(seed, "main", None) or getattr(seed, "seed", None)
    if seed_main:
        seed_main()
    from apps.api.main import app

    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture()
def user(client):
    """A freshly registered, logged-in farmer: returns (headers, email, tokens)."""
    email = f"{uuid.uuid4().hex[:10]}@example.com"
    password = "Passw0rd!test"
    r = client.post("/auth/register", json={"name": "Test Farmer", "email": email, "password": password})
    assert r.status_code == 201, r.text
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    tokens = r.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}, email, tokens
