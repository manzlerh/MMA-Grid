"""
Recurring data refresh: re-run cleaning and enrichment, compare with DB, upsert changes,
rebuild attribute index, and optionally notify Discord.

Run from project root. Expects DATABASE_URL in environment or .env.
"""
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Project root (parent of data/)
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
PROCESSED_DIR = SCRIPT_DIR / "processed"
ENV_PATH = PROJECT_ROOT / ".env"

# Ensure we can import data scripts when run from project root
sys.path.insert(0, str(SCRIPT_DIR))

load_dotenv(ENV_PATH)

# Pipeline: clean -> enrich -> fighters_enriched.json; then copy to fighters_final.json for index
import clean_fighters
import enrich_fighters
import build_attribute_index
import import_to_db
import scrape_rankings_wikipedia
import generate_fighter_popularity


FIGHTERS_ENRICHED = PROCESSED_DIR / "fighters_enriched.json"
FIGHTERS_FINAL = PROCESSED_DIR / "fighters_final.json"
FIGHT_HISTORY_PATH = PROCESSED_DIR / "fight_history.json"


def run_pipeline() -> None:
    """Re-run cleaning and enrichment (no scraping; raw CSVs must exist)."""
    clean_fighters.main()
    enrich_fighters.main()
    # So build_attribute_index and other scripts see the same source
    if FIGHTERS_ENRICHED.exists():
        with open(FIGHTERS_ENRICHED, encoding="utf-8") as f:
            data = json.load(f)
        with open(FIGHTERS_FINAL, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Wrote {FIGHTERS_FINAL} ({len(data) if isinstance(data, list) else 1} fighters).")


def fetch_fighters_from_db(conn):
    """Return dict name -> tuple of values in FIGHTER_COLS order (for comparison)."""
    cols = import_to_db.FIGHTER_COLS
    sql = "SELECT " + ", ".join(cols) + " FROM fighters"
    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()
    return {row[0]: row for row in rows}  # name is first column


def classify_fighters(json_fighters: list[dict], db_by_name: dict) -> tuple[list[dict], list[dict], list[dict]]:
    """Return (new, updated, unchanged) lists of fighter dicts."""
    new, updated, unchanged = [], [], []
    for rec in json_fighters:
        name = (rec.get("name") or "").strip()
        if not name:
            continue
        row_from_json = import_to_db.fighter_row(rec)
        existing = db_by_name.get(name)
        if existing is None:
            new.append(rec)
        elif row_from_json != existing:
            updated.append(rec)
        else:
            unchanged.append(rec)
    return new, updated, unchanged


def send_discord_summary(added: int, updated: int, unchanged: int, error: str | None = None) -> None:
    """POST summary to DISCORD_WEBHOOK_URL if set."""
    url = os.getenv("DISCORD_WEBHOOK_URL", "").strip()
    if not url:
        return
    import urllib.request
    body = {
        "content": None,
        "embeds": [
            {
                "title": "UFC Trivia – Data Refresh",
                "description": error
                or f"Added: **{added}** fighters\nUpdated: **{updated}** fighters\nUnchanged: **{unchanged}** fighters",
                "color": 0xE74C3C if error else 0x2ECC71,
            }
        ],
    }
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status not in (200, 204):
                print(f"Discord webhook returned {resp.status}", file=sys.stderr)
    except Exception as e:
        print(f"Discord webhook failed: {e}", file=sys.stderr)


def main() -> None:
    # So clean_fighters and enrich_fighters don't see refresh_fighters.py's argv
    orig_argv = sys.argv
    try:
        sys.argv = ["refresh_fighters.py"]
        run_pipeline()
    finally:
        sys.argv = orig_argv

    fighters = import_to_db.load_fighters(FIGHTERS_ENRICHED)
    if not fighters:
        print("No fighters in enriched JSON; skipping DB update and index.")
        send_discord_summary(0, 0, 0, "No fighters in enriched JSON.")
        return

    conn = import_to_db.get_conn()
    try:
        import_to_db.ensure_schema(conn)
        db_by_name = fetch_fighters_from_db(conn)
        new, updated, unchanged = classify_fighters(fighters, db_by_name)
        to_upsert = new + updated
        if to_upsert:
            import_to_db.upsert_fighters(conn, to_upsert)
        else:
            print("No fighter changes to upsert.")
        # Fight history is not re-inserted here to avoid duplicates (no unique constraint).
    finally:
        conn.close()

    added, updated_count, unchanged_count = len(new), len(updated), len(unchanged)
    summary = f"Added: {added} fighters, Updated: {updated_count} fighters, Unchanged: {unchanged_count} fighters"
    print(summary)

    # Update UFC rankings from Wikipedia (fighter_rankings table)
    scrape_rankings_wikipedia.main()

    # Generate fighter popularity scores (uses rankings + champion/bonuses/fights); then rebuild index with popularity
    generate_fighter_popularity.main()
    build_attribute_index.main()

    send_discord_summary(added, updated_count, unchanged_count)


if __name__ == "__main__":
    main()
