"""
Master attribute registry for UFC trivia grid puzzles.
Each attribute has: id, label, category, match_fn(fighter [, fight_history]), and optional requires_fight_history.
Fighter dict keys align with Phase 1 / DB: name, nationality, gym, weight_classes, stance,
wins, losses, win_by_ko, win_by_sub, win_by_dec, total_fights, is_champion, is_former_champion,
title_weight_classes, performance_bonuses, ufc_debut_year, etc.
"""

from typing import Any


def _nat(fighter: dict, *values: str) -> bool:
    n = (fighter.get("nationality") or "").strip().lower()
    return n in (v.lower() for v in values)


def _weight_class(fighter: dict, label: str) -> bool:
    # label like "Heavyweight", "Light Heavyweight", etc.
    wc = fighter.get("weight_classes") or []
    if not isinstance(wc, list):
        return False
    return any((s or "").strip().lower() == label.strip().lower() for s in wc)


def _gym_contains(fighter: dict, substring: str) -> bool:
    g = (fighter.get("gym") or "").lower()
    return substring.lower() in g


# -----------------------------------------------------------------------------
# Nationality
# -----------------------------------------------------------------------------
NATIONALITY_ATTRIBUTES = [
    {"id": "brazilian_fighter", "label": "Brazilian Fighter", "category": "nationality", "requires_fight_history": False, "match_fn": lambda f: _nat(f, "Brazil", "Brazilian")},
    {"id": "american_fighter", "label": "American Fighter", "category": "nationality", "requires_fight_history": False, "match_fn": lambda f: _nat(f, "United States", "USA", "America", "American")},
    {"id": "russian_fighter", "label": "Russian Fighter", "category": "nationality", "requires_fight_history": False, "match_fn": lambda f: _nat(f, "Russia", "Russian")},
    {"id": "irish_fighter", "label": "Irish Fighter", "category": "nationality", "requires_fight_history": False, "match_fn": lambda f: _nat(f, "Ireland", "Irish")},
    {"id": "mexican_fighter", "label": "Mexican Fighter", "category": "nationality", "requires_fight_history": False, "match_fn": lambda f: _nat(f, "Mexico", "Mexican")},
    {"id": "nigerian_fighter", "label": "Nigerian Fighter", "category": "nationality", "requires_fight_history": False, "match_fn": lambda f: _nat(f, "Nigeria", "Nigerian")},
    {"id": "british_fighter", "label": "British Fighter", "category": "nationality", "requires_fight_history": False, "match_fn": lambda f: _nat(f, "United Kingdom", "UK", "England", "British", "Wales", "Scotland")},
    {"id": "chinese_fighter", "label": "Chinese Fighter", "category": "nationality", "requires_fight_history": False, "match_fn": lambda f: _nat(f, "China", "Chinese")},
    {"id": "japanese_fighter", "label": "Japanese Fighter", "category": "nationality", "requires_fight_history": False, "match_fn": lambda f: _nat(f, "Japan", "Japanese")},
    {"id": "australian_fighter", "label": "Australian Fighter", "category": "nationality", "requires_fight_history": False, "match_fn": lambda f: _nat(f, "Australia", "Australian")},
    {"id": "canadian_fighter", "label": "Canadian Fighter", "category": "nationality", "requires_fight_history": False, "match_fn": lambda f: _nat(f, "Canada", "Canadian")},
    {"id": "georgian_fighter", "label": "Georgian Fighter", "category": "nationality", "requires_fight_history": False, "match_fn": lambda f: _nat(f, "Georgia")},
    {"id": "dagestani_fighter", "label": "Dagestani Fighter", "category": "nationality", "requires_fight_history": False, "match_fn": lambda f: _nat(f, "Dagestan", "Dagestani")},
]

# -----------------------------------------------------------------------------
# Weight class (ever competed at)
# -----------------------------------------------------------------------------
WEIGHT_CLASS_ATTRIBUTES = [
    {"id": "competed_heavyweight", "label": "Competed at Heavyweight", "category": "weightclass", "requires_fight_history": False, "match_fn": lambda f: _weight_class(f, "Heavyweight")},
    {"id": "competed_light_heavyweight", "label": "Competed at Light Heavyweight", "category": "weightclass", "requires_fight_history": False, "match_fn": lambda f: _weight_class(f, "Light Heavyweight")},
    {"id": "competed_middleweight", "label": "Competed at Middleweight", "category": "weightclass", "requires_fight_history": False, "match_fn": lambda f: _weight_class(f, "Middleweight")},
    {"id": "competed_welterweight", "label": "Competed at Welterweight", "category": "weightclass", "requires_fight_history": False, "match_fn": lambda f: _weight_class(f, "Welterweight")},
    {"id": "competed_lightweight", "label": "Competed at Lightweight", "category": "weightclass", "requires_fight_history": False, "match_fn": lambda f: _weight_class(f, "Lightweight")},
    {"id": "competed_featherweight", "label": "Competed at Featherweight", "category": "weightclass", "requires_fight_history": False, "match_fn": lambda f: _weight_class(f, "Featherweight")},
    {"id": "competed_bantamweight", "label": "Competed at Bantamweight", "category": "weightclass", "requires_fight_history": False, "match_fn": lambda f: _weight_class(f, "Bantamweight")},
    {"id": "competed_flyweight", "label": "Competed at Flyweight", "category": "weightclass", "requires_fight_history": False, "match_fn": lambda f: _weight_class(f, "Flyweight")},
    {"id": "competed_strawweight", "label": "Competed at Strawweight", "category": "weightclass", "requires_fight_history": False, "match_fn": lambda f: _weight_class(f, "Strawweight")},
]

# -----------------------------------------------------------------------------
# Achievement
# -----------------------------------------------------------------------------
def _int(fighter: dict, key: str, default: int = 0) -> int:
    v = fighter.get(key)
    if v is None:
        return default
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


ACHIEVEMENT_ATTRIBUTES = [
    {"id": "former_ufc_champion", "label": "Former UFC Champion", "category": "achievement", "requires_fight_history": False, "match_fn": lambda f: bool(f.get("is_former_champion"))},
    {"id": "current_ufc_champion", "label": "Current UFC Champion", "category": "achievement", "requires_fight_history": False, "match_fn": lambda f: bool(f.get("is_champion"))},
    {"id": "two_division_champion", "label": "Two-Division Champion", "category": "achievement", "requires_fight_history": False, "match_fn": lambda f: (f.get("title_weight_classes") or []) and len(f.get("title_weight_classes") or []) >= 2},
    {"id": "undefeated_in_ufc", "label": "Undefeated in UFC", "category": "achievement", "requires_fight_history": False, "match_fn": lambda f: _int(f, "losses") == 0 and _int(f, "total_fights", 0) > 0},
    {"id": "won_by_ko_5_plus", "label": "Won by KO/TKO 5+ times", "category": "achievement", "requires_fight_history": False, "match_fn": lambda f: _int(f, "win_by_ko") >= 5},
    {"id": "won_by_sub_5_plus", "label": "Won by Submission 5+ times", "category": "achievement", "requires_fight_history": False, "match_fn": lambda f: _int(f, "win_by_sub") >= 5},
    {"id": "decision_specialist", "label": "Decision Specialist (8+ decision wins)", "category": "achievement", "requires_fight_history": False, "match_fn": lambda f: _int(f, "win_by_dec") >= 8},
    {"id": "ufc_wins_10_plus", "label": "10+ UFC Wins", "category": "achievement", "requires_fight_history": False, "match_fn": lambda f: _int(f, "wins") >= 10},
    {"id": "ufc_wins_20_plus", "label": "20+ UFC Wins", "category": "achievement", "requires_fight_history": False, "match_fn": lambda f: _int(f, "wins") >= 20},
    {"id": "has_performance_bonus", "label": "Has a Performance Bonus", "category": "achievement", "requires_fight_history": False, "match_fn": lambda f: _int(f, "performance_bonuses") >= 1},
    {"id": "has_fight_of_the_night", "label": "Has a Fight of the Night Bonus", "category": "achievement", "requires_fight_history": False, "match_fn": lambda f: _int(f, "performance_bonuses") >= 1},  # schema has single count; treat as any bonus
    {"id": "never_been_finished", "label": "Never Been Finished", "category": "achievement", "requires_fight_history": False, "match_fn": lambda f: _int(f, "losses") == 0},  # conservative: no losses => never finished
]

# -----------------------------------------------------------------------------
# Era (ufc_debut_year; "active" may need last_fight_date from fight_history later)
# -----------------------------------------------------------------------------
def _debut_year(fighter: dict) -> int | None:
    y = fighter.get("ufc_debut_year")
    if y is None:
        return None
    try:
        return int(y)
    except (TypeError, ValueError):
        return None


ERA_ATTRIBUTES = [
    {"id": "ufc_debut_before_2010", "label": "UFC Debut Before 2010", "category": "era", "requires_fight_history": False, "match_fn": lambda f: (_debut_year(f) or 9999) < 2010},
    {"id": "ufc_debut_2010_2015", "label": "UFC Debut 2010-2015", "category": "era", "requires_fight_history": False, "match_fn": lambda f: 2010 <= (_debut_year(f) or 0) <= 2015},
    {"id": "ufc_debut_2016_2020", "label": "UFC Debut 2016-2020", "category": "era", "requires_fight_history": False, "match_fn": lambda f: 2016 <= (_debut_year(f) or 0) <= 2020},
    {"id": "ufc_debut_after_2020", "label": "UFC Debut After 2020", "category": "era", "requires_fight_history": False, "match_fn": lambda f: (_debut_year(f) or 0) > 2020},
    {"id": "active_fighter_18_months", "label": "Active Fighter (fought in last 18 months)", "category": "era", "requires_fight_history": True, "match_fn": lambda f, hist=None: _active_in_last_18_months(f, hist)},
    {"id": "retired_fighter", "label": "Retired Fighter", "category": "era", "requires_fight_history": True, "match_fn": lambda f, hist=None: not _active_in_last_18_months(f, hist) and (hist is not None and len(hist) > 0)},
]


def _active_in_last_18_months(fighter: dict, fight_history: list[dict] | None) -> bool:
    if not fight_history:
        return False
    from datetime import datetime, timedelta
    cutoff = (datetime.utcnow() - timedelta(days=18 * 30)).year
    for fight in fight_history:
        y = fight.get("fight_year")
        if y is not None and int(y) >= cutoff:
            return True
    return False


# -----------------------------------------------------------------------------
# Style (stance and win-style ratios)
# -----------------------------------------------------------------------------
def _stance_match(fighter: dict, stance_value: str) -> bool:
    s = (fighter.get("stance") or "").strip().lower()
    return stance_value.lower() in s


def _striker_ratio(fighter: dict) -> bool:
    ko = _int(fighter, "win_by_ko")
    total = _int(fighter, "wins")
    if total == 0:
        return False
    return (ko / total) >= 0.6


def _wrestler_style(fighter: dict) -> bool:
    # "50%+ wins by sub or decision with wrestling background" — we approximate: 50%+ by sub or dec
    sub = _int(fighter, "win_by_sub")
    dec = _int(fighter, "win_by_dec")
    total = _int(fighter, "wins")
    if total == 0:
        return False
    return (sub + dec) / total >= 0.5


STYLE_ATTRIBUTES = [
    {"id": "southpaw_stance", "label": "Southpaw Stance", "category": "style", "requires_fight_history": False, "match_fn": lambda f: _stance_match(f, "Southpaw")},
    {"id": "orthodox_stance", "label": "Orthodox Stance", "category": "style", "requires_fight_history": False, "match_fn": lambda f: _stance_match(f, "Orthodox")},
    {"id": "wrestler_style", "label": "Wrestler (50%+ wins by sub or decision with wrestling background)", "category": "style", "requires_fight_history": False, "match_fn": _wrestler_style},
    {"id": "striker_style", "label": "Striker (60%+ wins by KO/TKO)", "category": "style", "requires_fight_history": False, "match_fn": _striker_ratio},
]

# -----------------------------------------------------------------------------
# Gym
# -----------------------------------------------------------------------------
GYM_ATTRIBUTES = [
    {"id": "gym_american_top_team", "label": "American Top Team", "category": "gym", "requires_fight_history": False, "match_fn": lambda f: _gym_contains(f, "American Top Team") or _gym_contains(f, "ATT")},
    {"id": "gym_jackson_wink", "label": "Jackson-Wink MMA", "category": "gym", "requires_fight_history": False, "match_fn": lambda f: _gym_contains(f, "Jackson") or _gym_contains(f, "Wink")},
    {"id": "gym_aka", "label": "AKA (American Kickboxing Academy)", "category": "gym", "requires_fight_history": False, "match_fn": lambda f: _gym_contains(f, "American Kickboxing") or _gym_contains(f, "AKA")},
    {"id": "gym_tristar", "label": "Tristar Gym", "category": "gym", "requires_fight_history": False, "match_fn": lambda f: _gym_contains(f, "Tristar")},
    {"id": "gym_sbg_ireland", "label": "SBG Ireland", "category": "gym", "requires_fight_history": False, "match_fn": lambda f: _gym_contains(f, "SBG") or _gym_contains(f, "Straight Blast")},
    {"id": "gym_city_kickboxing", "label": "City Kickboxing", "category": "gym", "requires_fight_history": False, "match_fn": lambda f: _gym_contains(f, "City Kickboxing")},
    {"id": "gym_fortis_mma", "label": "Fortis MMA", "category": "gym", "requires_fight_history": False, "match_fn": lambda f: _gym_contains(f, "Fortis")},
    {"id": "gym_tiger_muay_thai", "label": "Tiger Muay Thai", "category": "gym", "requires_fight_history": False, "match_fn": lambda f: _gym_contains(f, "Tiger Muay Thai") or _gym_contains(f, "TMT")},
]

# -----------------------------------------------------------------------------
# Shared history (fight-based) — require fight_history list of dicts (event_name, fight_year, etc.)
# -----------------------------------------------------------------------------
def _fought_at_ufc_100(fighter: dict, fight_history: list[dict] | None = None) -> bool:
    if not fight_history:
        return False
    for fight in fight_history:
        ev = (fight.get("event_name") or "").strip()
        if "UFC 100" in ev or ev == "UFC 100":
            return True
    return False


def _main_evented_ppv(fighter: dict, fight_history: list[dict] | None = None) -> bool:
    if not fight_history:
        return False
    for fight in fight_history:
        ev = (fight.get("event_name") or "").strip().upper()
        if "MAIN EVENT" in ev or "PPV" in ev or "Pay-Per-View" in ev:
            return True
    return False


def _fought_for_title(fighter: dict, fight_history: list[dict] | None = None) -> bool:
    if not fight_history:
        return False
    for fight in fight_history:
        ev = (fight.get("event_name") or "").strip().lower()
        wc = (fight.get("weight_class") or "").strip().lower()
        if "title" in ev or "championship" in ev or "title" in wc:
            return True
    return False


FIGHT_HISTORY_ATTRIBUTES = [
    {"id": "fought_at_ufc_100", "label": "Fought at UFC 100", "category": "record", "requires_fight_history": True, "match_fn": _fought_at_ufc_100},
    {"id": "main_evented_ppv", "label": "Main Evented a PPV", "category": "record", "requires_fight_history": True, "match_fn": _main_evented_ppv},
    {"id": "fought_for_ufc_title", "label": "Fought for a UFC Title", "category": "record", "requires_fight_history": True, "match_fn": _fought_for_title},
]


def match_attribute(fighter: dict, attr: dict, fight_history: list[dict] | None = None) -> bool:
    """Run an attribute's match_fn. Passes fight_history for attributes with requires_fight_history=True."""
    fn = attr.get("match_fn")
    if not callable(fn):
        return False
    if attr.get("requires_fight_history"):
        return bool(fn(fighter, fight_history))
    return bool(fn(fighter))


# -----------------------------------------------------------------------------
# Master list (single source of truth for puzzle generation)
# -----------------------------------------------------------------------------
ATTRIBUTES: list[dict[str, Any]] = (
    NATIONALITY_ATTRIBUTES
    + WEIGHT_CLASS_ATTRIBUTES
    + ACHIEVEMENT_ATTRIBUTES
    + ERA_ATTRIBUTES
    + STYLE_ATTRIBUTES
    + GYM_ATTRIBUTES
    + FIGHT_HISTORY_ATTRIBUTES
)


def get_attribute_by_id(attr_id: str) -> dict | None:
    for a in ATTRIBUTES:
        if a.get("id") == attr_id:
            return a
    return None


def get_attributes_by_category(category: str) -> list[dict]:
    return [a for a in ATTRIBUTES if a.get("category") == category]
