import os, sys, json, requests
from dotenv import dotenv_values

env = dotenv_values("/app/frontend/.env")
BASE = env["REACT_APP_BACKEND_URL"].rstrip("/")
UID = "69f4b5d6e03695479f1354f3"


def token(email, pwd):
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": pwd}, timeout=30)
    r.raise_for_status()
    d = r.json()
    return d.get("access_token") or d.get("token")


def main():
    cmd = sys.argv[1]
    at = token("danielebrufani@gmail.com", "Mariavittoria23")
    H = {"Authorization": f"Bearer {at}"}
    if cmd == "state":
        r = requests.get(f"{BASE}/api/admin/certificato/{UID}", headers=H, timeout=30)
        print(r.status_code, json.dumps(r.json(), indent=2, default=str))
    elif cmd == "setscad":
        # arg2 = days ago (negative for future)
        from datetime import date, timedelta
        days = int(sys.argv[2])
        d = (date.today() - timedelta(days=days)).isoformat()
        r = requests.put(f"{BASE}/api/admin/certificato/{UID}", headers=H, json={"scadenza": d}, timeout=30)
        print(r.status_code, r.text[:600])
    elif cmd == "delete":
        r = requests.delete(f"{BASE}/api/admin/certificato/{UID}", headers=H, timeout=30)
        print(r.status_code, r.text[:300])
    elif cmd == "deroga_off":
        r = requests.post(f"{BASE}/api/admin/certificato/{UID}/deroga", headers=H, json={"giorni": None}, timeout=30)
        print(r.status_code, r.text[:400])
    elif cmd == "upload":
        # admin uploads a small JPEG cert for the test client and convalidates it
        import base64
        from datetime import date, timedelta
        raw = base64.b64decode(
            "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nIC"
            "IsIxwcKDcpLDAxNDQ0Hyc5PTgyPDIzMv/AABEIAAEAAQMBIgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAAA"
            "AQIDBAUGBwgJCgv/xAC1EAACAQMDAgQDBQUEBAAAAX0BAgMABBEFEiExQQYTUWEHInEUMoGRoQgjQrHBFVLR8C"
            "QzYnKCCQoWFxgZGiUmJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqS"
            "k5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v"
            "/aAAwDAQACEQMRAD8A/v4oAKACgD//2Q==")
        b64 = base64.b64encode(raw).decode()
        scad_ok = (date.today() + timedelta(days=200)).isoformat()
        s = requests.post(f"{BASE}/api/certificato/upload/start", headers=H, json={
            "file_name": "TEST_cert.jpg", "content_type": "image/jpeg", "total_chunks": 1,
            "scadenza": scad_ok, "target_user_id": UID}, timeout=30)
        print("start", s.status_code, s.text[:200])
        uid_up = s.json()["upload_id"]
        c = requests.post(f"{BASE}/api/certificato/upload/chunk", headers=H,
                          json={"upload_id": uid_up, "index": 0, "data": b64}, timeout=30)
        print("chunk", c.status_code, c.text[:150])
        f = requests.post(f"{BASE}/api/certificato/upload/finish", headers=H,
                          json={"upload_id": uid_up}, timeout=60)
        print("finish", f.status_code, f.text[:300])
        v = requests.post(f"{BASE}/api/admin/certificato/{UID}/convalida", headers=H,
                          json={"approva": True, "scadenza": scad_ok}, timeout=30)
        print("convalida", v.status_code, v.text[:300])
    elif cmd == "markseen":
        r = requests.post(f"{BASE}/api/admin/mark-registrations-seen", headers=H, timeout=30)
        print(r.status_code, r.text[:200])


main()
