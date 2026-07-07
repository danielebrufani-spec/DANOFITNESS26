"""Tests for Activities & Lessons CRUD management (admin panel iter 13)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0]
BASE_URL = BASE_URL.rstrip("/")
ADMIN_EMAIL = "danielebrufani@gmail.com"
ADMIN_PASSWORD = "Mariavittoria23"

DEFAULT_KEYS = {"circuito", "funzionale", "pilates", "yoga", "acquapower", "acquagag"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def client_token():
    # Try login existing test client, else register
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "testclient_kpi@test.com", "password": "Test123456"}, timeout=15)
    if r.status_code == 200:
        return r.json()["token"]
    return None


# ---------- Activities ----------
class TestActivities:
    def test_list_default_activities(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/activities", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        keys = {a["key"] for a in r.json()["activities"]}
        missing = DEFAULT_KEYS - keys
        assert not missing, f"missing default activities: {missing}"
        for a in r.json()["activities"]:
            if a["key"] in DEFAULT_KEYS:
                assert a["is_default"] is True

    def test_activities_require_auth(self):
        r = requests.get(f"{BASE_URL}/api/activities", timeout=15)
        assert r.status_code in (401, 403)

    def test_admin_activity_requires_admin(self, client_token):
        if not client_token:
            pytest.skip("no client token")
        h = {"Authorization": f"Bearer {client_token}", "Content-Type": "application/json"}
        r = requests.post(f"{BASE_URL}/api/admin/activities",
                          json={"key": "x", "nome": "X"}, headers=h, timeout=15)
        assert r.status_code in (401, 403)

    def test_create_update_delete_activity(self, admin_headers):
        # cleanup previous
        r = requests.get(f"{BASE_URL}/api/activities", headers=admin_headers, timeout=15)
        for a in r.json()["activities"]:
            if a["key"] == "test_zumba":
                requests.delete(f"{BASE_URL}/api/admin/activities/{a['id']}", headers=admin_headers, timeout=15)

        # CREATE
        r = requests.post(f"{BASE_URL}/api/admin/activities",
                         json={"key": "test_zumba", "nome": "Test Zumba", "colore": "#FF1493", "icona": "music-note"},
                         headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        act = r.json()["activity"]
        assert act["key"] == "test_zumba"
        assert act["is_default"] is False
        aid = act["id"]

        # DUP
        r2 = requests.post(f"{BASE_URL}/api/admin/activities",
                          json={"key": "test_zumba", "nome": "Dup"}, headers=admin_headers, timeout=15)
        assert r2.status_code == 400

        # UPDATE
        r3 = requests.put(f"{BASE_URL}/api/admin/activities/{aid}",
                         json={"nome": "Test Zumba Advanced", "colore": "#B388FF"},
                         headers=admin_headers, timeout=15)
        assert r3.status_code == 200
        assert r3.json()["activity"]["nome"] == "Test Zumba Advanced"
        assert r3.json()["activity"]["colore"] == "#B388FF"

        # DELETE
        r4 = requests.delete(f"{BASE_URL}/api/admin/activities/{aid}", headers=admin_headers, timeout=15)
        assert r4.status_code == 200


# ---------- Lessons ----------
class TestLessons:
    created_lesson_id = None
    created_activity_id = None

    def test_lessons_crud_full_flow(self, admin_headers):
        # Create custom activity
        # Cleanup
        r = requests.get(f"{BASE_URL}/api/activities", headers=admin_headers, timeout=15)
        for a in r.json()["activities"]:
            if a["key"] == "test_boxing":
                # remove lessons using this activity
                lr = requests.get(f"{BASE_URL}/api/lessons", headers=admin_headers, timeout=15)
                for l in lr.json():
                    if l["tipo_attivita"] == "test_boxing":
                        requests.delete(f"{BASE_URL}/api/admin/lessons/{l['id']}", headers=admin_headers, timeout=15)
                requests.delete(f"{BASE_URL}/api/admin/activities/{a['id']}", headers=admin_headers, timeout=15)

        r = requests.post(f"{BASE_URL}/api/admin/activities",
                         json={"key": "test_boxing", "nome": "Test Boxing"}, headers=admin_headers, timeout=15)
        assert r.status_code == 200
        act_id = r.json()["activity"]["id"]

        # Create lesson
        r = requests.post(f"{BASE_URL}/api/admin/lessons",
                         json={"giorno": "sabato", "orario": "23:45", "tipo_attivita": "test_boxing",
                               "coach": "TesterCoach", "descrizione": "Test lesson"},
                         headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        lesson_id = r.json()["lesson"]["id"]

        # Cache invalidation - GET /api/lessons should reflect
        rl = requests.get(f"{BASE_URL}/api/lessons", headers=admin_headers, timeout=15)
        assert rl.status_code == 200
        ids = [x["id"] for x in rl.json()]
        assert lesson_id in ids

        # Duplicate lesson (same day+time) => 400
        rd = requests.post(f"{BASE_URL}/api/admin/lessons",
                          json={"giorno": "sabato", "orario": "23:45", "tipo_attivita": "test_boxing",
                                "coach": "Other"}, headers=admin_headers, timeout=15)
        assert rd.status_code == 400

        # Invalid day => 400
        ri = requests.post(f"{BASE_URL}/api/admin/lessons",
                          json={"giorno": "funday", "orario": "10:00", "tipo_attivita": "test_boxing",
                                "coach": "x"}, headers=admin_headers, timeout=15)
        assert ri.status_code == 400

        # Invalid time format => 400
        rt = requests.post(f"{BASE_URL}/api/admin/lessons",
                          json={"giorno": "lunedi", "orario": "8:00", "tipo_attivita": "test_boxing",
                                "coach": "x"}, headers=admin_headers, timeout=15)
        assert rt.status_code == 400

        # Non-existent activity => 400
        rn = requests.post(f"{BASE_URL}/api/admin/lessons",
                          json={"giorno": "lunedi", "orario": "22:15", "tipo_attivita": "does_not_exist",
                                "coach": "x"}, headers=admin_headers, timeout=15)
        assert rn.status_code == 400

        # Delete activity while in use => 400
        rda = requests.delete(f"{BASE_URL}/api/admin/activities/{act_id}", headers=admin_headers, timeout=15)
        assert rda.status_code == 400
        assert "usata" in rda.json().get("detail", "").lower()

        # UPDATE lesson (change time)
        ru = requests.put(f"{BASE_URL}/api/admin/lessons/{lesson_id}",
                        json={"orario": "23:50", "coach": "NewCoach"},
                        headers=admin_headers, timeout=15)
        assert ru.status_code == 200
        assert ru.json()["lesson"]["orario"] == "23:50"
        assert ru.json()["lesson"]["coach"] == "NewCoach"

        # Delete lesson
        rdel = requests.delete(f"{BASE_URL}/api/admin/lessons/{lesson_id}", headers=admin_headers, timeout=15)
        assert rdel.status_code == 200

        # Now delete the activity (no longer used)
        rdaf = requests.delete(f"{BASE_URL}/api/admin/activities/{act_id}", headers=admin_headers, timeout=15)
        assert rdaf.status_code == 200

    def test_admin_lessons_require_admin(self, client_token):
        if not client_token:
            pytest.skip("no client token")
        h = {"Authorization": f"Bearer {client_token}", "Content-Type": "application/json"}
        r = requests.post(f"{BASE_URL}/api/admin/lessons",
                          json={"giorno": "lunedi", "orario": "10:00", "tipo_attivita": "pilates", "coach": "x"},
                          headers=h, timeout=15)
        assert r.status_code in (401, 403)
