"""
Clean UFC fighter and fight data into a single fighters.json.

Reads:
  - data/raw/ufc_fighter_details.csv (FIRST, LAST, NICKNAME)
  - data/raw/ufc_fight_results.csv (BOUT, OUTCOME, WEIGHTCLASS, METHOD)
  - data/raw/ufc_fighter_tott.csv (optional: FIGHTER, HEIGHT, WEIGHT, REACH, STANCE)

Writes:
  - data/processed/fighters.json
"""

import json
import math
import os
import re
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
RAW_DIR = BASE_DIR / "raw"
PROCESSED_DIR = BASE_DIR / "processed"

FIGHTER_DETAILS_CSV = RAW_DIR / "ufc_fighter_details.csv"
FIGHT_RESULTS_CSV = RAW_DIR / "ufc_fight_results.csv"
FIGHTER_TOTT_CSV = RAW_DIR / "ufc_fighter_tott.csv"  # optional
OUTPUT_JSON = PROCESSED_DIR / "fighters.json"

# BOUT format in ufc_fight_results: "Fighter A vs. Fighter B"
BOUT_SEP = " vs. "


def _to_int(value: Any) -> Optional[int]:
    """Convert common numeric string formats to int, returning None on failure."""
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    if isinstance(value, int):
        return value
    s = str(value).strip()
    if not s or s in ("--", ""):
        return None
    m = re.search(r"-?\d+", s)
    if not m:
        return None
    try:
        return int(m.group(0))
    except ValueError:
        return None


def height_to_inches(height_str: Any) -> Optional[int]:
    """
    Convert height in formats like "5'11\"", "5' 11\"", "5'11" to inches.
    Returns None if parsing fails.
    """
    if height_str is None or (isinstance(height_str, float) and math.isnan(height_str)):
        return None
    s = str(height_str).strip()
    if not s or s == "--":
        return None
    m = re.match(r"^\s*(\d+)\s*'\s*(\d+)?", s)
    if not m:
        return None
    feet = int(m.group(1))
    inches = int(m.group(2)) if m.group(2) else 0
    return feet * 12 + inches


def normalize_weight_class(raw: str) -> str:
    """e.g. 'Bantamweight Bout' -> 'Bantamweight', 'UFC Featherweight Title Bout' -> 'Featherweight'."""
    s = str(raw).strip()
    if not s:
        return ""
    # Remove common suffixes
    for suffix in ("Bout", "UFC ", " Title Bout", " Title"):
        if s.endswith(suffix):
            s = s[: -len(suffix)].strip()
        if s.startswith("UFC "):
            s = s[4:].strip()
    return s.strip() or str(raw).strip()


def classify_method(method: str) -> str:
    """Return 'ko', 'sub', or 'dec' for win method."""
    m = str(method).strip().upper()
    if not m:
        return "dec"
    if "KO" in m or "TKO" in m:
        return "ko"
    if "SUB" in m:
        return "sub"
    if "DRAW" in m or "NO CONTEST" in m or "NC" in m:
        return "draw"
    return "dec"


def load_csv(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    return df


def build_nickname_map(details_df: pd.DataFrame) -> Dict[str, str]:
    """Map full name (first + ' ' + last) -> nickname from ufc_fighter_details."""
    nick_map: Dict[str, str] = {}
    first_col = "first"
    last_col = "last"
    nick_col = "nickname"
    if first_col not in details_df.columns or last_col not in details_df.columns:
        return nick_map
    for _, row in details_df.iterrows():
        first = str(row.get(first_col, "")).strip()
        last = str(row.get(last_col, "")).strip()
        name = f"{first} {last}".strip()
        if not name:
            continue
        nick = row.get(nick_col)
        if pd.isna(nick) or nick is None:
            nick_val = ""
        else:
            nick_val = str(nick).strip()
        nick_map[name] = nick_val
    return nick_map


def load_tott_physical(tott_path: Path) -> Dict[str, Dict[str, Any]]:
    """If ufc_fighter_tott.csv exists, return map: fighter_name -> {height_inches, weight_lbs, reach_inches, stance}."""
    if not tott_path.exists():
        return {}
    df = load_csv(tott_path)
    col_fighter = "fighter"
    if col_fighter not in df.columns:
        return {}
    physical: Dict[str, Dict[str, Any]] = {}
    for _, row in df.iterrows():
        name = str(row.get(col_fighter, "")).strip()
        if not name:
            continue
        physical[name] = {
            "height_inches": height_to_inches(row.get("height")),
            "weight_lbs": _to_int(row.get("weight")),
            "reach_inches": _to_int(row.get("reach")),
            "stance": _str_or_empty(row.get("stance")),
        }
    return physical


def _str_or_empty(val: Any) -> str:
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return ""
    s = str(val).strip()
    return s if s != "--" else ""


def aggregate_fight_stats(fights_df: pd.DataFrame) -> Dict[str, Dict[str, Any]]:
    """
    Build per-fighter stats from ufc_fight_results (BOUT, OUTCOME, WEIGHTCLASS, METHOD).
    """
    stats: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {
            "total_fights": 0,
            "wins": 0,
            "losses": 0,
            "draws": 0,
            "win_by_ko": 0,
            "win_by_sub": 0,
            "win_by_dec": 0,
            "weight_classes": set(),
            "opponents": set(),
        }
    )

    bout_col = "bout"
    outcome_col = "outcome"
    weight_col = "weightclass"
    method_col = "method"

    for col in (bout_col, outcome_col, weight_col, method_col):
        if col not in fights_df.columns:
            raise ValueError(f"Missing column '{col}' in fight results CSV. Columns: {list(fights_df.columns)}")

    for _, row in fights_df.iterrows():
        bout = str(row.get(bout_col, "")).strip()
        if not bout or BOUT_SEP not in bout:
            continue
        parts = bout.split(BOUT_SEP, 1)
        if len(parts) != 2:
            continue
        f1, f2 = parts[0].strip(), parts[1].strip()
        if not f1 or not f2:
            continue

        outcome = str(row.get(outcome_col, "")).strip().upper()
        method = classify_method(row.get(method_col, ""))
        wc = normalize_weight_class(row.get(weight_col, ""))

        for name in (f1, f2):
            s = stats[name]
            s["total_fights"] += 1
            if wc:
                s["weight_classes"].add(wc)
            s["opponents"].add(f2 if name == f1 else f1)

        if method == "draw":
            stats[f1]["draws"] += 1
            stats[f2]["draws"] += 1
            continue

        # W/L = first fighter won, L/W = second fighter won
        if outcome == "W/L":
            winner, loser = f1, f2
        elif outcome == "L/W":
            winner, loser = f2, f1
        else:
            continue

        stats[winner]["wins"] += 1
        stats[loser]["losses"] += 1
        if method == "ko":
            stats[winner]["win_by_ko"] += 1
        elif method == "sub":
            stats[winner]["win_by_sub"] += 1
        else:
            stats[winner]["win_by_dec"] += 1

    return stats


def build_clean_fighters(
    fight_stats: Dict[str, Dict[str, Any]],
    nickname_map: Dict[str, str],
    physical_map: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Produce list of fighter objects for JSON, only including fighters with >= 3 UFC fights."""
    output: List[Dict[str, Any]] = []
    for name, s in fight_stats.items():
        if s["total_fights"] < 3:
            continue
        nick = nickname_map.get(name, "")
        phys = physical_map.get(name, {})
        weight_classes = sorted(w for w in s["weight_classes"] if w)
        opponents = sorted(o for o in s["opponents"] if o and o != name)
        obj = {
            "name": name,
            "nickname": nick if isinstance(nick, str) else "",
            "height_inches": phys.get("height_inches"),
            "weight_lbs": phys.get("weight_lbs"),
            "reach_inches": phys.get("reach_inches"),
            "stance": phys.get("stance", ""),
            "wins": int(s["wins"]),
            "losses": int(s["losses"]),
            "draws": int(s["draws"]),
            "win_by_ko": int(s["win_by_ko"]),
            "win_by_sub": int(s["win_by_sub"]),
            "win_by_dec": int(s["win_by_dec"]),
            "weight_classes": weight_classes,
            "total_fights": int(s["total_fights"]),
            "opponents": opponents,
        }
        output.append(obj)
    return output


def main() -> None:
    os.makedirs(PROCESSED_DIR, exist_ok=True)

    details_df = load_csv(FIGHTER_DETAILS_CSV)
    fights_df = load_csv(FIGHT_RESULTS_CSV)

    nickname_map = build_nickname_map(details_df)
    fight_stats = aggregate_fight_stats(fights_df)
    physical_map = load_tott_physical(FIGHTER_TOTT_CSV)

    fighters = build_clean_fighters(fight_stats, nickname_map, physical_map)

    with OUTPUT_JSON.open("w", encoding="utf-8") as f:
        json.dump(fighters, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(fighters)} fighters to {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
