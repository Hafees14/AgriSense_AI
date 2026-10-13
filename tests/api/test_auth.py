import uuid

from apps.api.core.security import hash_refresh_token


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


def test_register_login_me(client, user):
    headers, email, _ = user
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == email
    assert me.json()["role"] == "farmer"


def test_duplicate_email_rejected_case_insensitively(client, user):
    _, email, _ = user
    r = client.post("/auth/register", json={"name": "Other", "email": email.upper(), "password": "Passw0rd!test"})
    assert r.status_code == 409


def test_login_is_case_insensitive_and_wrong_password_fails(client, user):
    _, email, _ = user
    assert client.post("/auth/login", json={"email": email.upper(), "password": "Passw0rd!test"}).status_code == 200
    assert client.post("/auth/login", json={"email": email, "password": "wrong-password"}).status_code == 401


def test_weak_input_is_rejected(client):
    r = client.post("/auth/register", json={"name": "T", "email": "x@example.com", "password": "short"})
    assert r.status_code == 422


def test_officer_signup_needs_code(client):
    r = client.post(
        "/auth/register",
        json={"name": "Sneaky", "email": f"{uuid.uuid4().hex[:8]}@example.com", "password": "Passw0rd!test", "role": "officer"},
    )
    assert r.status_code == 403


def test_protected_routes_need_a_token(client):
    assert client.get("/history").status_code == 403
    assert client.get("/auth/me", headers={"Authorization": "Bearer not-a-token"}).status_code == 401


def test_access_token_cannot_be_used_as_refresh_token(client, user):
    _, _, tokens = user
    r = client.post("/auth/refresh", json={"refresh_token": tokens["access_token"]})
    assert r.status_code == 401


def test_refresh_works_then_stops_after_logout(client, user):
    _, _, tokens = user
    r = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 200
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"}).status_code == 200

    assert client.post("/auth/logout", json={"refresh_token": tokens["refresh_token"]}).status_code == 204
    again = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert again.status_code == 401


def test_forged_refresh_token_without_a_session_is_rejected(client, user):
    from apps.api.core.security import create_refresh_token

    forged = create_refresh_token(subject="00000000-0000-0000-0000-000000000000")
    assert client.post("/auth/refresh", json={"refresh_token": forged}).status_code == 401


def test_refresh_token_hash_uses_the_whole_token():
    assert hash_refresh_token("a" * 100 + "1") != hash_refresh_token("a" * 100 + "2")
