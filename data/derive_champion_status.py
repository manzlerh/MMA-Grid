"""
Derive champion status from ufc_fight_results.csv and merge into fighters JSON.

Title bout info is in WEIGHTCLASS (e.g. 'UFC Featherweight Title Bout').
Winners are determined from BOUT + OUTCOME (W/L = first fighter won, L/W = second).
is_champion (current) is left False for all — requires manual verification.
"""
import json
from pathlib import Path

import pandas as pd

SCRIPT_DIR = Path(__file__).resolve().parent
RAW_DIR = SCRIPT_DIR / "raw"
PROCESSED_DIR = SCRIPT_DIR / "processed"
FIGHT_RESULTS_CSV = RAW_DIR / "ufc_fight_results.csv"
FIGHTERS_FINAL = PROCESSED_DIR / "fighters_final.json"
FIGHTERS_ENRICHED = PROCESSED_DIR / "fighters_enriched.json"

BOUT_SEP = " vs. "


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Lowercase column names and replace spaces with underscores."""
    df = df.copy()
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    return df


def extract_title_weight_class(weightclass_raw: str) -> tuple[str | None, bool]:
    """
    Extract clean weight class and interim flag from WEIGHTCLASS string.
    E.g. 'UFC Featherweight Title Bout' -> ('Featherweight', False)
         'UFC Interim Lightweight Title Bout' -> ('Lightweight', True)
         "UFC Women's Strawweight Title Bout" -> ('Strawweight', False)
    """
    s = (weightclass_raw or "").strip()
    if not s or "title" not in s.lower():
        return None, False
    is_interim = "interim" in s.lower()
    # Remove suffixes and prefixes
    for suffix in (" title bout", " title", " bout"):
        if s.lower().endswith(suffix):
            s = s[: -len(suffix)].strip()
    for prefix in ("ufc ", "interim "):
        while s.lower().startswith(prefix):
            s = s[len(prefix) :].strip()
    if s.lower().startswith("women's "):
        s = s[8:].strip()  # "Women's " -> drop for unified name
    # Strip any trailing junk (e.g. "Tournament")
    s = s.strip()
    if not s:
        return None, is_interim
    # Known UFC weight classes for consistency (match longest first)
    known = [
        "Light Heavyweight",
        "Heavyweight",
        "Middleweight",
        "Welterweight",
        "Lightweight",
        "Featherweight",
        "Bantamweight",
        "Flyweight",
        "Strawweight",
    ]
    for wc in known:
        if wc.lower() in s.lower():
            return wc, is_interim
    return s, is_interim


def derive_champion_data() -> dict[str, dict]:
    """
    Load ufc_fight_results.csv, filter to title bouts, assign title wins to winners.
    Returns dict keyed by fighter name: {
        'title_weight_classes': [...],
        'is_former_champion': True,
        'title_wins': int,
        'interim_title_wins': int,
    }
    """
    if not FIGHT_RESULTS_CSV.exists():
        raise FileNotFoundError(f"Missing {FIGHT_RESULTS_CSV}")

    df = pd.read_csv(FIGHT_RESULTS_CSV)
    df = _normalize_columns(df)

    bout_col = "bout"
    outcome_col = "outcome"
    weight_col = "weightclass"
    for col in (bout_col, outcome_col, weight_col):
        if col not in df.columns:
            raise ValueError(f"CSV missing column {col}. Columns: {list(df.columns)}")

    # Filter to UFC title bouts (exclude e.g. TUF tournament "title" bouts)
    df["weightclass_str"] = df[weight_col].fillna("").astype(str)
    title_mask = (
        df["weightclass_str"].str.contains("title", case=False, na=False)
        & df["weightclass_str"].str.contains("ufc", case=False, na=False)
    )
    title_df = df[title_mask].copy()

    # Per-fighter: set of weight classes won, title_wins count, interim_title_wins count
    by_fighter: dict[str, dict] = {}

    for _, row in title_df.iterrows():
        bout = str(row.get(bout_col, "")).strip()
        outcome = str(row.get(outcome_col, "")).strip().upper()
        if not bout or BOUT_SEP not in bout:
            continue
        # Only assign winner for clear W/L or L/W (not Draw, NC/NC, etc.)
        if outcome == "W/L":
            winner = bout.split(BOUT_SEP, 1)[0].strip()
        elif outcome == "L/W":
            winner = bout.split(BOUT_SEP, 1)[1].strip()
        else:
            continue
        if not winner:
            continue

        wc_raw = row.get(weight_col, "")
        wc_clean, is_interim = extract_title_weight_class(str(wc_raw))
        if wc_clean is None:
            continue
        # Exclude old UFC tournament "titles" (e.g. "5 Tournament", "10 Tournament") — not division titles
        if "tournament" in (wc_clean or "").lower():
            continue

        if winner not in by_fighter:
            by_fighter[winner] = {
                "title_weight_classes": [],
                "is_former_champion": False,
                "title_wins": 0,
                "interim_title_wins": 0,
            }
        rec = by_fighter[winner]
        # Deduplicate weight classes (use list, add if not present)
        if wc_clean not in rec["title_weight_classes"]:
            rec["title_weight_classes"].append(wc_clean)
        rec["title_wins"] += 1
        if is_interim:
            rec["interim_title_wins"] += 1

    # Set is_former_champion for anyone with at least one title win
    for rec in by_fighter.values():
        rec["is_former_champion"] = rec["title_wins"] >= 1
        rec["title_weight_classes"] = sorted(rec["title_weight_classes"])

    return by_fighter


def load_fighters_json() -> tuple[list[dict], Path]:
    """Load fighters from fighters_final.json or fighters_enriched.json. Returns (list, path_loaded_from)."""
    if FIGHTERS_FINAL.exists():
        path = FIGHTERS_FINAL
    else:
        path = FIGHTERS_ENRICHED
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    fighters = data if isinstance(data, list) else [data]
    return fighters, path


def main() -> None:
    champion_data = derive_champion_data()

    fighters, load_path = load_fighters_json()
    print(f"Loaded {len(fighters)} fighters from {load_path.name}")

    # Merge champion data into fighters (match on name)
    for f in fighters:
        name = (f.get("name") or "").strip()
        if not name:
            continue
        if name in champion_data:
            rec = champion_data[name]
            f["is_former_champion"] = rec["is_former_champion"]
            f["title_weight_classes"] = rec["title_weight_classes"]
            f["title_wins"] = rec["title_wins"]
            f["interim_title_wins"] = rec["interim_title_wins"]
        else:
            f["is_former_champion"] = False
            f["title_weight_classes"] = []
            if "title_wins" in f:
                del f["title_wins"]
            if "interim_title_wins" in f:
                del f["interim_title_wins"]
        # Leave is_champion as False for all — manual verification required
        f["is_champion"] = False

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    with open(FIGHTERS_FINAL, "w", encoding="utf-8") as f:
        json.dump(fighters, f, ensure_ascii=False, indent=2)
    print(f"Saved {FIGHTERS_FINAL}")

    print("\nNote: is_champion (current champion) is set to False for all fighters.")
    print("      Mark current champions manually or via a separate data source.\n")

    former = [name for name, rec in champion_data.items() if rec["is_former_champion"]]
    former.sort()
    print(f"Summary: {len(former)} fighter(s) marked as former champion (won at least one title fight).")
    print("\nFormer champions (spot-check for false positives):")
    print("-" * 60)
    for name in former:
        rec = champion_data[name]
        wcs = ", ".join(rec["title_weight_classes"])
        print(f"  {name}: {rec['title_wins']} title win(s) — {wcs}")


if __name__ == "__main__":
    main()
