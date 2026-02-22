const express = require('express');
const router = express.Router();

const CONNECTIONS_COLORS = ['yellow', 'green', 'blue', 'purple'];

function todayUTC() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
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

// GET /api/daily/meta?gameType=grid|connections&date=YYYY-MM-DD — lightweight check if puzzle exists
router.get('/meta', (req, res, next) => {
  const gameType = (req.query.gameType || 'grid').toLowerCase();
  if (gameType !== 'grid' && gameType !== 'connections') {
    return res.status(400).json({ error: 'gameType must be "grid" or "connections"' });
  }

  const pool = req.app.get('pool');
  if (!pool) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  let puzzleDate = (req.query.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(puzzleDate)) {
    puzzleDate = todayUTC();
  }

  const sql = `
    SELECT puzzle_date, difficulty
    FROM daily_puzzles
    WHERE game_type = $1 AND puzzle_date = $2::date
    LIMIT 1
  `;

  pool.query(sql, [gameType, puzzleDate])
    .then((result) => {
      const row = result.rows[0];
      const has_puzzle = !!row;
      res.json({
        puzzle_date: puzzleDate,
        difficulty: row ? row.difficulty : null,
        has_puzzle,
      });
    })
    .catch((err) => next(err));
});

// GET /api/daily?gameType=grid|connections&date=YYYY-MM-DD — get puzzle (stripped of answers for grid)
router.get('/', (req, res, next) => {
  const gameType = (req.query.gameType || 'grid').toLowerCase();
  if (gameType !== 'grid' && gameType !== 'connections') {
    return res.status(400).json({ error: 'gameType must be "grid" or "connections"' });
  }

  const pool = req.app.get('pool');
  if (!pool) {
    return res.status(500).json({ error: 'Database not configured' });
  }

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
      if (!row) {
        return res.status(404).json({
          error: 'No puzzle today',
          message: 'Check back tomorrow',
        });
      }

      const puzzleData = parsePuzzleData(row.puzzle_data);
      if (!puzzleData) {
        return res.status(404).json({
          error: 'No puzzle today',
          message: 'Check back tomorrow',
        });
      }

      let puzzle;
      if (gameType === 'grid') {
        // Strip valid_fighters: send only count per cell so client cannot see answers
        const cells = puzzleData.cells || {};
        const strippedCells = {};
        for (const [key, val] of Object.entries(cells)) {
          const list = Array.isArray(val) ? val : (val && val.valid_fighters) || [];
          strippedCells[key] = { count: list.length };
        }
        puzzle = {
          rows: Array.isArray(puzzleData.rows) ? puzzleData.rows : [],
          columns: Array.isArray(puzzleData.columns) ? puzzleData.columns : (puzzleData.cols || []),
          cells: strippedCells,
        };
      } else {
        // Connections: { groups: [{ label, color, fighters }], all_fighters } — all_fighters just names, shuffled (no group assignment)
        const categories = puzzleData.categories || [];
        puzzle = {
          groups: categories.map((c, i) => ({
            label: c.name || c.label,
            color: c.color || CONNECTIONS_COLORS[i] || CONNECTIONS_COLORS[0],
            fighters: (c.fighters || []).map((name) => (typeof name === 'object' && name?.name ? { id: name.name, name: name.name } : { id: name, name })),
          })),
          all_fighters: Array.isArray(puzzleData.all_fighters) ? [...puzzleData.all_fighters] : [],
        };
        // Shuffle all_fighters if not already (client expects shuffled)
        if (puzzle.all_fighters.length > 0) {
          for (let i = puzzle.all_fighters.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [puzzle.all_fighters[i], puzzle.all_fighters[j]] = [puzzle.all_fighters[j], puzzle.all_fighters[i]];
          }
        }
      }

      res.set('Cache-Control', 'public, max-age=3600');
      console.log(`[${new Date().toISOString()}] puzzle fetch gameType=${gameType} date=${puzzleDate}`);
      res.json({
        gameType,
        puzzle,
        difficulty: row.difficulty,
        puzzleDate,
      });
    })
    .catch((err) => next(err));
});

module.exports = router;
