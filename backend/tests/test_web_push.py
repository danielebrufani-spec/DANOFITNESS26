"""Tests for Web Push Notifications endpoints and announcement broadcast hook."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fall back to reading frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

ADMIN_EMAIL = "danielebrufani@gmail.com"
ADMIN_PASSWORD = "Mariavittoria23"
CLIENT_EMAIL = "testclient_kpi@test.com"
CLIENT_PASSWORD = "Test123456"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=20)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def client_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": CLIENT_EMAIL, "password": CLIENT_PASSWORD},
                      timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Client login failed: {r.status_code}")
    return r.json()["token"]


# ---------------- VAPID public key (public) ----------------
def test_vapid_public_key_no_auth():
    r = requests.get(f"{BASE_URL}/api/push/vapid-public-key", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "public_key" in data
    pk = data["public_key"]
    assert isinstance(pk, str) and len(pk) > 50, f"unexpected key len {len(pk)}"
    # base64url chars only
    import re
    assert re.match(r"^[A-Za-z0-9_-]+$", pk), "public_key not base64url"


# ---------------- Auth gating ----------------
def test_push_status_requires_auth():
    r = requests.get(f"{BASE_URL}/api/push/status", timeout=15)
    assert r.status_code in (401, 403)


def test_push_subscribe_requires_auth():
    r = requests.post(f"{BASE_URL}/api/push/subscribe",
                      json={"endpoint": "https://x", "keys": {"p256dh": "a", "auth": "b"}},
                      timeout=15)
    assert r.status_code in (401, 403)


def test_push_unsubscribe_requires_auth():
    r = requests.post(f"{BASE_URL}/api/push/unsubscribe",
                      json={"endpoint": "https://x", "keys": {"p256dh": "a", "auth": "b"}},
                      timeout=15)
    assert r.status_code in (401, 403)


# ---------------- Status ----------------
def test_push_status_authenticated(client_token):
    r = requests.get(f"{BASE_URL}/api/push/status",
                     headers={"Authorization": f"Bearer {client_token}"}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "subscribed" in data and "devices" in data
    assert isinstance(data["subscribed"], bool)
    assert isinstance(data["devices"], int)


# ---------------- Subscribe / unsubscribe flow ----------------
FAKE_ENDPOINT = "https://fcm.googleapis.com/fcm/send/TEST_ENDPOINT_web_push_agent_iter15"
FAKE_KEYS = {
    "p256dh": "BLc4xRzKlKORKiCBdxyM4wJl5RzuT3QSJgFcHcmH5cEJ0S6a3lNc0aWZk4T1KXfR2EylZFCA6c1sjLc9y5xNRxA",
    "auth": "kR0iX8W6E3F1TzP3nYqL9A",
}


def test_push_subscribe_and_unsubscribe(client_token):
    h = {"Authorization": f"Bearer {client_token}"}
    # 1) Initial status
    r0 = requests.get(f"{BASE_URL}/api/push/status", headers=h, timeout=15)
    initial_devices = r0.json().get("devices", 0)

    # 2) Subscribe
    r = requests.post(f"{BASE_URL}/api/push/subscribe", headers=h,
                     json={"endpoint": FAKE_ENDPOINT, "keys": FAKE_KEYS}, timeout=15)
    assert r.status_code == 200, r.text
    assert "message" in r.json()

    # 3) Verify status shows +1 device (or subscribed True)
    r2 = requests.get(f"{BASE_URL}/api/push/status", headers=h, timeout=15)
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["subscribed"] is True
    assert d2["devices"] >= 1

    # 4) Idempotent: subscribe same endpoint again -> still one device
    r3 = requests.post(f"{BASE_URL}/api/push/subscribe", headers=h,
                     json={"endpoint": FAKE_ENDPOINT, "keys": FAKE_KEYS}, timeout=15)
    assert r3.status_code == 200
    r4 = requests.get(f"{BASE_URL}/api/push/status", headers=h, timeout=15)
    assert r4.json()["devices"] == d2["devices"], "Subscription should be idempotent (upsert)"

    # 5) Unsubscribe
    r5 = requests.post(f"{BASE_URL}/api/push/unsubscribe", headers=h,
                      json={"endpoint": FAKE_ENDPOINT, "keys": FAKE_KEYS}, timeout=15)
    assert r5.status_code == 200
    assert r5.json().get("removed") == 1

    # 6) Status back to initial
    r6 = requests.get(f"{BASE_URL}/api/push/status", headers=h, timeout=15)
    assert r6.json()["devices"] == initial_devices


def test_push_subscribe_malformed_payload(client_token):
    h = {"Authorization": f"Bearer {client_token}"}
    # Missing keys
    r = requests.post(f"{BASE_URL}/api/push/subscribe", headers=h,
                     json={"endpoint": "https://x", "keys": {}}, timeout=15)
    assert r.status_code == 400, r.text

    # Missing p256dh
    r2 = requests.post(f"{BASE_URL}/api/push/subscribe", headers=h,
                      json={"endpoint": "https://x", "keys": {"auth": "a"}}, timeout=15)
    assert r2.status_code == 400

    # Empty endpoint
    r3 = requests.post(f"{BASE_URL}/api/push/subscribe", headers=h,
                      json={"endpoint": "", "keys": FAKE_KEYS}, timeout=15)
    assert r3.status_code == 400


# ---------------- Announcement broadcast hook ----------------
def test_create_announcement_returns_push_stats(admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "titolo": "TEST_PUSH_ITER15",
        "messaggio": "Test broadcast push notification",
        "colore": "red",
        "lampeggiante": False,
        "attivo": True,
    }
    r = requests.post(f"{BASE_URL}/api/admin/announcements", headers=h,
                      json=payload, timeout=30)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    assert "announcement" in data
    ann = data["announcement"]
    ann_id = ann.get("id") or ann.get("_id")
    assert ann_id, "announcement id missing"
    assert "push_stats" in data, "push_stats field must be present when active=True"
    ps = data["push_stats"]
    assert ps is not None, "push_stats should not be null for active announcement"
    assert "sent" in ps and "failed" in ps and "expired_cleaned" in ps
    assert isinstance(ps["sent"], int)

    # Cleanup
    requests.delete(f"{BASE_URL}/api/admin/announcements/{ann_id}", headers=h, timeout=15)


def test_create_inactive_announcement_no_push(admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "titolo": "TEST_PUSH_INACTIVE_ITER15",
        "messaggio": "no push",
        "colore": "green",
        "lampeggiante": False,
        "attivo": False,
    }
    r = requests.post(f"{BASE_URL}/api/admin/announcements", headers=h,
                      json=payload, timeout=30)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    assert data.get("push_stats") is None, "push_stats must be null for inactive announcement"
    ann_id = data["announcement"].get("id") or data["announcement"].get("_id")
    # Cleanup
    requests.delete(f"{BASE_URL}/api/admin/announcements/{ann_id}", headers=h, timeout=15)


def test_toggle_announcement_push_only_on_activation(admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    # Create inactive
    payload = {
        "titolo": "TEST_TOGGLE_ITER15",
        "messaggio": "toggle test",
        "colore": "yellow",
        "lampeggiante": False,
        "attivo": False,
    }
    r = requests.post(f"{BASE_URL}/api/admin/announcements", headers=h,
                      json=payload, timeout=30)
    assert r.status_code in (200, 201), r.text
    ann_id = r.json()["announcement"].get("id") or r.json()["announcement"].get("_id")

    try:
        # Toggle ON -> should include push_stats not null
        r2 = requests.patch(f"{BASE_URL}/api/admin/announcements/{ann_id}/toggle",
                           headers=h, timeout=30)
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        assert d2.get("attivo") is True
        assert d2.get("push_stats") is not None
        assert "sent" in d2["push_stats"]

        # Toggle OFF -> push_stats should be null
        r3 = requests.patch(f"{BASE_URL}/api/admin/announcements/{ann_id}/toggle",
                           headers=h, timeout=30)
        assert r3.status_code == 200
        d3 = r3.json()
        assert d3.get("attivo") is False
        assert d3.get("push_stats") is None, "toggle OFF must not trigger push"
    finally:
        requests.delete(f"{BASE_URL}/api/admin/announcements/{ann_id}", headers=h, timeout=15)
