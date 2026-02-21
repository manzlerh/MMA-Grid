"""
Admin CLI for generating, previewing, approving, and scheduling daily puzzles.
Uses Python's cmd module (no external deps beyond psycopg2/dotenv for DB).
Run from project root: python data/admin_cli.py
"""
import json
import os
import sys
from calendar import monthrange
from cmd import Cmd
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
ENV_PATH = PROJECT_ROOT / ".env"
DATA_PROCESSED = SCRIPT_DIR / "processed"
SCHEDULED_DIR = SCRIPT_DIR / "scheduled"
FIGHTERS_FINAL = DATA_PROCESSED / "fighters_final.json"
FIGHTERS_ENRICHED = DATA_PROCESSED / "fighters_enriched.json"

sys.path.insert(0, str(SCRIPT_DIR))
from generate_grid_puzzle import (
    generate_grid_puzzle_interactive,
    load_attribute_index as load_grid_index,
)
from generate_connections_puzzle import (
    generate_connections_puzzle,
    check_ambiguity,
    _load_index as load_connections_index,
)


def get_conn():
    load_dotenv(ENV_PATH)
    url = os.getenv("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL not set in .env")
    return psycopg2.connect(url)


def load_fighter_wins() -> dict[str, int]:
    """Return name -> UFC wins for 'fame' ordering."""
    path = FIGHTERS_FINAL if FIGHTERS_FINAL.exists() else FIGHTERS_ENRICHED
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    fighters = data if isinstance(data, list) else [data]
    out = {}
    for f in fighters:
        name = f.get("name")
        if not name:
            continue
        try:
            out[name] = int(f.get("wins") or 0)
        except (TypeError, ValueError):
            out[name] = 0
    return out


def grid_puzzle_to_puzzle_data(puzzle: dict) -> dict:
    """Convert generator output to puzzle_data for DB (columns, rows, cells with name lists)."""
    return {
        "columns": [c["label"] for c in puzzle["cols"]],
        "rows": [r["label"] for r in puzzle["rows"]],
        "cells": {
            k: v.get("valid_fighters", [])
            for k, v in (puzzle.get("cells") or {}).items()
        },
    }


def connections_puzzle_to_puzzle_data(puzzle: dict) -> dict:
    """Convert generator output to puzzle_data for DB (categories, all_fighters)."""
    return {
        "categories": [
            {"name": g["label"], "fighters": g["fighters"]}
            for g in puzzle["groups"]
        ],
        "all_fighters": puzzle.get("all_fighters", []),
    }


class PuzzleAdminCLI(Cmd):
    intro = (
        "\n  UFC Trivia — Puzzle Admin CLI\n"
        "  Commands: generate, preview, approve, schedule, calendar, list, export\n"
        "  Type help or ? for list. help <command> for details.\n"
    )
    prompt = "puzzle> "

    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self.grid_candidates: list[dict] = []
        self.approved_grid: dict | None = None
        self.approved_connections: dict | None = None
        self._fighter_wins: dict[str, int] = {}
        self._grid_index = None
        self._conn_index = None

    def _ensure_fighter_wins(self):
        if not self._fighter_wins:
            self._fighter_wins = load_fighter_wins()

    def _top_famous(self, names: list[str], n: int = 3) -> list[str]:
        self._ensure_fighter_wins()
        by_wins = [(name, self._fighter_wins.get(name, 0)) for name in names]
        by_wins.sort(key=lambda x: -x[1])
        return [x[0] for x in by_wins[:n]]

    def _print_grid_table(self, puzzle: dict):
        """Table: row labels, column labels, each cell = count + top 3 famous."""
        rows = puzzle.get("rows") or []
        cols = puzzle.get("cols") or []
        cells = puzzle.get("cells") or {}
        r_labels = [r.get("label", "?") for r in rows]
        c_labels = [c.get("label", "?") for c in cols]
        col_w = max(14, max(len(c) for c in c_labels))
        cell_w = 36
        # Header row: empty, then col labels
        print("  " + "".join((c_labels[i][:col_w].ljust(col_w) for i in range(3))))
        for r in range(3):
            line = (r_labels[r][:14].ljust(14) if r < len(r_labels) else "?") + " "
            for c in range(3):
                key = f"{r},{c}"
                data = cells.get(key) or {}
                fighters = data.get("valid_fighters") or []
                count = data.get("count", 0)
                top = self._top_famous(fighters, 3)
                cell_str = f"({count}) " + ", ".join(top[:3]) if top else f"({count}) —"
                line += cell_str[:cell_w].ljust(cell_w)
            print("  " + line)

    def do_generate(self, arg: str):
        """generate grid [easy|normal|hard]  OR  generate connections [easy|normal|hard]"""
        parts = (arg or "").strip().split()
        if len(parts) < 2:
            print("Usage: generate grid [easy|normal|hard]  |  generate connections [easy|normal|hard]")
            return
        game, diff = parts[0].lower(), (parts[1].lower() if len(parts) > 1 else "normal")
        if game not in ("grid", "connections"):
            print("Game must be 'grid' or 'connections'")
            return
        if diff not in ("easy", "normal", "hard"):
            diff = "normal"

        if game == "grid":
            if not self._grid_index:
                self._grid_index = load_grid_index()
            self.grid_candidates = generate_grid_puzzle_interactive(
                difficulty=diff, num_candidates=3, index=self._grid_index, silent=True
            )
            if not self.grid_candidates:
                print("No grid candidates generated.")
                return
            print("\n--- Grid candidates (table) ---\n")
            for i, p in enumerate(self.grid_candidates, 1):
                print(f"  --- Candidate {i} ---")
                self._print_grid_table(p)
                print()
            choice = input("Enter puzzle number to preview (1-3) or r to regenerate: ").strip().lower()
            if choice == "r":
                return self.do_generate(arg)
            if choice in ("1", "2", "3"):
                self.do_preview(f"grid {choice}")
            return

        if game == "connections":
            if not self._conn_index:
                self._conn_index = load_connections_index()
            try:
                p = generate_connections_puzzle(difficulty=diff, index=self._conn_index)
            except ValueError as e:
                print(e)
                return
            print("\n--- Connections puzzle ---")
            for g in p["groups"]:
                print(f"  {g['color']}: {g['label']}")
                print(f"    {g['fighters']}")
            report = check_ambiguity(p, self._conn_index)
            if report["summary"]["ambiguous_count"] > 0:
                print(f"\n  WARNING: {report['summary']['ambiguous_count']} ambiguous fighter(s):")
                print("    " + ", ".join(report["ambiguous_fighters"][:20]))
                if len(report["ambiguous_fighters"]) > 20:
                    print("    ...")
            approve = input("\nApprove? (y/n): ").strip().lower()
            if approve == "y":
                self.approved_connections = p
                print("Connections puzzle approved. Use 'schedule connections YYYY-MM-DD' to save.")
            return

    def do_preview(self, arg: str):
        """preview grid [1|2|3] — show full valid fighter list for every cell."""
        parts = (arg or "").strip().split()
        if len(parts) < 2 or parts[0].lower() != "grid":
            print("Usage: preview grid [1|2|3]")
            return
        try:
            n = int(parts[1])
        except ValueError:
            print("Puzzle number must be 1, 2, or 3.")
            return
        if n < 1 or n > 3:
            print("Puzzle number must be 1, 2, or 3.")
            return
        if not self.grid_candidates or n > len(self.grid_candidates):
            print("No candidate puzzle. Run 'generate grid [difficulty]' first.")
            return
        puzzle = self.grid_candidates[n - 1]
        cells = puzzle.get("cells") or {}
        rows = puzzle.get("rows") or []
        cols = puzzle.get("cols") or []
        r_labels = [r.get("label", "?") for r in rows]
        c_labels = [c.get("label", "?") for c in cols]
        print("\n--- Full fighter list per cell ---\n")
        for r in range(3):
            for c in range(3):
                key = f"{r},{c}"
                data = cells.get(key) or {}
                fighters = data.get("valid_fighters") or []
                rl = r_labels[r] if r < len(r_labels) else "?"
                cl = c_labels[c] if c < len(c_labels) else "?"
                print(f"  [{rl}] x [{cl}] ({len(fighters)}):")
                print("    " + ", ".join(fighters) if fighters else "    (none)")
                print()
        print("Use 'approve grid", n, "' to approve this puzzle for scheduling.")

    def do_approve(self, arg: str):
        """approve grid [1|2|3] — set approved grid puzzle for scheduling."""
        parts = (arg or "").strip().split()
        if len(parts) < 2 or parts[0].lower() != "grid":
            print("Usage: approve grid [1|2|3]")
            return
        try:
            n = int(parts[1])
        except ValueError:
            print("Puzzle number must be 1, 2, or 3.")
            return
        if n < 1 or n > 3 or not self.grid_candidates or n > len(self.grid_candidates):
            print("Invalid puzzle number or no candidates. Run 'generate grid' first.")
            return
        self.approved_grid = self.grid_candidates[n - 1]
        print("Grid puzzle approved. Use 'schedule grid YYYY-MM-DD' to save to DB.")

    def do_schedule(self, arg: str):
        """schedule grid YYYY-MM-DD  |  schedule connections YYYY-MM-DD"""
        parts = (arg or "").strip().split()
        if len(parts) < 2:
            print("Usage: schedule grid YYYY-MM-DD  |  schedule connections YYYY-MM-DD")
            return
        game = parts[0].lower()
        date_str = parts[1]
        if game not in ("grid", "connections"):
            print("Game must be 'grid' or 'connections'")
            return
        if len(date_str) != 10 or date_str[4] != "-" or date_str[7] != "-":
            print("Date must be YYYY-MM-DD")
            return

        if game == "grid":
            p = self.approved_grid
            if not p:
                print("No approved grid puzzle. Run 'generate grid', then 'approve grid N'.")
                return
            puzzle_data = grid_puzzle_to_puzzle_data(p)
            difficulty = p.get("difficulty", "normal")
        else:
            p = self.approved_connections
            if not p:
                print("No approved connections puzzle. Run 'generate connections' and approve.")
                return
            puzzle_data = connections_puzzle_to_puzzle_data(p)
            difficulty = p.get("difficulty", "normal")

        try:
            conn = get_conn()
        except SystemExit as e:
            print(e)
            return
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM daily_puzzles WHERE game_type = %s AND puzzle_date = %s::date",
                    (game, date_str),
                )
                exists = cur.fetchone()
            if exists:
                ow = input("Overwrite? (y/n): ").strip().lower()
                if ow != "y":
                    print("Cancelled.")
                    return
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO daily_puzzles (game_type, puzzle_date, puzzle_data, difficulty)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (game_type, puzzle_date)
                    DO UPDATE SET puzzle_data = EXCLUDED.puzzle_data, difficulty = EXCLUDED.difficulty
                    """,
                    (game, date_str, json.dumps(puzzle_data), difficulty),
                )
            conn.commit()
            print(f"Scheduled {game} puzzle for {date_str}.")
        except Exception as e:
            print("Error:", e)
        finally:
            conn.close()

    def do_calendar(self, arg: str):
        """calendar [month] [year] — e.g. calendar 2 2026"""
        parts = (arg or "").strip().split()
        try:
            month = int(parts[0]) if parts else None
            year = int(parts[1]) if len(parts) > 1 else None
        except ValueError:
            month = year = None
        from datetime import date
        today = date.today()
        month = month or today.month
        year = year or today.year
        if month < 1 or month > 12:
            print("Month must be 1-12")
            return
        try:
            conn = get_conn()
        except SystemExit as e:
            print(e)
            return
        try:
            _, last = monthrange(year, month)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT puzzle_date, game_type
                    FROM daily_puzzles
                    WHERE puzzle_date >= %s::date AND puzzle_date <= %s::date
                    ORDER BY puzzle_date
                    """,
                    (f"{year}-{month:02d}-01", f"{year}-{month:02d}-{last}"),
                )
                rows = cur.fetchall()
            by_date: dict[str, set[str]] = {}
            for (puzzle_date, game_type) in rows:
                d = puzzle_date.isoformat() if hasattr(puzzle_date, "isoformat") else str(puzzle_date)[:10]
                by_date.setdefault(d, set()).add(game_type)
            print(f"\n  {year} — Month {month}   (B=both  G=grid  C=connections  .=empty)\n")
            day = 1
            while day <= last:
                dates_line = "  "
                letters_line = "  "
                for _ in range(7):
                    if day > last:
                        dates_line += "    "
                        letters_line += "    "
                    else:
                        key = f"{year}-{month:02d}-{day:02d}"
                        s = by_date.get(key) or set()
                        dates_line += f" {day:>2} "
                        if "grid" in s and "connections" in s:
                            letters_line += " B  "
                        elif "grid" in s:
                            letters_line += " G  "
                        elif "connections" in s:
                            letters_line += " C  "
                        else:
                            letters_line += " .  "
                        day += 1
                print(dates_line)
                print(letters_line)
                print()
            print()
        except Exception as e:
            print("Error:", e)
        finally:
            conn.close()

    def do_list(self, arg: str):
        """list upcoming — next 14 days and puzzle status."""
        from datetime import date, timedelta
        try:
            conn = get_conn()
        except SystemExit as e:
            print(e)
            return
        start = date.today()
        end = start + timedelta(days=14)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT puzzle_date, game_type
                    FROM daily_puzzles
                    WHERE puzzle_date >= %s AND puzzle_date <= %s
                    ORDER BY puzzle_date, game_type
                    """,
                    (start, end),
                )
                rows = cur.fetchall()
            by_date: dict[str, list[str]] = {}
            for (puzzle_date, game_type) in rows:
                d = puzzle_date.isoformat() if hasattr(puzzle_date, "isoformat") else str(puzzle_date)[:10]
                by_date.setdefault(d, []).append(game_type)
            print("\n  Next 14 days:")
            for i in range(14):
                d = start + timedelta(days=i)
                key = d.isoformat()
                types = by_date.get(key) or []
                g = "G" if "grid" in types else " "
                c = "C" if "connections" in types else " "
                print(f"    {key}  grid:{g}  connections:{c}")
            print()
        except Exception as e:
            print("Error:", e)
        finally:
            conn.close()

    def do_export(self, arg: str):
        """export YYYY-MM-DD — export puzzle(s) for that date to data/scheduled/."""
        date_str = (arg or "").strip()
        if len(date_str) != 10 or date_str[4] != "-" or date_str[7] != "-":
            print("Usage: export YYYY-MM-DD")
            return
        try:
            conn = get_conn()
        except SystemExit as e:
            print(e)
            return
        SCHEDULED_DIR.mkdir(parents=True, exist_ok=True)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT game_type, puzzle_data, difficulty FROM daily_puzzles WHERE puzzle_date = %s::date",
                    (date_str,),
                )
                rows = cur.fetchall()
            out = {"puzzle_date": date_str, "grid": None, "connections": None}
            for (game_type, puzzle_data, difficulty) in rows:
                if game_type == "grid":
                    out["grid"] = {"puzzle_data": puzzle_data, "difficulty": difficulty}
                elif game_type == "connections":
                    out["connections"] = {"puzzle_data": puzzle_data, "difficulty": difficulty}
            path = SCHEDULED_DIR / f"{date_str}.json"
            with open(path, "w", encoding="utf-8") as f:
                json.dump(out, f, indent=2)
            print(f"Exported to {path}")
        except Exception as e:
            print("Error:", e)
        finally:
            conn.close()

    def do_quit(self, arg: str):
        """Exit the CLI."""
        print("Bye.")
        return True

    do_exit = do_quit
    do_q = do_quit


def main():
    load_dotenv(ENV_PATH)
    if not os.getenv("DATABASE_URL"):
        print("DATABASE_URL not set in .env. Exiting.")
        sys.exit(1)
    PuzzleAdminCLI().cmdloop()


if __name__ == "__main__":
    main()
