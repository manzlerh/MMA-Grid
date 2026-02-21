"""
Seed daily_puzzles from JSON file(s).
Loads from data/puzzles/ (or given path). Supports:
- Single file: path to a .json file (object or array)
- Directory: loads all *.json from path and subdirs (e.g. grid/, connections/)
  and infers game_type from folder name when missing in JSON.
Expects JSON: object(s) with game_type, puzzle_date, difficulty, puzzle_data.
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
DEFAULT_SEED_PATH = SCRIPT_DIR


def load_puzzles(path: Path) -> list[dict]:
    """Load puzzle(s) from a file or directory. Infers game_type from folder name when missing."""
    puzzles = []

    if path.is_file():
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        items = data if isinstance(data, list) else [data]
        for item in items:
            if isinstance(item, dict):
                puzzles.append(item)
        return puzzles

    if path.is_dir():
        for file in path.rglob("*.json"):
            with open(file, encoding="utf-8") as f:
                data = json.load(f)
            items = data if isinstance(data, list) else [data]
            parent_name = file.parent.name.lower()
            for item in items:
                if not isinstance(item, dict):
                    continue
                if not item.get("game_type") and parent_name in ("grid", "connections"):
                    item["game_type"] = parent_name
                puzzles.append(item)
        return puzzles

    raise FileNotFoundError(f"No such file or directory: {path}")


def validate_puzzle(p: dict) -> bool:
    """Validate puzzle structure by game_type. Returns True if valid."""
    game_type = p.get("game_type")
    data = p.get("puzzle_data")

    if not isinstance(data, dict):
        print("Invalid puzzle_data format", file=sys.stderr)
        return False

    if game_type == "grid":
        required_keys = {"rows", "columns", "cells"}
        if not required_keys.issubset(data.keys()):
            print("Grid puzzle missing required keys (rows, columns, cells)", file=sys.stderr)
            return False
        return True

    if game_type == "connections":
        if "categories" not in data or "all_fighters" not in data:
            print("Connections puzzle missing required keys (categories, all_fighters)", file=sys.stderr)
            return False

        categories = data["categories"]
        all_fighters = data["all_fighters"]

        if len(categories) != 4:
            print("Connections must have exactly 4 categories", file=sys.stderr)
            return False

        fighters_flat = []
        for c in categories:
            if "name" not in c or "fighters" not in c:
                print("Invalid category format (need name and fighters)", file=sys.stderr)
                return False
            if len(c["fighters"]) != 4:
                print(f"Category '{c.get('name')}' must have 4 fighters", file=sys.stderr)
                return False
            fighters_flat.extend(c["fighters"])

        if len(set(fighters_flat)) != 16:
            print("Connections puzzle must have 16 unique fighters", file=sys.stderr)
            return False

        if set(fighters_flat) != set(all_fighters):
            print("all_fighters does not match category fighters", file=sys.stderr)
            return False

        return True

    return False


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
                print("Skipping entry missing game_type or puzzle_date", file=sys.stderr)
                continue
            if game_type not in ("grid", "connections"):
                print(f"Skipping invalid game_type '{game_type}'", file=sys.stderr)
                continue
            if not validate_puzzle(p):
                print(f"Skipping invalid puzzle for {game_type} on {puzzle_date}", file=sys.stderr)
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
        print(f"File or directory not found: {path}", file=sys.stderr)
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
