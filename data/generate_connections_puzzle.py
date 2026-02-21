"""
Generate Connections puzzles: 4 groups of 4 fighters each, with overlap prevention and decoy checks.
"""
import json
import random
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR / "processed"
INDEX_PATH = DATA_DIR / "attribute_index.json"
FIGHTERS_FINAL = DATA_DIR / "fighters_final.json"
FIGHTERS_ENRICHED = DATA_DIR / "fighters_enriched.json"

sys.path.insert(0, str(SCRIPT_DIR))
from attributes import ATTRIBUTES, get_attribute_by_id

# Min fighters per attribute to use (by difficulty)
MIN_FIGHTERS_BY_DIFFICULTY = {"easy": 20, "normal": 12, "hard": 8}
CONNECTIONS_COLORS = ["yellow", "green", "blue", "purple"]


def _load_index(path: Path | None = None) -> dict:
    p = path or INDEX_PATH
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def _load_fighters() -> list[dict]:
    path = FIGHTERS_FINAL if FIGHTERS_FINAL.exists() else FIGHTERS_ENRICHED
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else [data]


def _obscure_by_name(fighters: list[dict]) -> dict[str, bool]:
    """Build name -> is_obscure (under 10 UFC fights)."""
    out = {}
    for f in fighters:
        name = f.get("name")
        if not name:
            continue
        total = f.get("total_fights")
        try:
            n = int(total) if total is not None else 0
        except (TypeError, ValueError):
            n = 0
        out[name] = n < 10
    return out


def _filter_attributes(
    index: dict,
    difficulty: str,
    exclude_attribute_ids: set[str] | list[str] | None,
) -> list[dict]:
    """Return attributes with enough fighters and not excluded."""
    min_fighters = MIN_FIGHTERS_BY_DIFFICULTY.get(difficulty, 12)
    exclude = set(exclude_attribute_ids or [])
    by_attr = index.get("by_attribute") or {}
    out = []
    for a in ATTRIBUTES:
        aid = a.get("id")
        if not aid or aid in exclude:
            continue
        names = by_attr.get(aid)
        count = len(names) if names else 0
        if count < min_fighters:
            continue
        out.append({
            "id": aid,
            "label": a.get("label", aid),
            "category": a.get("category", ""),
            "fighters": list(names) if names else [],
            "count": count,
        })
    return out


def _sample_four(
    fighter_list: list[str],
    already_used: set[str],
    obscure_only: bool,
    obscure_set: dict[str, bool],
) -> list[str] | None:
    """Sample 4 fighters from fighter_list, not in already_used. If obscure_only, restrict to obscure."""
    pool = [f for f in fighter_list if f not in already_used]
    if obscure_only:
        pool = [f for f in pool if obscure_set.get(f, False)]
    if len(pool) < 4:
        return None
    return random.sample(pool, 4)


def _resolve_overlaps(
    groups: list[dict],
    index: dict,
) -> list[dict] | None:
    """
    Ensure no fighter appears in more than one group. If overlap, remove from group where
    attribute has fewer total fighters (less central) and replace with another from that attribute.
    Returns updated groups or None if cannot resolve.
    """
    by_attr = index.get("by_attribute") or {}
    used = set()
    for g in groups:
        used.update(g["fighters"])
    changed = True
    while changed:
        changed = False
        for i, g in enumerate(groups):
            attr_id = g["id"]
            fighters = list(g["fighters"])
            for f in fighters:
                if sum(1 for og in groups if f in og["fighters"]) <= 1:
                    continue
                # f appears in at least 2 groups; remove from less central
                other_groups_with_f = [j for j, og in enumerate(groups) if j != i and f in og["fighters"]]
                my_count = len(by_attr.get(attr_id) or [])
                best_j = min(other_groups_with_f, key=lambda j: len(by_attr.get(groups[j]["id"]) or []))
                remove_from = i if my_count <= len(by_attr.get(groups[best_j]["id"]) or []) else best_j
                target_group = groups[remove_from]
                target_attr = target_group["id"]
                target_list = by_attr.get(target_attr) or []
                replacement_pool = [x for x in target_list if x not in used]
                if not replacement_pool:
                    return None
                replacement = random.choice(replacement_pool)
                target_group["fighters"] = [x for x in target_group["fighters"] if x != f]
                target_group["fighters"].append(replacement)
                used.add(replacement)
                changed = True
                break
            if changed:
                break
    return groups


def _decoy_ok(groups: list[dict], index: dict) -> bool:
    """Each group's attribute must be matched by at least 6 of the 16 fighters (4 in group + 2 decoys)."""
    by_attr = index.get("by_attribute") or {}
    all_16 = set()
    for g in groups:
        all_16.update(g["fighters"])
    if len(all_16) != 16:
        return False
    for g in groups:
        attr_id = g["id"]
        matching = set(by_attr.get(attr_id) or [])
        count_in_16 = len(all_16 & matching)
        if count_in_16 < 6:
            return False
    return True


def generate_connections_puzzle(
    difficulty: str = "normal",
    max_attempts: int = 300,
    exclude_attribute_ids: list[str] | set[str] | None = None,
    index: dict | None = None,
) -> dict:
    """
    Generate a Connections puzzle: 4 groups of 4 fighters each.
    Returns { groups: [{ id, label, color, fighters }], all_fighters: [16 names shuffled], difficulty }.
    """
    idx = index or _load_index()
    available = _filter_attributes(idx, difficulty, exclude_attribute_ids)
    if len(available) < 4:
        raise ValueError(f"Not enough attributes for difficulty={difficulty} (need 4, have {len(available)})")

    fighters_list = _load_fighters()
    obscure = _obscure_by_name(fighters_list)
    by_attr = idx.get("by_attribute") or {}
    use_obscure = difficulty == "hard"

    for _ in range(max_attempts):
        chosen = random.sample(available, 4)
        used = set()
        groups = []
        for attr_info in chosen:
            fighter_list = list(attr_info["fighters"])
            four = _sample_four(fighter_list, used, use_obscure, obscure)
            if four is None:
                four = _sample_four(fighter_list, used, False, obscure)
            if four is None:
                break
            used.update(four)
            groups.append({
                "id": attr_info["id"],
                "label": attr_info["label"],
                "color": None,
                "fighters": four,
            })
        if len(groups) != 4:
            continue
        resolved = _resolve_overlaps(groups, idx)
        if resolved is None:
            continue
        groups = resolved
        if not _decoy_ok(groups, idx):
            continue

        # Assign colors: easiest (largest attribute pool) = yellow, hardest = purple
        by_size = [(i, len(by_attr.get(g["id"]) or [])) for i, g in enumerate(groups)]
        by_size.sort(key=lambda x: -x[1])
        for rank, (i, _) in enumerate(by_size):
            groups[i]["color"] = CONNECTIONS_COLORS[rank]

        all_16 = []
        for g in groups:
            all_16.extend(g["fighters"])
        random.shuffle(all_16)

        return {
            "groups": groups,
            "all_fighters": all_16,
            "difficulty": difficulty,
        }

    raise ValueError(f"Could not generate a {difficulty} connections puzzle within {max_attempts} attempts.")


def check_ambiguity(puzzle: dict, index: dict | None = None) -> dict:
    """
    For each fighter in the puzzle, count how many groups they could belong to (by attribute).
    Flag any fighter who fits 2+ groups as 'ambiguous'. Return full report:
    - ambiguous_fighters: list of names
    - per_fighter: name -> { matching_group_ids, matching_group_labels, match_count, ambiguous }
    - summary: { total, ambiguous_count }
    """
    idx = index or _load_index()
    by_fighter = idx.get("by_fighter") or {}
    groups = puzzle.get("groups") or []
    group_attr_ids = [g.get("id") for g in groups if g.get("id")]

    report = {
        "ambiguous_fighters": [],
        "per_fighter": {},
        "summary": {"total": 0, "ambiguous_count": 0},
    }
    all_fighters = set()
    for g in groups:
        all_fighters.update(g.get("fighters") or [])

    for name in all_fighters:
        attr_ids = set(by_fighter.get(name) or [])
        matching_groups = [g for g in groups if g.get("id") in attr_ids]
        count = len(matching_groups)
        report["per_fighter"][name] = {
            "matching_group_ids": [g.get("id") for g in matching_groups],
            "matching_group_labels": [g.get("label") for g in matching_groups],
            "match_count": count,
            "ambiguous": count >= 2,
        }
        if count >= 2:
            report["ambiguous_fighters"].append(name)
    report["summary"]["total"] = len(all_fighters)
    report["summary"]["ambiguous_count"] = len(report["ambiguous_fighters"])
    return report


if __name__ == "__main__":
    idx = _load_index()
    try:
        p = generate_connections_puzzle("normal", index=idx)
        print("Generated puzzle:")
        for g in p["groups"]:
            print(f"  {g['color']}: {g['label']} -> {g['fighters']}")
        print("all_fighters (shuffled):", p["all_fighters"])
        report = check_ambiguity(p, idx)
        print("Ambiguity report:", report["summary"])
        if report["ambiguous_fighters"]:
            print("Ambiguous:", report["ambiguous_fighters"])
    except ValueError as e:
        print(e)
