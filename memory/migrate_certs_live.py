"""Migrazione file certificati: Emergent objstore (accessibile solo da qui) -> GridFS del live (Render).
Uso: python3 /app/memory/migrate_certs_live.py
"""
import os, sys, base64, requests
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

LIVE = "https://diobestia.onrender.com/api"
OBJ = "https://integrations.emergentagent.com/objstore/api/v1/storage"

r = requests.post(f"{LIVE}/auth/login", json={"email": "danielebrufani@gmail.com", "password": "Mariavittoria23"}, timeout=60)
tok = r.json()["token"]
H = {"Authorization": f"Bearer {tok}"}

r = requests.post(f"{OBJ}/init", json={"emergent_key": os.environ["EMERGENT_LLM_KEY"].strip()}, timeout=30)
r.raise_for_status()
sk = r.json()["storage_key"]

lista = requests.get(f"{LIVE}/admin/certificati/migrazione/lista", headers=H, timeout=60).json()
print(f"Da migrare: {lista['totale']}")
ok, err = 0, 0
for item in lista["da_migrare"]:
    path = item["storage_path"]
    try:
        f = requests.get(f"{OBJ}/objects/{path}", headers={"X-Storage-Key": sk}, timeout=60)
        if f.status_code != 200:
            print(f"  SKIP {path}: objstore {f.status_code}")
            err += 1
            continue
        up = requests.post(f"{LIVE}/admin/certificati/migrazione/carica", headers=H, timeout=120,
                           json={"storage_path": path, "content_type": item.get("content_type") or f.headers.get("Content-Type", "application/octet-stream"), "data_b64": base64.b64encode(f.content).decode()})
        if up.status_code == 200:
            print(f"  OK {item['user_id']} {item.get('file_name')} ({len(f.content)} bytes)")
            ok += 1
        else:
            print(f"  ERR carica {path}: {up.status_code} {up.text[:100]}")
            err += 1
    except Exception as e:
        print(f"  ERR {path}: {e}")
        err += 1
print(f"\nMigrati: {ok} | Errori/skip: {err}")
