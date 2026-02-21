const express = require('express');
const router = express.Router();

function todayUTC() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
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

// GET /api/daily?gameType=grid|connections&date=YYYY-MM-DD — get puzzle by game type and date (date optional, defaults to today UTC)
router.get('/', (req, res, next) => {
  const gameType = (req.query.gameType || 'grid').toLowerCase();
  if (gameType !== 'grid' && gameType !== 'connections') {
    return res.status(400).json({ error: 'gameType must be "grid" or "connections"' });
  }

  const pool = req.app.get('pool');
  if (!pool) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  // Optional date param (YYYY-MM-DD) so client can pass "today" and avoid server timezone mismatch
  let puzzleDate = (req.query.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(puzzleDate)) {
    puzzleDate = todayUTC();
  }

  const sql = `
    SELECT puzzle_data, difficulty
    FROM daily_puzzles
    WHERE game_type = $1 AND puzzle_date = $2::date
    LIMIT 1
  `;

  pool.query(sql, [gameType, puzzleDate])
    .then((result) => {
      const row = result.rows[0];
      const puzzle = row ? parsePuzzleData(row.puzzle_data) : null;
      res.json({
        gameType,
        puzzle,
        difficulty: row ? row.difficulty : null,
        puzzleDate,
      });
    })
    .catch((err) => next(err));
});

module.exports = router;
