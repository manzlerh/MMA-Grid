"""
Tests for data/processed/attribute_index.json and fighters_final.json.
Run from project root: python -m pytest data/tests/test_attribute_index.py -v
Or: python data/tests/test_attribute_index.py
"""
import json
import sys
import unittest
from pathlib import Path

# data/tests/ -> data/
SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent
PROCESSED_DIR = DATA_DIR / "processed"
INDEX_PATH = PROCESSED_DIR / "attribute_index.json"
FIGHTERS_FINAL_PATH = PROCESSED_DIR / "fighters_final.json"
FIGHTERS_ENRICHED_PATH = PROCESSED_DIR / "fighters_enriched.json"

sys.path.insert(0, str(DATA_DIR))
from attributes import ATTRIBUTES


def load_index():
    with open(INDEX_PATH, encoding="utf-8") as f:
        return json.load(f)


def load_fighters():
    path = FIGHTERS_FINAL_PATH if FIGHTERS_FINAL_PATH.exists() else FIGHTERS_ENRICHED_PATH
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else [data]


class TestAttributeIndex(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.index = load_index()
        cls.fighters = load_fighters()
        cls.by_attribute = cls.index.get("by_attribute", {})
        cls.by_fighter = cls.index.get("by_fighter", {})
        cls.fighter_names = [f["name"] for f in cls.fighters if f.get("name")]

    def test_no_empty_attributes(self):
        """Every attribute in by_attribute has at least 1 fighter."""
        empty = [attr_id for attr_id, names in self.by_attribute.items() if len(names) < 1]
        if empty:
            self.fail(
                f"test_no_empty_attributes FAILED: {len(empty)} attribute(s) have 0 fighters: {empty[:20]}{'...' if len(empty) > 20 else ''}"
            )
        print("test_no_empty_attributes: PASS — every attribute has at least 1 fighter")

    def test_grid_safe_attributes(self):
        """Attributes with category not in ['shared_history'] have 15+ matching fighters."""
        exclude_categories = {"shared_history"}
        grid_attrs = [a for a in ATTRIBUTES if a.get("category") not in exclude_categories]
        below = []
        for attr in grid_attrs:
            attr_id = attr.get("id")
            if attr_id not in self.by_attribute:
                below.append((attr.get("label", attr_id), 0))
                continue
            count = len(self.by_attribute[attr_id])
            if count < 15:
                below.append((attr.get("label", attr_id), count))
        if below:
            self.fail(
                f"test_grid_safe_attributes FAILED: {len(below)} attribute(s) have < 15 fighters: "
                + ", ".join(f"{label}(n={n})" for label, n in below[:15])
                + (" ..." if len(below) > 15 else "")
            )
        print("test_grid_safe_attributes: PASS — all grid attributes (excl. shared_history) have 15+ fighters")

    def test_reverse_index_complete(self):
        """Every fighter name in fighters_final.json has an entry in by_fighter (list may be empty)."""
        missing = [n for n in self.fighter_names if n not in self.by_fighter]
        if missing:
            self.fail(
                f"test_reverse_index_complete FAILED: {len(missing)} fighter(s) missing from by_fighter: "
                + ", ".join(missing[:15])
                + (" ..." if len(missing) > 15 else "")
            )
        print("test_reverse_index_complete: PASS — every fighter has an entry in by_fighter")

    def test_no_orphaned_fighters(self):
        """At least 80% of fighters match at least 3 attributes."""
        match_counts = [len(self.by_fighter.get(n, [])) for n in self.fighter_names]
        with_3_plus = sum(1 for c in match_counts if c >= 3)
        pct = (with_3_plus / len(self.fighter_names) * 100) if self.fighter_names else 0
        if pct < 80:
            low = sum(1 for c in match_counts if c <= 1)
            self.fail(
                f"test_no_orphaned_fighters FAILED: only {pct:.1f}% of fighters match >= 3 attributes "
                f"(required >= 80%). {with_3_plus}/{len(self.fighter_names)} have 3+. "
                f"{low} fighters match 0-1 attributes (data quality problem)."
            )
        print(f"test_no_orphaned_fighters: PASS — {pct:.1f}% of fighters match >= 3 attributes")

    def test_champion_count_plausible(self):
        """'Former UFC Champion' attribute has between 30 and 200 fighters."""
        attr_id = "former_ufc_champion"
        names = self.by_attribute.get(attr_id, [])
        n = len(names)
        if n < 30 or n > 200:
            self.fail(
                f"test_champion_count_plausible FAILED: former_ufc_champion has {n} fighters "
                f"(expected 30–200)."
            )
        print(f"test_champion_count_plausible: PASS — Former UFC Champion has {n} fighters (30–200)")

    def test_nationality_coverage(self):
        """At least 60% of fighters match at least one nationality attribute."""
        nationality_ids = {a["id"] for a in ATTRIBUTES if a.get("category") == "nationality"}
        with_nat = 0
        for name in self.fighter_names:
            attrs = self.by_fighter.get(name, [])
            if any(a in nationality_ids for a in attrs):
                with_nat += 1
        pct = (with_nat / len(self.fighter_names) * 100) if self.fighter_names else 0
        if pct < 60:
            self.fail(
                f"test_nationality_coverage FAILED: only {pct:.1f}% of fighters match at least one "
                f"nationality attribute (required >= 60%). {with_nat}/{len(self.fighter_names)}."
            )
        print(f"test_nationality_coverage: PASS — {pct:.1f}% of fighters match at least one nationality")

    def test_no_duplicate_fighter_names(self):
        """All fighter names in fighters_final.json are unique."""
        seen = {}
        for f in self.fighters:
            name = f.get("name")
            if not name:
                continue
            if name in seen:
                self.fail(
                    f"test_no_duplicate_fighter_names FAILED: duplicate name '{name}' "
                    f"at indices {seen[name]} and {self.fighters.index(f)}."
                )
            seen[name] = self.fighters.index(f)
        print("test_no_duplicate_fighter_names: PASS — all fighter names are unique")


def run_with_summary():
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(TestAttributeIndex)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_with_summary()
    sys.exit(0 if success else 1)
