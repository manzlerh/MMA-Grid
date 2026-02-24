"""
Generate a composite fighter popularity score from weighted signals and write
processed/fighter_popularity.json for use in puzzle generation.

Weight order (highest to lowest):
1. Most-followed list (The Scrap) — highest; those fighters get a large boost.
2. Tapology fan-voted favorite ranking — full list, position-based decay.
3. Wikipedia pageviews (optional file wikipedia_pageviews.json) — if present.
4. UFC ranking + champion/former champion status.
5. Other (total_fights, performance_bonuses) — relatively low.

Run from project root. Requires DATABASE_URL for rankings. For best results, run
scrape_most_followed_fighters.py and scrape_tapology_fan_favorites.py first.
"""
import json
import math
import os
import re
import sys
import unicodedata
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = SCRIPT_DIR / "processed"
ENV_PATH = PROJECT_ROOT / ".env"
FIGHTERS_FINAL = DATA_DIR / "fighters_final.json"
FIGHTERS_ENRICHED = DATA_DIR / "fighters_enriched.json"
OUTPUT_PATH = DATA_DIR / "fighter_popularity.json"
MOST_FOLLOWED_PATH = DATA_DIR / "most_followed_fighters.json"
TAPOLOGY_FAVORITES_PATH = DATA_DIR / "tapology_fan_favorites.json"
WIKIPEDIA_PAGEVIEWS_PATH = DATA_DIR / "wikipedia_pageviews.json"

sys.path.insert(0, str(SCRIPT_DIR))

# ---- Weights (tunable). Order: most_followed > tapology > wikipedia > ranking/champion > other ----
WEIGHT_MOST_FOLLOWED = 35.0       # If on The Scrap most-followed list
WEIGHT_TAPOLOGY_MAX = 30.0        # Rank 1 ≈ 30, decay by position
WEIGHT_WIKIPEDIA_MAX = 20.0       # Log-scale pageviews, cap this
WEIGHT_RANKING_CAP = 12.0         # Best UFC rank across divisions (reduced)
WEIGHT_CHAMPION = 10.0
WEIGHT_FORMER_CHAMPION = 5.0
WEIGHT_TOTAL_FIGHTS_CAP = 5.0
WEIGHT_TOTAL_FIGHTS_SCALE = 1.2
WEIGHT_BONUS_PER = 0.5
WEIGHT_BONUS_CAP = 3.0

RANK_POINTS = {"C": 12, "IC": 10}
for i in range(1, 16):
    RANK_POINTS[str(i)] = max(0.5, 10 - 0.6 * i)
P4P_DIVISIONS = frozenset(("Men's pound-for-pound", "Women's pound-for-pound"))


def _normalize_name(name: str) -> str:
    """Lowercase, collapse spaces, ASCII-fold accents for matching across sources."""
    if not name:
        return ""
    n = unicodedata.normalize("NFKD", name)
    n = "".join(c for c in n if not unicodedata.combining(c))
    n = n.encode("ascii", "ignore").decode("ascii").lower()
    return " ".join(re.sub(r"[^a-z0-9\s]", "", n).split())


def _load_fighters() -> list[dict]:
    path = FIGHTERS_FINAL if FIGHTERS_FINAL.exists() else FIGHTERS_ENRICHED
    if not path.exists():
        print(f"Missing fighters file: {path}", file=sys.stderr)
        sys.exit(1)
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else [data]


def _load_most_followed() -> set[str]:
    """Set of normalized names from most_followed_fighters.json."""
    if not MOST_FOLLOWED_PATH.exists():
        return set()
    try:
        with open(MOST_FOLLOWED_PATH, encoding="utf-8") as f:
            data = json.load(f)
        names = data.get("names") or [e.get("name") for e in data.get("entries") or []]
        return {_normalize_name(n) for n in names if n}
    except Exception as e:
        print(f"Could not load most_followed: {e}", file=sys.stderr)
        return set()


def _load_tapology_name_to_rank() -> dict[str, int]:
    """Normalized name -> best rank (1 = first). From tapology_fan_favorites.json."""
    if not TAPOLOGY_FAVORITES_PATH.exists():
        return {}
    try:
        with open(TAPOLOGY_FAVORITES_PATH, encoding="utf-8") as f:
            data = json.load(f)
        name_to_rank = data.get("name_to_rank") or {}
        return {_normalize_name(k): v for k, v in name_to_rank.items() if k}
    except Exception as e:
        print(f"Could not load Tapology favorites: {e}", file=sys.stderr)
        return {}


def _load_wikipedia_pageviews() -> dict[str, float]:
    """Fighter name (any case) -> pageview count. Optional file."""
    if not WIKIPEDIA_PAGEVIEWS_PATH.exists():
        return {}
    try:
        with open(WIKIPEDIA_PAGEVIEWS_PATH, encoding="utf-8") as f:
            data = json.load(f)
        return {k: float(v) for k, v in (data if isinstance(data, dict) else {}).items()}
    except Exception as e:
        print(f"Could not load Wikipedia pageviews: {e}", file=sys.stderr)
        return {}


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
    """Best rank across divisions; P4P gets 1.2x. Capped at WEIGHT_RANKING_CAP."""
    if not rankings:
        return 0.0
    best = 0.0
    for division, pos in rankings:
        pos = (pos or "").strip().upper()
        if not pos:
            continue
        points = RANK_POINTS.get(pos, 0)
        if division in P4P_DIVISIONS:
            points *= 1.2
        best = max(best, min(WEIGHT_RANKING_CAP, points))
    return best


def _tapology_score(rank: int) -> float:
    """Score from Tapology fan rank: 1 => max, decay by position."""
    if rank < 1:
        return 0.0
    return WEIGHT_TAPOLOGY_MAX / (1.0 + math.log2(max(1, rank)))


def _wikipedia_score(views: float, max_views: float) -> float:
    """Log-scale pageviews, normalized to WEIGHT_WIKIPEDIA_MAX."""
    if max_views <= 0 or views <= 0:
        return 0.0
    log_val = math.log1p(views)
    log_max = math.log1p(max_views)
    if log_max <= 0:
        return 0.0
    return WEIGHT_WIKIPEDIA_MAX * (log_val / log_max)


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
    most_followed_norm: set[str],
    tapology_norm_to_rank: dict[str, int],
    wikipedia_views: dict[str, float],
) -> dict[str, float]:
    """Return fighter name -> raw score (0–100)."""
    max_wiki = max(wikipedia_views.values()) if wikipedia_views else 0.0
    scores: dict[str, float] = {}
    for f in fighters:
        name = (f.get("name") or "").strip()
        if not name:
            continue
        norm = _normalize_name(name)
        total = 0.0
        if norm in most_followed_norm:
            total += WEIGHT_MOST_FOLLOWED
        tap_rank = tapology_norm_to_rank.get(norm)
        if tap_rank is not None:
            total += _tapology_score(tap_rank)
        if name in wikipedia_views:
            total += _wikipedia_score(wikipedia_views[name], max_wiki)
        total += _ranking_score(name_to_rankings.get(name, []))
        total += WEIGHT_CHAMPION if f.get("is_champion") else 0
        total += WEIGHT_FORMER_CHAMPION if f.get("is_former_champion") else 0
        total += _total_fights_component(f.get("total_fights"))
        total += _bonus_component(f.get("performance_bonuses"))
        scores[name] = min(100.0, total)
    return scores


def main() -> None:
    fighters = _load_fighters()
    most_followed_norm = _load_most_followed()
    tapology_norm_to_rank = _load_tapology_name_to_rank()
    wikipedia_views = _load_wikipedia_pageviews()
    name_to_rankings = _load_rankings_from_db()

    raw_scores = compute_scores(
        fighters,
        name_to_rankings,
        most_followed_norm,
        tapology_norm_to_rank,
        wikipedia_views,
    )
    scores = {name: round(score / 100.0, 4) for name, score in raw_scores.items()}
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "scores": scores,
        "meta": {
            "version": 2,
            "sources": {
                "most_followed": len(most_followed_norm),
                "tapology_favorites": len(tapology_norm_to_rank),
                "wikipedia_pageviews": len(wikipedia_views),
                "rankings_from_db": len(name_to_rankings),
            },
            "weights": {
                "most_followed": WEIGHT_MOST_FOLLOWED,
                "tapology_max": WEIGHT_TAPOLOGY_MAX,
                "wikipedia_max": WEIGHT_WIKIPEDIA_MAX,
                "ranking_cap": WEIGHT_RANKING_CAP,
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
    if most_followed_norm:
        print(f"  Most-followed list: {len(most_followed_norm)} names.")
    if tapology_norm_to_rank:
        print(f"  Tapology fan favorites: {len(tapology_norm_to_rank)} names.")
    if wikipedia_views:
        print(f"  Wikipedia pageviews: {len(wikipedia_views)} names.")
    if name_to_rankings:
        print(f"  UFC rankings (DB): {len(name_to_rankings)} fighters.")


if __name__ == "__main__":
    main()
