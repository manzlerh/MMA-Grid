"""
Generate a composite fighter popularity score from weighted signals (option 1: single score)
and write processed/fighter_popularity.json for use in puzzle generation (option 2: weighted selection).

Signals and weights:
- UFC rankings (fighter_rankings): C=40, IC=35, 1=30 down to 15=2; P4P division gets 1.2x. Best rank across divisions.
- is_champion: +25
- is_former_champion: +12
- total_fights: log(1 + n) * scale, cap 20 (more UFC fights = more exposure)
- performance_bonuses: min(10, count * 2)

Total is capped at 100; stored as 0.0–1.0 in JSON. Run from project root. Requires DATABASE_URL for rankings.
"""
import json
import math
import os
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = SCRIPT_DIR / "processed"
ENV_PATH = PROJECT_ROOT / ".env"
FIGHTERS_FINAL = DATA_DIR / "fighters_final.json"
FIGHTERS_ENRICHED = DATA_DIR / "fighters_enriched.json"
OUTPUT_PATH = DATA_DIR / "fighter_popularity.json"

sys.path.insert(0, str(SCRIPT_DIR))


# Weights (tunable)
WEIGHT_CHAMPION = 25
WEIGHT_FORMER_CHAMPION = 12
WEIGHT_TOTAL_FIGHTS_CAP = 20
WEIGHT_TOTAL_FIGHTS_SCALE = 4.0  # log(1+x)*scale, cap WEIGHT_TOTAL_FIGHTS_CAP
WEIGHT_BONUS_PER = 2
WEIGHT_BONUS_CAP = 10
# Ranking: best rank across divisions. P4P gets 1.2x multiplier.
RANK_POINTS = {"C": 40, "IC": 35}
for i in range(1, 16):
    RANK_POINTS[str(i)] = max(2, 32 - 2 * i)
P4P_DIVISIONS = frozenset(("Men's pound-for-pound", "Women's pound-for-pound"))
RANK_CAP = 45  # after P4P multiplier


def _load_fighters() -> list[dict]:
    path = FIGHTERS_FINAL if FIGHTERS_FINAL.exists() else FIGHTERS_ENRICHED
    if not path.exists():
        print(f"Missing fighters file: {path}", file=sys.stderr)
        sys.exit(1)
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else [data]


def _load_rankings_from_db() -> dict[str, list[tuple[str, str]]]:
    """Return name -> [(division, rank_position), ...]. Empty dict if DB unavailable."""
    try:
        from dotenv import load_dotenv
        import psycopg2
        load_dotenv(ENV_PATH)
        url = os.getenv("DATABASE_URL")
        if not url:
            return {}
        conn = psycopg2.connect(url)
    except Exception as e:
        print(f"DB not available for rankings: {e}", file=sys.stderr)
        return {}
    out: dict[str, list[tuple[str, str]]] = {}
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT f.name, fr.division, fr.rank_position
                FROM fighters f
                JOIN fighter_rankings fr ON fr.fighter_id = f.id
                ORDER BY f.name, fr.division
            """)
            for name, division, rank_position in cur.fetchall():
                name = (name or "").strip()
                if not name:
                    continue
                out.setdefault(name, []).append((division or "", rank_position or ""))
    finally:
        conn.close()
    return out


def _ranking_score(rankings: list[tuple[str, str]]) -> float:
    """Best rank across divisions; P4P ranks get 1.5x. Capped at RANK_CAP."""
    if not rankings:
        return 0.0
    best = 0.0
    for division, pos in rankings:
        pos = (pos or "").strip().upper()
        if not pos:
            continue
        points = RANK_POINTS.get(pos, 0)
        if division in P4P_DIVISIONS:
            points *= 1.5
        best = max(best, min(RANK_CAP, points))
    return best


def _total_fights_component(total_fights: int | None) -> float:
    try:
        n = int(total_fights) if total_fights is not None else 0
    except (TypeError, ValueError):
        n = 0
    if n <= 0:
        return 0.0
    raw = math.log(1 + n) * WEIGHT_TOTAL_FIGHTS_SCALE
    return min(WEIGHT_TOTAL_FIGHTS_CAP, raw)


def _bonus_component(performance_bonuses: int | None) -> float:
    try:
        n = int(performance_bonuses) if performance_bonuses is not None else 0
    except (TypeError, ValueError):
        n = 0
    return min(WEIGHT_BONUS_CAP, max(0, n) * WEIGHT_BONUS_PER)


def compute_scores(
    fighters: list[dict],
    name_to_rankings: dict[str, list[tuple[str, str]]],
) -> dict[str, float]:
    """Return fighter name -> raw score (0–100)."""
    scores: dict[str, float] = {}
    for f in fighters:
        name = (f.get("name") or "").strip()
        if not name:
            continue
        total = 0.0
        total += _ranking_score(name_to_rankings.get(name, []))
        total += WEIGHT_CHAMPION if f.get("is_champion") else 0
        total += WEIGHT_FORMER_CHAMPION if f.get("is_former_champion") else 0
        total += _total_fights_component(f.get("total_fights"))
        total += _bonus_component(f.get("performance_bonuses"))
        scores[name] = min(100.0, total)
    return scores


def main() -> None:
    fighters = _load_fighters()
    name_to_rankings = _load_rankings_from_db()
    raw_scores = compute_scores(fighters, name_to_rankings)
    # Normalize to 0.0–1.0 for storage
    scores = {name: round(score / 100.0, 4) for name, score in raw_scores.items()}
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "scores": scores,
        "meta": {
            "version": 1,
            "weights": {
                "ranking_cap": RANK_CAP,
                "champion": WEIGHT_CHAMPION,
                "former_champion": WEIGHT_FORMER_CHAMPION,
                "total_fights_cap": WEIGHT_TOTAL_FIGHTS_CAP,
                "bonus_cap": WEIGHT_BONUS_CAP,
            },
        },
    }
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    print(f"Wrote {OUTPUT_PATH}: {len(scores)} fighter popularity scores (0–1).")
    if name_to_rankings:
        print(f"  Rankings loaded for {len(name_to_rankings)} fighters from DB.")
    else:
        print("  Rankings skipped (DB unavailable).")


if __name__ == "__main__":
    main()
