"""
Build reverse index: attribute_id -> [fighter names] and fighter_name -> [attribute ids].
Uses fighters_final.json (fallback: fighters_enriched.json) and fight_history.json.
Saves data/processed/attribute_index.json. Run from project root or from data/.
"""
import json
import sys
from pathlib import Path

# Allow running from project root or from data/
SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR / "processed"
FIGHTERS_FINAL = DATA_DIR / "fighters_final.json"
FIGHTERS_ENRICHED = DATA_DIR / "fighters_enriched.json"
FIGHT_HISTORY_PATH = DATA_DIR / "fight_history.json"
OUTPUT_PATH = DATA_DIR / "attribute_index.json"

# Import attributes (same package as data/)
sys.path.insert(0, str(SCRIPT_DIR))
from attributes import ATTRIBUTES, match_attribute


def load_fighters() -> list[dict]:
    path = FIGHTERS_FINAL if FIGHTERS_FINAL.exists() else FIGHTERS_ENRICHED
    if not path.exists():
        print(f"Missing fighters file: {path}", file=sys.stderr)
        sys.exit(1)
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else [data]


def load_fight_history() -> list[dict]:
    if not FIGHT_HISTORY_PATH.exists():
        return []
    with open(FIGHT_HISTORY_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else [data]


def build_fights_by_fighter(history: list[dict]) -> dict[str, list[dict]]:
    """Group fight records by fighter name (fighter_name or fighter key)."""
    by_name: dict[str, list[dict]] = {}
    for rec in history:
        name = (rec.get("fighter_name") or rec.get("fighter") or "").strip()
        if not name:
            continue
        if name not in by_name:
            by_name[name] = []
        by_name[name].append(rec)
    return by_name


def main() -> None:
    fighters = load_fighters()
    history = load_fight_history()
    fights_by_fighter = build_fights_by_fighter(history)

    name_to_fighter = {f.get("name"): f for f in fighters if f.get("name")}
    by_attribute: dict[str, list[str]] = {a["id"]: [] for a in ATTRIBUTES}
    by_fighter: dict[str, list[str]] = {}

    for attr in ATTRIBUTES:
        attr_id = attr["id"]
        needs_history = attr.get("requires_fight_history", False)
        for name, fighter in name_to_fighter.items():
            if not fighter:
                continue
            hist = fights_by_fighter.get(name) if needs_history else None
            try:
                if match_attribute(fighter, attr, hist):
                    by_attribute[attr_id].append(name)
                    by_fighter.setdefault(name, []).append(attr_id)
            except Exception as e:
                print(f"  Warning: {attr.get('label', attr_id)} for {name}: {e}", file=sys.stderr)

    # Summary
    min_safe = 8
    target_min = 15
    print("Attribute index summary\n" + "-" * 60)
    for attr in ATTRIBUTES:
        aid = attr["id"]
        label = attr.get("label", aid)
        count = len(by_attribute[aid])
        status = ""
        if count < min_safe:
            status = " WARNING: too few fighters"
        elif count < target_min:
            status = " (below 15)"
        print(f"  {label}: {count}{status}")
    print("-" * 60)
    print(f"Total fighters: {len(name_to_fighter)}")
    print(f"Total attributes: {len(ATTRIBUTES)}")
    print(f"Output: {OUTPUT_PATH}")

    payload = {"by_attribute": by_attribute, "by_fighter": by_fighter}
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    low = [a for a in ATTRIBUTES if len(by_attribute[a["id"]]) < min_safe]
    if low:
        print(f"\n{len(low)} attribute(s) have fewer than {min_safe} fighters. Fix or remove in attributes.py, then re-run.")


if __name__ == "__main__":
    main()
