"""Test: streak bonus per cliente che inizia a metà settimana.

Scenario:
- Settimana ISO corrente Lunedì-Domenica.
- Cliente che NON ha allenato Lun/Mar.
- Cliente fa Mer, Gio, Ven (3 consecutivi) — deve ricevere bonus +3 biglietti.
- Aggiunge Sab → streak 4 (no bonus extra perché 3 già dato).
- Aggiunge Dom → streak 5 → +3 bonus 5gg.
"""
import os
import asyncio
from datetime import date, datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import sys

sys.path.insert(0, '/app/backend')
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

from server import (
    db, compute_user_streak, check_and_award_streak_bonus, _week_bounds, ROME_TZ
)


async def setup_user_bookings(user_id: str, dates_iso: list[str]):
    # cleanup
    await db.bookings.delete_many({"user_id": user_id, "_test_streak": True})
    await db.streak_bonuses.delete_many({"user_id": user_id})
    await db.wheel_tickets.delete_many({"user_id": user_id})
    docs = []
    for d in dates_iso:
        docs.append({
            "user_id": user_id,
            "lesson_id": f"test_lesson_{d}",
            "data_lezione": d,
            "data_prenotazione": d,
            "ora_lezione": "10:00",
            "lezione_scalata": True,
            "_test_streak": True,
            "created_at": datetime.now(ROME_TZ),
        })
    if docs:
        await db.bookings.insert_many(docs)


async def cleanup(user_id: str):
    await db.bookings.delete_many({"user_id": user_id, "_test_streak": True})
    await db.streak_bonuses.delete_many({"user_id": user_id})
    await db.wheel_tickets.delete_many({"user_id": user_id})


async def get_tickets(user_id: str, mese_data_ref: str) -> int:
    """Conta biglietti per un mese specifico (può attraversare la settimana)."""
    doc = await db.wheel_tickets.find_one({"user_id": user_id, "mese": mese_data_ref})
    return doc.get("biglietti", 0) if doc else 0


async def get_total_tickets(user_id: str) -> int:
    """Somma totale biglietti su tutti i mesi (utile quando settimana straddle)."""
    total = 0
    async for doc in db.wheel_tickets.find({"user_id": user_id}):
        total += doc.get("biglietti", 0)
    return total


async def main():
    USER_ID = "TEST_streak_user_midweek"

    # Trova settimana corrente per scegliere date "metà settimana"
    today = datetime.now(ROME_TZ).date()
    monday, sunday, week_key = _week_bounds(today)
    print(f"\nSettimana corrente: {week_key} ({monday} → {sunday})")

    # Use first 5 days: Mon-Fri of current week (clearly in current week)
    mer = (monday + timedelta(days=2)).isoformat()  # Mercoledì
    gio = (monday + timedelta(days=3)).isoformat()
    ven = (monday + timedelta(days=4)).isoformat()
    sab = (monday + timedelta(days=5)).isoformat()
    dom = (monday + timedelta(days=6)).isoformat()
    mese = monday.strftime("%Y-%m")

    print(f"\n=== TEST 1: Cliente inizia mercoledì (Mer-Gio-Ven) ===")
    await cleanup(USER_ID)
    # Inserisce bookings Mer e Gio
    await setup_user_bookings(USER_ID, [mer, gio])
    info = await compute_user_streak(USER_ID, date.fromisoformat(gio))
    print(f"Dopo Mer+Gio: streak_corrente={info['streak_corrente']} giorni={info['giorni_allenati']}")
    assert info['streak_corrente'] == 2, f"Atteso 2, got {info['streak_corrente']}"

    # Aggiunge venerdì + chiama hook
    await setup_user_bookings(USER_ID, [mer, gio, ven])
    res = await check_and_award_streak_bonus(USER_ID, ven)
    print(f"Dopo Mer+Gio+Ven (hook su venerdì): {res}")
    tickets = await get_total_tickets(USER_ID)
    print(f"Biglietti totali (somma su tutti i mesi): {tickets}")
    assert res['streak'] == 3, f"Atteso streak=3, got {res['streak']}"
    assert res['bonus_awarded'] == 3, f"Atteso bonus=3, got {res['bonus_awarded']}"
    assert tickets == 3, f"Atteso 3 biglietti totali, got {tickets}"
    print("✅ TEST 1 PASSED: bonus 3gg ricevuto anche con cliente partito a metà settimana\n")

    print(f"=== TEST 2: Aggiunge sabato (streak=4, NO bonus extra) ===")
    await setup_user_bookings(USER_ID, [mer, gio, ven, sab])
    # Mantieni stato bonus_3_dato (rimettila dato che setup_user_bookings la pulisce)
    await db.streak_bonuses.insert_one({
        "user_id": USER_ID, "settimana": week_key, "streak_attuale": 3,
        "bonus_3_dato": True, "bonus_5_dato": False, "max_consecutivi": 3,
        "ultima_data": ven, "mese": mese
    })
    # Restore tickets
    await db.wheel_tickets.insert_one({"user_id": USER_ID, "mese": mese, "biglietti": 3})
    res = await check_and_award_streak_bonus(USER_ID, sab)
    tickets = await get_total_tickets(USER_ID)
    print(f"Dopo Mer+Gio+Ven+Sab: {res}, biglietti={tickets}")
    assert res['streak'] == 4
    assert res['bonus_awarded'] == 0, "Non deve dare bonus extra a streak=4"
    assert tickets == 3
    print("✅ TEST 2 PASSED: streak=4 non assegna bonus extra (corretto)\n")

    print(f"=== TEST 3: Aggiunge domenica (streak=5 → bonus +3 extra) ===")
    await setup_user_bookings(USER_ID, [mer, gio, ven, sab, dom])
    await db.streak_bonuses.insert_one({
        "user_id": USER_ID, "settimana": week_key, "streak_attuale": 4,
        "bonus_3_dato": True, "bonus_5_dato": False, "max_consecutivi": 4,
        "ultima_data": sab, "mese": mese
    })
    await db.wheel_tickets.insert_one({"user_id": USER_ID, "mese": mese, "biglietti": 3})
    res = await check_and_award_streak_bonus(USER_ID, dom)
    tickets = await get_total_tickets(USER_ID)
    print(f"Dopo Mer+Gio+Ven+Sab+Dom: {res}, biglietti={tickets}")
    assert res['streak'] == 5
    assert res['bonus_awarded'] == 3, "Atteso +3 bonus 5gg"
    assert tickets == 6, f"Atteso 6 biglietti (3+3), got {tickets}"
    print("✅ TEST 3 PASSED: bonus 5gg ricevuto correttamente\n")

    print(f"=== TEST 4: Settimana già iniziata, salta un giorno (no streak) ===")
    await cleanup(USER_ID)
    # Mer + Ven (salto Gio) → streak ven=1
    await setup_user_bookings(USER_ID, [mer, ven])
    res = await check_and_award_streak_bonus(USER_ID, ven)
    print(f"Mer + Ven (salto Gio) hook su Ven: {res}")
    tickets = await get_total_tickets(USER_ID)
    assert res['streak'] == 1, f"Atteso 1 (gap), got {res['streak']}"
    assert res['bonus_awarded'] == 0
    assert tickets == 0
    print("✅ TEST 4 PASSED: gap interrompe correttamente la streak\n")

    print(f"=== TEST 5: Cliente nuovo iscritto giovedì, fa Gio-Ven-Sab ===")
    await cleanup(USER_ID)
    await setup_user_bookings(USER_ID, [gio, ven, sab])
    res = await check_and_award_streak_bonus(USER_ID, sab)
    tickets = await get_total_tickets(USER_ID)
    print(f"Iscritto giovedì, Gio-Ven-Sab hook su Sab: {res}, biglietti={tickets}")
    assert res['streak'] == 3
    assert res['bonus_awarded'] == 3
    assert tickets == 3
    print("✅ TEST 5 PASSED: bonus 3gg per cliente partito da giovedì\n")

    # Cleanup finale
    await cleanup(USER_ID)
    print("🎉 TUTTI I TEST PASSATI — lo streak bonus funziona correttamente anche a settimana iniziata.")


if __name__ == "__main__":
    asyncio.run(main())
