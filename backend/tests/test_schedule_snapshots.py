"""Tests for Schedule Snapshots (Duplica settimana / backup)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0]
BASE_URL = BASE_URL.rstrip("/")
ADMIN_EMAIL = "danielebrufani@gmail.com"
ADMIN_PASSWORD = "Mariavittoria23"


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def client_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "testclient_kpi@test.com", "password": "Test123456"}, timeout=15)
    if r.status_code != 200:
        return None
    return {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}


class TestSnapshotAuth:
    def test_list_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/schedule-snapshots", timeout=15)
        assert r.status_code in (401, 403)

    def test_create_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/admin/schedule-snapshots", json={"nome": "x"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_restore_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/admin/schedule-snapshots/000000000000000000000000/restore", timeout=15)
        assert r.status_code in (401, 403)

    def test_delete_requires_auth(self):
        r = requests.delete(f"{BASE_URL}/api/admin/schedule-snapshots/000000000000000000000000", timeout=15)
        assert r.status_code in (401, 403)

    def test_client_cannot_access(self, client_headers):
        if not client_headers:
            pytest.skip("no client")
        r = requests.get(f"{BASE_URL}/api/admin/schedule-snapshots", headers=client_headers, timeout=15)
        assert r.status_code in (401, 403)


class TestSnapshotCRUD:
    created_ids = []

    def test_create_with_custom_name(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/schedule-snapshots",
                          json={"nome": "TEST_snap_custom"}, headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        snap = r.json()["snapshot"]
        assert snap["nome"] == "TEST_snap_custom"
        assert snap["id"]
        assert isinstance(snap["lessons_count"], int)
        assert snap["created_at"]
        TestSnapshotCRUD.created_ids.append(snap["id"])

    def test_create_default_name(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/schedule-snapshots",
                          json={}, headers=admin_headers, timeout=20)
        assert r.status_code == 200
        snap = r.json()["snapshot"]
        assert snap["nome"].startswith("Backup ")
        TestSnapshotCRUD.created_ids.append(snap["id"])

    def test_list_snapshots(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/schedule-snapshots", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "snapshots" in data
        assert isinstance(data["snapshots"], list)
        # ensure our created ones present + lessons field NOT included
        listed_ids = {s["id"] for s in data["snapshots"]}
        for cid in TestSnapshotCRUD.created_ids:
            assert cid in listed_ids
        for s in data["snapshots"]:
            assert "lessons" not in s
            assert {"id", "nome", "lessons_count", "created_at"} <= set(s.keys())
        # ordering: descending by created_at
        dates = [s["created_at"] for s in data["snapshots"] if s["created_at"]]
        assert dates == sorted(dates, reverse=True)

    def test_delete_snapshot(self, admin_headers):
        if not TestSnapshotCRUD.created_ids:
            pytest.skip("no snapshot")
        sid = TestSnapshotCRUD.created_ids.pop()
        r = requests.delete(f"{BASE_URL}/api/admin/schedule-snapshots/{sid}",
                            headers=admin_headers, timeout=15)
        assert r.status_code == 200

    def test_delete_snapshot_404(self, admin_headers):
        r = requests.delete(f"{BASE_URL}/api/admin/schedule-snapshots/507f1f77bcf86cd799439011",
                            headers=admin_headers, timeout=15)
        assert r.status_code == 404

    def test_delete_bad_id(self, admin_headers):
        r = requests.delete(f"{BASE_URL}/api/admin/schedule-snapshots/notanid",
                            headers=admin_headers, timeout=15)
        assert r.status_code == 400

    def test_restore_404(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/schedule-snapshots/507f1f77bcf86cd799439011/restore",
                         headers=admin_headers, timeout=15)
        assert r.status_code == 404


class TestSnapshotRestoreE2E:
    """Snapshot → delete lesson → restore → verify count."""

    def test_full_restore_flow(self, admin_headers):
        # 1) get current lessons count
        r0 = requests.get(f"{BASE_URL}/api/lessons", headers=admin_headers, timeout=15)
        assert r0.status_code == 200
        body0 = r0.json()
        initial = body0["lessons"] if isinstance(body0, dict) else body0
        initial_count = len(initial)
        if initial_count < 1:
            pytest.skip("need at least 1 lesson to test restore")
        initial_keys = {(l["giorno"], l["orario"], l["tipo_attivita"], l.get("coach", "Daniele")) for l in initial}

        # 2) create snapshot
        r1 = requests.post(f"{BASE_URL}/api/admin/schedule-snapshots",
                           json={"nome": "TEST_snap_e2e"}, headers=admin_headers, timeout=20)
        assert r1.status_code == 200
        snap = r1.json()["snapshot"]
        snap_id = snap["id"]
        assert snap["lessons_count"] == initial_count

        try:
            # 3) delete first lesson
            victim = initial[0]
            vid = victim["id"]
            rd = requests.delete(f"{BASE_URL}/api/admin/lessons/{vid}", headers=admin_headers, timeout=15)
            assert rd.status_code == 200

            r2 = requests.get(f"{BASE_URL}/api/lessons", headers=admin_headers, timeout=15)
            b2 = r2.json()
            lst2 = b2["lessons"] if isinstance(b2, dict) else b2
            assert len(lst2) == initial_count - 1

            # 4) restore
            rr = requests.post(f"{BASE_URL}/api/admin/schedule-snapshots/{snap_id}/restore",
                              headers=admin_headers, timeout=30)
            assert rr.status_code == 200, rr.text
            payload = rr.json()
            assert payload["lessons_restored"] == initial_count

            # 5) verify count back + same keys
            r3 = requests.get(f"{BASE_URL}/api/lessons", headers=admin_headers, timeout=15)
            b3 = r3.json()
            restored = b3["lessons"] if isinstance(b3, dict) else b3
            assert len(restored) == initial_count
            restored_keys = {(l["giorno"], l["orario"], l["tipo_attivita"], l.get("coach", "Daniele")) for l in restored}
            assert restored_keys == initial_keys, f"key mismatch: missing={initial_keys - restored_keys} extra={restored_keys - initial_keys}"
        finally:
            # cleanup snapshot
            requests.delete(f"{BASE_URL}/api/admin/schedule-snapshots/{snap_id}",
                           headers=admin_headers, timeout=15)


@pytest.fixture(scope="module", autouse=True)
def _cleanup(admin_headers):
    yield
    # cleanup any TEST_ snapshot leftover
    try:
        r = requests.get(f"{BASE_URL}/api/admin/schedule-snapshots", headers=admin_headers, timeout=15)
        for s in r.json().get("snapshots", []):
            if s["nome"].startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/admin/schedule-snapshots/{s['id']}",
                               headers=admin_headers, timeout=10)
    except Exception:
        pass
