const express = require('express');
const router = express.Router();

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function parsePuzzleData(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeName(name) {
  return (name || '').trim().toLowerCase();
}

// POST /api/validate — body: { cell: { row, col }, fighterName }, optional puzzleDate (YYYY-MM-DD, default today UTC)
// Returns { valid: boolean, fighter: object | null } — fighter has at least .name when valid
router.post('/', (req, res, next) => {
  const { cell, fighterName, puzzleDate: bodyDate } = req.body || {};
  const pool = req.app.get('pool');
  if (!pool) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const row = cell?.row;
  const col = cell?.col;
  const name = (fighterName || '').trim();
  if (row == null || col == null || !name) {
    return res.status(400).json({ valid: false, fighter: null, error: 'Missing cell or fighterName' });
  }

  const puzzleDate = /^\d{4}-\d{2}-\d{2}$/.test((bodyDate || '').trim())
    ? bodyDate.trim()
    : todayUTC();

  const sql = `
    SELECT puzzle_data
    FROM daily_puzzles
    WHERE game_type = 'grid' AND puzzle_date = $1::date
    LIMIT 1
  `;

  pool
    .query(sql, [puzzleDate])
    .then((result) => {
      const row_db = result.rows[0];
      const puzzleData = row_db ? parsePuzzleData(row_db.puzzle_data) : null;
      if (!puzzleData || !puzzleData.cells) {
        return res.json({ valid: false, fighter: null });
      }

      const cellKey = `${Number(row)},${Number(col)}`;
      const validNames = puzzleData.cells[cellKey];
      if (!Array.isArray(validNames)) {
        return res.json({ valid: false, fighter: null });
      }

      const nameNorm = normalizeName(name);
      const found = validNames.some((n) => normalizeName(n) === nameNorm);
      if (!found) {
        return res.json({ valid: false, fighter: null });
      }

      return res.json({ valid: true, fighter: { name: name } });
    })
    .catch((err) => next(err));
});

module.exports = router;
