"""
Unit tests for grid_validator and puzzle generation category rules.
Run from project root: python -m pytest data/tests/test_grid_validator.py -v
Or: python data/tests/test_grid_validator.py
"""
import sys
import unittest
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(DATA_DIR))

from grid_validator import (
    load_attribute_index,
    validate_grid_combination,
    score_puzzle_quality,
    get_index,
)
from generate_grid_puzzle import _rows_and_cols_category_ok
from attributes import ATTRIBUTES, get_attribute_by_id


def _attr(id_: str) -> dict:
    a = get_attribute_by_id(id_)
    if a is None:
        raise ValueError(f"Unknown attribute id: {id_}")
    return {"id": a["id"], "label": a.get("label", id_), "category": a.get("category", "")}


class TestGridValidator(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        load_attribute_index()
        cls.index = get_index()

    def test_valid_combination_returns_nine_cells(self):
        """Known-good combination: 3 nationalities x 3 weight classes -> valid, 9 cells."""
        rows = ["brazilian_fighter", "american_fighter", "russian_fighter"]
        cols = ["competed_lightweight", "competed_heavyweight", "competed_welterweight"]
        result = validate_grid_combination(rows, cols, self.index)
        self.assertTrue(result["valid"], f"Expected valid=True, got {result}")
        self.assertIn("cells", result)
        self.assertEqual(len(result["cells"]), 9, f"Expected 9 cells, got {list(result['cells'].keys())}")
        print("test_valid_combination_returns_nine_cells: PASS — valid=True, 9 cells")

    def test_impossible_combination_returns_invalid(self):
        """Very tight combination (rare nationalities + rare achievements) should be invalid."""
        rows = ["chinese_fighter", "nigerian_fighter", "georgian_fighter"]
        cols = ["two_division_champion", "undefeated_in_ufc", "never_been_finished"]
        result = validate_grid_combination(rows, cols, self.index)
        self.assertFalse(result["valid"], f"Expected valid=False for impossible combo, got valid=True")
        print("test_impossible_combination_returns_invalid: PASS — valid=False")

    def test_cell_counts_are_accurate(self):
        """For a valid combination, one cell's count matches manual intersection from index."""
        rows = ["brazilian_fighter", "american_fighter", "russian_fighter"]
        cols = ["competed_lightweight", "competed_heavyweight", "competed_welterweight"]
        result = validate_grid_combination(rows, cols, self.index)
        if not result["valid"]:
            self.skipTest("Combination was invalid; cannot verify cell counts")
        by_attr = self.index.get("by_attribute") or {}
        row_set = set(by_attr.get(rows[0]) or [])
        col_set = set(by_attr.get(cols[0]) or [])
        expected_count = len(row_set & col_set)
        cell_0_0 = result["cells"].get("0,0", {})
        actual_count = cell_0_0.get("count", -1)
        self.assertEqual(
            actual_count,
            expected_count,
            f"Cell 0,0: expected count {expected_count} (from index), got {actual_count}",
        )
        print("test_cell_counts_are_accurate: PASS — cell 0,0 count matches index intersection")

    def test_min_cell_count_correct(self):
        """result['min_cell_count'] equals the minimum of all cell counts."""
        rows = ["brazilian_fighter", "american_fighter", "russian_fighter"]
        cols = ["competed_lightweight", "competed_welterweight", "ufc_wins_10_plus"]
        result = validate_grid_combination(rows, cols, self.index)
        cells = result.get("cells", {})
        counts = [cells[k].get("count", 0) for k in sorted(cells)]
        expected_min = min(counts) if counts else 0
        self.assertEqual(
            result.get("min_cell_count"),
            expected_min,
            f"min_cell_count should be {expected_min}, got {result.get('min_cell_count')}",
        )
        print("test_min_cell_count_correct: PASS — min_cell_count equals min of cell counts")

    def test_difficulty_scoring(self):
        """Broad attributes -> easy; valid combos get a defined difficulty (easy/normal/hard)."""
        # Easy: large pools (nationality + weightclass + stance)
        rows_easy = ["american_fighter", "brazilian_fighter", "ufc_wins_10_plus"]
        cols_easy = ["competed_lightweight", "competed_welterweight", "orthodox_stance"]
        result_easy = validate_grid_combination(rows_easy, cols_easy, self.index)
        self.assertEqual(
            result_easy["difficulty_score"],
            "easy",
            f"Expected easy for broad combo, got {result_easy['difficulty_score']} "
            f"(min={result_easy.get('min_cell_count')}, avg={result_easy.get('avg_cell_count')})",
        )
        # Same known-valid combo as test_valid_combination: should be valid and score easy or normal
        rows_valid = ["brazilian_fighter", "american_fighter", "russian_fighter"]
        cols_valid = ["competed_lightweight", "competed_heavyweight", "competed_welterweight"]
        result_valid = validate_grid_combination(rows_valid, cols_valid, self.index)
        self.assertTrue(result_valid["valid"], "Nationality x weight combo should be valid")
        self.assertIn(
            result_valid["difficulty_score"],
            ("easy", "normal", "hard"),
            f"Valid combo should have difficulty easy/normal/hard, got {result_valid['difficulty_score']}",
        )
        print("test_difficulty_scoring: PASS — broad combo=easy; valid combo has difficulty in [easy, normal, hard]")

    def test_quality_score_range(self):
        """score_puzzle_quality(result) returns a float in [0, 1]."""
        rows = ["american_fighter", "brazilian_fighter", "competed_welterweight"]
        cols = ["competed_lightweight", "orthodox_stance", "ufc_wins_10_plus"]
        result = validate_grid_combination(rows, cols, self.index)
        score = score_puzzle_quality(result)
        self.assertIsInstance(score, (int, float), "score should be numeric")
        self.assertGreaterEqual(score, 0.0, f"score should be >= 0, got {score}")
        self.assertLessEqual(score, 1.0, f"score should be <= 1, got {score}")
        print("test_quality_score_range: PASS — score in [0, 1]")

    def test_same_category_rejected(self):
        """Generator rejects when two nationality attributes are used as columns (and rows)."""
        # Two triples that each have nationality; shared category is nationality -> not allowed
        row_triple = [
            _attr("brazilian_fighter"),
            _attr("american_fighter"),
            _attr("mexican_fighter"),
        ]
        col_triple = [
            _attr("irish_fighter"),
            _attr("russian_fighter"),
            _attr("japanese_fighter"),
        ]
        ok = _rows_and_cols_category_ok(row_triple, col_triple)
        self.assertFalse(
            ok,
            "Generator should reject: rows and cols both use nationality (same category).",
        )
        print("test_same_category_rejected: PASS — _rows_and_cols_category_ok rejects nationality in both axes")


def run_with_summary():
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(TestGridValidator)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_with_summary()
    sys.exit(0 if success else 1)
