"""
Grid puzzle validator: given 3 row and 3 column attribute ids, compute valid fighters
per cell and determine if the combination is usable. Used by puzzle generation.
"""
import json
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
INDEX_PATH = SCRIPT_DIR / "processed" / "attribute_index.json"

# Load once at module level; call load_attribute_index() to refresh
_index: dict | None = None


def load_attribute_index(path: Path | None = None) -> dict:
    """Load attribute index from JSON. Uses cached copy unless path given or cache is None."""
    global _index
    p = path or INDEX_PATH
    with open(p, encoding="utf-8") as f:
        _index = json.load(f)
    return _index


def get_index() -> dict:
    """Return the attribute index, loading from disk if not yet loaded."""
    global _index
    if _index is None:
        load_attribute_index()
    return _index


def _fighter_set(index: dict, attr_id: str) -> set[str]:
    """Return the set of fighter names for an attribute; empty set if attr missing."""
    by_attr = index.get("by_attribute") or {}
    names = by_attr.get(attr_id)
    if names is None:
        return set()
    return set(names) if not isinstance(names, set) else names


def validate_grid_combination(
    row_attr_ids: list[str],
    col_attr_ids: list[str],
    index: dict | None = None,
) -> dict:
    """
    Validate a 3x3 grid defined by 3 row and 3 column attribute ids.
    Returns a result dict with valid, cells, counts, difficulty_score, etc.
    """
    idx = index or get_index()
    if len(row_attr_ids) != 3 or len(col_attr_ids) != 3:
        return {
            "valid": False,
            "cells": {},
            "min_cell_count": 0,
            "avg_cell_count": 0.0,
            "total_unique_fighters": 0,
            "invalid_cells": ["0,0", "0,1", "0,2", "1,0", "1,1", "1,2", "2,0", "2,1", "2,2"],
            "difficulty_score": "invalid",
        }

    cells: dict[str, dict] = {}
    invalid_cells: list[str] = []
    all_fighters: set[str] = set()
    counts: list[int] = []

    for r in range(3):
        row_set = _fighter_set(idx, row_attr_ids[r])
        for c in range(3):
            col_set = _fighter_set(idx, col_attr_ids[c])
            intersection = row_set & col_set
            key = f"{r},{c}"
            count = len(intersection)
            cells[key] = {"valid_fighters": sorted(intersection), "count": count}
            all_fighters |= intersection
            counts.append(count)
            if count == 0:
                invalid_cells.append(key)

    total = sum(counts)
    min_cell_count = min(counts) if counts else 0
    avg_cell_count = total / 9.0 if counts else 0.0

    # difficulty_score
    if min_cell_count >= 5 and avg_cell_count >= 15:
        difficulty_score = "easy"
    elif min_cell_count >= 2 and avg_cell_count >= 8:
        difficulty_score = "normal"
    elif min_cell_count >= 1 and avg_cell_count >= 4:
        difficulty_score = "hard"
    else:
        difficulty_score = "invalid"

    valid = len(invalid_cells) == 0

    return {
        "valid": valid,
        "cells": cells,
        "min_cell_count": min_cell_count,
        "avg_cell_count": round(avg_cell_count, 2),
        "total_unique_fighters": len(all_fighters),
        "invalid_cells": invalid_cells,
        "difficulty_score": difficulty_score,
    }


def score_puzzle_quality(result: dict) -> float:
    """
    Return a float in [0, 1] representing how good a puzzle is.
    Penalizes cells with fewer than 3 valid fighters; rewards diversity
    (not the same small set of fighters appearing in every cell).
    """
    if not result.get("valid"):
        return 0.0

    cells = result.get("cells") or {}
    if len(cells) != 9:
        return 0.0

    score = 1.0

    # Penalize cells with fewer than 3 valid fighters
    for key, data in cells.items():
        count = data.get("count", 0)
        if count == 0:
            score = 0.0
            break
        if count < 3:
            # Linear penalty: 0 -> 0, 1 -> 0.5, 2 -> 0.75
            penalty = (3 - count) * 0.25
            score = min(score, 1.0 - penalty)

    if score <= 0:
        return 0.0

    # Reward diversity: unique fighters across grid vs repeated same fighters everywhere
    total_unique = result.get("total_unique_fighters", 0)
    total_slots = sum(data.get("count", 0) for data in cells.values())
    if total_slots > 0:
        # Diversity ratio: unique / total appearances. Higher = more diverse.
        # Ideal: each cell has different fighters (high unique). Low: same 5 in every cell (low unique).
        diversity_ratio = total_unique / total_slots
        # Cap so 9 cells with 27 total slots and 27 unique -> 1.0; 9 cells with 45 slots and 9 unique -> 0.2
        diversity_bonus = min(1.0, diversity_ratio * 1.5)  # scale so 2/3 ratio -> 1.0
        score = (score + diversity_bonus) / 2.0  # blend base score with diversity

    return round(max(0.0, min(1.0, score)), 4)
