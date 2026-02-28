"""
Generate grid puzzles by sampling row/column attribute combinations and validating them.
Uses grid_validator for validation and quality scoring.
"""
import random
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from grid_validator import (
    get_index,
    load_attribute_index,
    validate_grid_combination,
    score_puzzle_quality,
)
from attributes import ATTRIBUTES, get_attribute_by_id


class PuzzleGenerationError(Exception):
    """Raised when no valid puzzle could be generated within max_attempts."""
    pass


# Min number of matching fighters per attribute to allow in pool (by difficulty)
MIN_FIGHTERS_BY_DIFFICULTY = {"easy": 15, "normal": 10, "hard": 6}


def _get_attr_count(index: dict, attr_id: str) -> int:
    by_attr = index.get("by_attribute") or {}
    names = by_attr.get(attr_id)
    return len(names) if names is not None else 0


def _filter_attributes(
    index: dict,
    difficulty: str,
    exclude_attribute_ids: set[str] | list[str] | None,
) -> list[dict]:
    """Return list of attribute dicts (id, label, category) that meet min count and are not excluded."""
    min_fighters = MIN_FIGHTERS_BY_DIFFICULTY.get(difficulty, 10)
    exclude = set(exclude_attribute_ids or [])
    out = []
    for a in ATTRIBUTES:
        aid = a.get("id")
        if not aid or aid in exclude:
            continue
        if _get_attr_count(index, aid) < min_fighters:
            continue
        out.append({"id": aid, "label": a.get("label", aid), "category": a.get("category", "")})
    return out


def _triple_spans_at_most_two_categories(triple: list[dict]) -> bool:
    cats = {t.get("category") for t in triple if t.get("category")}
    return len(cats) <= 2


def _rows_and_cols_category_ok(row_triple: list[dict], col_triple: list[dict]) -> bool:
    """No category in both rows and columns, except 'weightclass' may appear once in each."""
    row_cats = {t.get("category") for t in row_triple if t.get("category")}
    col_cats = {t.get("category") for t in col_triple if t.get("category")}
    shared = row_cats & col_cats
    # Only weightclass is allowed to appear in both
    return shared <= {"weightclass"}

DEFAULT_POPULARITY = 0.15


def _enrich_cells_with_popularity(cells: dict, popularity_scores: dict[str, float]) -> tuple[dict, dict[str, float]]:
    """
    Add min_popularity and best_fighter to each cell; return (enriched_cells, popularity_scores_subset).
    best_fighter = valid fighter with highest popularity (most popular correct answer for that cell).
    """
    pop = popularity_scores or {}
    enriched: dict = {}
    all_names: set[str] = set()
    for key, data in cells.items():
        valid = data.get("valid_fighters") or []
        if not valid:
            enriched[key] = {**data, "min_popularity": DEFAULT_POPULARITY, "best_fighter": None}
            continue
        pops = [(name, pop.get(name, DEFAULT_POPULARITY)) for name in valid]
        min_pop = min(p for _, p in pops)
        best_name = max(pops, key=lambda x: x[1])[0]
        all_names.update(valid)
        enriched[key] = {
            **data,
            "min_popularity": min_pop,
            "best_fighter": best_name,
        }
    subset = {name: pop.get(name, DEFAULT_POPULARITY) for name in all_names}
    return enriched, subset


def generate_grid_puzzle(
    difficulty: str = "normal",
    max_attempts: int = 500,
    exclude_attribute_ids: list[str] | set[str] | None = None,
    index: dict | None = None,
) -> dict:
    """
    Generate a single grid puzzle of the given difficulty.
    Returns a puzzle dict: rows, cols (each list of {id, label}), cells, difficulty, quality_score.
    Raises PuzzleGenerationError if no valid puzzle found within max_attempts.
    """
    idx = index or get_index()
    available = _filter_attributes(idx, difficulty, exclude_attribute_ids)
    if len(available) < 6:
        raise PuzzleGenerationError(
            f"Not enough attributes meeting min fighter count for difficulty={difficulty} (have {len(available)}, need 6)"
        )

    for _ in range(max_attempts):
        row_triple = random.sample(available, 3)
        col_triple = random.sample(available, 3)
        if not _triple_spans_at_most_two_categories(row_triple):
            continue
        if not _triple_spans_at_most_two_categories(col_triple):
            continue
        if not _rows_and_cols_category_ok(row_triple, col_triple):
            continue

        row_ids = [t["id"] for t in row_triple]
        col_ids = [t["id"] for t in col_triple]
        result = validate_grid_combination(row_ids, col_ids, idx)
        if not result.get("valid"):
            continue
        if result.get("difficulty_score") != difficulty:
            continue
        quality = score_puzzle_quality(result)
        if quality <= 0.6:
            continue

        raw_cells = result.get("cells", {})
        popularity_scores = idx.get("popularity_scores") or {}
        cells, popularity_scores_subset = _enrich_cells_with_popularity(raw_cells, popularity_scores)

        return {
            "rows": [{"id": t["id"], "label": t["label"]} for t in row_triple],
            "cols": [{"id": t["id"], "label": t["label"]} for t in col_triple],
            "cells": cells,
            "popularity_scores": popularity_scores_subset,
            "difficulty": difficulty,
            "quality_score": quality,
            "min_cell_count": result.get("min_cell_count"),
            "avg_cell_count": result.get("avg_cell_count"),
            "total_unique_fighters": result.get("total_unique_fighters"),
        }

    raise PuzzleGenerationError(
        f"Could not generate a {difficulty} grid puzzle within {max_attempts} attempts."
    )


def generate_grid_puzzle_interactive(
    difficulty: str = "normal",
    num_candidates: int = 5,
    index: dict | None = None,
    silent: bool = False,
) -> list[dict]:
    """
    Generate num_candidates candidate puzzles and optionally print their stats.
    Returns the list of puzzle dicts. Set silent=True to skip printing (e.g. when caller formats output).
    """
    idx = index or get_index()
    available = _filter_attributes(idx, difficulty, None)
    if len(available) < 6:
        print(f"Not enough attributes for {difficulty} (need 6, have {len(available)}).")
        return []

    puzzles: list[dict] = []
    seen: set[tuple[tuple[str, ...], tuple[str, ...]]] = set()
    max_tries = 2000
    tried = 0

    while len(puzzles) < num_candidates and tried < max_tries:
        tried += 1
        row_triple = random.sample(available, 3)
        col_triple = random.sample(available, 3)
        if not _triple_spans_at_most_two_categories(row_triple):
            continue
        if not _triple_spans_at_most_two_categories(col_triple):
            continue
        if not _rows_and_cols_category_ok(row_triple, col_triple):
            continue

        row_ids = tuple(t["id"] for t in row_triple)
        col_ids = tuple(t["id"] for t in col_triple)
        key = (row_ids, col_ids)
        if key in seen:
            continue
        seen.add(key)

        result = validate_grid_combination(list(row_ids), list(col_ids), idx)
        if not result.get("valid") or result.get("difficulty_score") != difficulty:
            continue
        quality = score_puzzle_quality(result)
        if quality <= 0.6:
            continue

        raw_cells = result.get("cells", {})
        popularity_scores = idx.get("popularity_scores") or {}
        cells, popularity_scores_subset = _enrich_cells_with_popularity(raw_cells, popularity_scores)

        puzzle = {
            "rows": [{"id": t["id"], "label": t["label"]} for t in row_triple],
            "cols": [{"id": t["id"], "label": t["label"]} for t in col_triple],
            "cells": cells,
            "popularity_scores": popularity_scores_subset,
            "difficulty": difficulty,
            "quality_score": quality,
            "min_cell_count": result.get("min_cell_count"),
            "avg_cell_count": result.get("avg_cell_count"),
            "total_unique_fighters": result.get("total_unique_fighters"),
        }
        puzzles.append(puzzle)

    # Sort by quality_score descending
    puzzles.sort(key=lambda p: (p.get("quality_score") or 0), reverse=True)

    if not silent:
        print(f"\n--- {len(puzzles)} candidate puzzle(s) for difficulty={difficulty} ---\n")
        for i, p in enumerate(puzzles, 1):
            print(f"  Candidate {i}:")
            print(f"    Rows: {[r['label'] for r in p['rows']]}")
            print(f"    Cols: {[c['label'] for c in p['cols']]}")
            print(f"    quality_score={p.get('quality_score')}, min_cell={p.get('min_cell_count')}, avg_cell={p.get('avg_cell_count')}, unique_fighters={p.get('total_unique_fighters')}")
            print()
    return puzzles


if __name__ == "__main__":
    load_attribute_index()
    difficulty = "normal"
    if len(sys.argv) > 1:
        difficulty = sys.argv[1].lower()
    if difficulty not in MIN_FIGHTERS_BY_DIFFICULTY:
        difficulty = "normal"
    generate_grid_puzzle_interactive(difficulty=difficulty, num_candidates=5)
