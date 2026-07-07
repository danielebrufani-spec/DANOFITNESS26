"""Tests for the summer schedule migration (ACQUAPOWER/ACQUAGAG)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://gamification-phase2-1.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "danielebrufani@gmail.com"
ADMIN_PASSWORD = "Mariavittoria23"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in login response: {data}"
    return token


@pytest.fixture(scope="module")
def lessons(admin_token):
    r = requests.get(
        f"{BASE_URL}/api/lessons",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    )
    assert r.status_code == 200, f"GET /api/lessons failed: {r.status_code} {r.text}"
    return r.json()


def test_lessons_count(lessons):
    assert isinstance(lessons, list)
    assert len(lessons) == 11, f"Expected 11 lessons, got {len(lessons)}: {lessons}"


def test_no_17_30_on_tue_thu(lessons):
    bad = [l for l in lessons if l.get("giorno") in ("martedi", "giovedi") and l.get("orario") == "17:30"]
    assert bad == [], f"Found unexpected 17:30 lessons: {bad}"


def test_martedi_1830_acquapower(lessons):
    match = [l for l in lessons if l.get("giorno") == "martedi" and l.get("orario") == "18:30"]
    assert len(match) == 1, f"Expected 1 martedì 18:30 lesson, got {match}"
    l = match[0]
    assert l["tipo_attivita"] == "acquapower", f"Wrong tipo_attivita: {l}"
    assert l["coach"] == "Daniele", f"Wrong coach: {l}"


def test_giovedi_1830_acquagag(lessons):
    match = [l for l in lessons if l.get("giorno") == "giovedi" and l.get("orario") == "18:30"]
    assert len(match) == 1, f"Expected 1 giovedì 18:30 lesson, got {match}"
    l = match[0]
    assert l["tipo_attivita"] == "acquagag", f"Wrong tipo_attivita: {l}"
    assert l["coach"] == "Davide", f"Wrong coach: {l}"


def test_day_distribution(lessons):
    from collections import Counter
    dist = Counter(l["giorno"] for l in lessons)
    expected = {"lunedi": 2, "martedi": 2, "mercoledi": 2, "giovedi": 2, "venerdi": 2, "sabato": 1}
    assert dict(dist) == expected, f"Unexpected day distribution: {dict(dist)}"


def test_idempotency_after_restart(admin_token):
    """Restart backend via supervisor and verify lessons still correct."""
    import subprocess, time
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"], capture_output=True, timeout=30)
    time.sleep(6)
    # retry loop
    for _ in range(10):
        try:
            r = requests.get(
                f"{BASE_URL}/api/lessons",
                headers={"Authorization": f"Bearer {admin_token}"},
                timeout=10,
            )
            if r.status_code == 200:
                break
        except Exception:
            pass
        time.sleep(2)
    assert r.status_code == 200, f"Backend not responding after restart: {r.status_code}"
    lessons = r.json()
    assert len(lessons) == 11, f"After restart expected 11, got {len(lessons)}"
    mar = [l for l in lessons if l["giorno"] == "martedi" and l["orario"] == "18:30"]
    gio = [l for l in lessons if l["giorno"] == "giovedi" and l["orario"] == "18:30"]
    assert len(mar) == 1 and mar[0]["tipo_attivita"] == "acquapower" and mar[0]["coach"] == "Daniele"
    assert len(gio) == 1 and gio[0]["tipo_attivita"] == "acquagag" and gio[0]["coach"] == "Davide"
    bad = [l for l in lessons if l.get("orario") == "17:30"]
    assert bad == [], f"Old 17:30 lessons resurfaced after restart: {bad}"
