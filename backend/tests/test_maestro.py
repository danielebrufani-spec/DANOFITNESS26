"""Tests for Chiedi al Maestro feature.
Endpoints tested:
- POST /api/maestro/ask
- GET  /api/maestro/today
- GET  /api/maestro/history
- GET  /api/admin/maestro/all
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://gamification-phase2-1.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "danielebrufani@gmail.com"
ADMIN_PASSWORD = "Mariavittoria23"


def _login(email: str, password: str) -> str | None:
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        return None
    data = r.json()
    return data.get("access_token") or data.get("token")


def _register_fresh_client() -> tuple[str, str, str]:
    """Register a brand-new client and return (email, password, token)."""
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_maestro_{suffix}@test.com"
    password = "Test123456!"
    payload = {
        "email": email,
        "password": password,
        "nome": "TestMaestro",
        "cognome": suffix,
    }
    r = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=30)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    if not token:
        token = _login(email, password)
    assert token, "no access_token on register/login"
    return email, password, token


@pytest.fixture(scope="module")
def fresh_client():
    return _register_fresh_client()


@pytest.fixture(scope="module")
def admin_token():
    tok = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not tok:
        pytest.skip("admin login failed")
    return tok


# ---------------- today before asking ----------------

def test_today_initial_can_ask_true(fresh_client):
    _, _, token = fresh_client
    r = requests.get(f"{BASE_URL}/api/maestro/today",
                     headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["can_ask"] is True
    assert data["today"] is None


# ---------------- validation errors ----------------

def test_ask_invalid_topic_returns_400(fresh_client):
    _, _, token = fresh_client
    r = requests.post(f"{BASE_URL}/api/maestro/ask",
                      headers={"Authorization": f"Bearer {token}"},
                      json={"argomento": "cucina", "domanda": "Cosa cucino stasera?"},
                      timeout=30)
    assert r.status_code == 400, r.text


def test_ask_too_short_domanda_returns_400(fresh_client):
    _, _, token = fresh_client
    r = requests.post(f"{BASE_URL}/api/maestro/ask",
                      headers={"Authorization": f"Bearer {token}"},
                      json={"argomento": "amore", "domanda": "ciao"},
                      timeout=30)
    assert r.status_code == 400, r.text


def test_ask_too_long_domanda_returns_400(fresh_client):
    _, _, token = fresh_client
    r = requests.post(f"{BASE_URL}/api/maestro/ask",
                      headers={"Authorization": f"Bearer {token}"},
                      json={"argomento": "amore", "domanda": "a" * 260},
                      timeout=30)
    assert r.status_code == 400, r.text


# ---------------- happy path ----------------

def test_ask_valid_creates_question_and_awards_ticket(fresh_client):
    _, _, token = fresh_client
    r = requests.post(f"{BASE_URL}/api/maestro/ask",
                      headers={"Authorization": f"Bearer {token}"},
                      json={"argomento": "amore",
                            "domanda": "La mia ex mi scrive dopo un anno, cosa faccio?"},
                      timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "item" in data
    item = data["item"]
    assert item["argomento"] == "amore"
    assert item["domanda"].startswith("La mia ex")
    assert isinstance(item["risposta"], str) and len(item["risposta"]) > 5
    assert data["biglietto_dato"] is True
    # store on module for subsequent tests
    test_ask_valid_creates_question_and_awards_ticket.item_id = item["id"]


def test_today_after_ask_shows_locked(fresh_client):
    _, _, token = fresh_client
    r = requests.get(f"{BASE_URL}/api/maestro/today",
                     headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["can_ask"] is False
    assert data["today"] is not None
    assert data["today"]["argomento"] == "amore"
    assert len(data["today"]["risposta"]) > 0


def test_ask_second_time_same_day_returns_429(fresh_client):
    _, _, token = fresh_client
    r = requests.post(f"{BASE_URL}/api/maestro/ask",
                      headers={"Authorization": f"Bearer {token}"},
                      json={"argomento": "lavoro",
                            "domanda": "Il mio capo mi odia, licenziarmi?"},
                      timeout=30)
    assert r.status_code == 429, r.text
    detail = r.json().get("detail", "")
    assert "oggi" in detail.lower() or "domani" in detail.lower()


def test_history_returns_list(fresh_client):
    _, _, token = fresh_client
    r = requests.get(f"{BASE_URL}/api/maestro/history",
                     headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["argomento"] == "amore"


# ---------------- admin ----------------

def test_admin_maestro_all(admin_token, fresh_client):
    r = requests.get(f"{BASE_URL}/api/admin/maestro/all",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    # Must contain at least the one we created
    assert any(it.get("domanda", "").startswith("La mia ex") for it in data)


def test_admin_endpoint_forbidden_for_client(fresh_client):
    _, _, token = fresh_client
    r = requests.get(f"{BASE_URL}/api/admin/maestro/all",
                     headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert r.status_code in (401, 403), r.text


# ---------------- unauth ----------------

def test_ask_unauth_returns_401():
    r = requests.post(f"{BASE_URL}/api/maestro/ask",
                      json={"argomento": "amore", "domanda": "Ciao Maestro, come va?"},
                      timeout=30)
    assert r.status_code in (401, 403), r.text
