"""
Bulk-seed daily_puzzles for a date range. Skips dates that already have puzzles.
Usage: python seed_puzzle_calendar.py --start 2025-03-01 --days 30
"""
import argparse
import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
ENV_PATH = PROJECT_ROOT / ".env"
FAILURES_LOG = SCRIPT_DIR / "failures.log"

sys.path.insert(0, str(SCRIPT_DIR))
from generate_grid_puzzle import (
    generate_grid_puzzle,
    load_attribute_index as load_grid_index,
    PuzzleGenerationError,
)
from generate_connections_puzzle import (
    generate_connections_puzzle,
    _load_index as load_connections_index,
)


def get_conn():
    load_dotenv(ENV_PATH)
    url = os.getenv("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL not set in .env")
    return psycopg2.connect(url)


def grid_difficulty_for_date(d: date) -> str:
    """Easy Monday, normal Tue–Thu, hard Friday, normal weekend."""
    w = d.weekday()  # Monday=0, Sunday=6
    if w == 0:
        return "easy"
    if w in (1, 2, 3):
        return "normal"
    if w == 4:
        return "hard"
    return "normal"


def connections_difficulty_for_day_index(day_index: int) -> str:
    """Cycle: easy, normal, normal, hard."""
    return ["easy", "normal", "normal", "hard"][day_index % 4]


def puzzle_data_grid(puzzle: dict) -> dict:
    """Build puzzle_data for DB including row_attr_ids/col_attr_ids for exclusion tracking."""
    data = {
        "columns": [c["label"] for c in puzzle["cols"]],
        "rows": [r["label"] for r in puzzle["rows"]],
        "cells": {
            k: v.get("valid_fighters", [])
            for k, v in (puzzle.get("cells") or {}).items()
        },
    }
    data["row_attr_ids"] = [r["id"] for r in puzzle["rows"]]
    data["col_attr_ids"] = [c["id"] for c in puzzle["cols"]]
    return data


def puzzle_data_connections(puzzle: dict) -> dict:
    """Build puzzle_data for DB including group_attr_ids for exclusion tracking."""
    data = {
        "categories": [
            {"name": g["label"], "fighters": g["fighters"]}
            for g in puzzle["groups"]
        ],
        "all_fighters": puzzle.get("all_fighters", []),
    }
    data["group_attr_ids"] = [g["id"] for g in puzzle["groups"]]
    return data


def load_used_attributes(conn, start_date: date, end_date: date) -> dict[date, dict]:
    """
    Return date -> { grid_ids: set, connections_ids: set } for puzzles in [start_date, end_date].
    Reads puzzle_data from DB; extracts row_attr_ids, col_attr_ids, group_attr_ids if present.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT puzzle_date, game_type, puzzle_data
            FROM daily_puzzles
            WHERE puzzle_date >= %s AND puzzle_date <= %s
            """,
            (start_date, end_date),
        )
        rows = cur.fetchall()
    by_date: dict[date, dict] = {}
    for (puzzle_date, game_type, raw_data) in rows:
        d = puzzle_date if isinstance(puzzle_date, date) else date.fromisoformat(str(puzzle_date)[:10])
        if d not in by_date:
            by_date[d] = {"grid_ids": set(), "connections_ids": set()}
        data = raw_data if isinstance(raw_data, dict) else (json.loads(raw_data) if raw_data else {})
        if game_type == "grid":
            by_date[d]["grid_ids"].update(data.get("row_attr_ids") or [])
            by_date[d]["grid_ids"].update(data.get("col_attr_ids") or [])
        elif game_type == "connections":
            by_date[d]["connections_ids"].update(data.get("group_attr_ids") or [])
    return by_date


def get_exclude_for_date(
    target_date: date,
    used_by_date: dict[date, dict],
    window_days: int = 7,
) -> tuple[set[str], set[str]]:
    """Exclude attribute ids used in [target_date - window_days, target_date - 1]. Default 7 days to avoid over-excluding (pool is ~40 attrs)."""
    exclude_grid: set[str] = set()
    exclude_conn: set[str] = set()
    for i in range(1, window_days + 1):
        d = target_date - timedelta(days=i)
        if d in used_by_date:
            exclude_grid.update(used_by_date[d]["grid_ids"])
            exclude_conn.update(used_by_date[d]["connections_ids"])
    return exclude_grid, exclude_conn


def insert_puzzle(conn, game_type: str, puzzle_date: date, puzzle_data: dict, difficulty: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO daily_puzzles (game_type, puzzle_date, puzzle_data, difficulty)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (game_type, puzzle_date)
            DO UPDATE SET puzzle_data = EXCLUDED.puzzle_data, difficulty = EXCLUDED.difficulty
            """,
            (game_type, puzzle_date.isoformat(), json.dumps(puzzle_data), difficulty),
        )
    conn.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Bulk-seed daily puzzles for a date range.")
    parser.add_argument("--start", required=True, help="Start date YYYY-MM-DD")
    parser.add_argument("--days", type=int, default=30, help="Number of days to seed (default 30)")
    parser.add_argument(
        "--exclude-days",
        type=int,
        default=7,
        help="Days of attribute exclusion to avoid reuse (default 7). Use 0 to disable.",
    )
    args = parser.parse_args()
    try:
        start_date = date.fromisoformat(args.start)
    except ValueError:
        sys.exit("Invalid --start; use YYYY-MM-DD")
    if args.days < 1:
        sys.exit("--days must be >= 1")

    end_date = start_date + timedelta(days=args.days - 1)
    exclude_days = max(0, args.exclude_days)
    window_start = start_date - timedelta(days=exclude_days)

    conn = get_conn()
    try:
        used_by_date = load_used_attributes(conn, window_start, end_date)
    finally:
        conn.close()

    grid_index = load_grid_index()
    conn_index = load_connections_index()

    seeded_grid = 0
    seeded_connections = 0
    failures: list[tuple[str, str, str]] = []  # (date, game_type, error_msg)
    max_attempts = 500

    for day_offset in range(args.days):
        d = start_date + timedelta(days=day_offset)
        date_str = d.isoformat()

        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT game_type FROM daily_puzzles WHERE puzzle_date = %s",
                    (d,),
                )
                existing = {row[0] for row in cur.fetchall()}
        finally:
            conn.close()

        need_grid = "grid" not in existing
        need_connections = "connections" not in existing
        if not need_grid and not need_connections:
            continue

        exclude_grid, exclude_conn = get_exclude_for_date(d, used_by_date, window_days=exclude_days)

        if need_grid:
            diff = grid_difficulty_for_date(d)
            puzzle = None
            try:
                for attempt_diff in [diff, "normal"] if diff != "normal" else [diff]:
                    try:
                        puzzle = generate_grid_puzzle(
                            difficulty=attempt_diff,
                            max_attempts=max_attempts,
                            exclude_attribute_ids=exclude_grid if attempt_diff == diff else None,
                            index=grid_index,
                        )
                        diff = attempt_diff
                        break
                    except PuzzleGenerationError:
                        if attempt_diff == "normal":
                            raise
                        continue
                if puzzle is not None:
                    data = puzzle_data_grid(puzzle)
                    conn = get_conn()
                    try:
                        insert_puzzle(conn, "grid", d, data, diff)
                        seeded_grid += 1
                        used_by_date.setdefault(d, {"grid_ids": set(), "connections_ids": set()})
                        used_by_date[d]["grid_ids"].update(data.get("row_attr_ids", []))
                        used_by_date[d]["grid_ids"].update(data.get("col_attr_ids", []))
                    finally:
                        conn.close()
            except PuzzleGenerationError as e:
                failures.append((date_str, "grid", str(e)))
            except Exception as e:
                failures.append((date_str, "grid", str(e)))

        if need_connections:
            diff = connections_difficulty_for_day_index(day_offset)
            puzzle = None
            try:
                for attempt_diff in [diff, "normal"] if diff != "normal" else [diff]:
                    try:
                        puzzle = generate_connections_puzzle(
                            difficulty=attempt_diff,
                            max_attempts=300,
                            exclude_attribute_ids=exclude_conn if attempt_diff == diff else None,
                            index=conn_index,
                        )
                        diff = attempt_diff
                        break
                    except ValueError:
                        if attempt_diff == "normal":
                            raise
                        continue
                if puzzle is not None:
                    data = puzzle_data_connections(puzzle)
                    conn = get_conn()
                    try:
                        insert_puzzle(conn, "connections", d, data, diff)
                        seeded_connections += 1
                        used_by_date.setdefault(d, {"grid_ids": set(), "connections_ids": set()})
                        used_by_date[d]["connections_ids"].update(data.get("group_attr_ids", []))
                    finally:
                        conn.close()
            except ValueError as e:
                failures.append((date_str, "connections", str(e)))
            except Exception as e:
                failures.append((date_str, "connections", str(e)))

    if failures:
        with open(FAILURES_LOG, "a", encoding="utf-8") as f:
            for date_str, game_type, err in failures:
                f.write(f"{date_str} {game_type} {err}\n")

    failed_count = len(failures)
    failed_dates = len({d for d, _, _ in failures})
    print(
        f"Seeded {seeded_grid} grid puzzles, {seeded_connections} connections puzzles. "
        f"Failed: {failed_count} puzzle(s) ({failed_dates} date(s))"
        + (f" — see {FAILURES_LOG}" if failed_count else ".")
    )


if __name__ == "__main__":
    main()
