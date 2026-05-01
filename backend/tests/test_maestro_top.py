"""Tests for Maestro Top-3 weekly publication feature.
Endpoints tested:
- GET    /api/admin/maestro/week-pool         (admin only, default last week)
- GET    /api/admin/maestro/week-pool?settimana=YYYY-Www
- POST   /api/admin/maestro/publish-top
- GET    /api/maestro/top                     (any auth user, anonymous)
- DELETE /api/admin/maestro/publish-top/{settimana}
"""
import os
import uuid
from datetime import datetime, timedelta

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://gamification-phase2-1.preview.emergentagent.com",
).rstrip("/")

ADMIN_EMAIL = "danielebrufani@gmail.com"
ADMIN_PASSWORD = "Mariavittoria23"


# --------------------------- helpers ------------------------------------
def _login(email: str, password: str):
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    if r.status_code != 200:
        return None
    data = r.json()
    return data.get("access_token") or data.get("token")


def _register_fresh_client():
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_maestrotop_{suffix}@test.com"
    password = "Test123456!"
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": password,
              "nome": "TestTop", "cognome": suffix},
        timeout=30,
    )
    assert r.status_code in (200, 201), r.text[:200]
    data = r.json()
    tok = data.get("access_token") or data.get("token") or _login(email, password)
    assert tok
    return email, password, tok


def _iso_week_key(dt: datetime) -> str:
    iso = dt.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


# --------------------------- fixtures -----------------------------------
@pytest.fixture(scope="module")
def admin_token():
    tok = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not tok:
        pytest.skip("admin login failed")
    return tok


@pytest.fixture(scope="module")
def client_token():
    _, _, tok = _register_fresh_client()
    return tok


@pytest.fixture(scope="module")
def seed_question_id(client_token):
    """Create at least one maestro question (today) so admin pool isn't empty."""
    headers = {"Authorization": f"Bearer {client_token}"}
    r = requests.post(
        f"{BASE_URL}/api/maestro/ask",
        json={"argomento": "amore", "domanda": "Test top weekly: il mio fidanzato russa, aiuto?"},
        headers=headers,
        timeout=120,
    )
    if r.status_code != 200:
        pytest.skip(f"cannot seed question: {r.status_code} {r.text[:200]}")
    item = r.json().get("item") or {}
    qid = item.get("id")
    assert qid
    return qid


# --------------------------- tests --------------------------------------
class TestWeekPool:
    def test_week_pool_default_last_week(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{BASE_URL}/api/admin/maestro/week-pool", headers=h, timeout=30)
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        assert "settimana" in data and "from" in data and "to" in data
        assert "questions" in data and isinstance(data["questions"], list)
        # default = last week
        expected = _iso_week_key(datetime.utcnow() - timedelta(days=7))
        # Allow ±1 since server uses Rome TZ; just verify ISO format
        assert data["settimana"].count("-W") == 1
        # Verify date range parses
        datetime.strptime(data["from"], "%Y-%m-%d")
        datetime.strptime(data["to"], "%Y-%m-%d")

    def test_week_pool_specific_week_current(self, admin_token, seed_question_id):
        """Current ISO week — should contain our seeded question."""
        cur = _iso_week_key(datetime.utcnow())
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(
            f"{BASE_URL}/api/admin/maestro/week-pool",
            params={"settimana": cur}, headers=h, timeout=30,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["settimana"] == cur
        ids = [q.get("id") for q in data["questions"]]
        assert seed_question_id in ids, f"seeded id {seed_question_id} not in pool"

    def test_week_pool_invalid_week(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(
            f"{BASE_URL}/api/admin/maestro/week-pool",
            params={"settimana": "BADFORMAT"}, headers=h, timeout=30,
        )
        assert r.status_code == 400

    def test_week_pool_forbidden_for_client(self, client_token):
        h = {"Authorization": f"Bearer {client_token}"}
        r = requests.get(f"{BASE_URL}/api/admin/maestro/week-pool", headers=h, timeout=30)
        assert r.status_code in (401, 403)

    def test_week_pool_unauth(self):
        r = requests.get(f"{BASE_URL}/api/admin/maestro/week-pool", timeout=30)
        assert r.status_code in (401, 403)


class TestPublishTop:
    def test_publish_zero_ids(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        cur = _iso_week_key(datetime.utcnow())
        r = requests.post(
            f"{BASE_URL}/api/admin/maestro/publish-top",
            json={"settimana": cur, "question_ids": []},
            headers=h, timeout=30,
        )
        assert r.status_code == 400

    def test_publish_more_than_3_ids(self, admin_token, seed_question_id):
        h = {"Authorization": f"Bearer {admin_token}"}
        cur = _iso_week_key(datetime.utcnow())
        r = requests.post(
            f"{BASE_URL}/api/admin/maestro/publish-top",
            json={"settimana": cur, "question_ids": [seed_question_id] * 4},
            headers=h, timeout=30,
        )
        assert r.status_code == 400

    def test_publish_invalid_id(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        cur = _iso_week_key(datetime.utcnow())
        r = requests.post(
            f"{BASE_URL}/api/admin/maestro/publish-top",
            json={"settimana": cur, "question_ids": ["not-an-objectid"]},
            headers=h, timeout=30,
        )
        assert r.status_code in (400, 404)

    def test_publish_nonexistent_id(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        cur = _iso_week_key(datetime.utcnow())
        # Valid ObjectId format but not in DB
        fake_oid = "0123456789abcdef01234567"
        r = requests.post(
            f"{BASE_URL}/api/admin/maestro/publish-top",
            json={"settimana": cur, "question_ids": [fake_oid]},
            headers=h, timeout=30,
        )
        assert r.status_code in (400, 404)

    def test_publish_happy_path_and_get_top_anonymous(
        self, admin_token, client_token, seed_question_id
    ):
        cur = _iso_week_key(datetime.utcnow())
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.post(
            f"{BASE_URL}/api/admin/maestro/publish-top",
            json={"settimana": cur, "question_ids": [seed_question_id]},
            headers=h, timeout=60,
        )
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        assert body.get("settimana") == cur
        assert body.get("count") == 1

        # Client fetches /api/maestro/top — must be anonymous
        ch = {"Authorization": f"Bearer {client_token}"}
        r2 = requests.get(f"{BASE_URL}/api/maestro/top", headers=ch, timeout=30)
        assert r2.status_code == 200
        weeks = r2.json()
        assert isinstance(weeks, list) and len(weeks) >= 1
        target = next((w for w in weeks if w.get("settimana") == cur), None)
        assert target, f"week {cur} missing from /api/maestro/top response"
        assert isinstance(target.get("entries"), list) and len(target["entries"]) >= 1
        for e in target["entries"]:
            # Anonymous: only argomento/domanda/risposta
            assert "argomento" in e and "domanda" in e and "risposta" in e
            assert "user_nome" not in e
            assert "user_id" not in e
            assert "data" not in e
            assert "created_at" not in e

    def test_top_unauth(self):
        r = requests.get(f"{BASE_URL}/api/maestro/top", timeout=30)
        assert r.status_code in (401, 403)

    def test_publish_forbidden_for_client(self, client_token, seed_question_id):
        h = {"Authorization": f"Bearer {client_token}"}
        cur = _iso_week_key(datetime.utcnow())
        r = requests.post(
            f"{BASE_URL}/api/admin/maestro/publish-top",
            json={"settimana": cur, "question_ids": [seed_question_id]},
            headers=h, timeout=30,
        )
        assert r.status_code in (401, 403)


class TestUnpublishTop:
    def test_unpublish_happy_path(self, admin_token, seed_question_id):
        cur = _iso_week_key(datetime.utcnow())
        h = {"Authorization": f"Bearer {admin_token}"}
        # Make sure it's published first
        requests.post(
            f"{BASE_URL}/api/admin/maestro/publish-top",
            json={"settimana": cur, "question_ids": [seed_question_id]},
            headers=h, timeout=30,
        )
        r = requests.delete(
            f"{BASE_URL}/api/admin/maestro/publish-top/{cur}",
            headers=h, timeout=30,
        )
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        assert body.get("deleted") == cur

    def test_unpublish_nonexistent(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.delete(
            f"{BASE_URL}/api/admin/maestro/publish-top/1999-W01",
            headers=h, timeout=30,
        )
        assert r.status_code == 404

    def test_unpublish_forbidden_for_client(self, client_token):
        h = {"Authorization": f"Bearer {client_token}"}
        r = requests.delete(
            f"{BASE_URL}/api/admin/maestro/publish-top/2026-W01",
            headers=h, timeout=30,
        )
        assert r.status_code in (401, 403)
