"""
Import fighters and fight history from JSON into PostgreSQL.
Uses upsert for fighters (idempotent). Run from project root or ensure .env is loadable.
"""
import json
import os
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

# Project root: one level up from data/
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_PROCESSED = PROJECT_ROOT / "data" / "processed"
FIGHTERS_FINAL = DATA_PROCESSED / "fighters_final.json"
FIGHTERS_ENRICHED = DATA_PROCESSED / "fighters_enriched.json"
SCHEMA_PATH = PROJECT_ROOT / "backend" / "db" / "schema.sql"
ENV_PATH = PROJECT_ROOT / ".env"

# Fighter columns in DB (order for INSERT)
FIGHTER_COLS = [
    "name", "nickname", "nationality", "gym", "weight_classes", "stance",
    "height_inches", "weight_lbs", "reach_inches", "wins", "losses", "draws",
    "win_by_ko", "win_by_sub", "win_by_dec", "total_fights", "is_champion",
    "is_former_champion", "title_weight_classes", "performance_bonuses",
    "born_year", "ufc_debut_year", "image_url",
]

# Map JSON keys to DB columns (default None if missing)
def fighter_row(rec: dict) -> tuple:
    def get(key: str, default=None):
        return rec.get(key, default)
    return (
        get("name"),
        get("nickname") or None,
        get("nationality") or None,
        get("gym") or None,
        get("weight_classes"),  # list -> TEXT[]
        get("stance") or None,
        get("height_inches"),
        get("weight_lbs"),
        get("reach_inches"),
        get("wins"),
        get("losses"),
        get("draws"),
        get("win_by_ko"),
        get("win_by_sub"),
        get("win_by_dec"),
        get("total_fights"),
        get("is_champion"),
        get("is_former_champion"),
        get("title_weight_classes"),
        get("performance_bonuses"),
        get("born_year"),
        get("ufc_debut_year"),
        get("image_url") or None,
    )


def load_fighters(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else [data]


def load_fight_history(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else [data]


def get_conn():
    load_dotenv(ENV_PATH)
    url = os.getenv("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL not set in .env")
    try:
        return psycopg2.connect(url)
    except psycopg2.OperationalError as e:
        if "could not translate host name" in str(e) or "Name or service not known" in str(e):
            print(
                "Connection failed: DNS could not resolve the database host.\n"
                "This is usually a network/firewall issue. Try:\n"
                "  1. Use the Session pooler URL instead of Direct: Supabase Dashboard → Project Settings → Database → Connection string → 'Session mode' (e.g. host aws-0-<region>.pooler.supabase.com, port 5432).\n"
                "  2. Check internet and that your network allows outbound connections to Supabase.",
                file=sys.stderr,
            )
        raise


def ensure_schema(conn) -> None:
    """Create tables if they don't exist by running backend/db/schema.sql."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fighters'"
        )
        if cur.fetchone():
            return
    if not SCHEMA_PATH.exists():
        raise SystemExit(f"Schema file not found: {SCHEMA_PATH}. Create tables first (e.g. run schema in Supabase SQL Editor).")
    sql = SCHEMA_PATH.read_text(encoding="utf-8")
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()
    print("Created database tables from backend/db/schema.sql.")


def upsert_fighters(conn, fighters: list[dict]) -> None:
    cols = ", ".join(FIGHTER_COLS)
    placeholders = ", ".join(["%s"] * len(FIGHTER_COLS))
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in FIGHTER_COLS if c != "name")
    sql = f"""
        INSERT INTO fighters ({cols})
        VALUES ({placeholders})
        ON CONFLICT (name) DO UPDATE SET {updates}
    """
    with conn.cursor() as cur:
        for rec in fighters:
            row = fighter_row(rec)
            cur.execute(sql, row)
    conn.commit()
    print(f"Upserted {len(fighters)} fighters.")


def build_name_to_id(conn) -> dict[str, str]:
    with conn.cursor() as cur:
        cur.execute("SELECT id, name FROM fighters")
        return {name: str(uid) for uid, name in cur.fetchall()}


def insert_fight_history(conn, records: list[dict], name_to_id: dict[str, str]) -> None:
    """Insert fight_history. Each record should have fighter_name (or fighter_id), opponent_name, event_name, fight_year, result, method, weight_class."""
    sql = """
        INSERT INTO fight_history (fighter_id, opponent_name, event_name, fight_year, result, method, weight_class)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    valid = ("W", "L", "D", "NC")
    inserted = 0
    skipped = 0
    with conn.cursor() as cur:
        for rec in records:
            fighter_id = rec.get("fighter_id")
            if not fighter_id:
                name = rec.get("fighter_name") or rec.get("fighter")
                if not name:
                    skipped += 1
                    continue
                fighter_id = name_to_id.get(name)
            if not fighter_id:
                skipped += 1
                continue
            result = (rec.get("result") or "").strip().upper()
            if result and result not in valid:
                result = None
            cur.execute(sql, (
                fighter_id,
                rec.get("opponent_name") or rec.get("opponent"),
                rec.get("event_name") or rec.get("event"),
                rec.get("fight_year"),
                result or None,
                rec.get("method") or None,
                rec.get("weight_class") or None,
            ))
            inserted += 1
    conn.commit()
    print(f"Inserted {inserted} fight_history rows (skipped {skipped}).")


def main():
    # Prefer fighters_final.json (has image_url from scrape_headshots); fallback to fighters_enriched.json
    if FIGHTERS_FINAL.exists():
        fighters_path = FIGHTERS_FINAL
    else:
        fighters_path = FIGHTERS_ENRICHED
    fight_history_path = DATA_PROCESSED / "fight_history.json"

    if not fighters_path.exists():
        print(f"Missing {fighters_path}", file=sys.stderr)
        sys.exit(1)

    fighters = load_fighters(fighters_path)
    print(f"Loading fighters from {fighters_path.name}")
    if not fighters:
        print("No fighters to import.")
        return

    conn = get_conn()
    try:
        ensure_schema(conn)
        upsert_fighters(conn, fighters)
        name_to_id = build_name_to_id(conn)

        if fight_history_path.exists():
            history = load_fight_history(fight_history_path)
            if history:
                insert_fight_history(conn, history, name_to_id)
            else:
                print("fight_history.json is empty, skipping.")
        else:
            print(f"No {fight_history_path} found, skipping fight history.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
