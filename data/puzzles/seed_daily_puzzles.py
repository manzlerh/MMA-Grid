"""
Seed daily_puzzles from JSON file(s).
Expects JSON: single object or array of objects with game_type, puzzle_date, difficulty, puzzle_data.
Upserts by (game_type, puzzle_date). Run from project root or set .env there.
"""
import json
import os
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

# Project root: data/puzzles -> data -> project root
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
ENV_PATH = PROJECT_ROOT / ".env"
DEFAULT_SEED_PATH = SCRIPT_DIR / "seed_puzzles.json"


def load_puzzles(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    return [data]


def get_conn():
    load_dotenv(ENV_PATH)
    url = os.getenv("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL not set in .env")
    return psycopg2.connect(url)


def upsert_puzzles(conn, puzzles: list[dict]) -> None:
    sql = """
        INSERT INTO daily_puzzles (game_type, puzzle_date, puzzle_data, difficulty)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (game_type, puzzle_date)
        DO UPDATE SET puzzle_data = EXCLUDED.puzzle_data, difficulty = EXCLUDED.difficulty
    """
    count = 0
    with conn.cursor() as cur:
        for p in puzzles:
            game_type = p.get("game_type")
            puzzle_date = p.get("puzzle_date")
            puzzle_data = p.get("puzzle_data")
            difficulty = p.get("difficulty")
            if not game_type or not puzzle_date:
                print(f"Skipping entry missing game_type or puzzle_date", file=sys.stderr)
                continue
            if game_type not in ("grid", "connections"):
                print(f"Skipping invalid game_type '{game_type}'", file=sys.stderr)
                continue
            cur.execute(sql, (
                game_type,
                puzzle_date,
                json.dumps(puzzle_data) if puzzle_data is not None else None,
                difficulty or None,
            ))
            count += 1
    conn.commit()
    print(f"Upserted {count} puzzle(s).")


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SEED_PATH
    if not path.exists():
        print(f"File not found: {path}", file=sys.stderr)
        sys.exit(1)
    puzzles = load_puzzles(path)
    if not puzzles:
        print("No puzzles to load.")
        return
    conn = get_conn()
    try:
        upsert_puzzles(conn, puzzles)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
