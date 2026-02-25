const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const CONNECTIONS_COLORS = ['yellow', 'green', 'blue', 'purple'];

// Max 30 validation requests per minute per IP
const validateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests', retryAfter: 60 },
  standardHeaders: true,
});

router.use(validateLimiter);

function todayEST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
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

// POST /api/validate — grid (body: { cell: { row, col }, fighterName } or { puzzleDate, row, col, fighterName })
// Returns { valid, fighter, rarity_score }. Fighter from DB (name, nationality, gym, weight_classes, image_url).
router.post('/', gridValidate);
router.post('/grid', gridValidate);

function gridValidate(req, res, next) {
  const body = req.body || {};
  const cell = body.cell || {};
  const row = cell.row != null ? cell.row : body.row;
  const col = cell.col != null ? cell.col : body.col;
  const fighterName = (body.fighterName || '').trim();
  const pool = req.app.get('pool');
  if (!pool) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  if (row == null || col == null || !fighterName) {
    return res.status(400).json({ valid: false, fighter: null, rarity_score: 0, error: 'Missing cell or fighterName' });
  }

  const puzzleDate = /^\d{4}-\d{2}-\d{2}$/.test((body.puzzleDate || '').trim())
    ? body.puzzleDate.trim()
    : todayEST();

  const cellKey = `${Number(row)},${Number(col)}`;

  pool
    .query(
      `SELECT puzzle_data FROM daily_puzzles WHERE game_type = 'grid' AND puzzle_date = $1::date LIMIT 1`,
      [puzzleDate]
    )
    .then((result) => {
      const row_db = result.rows[0];
      const puzzleData = row_db ? parsePuzzleData(row_db.puzzle_data) : null;
      if (!puzzleData || !puzzleData.cells) {
        return res.status(404).json({ valid: false, fighter: null, rarity_score: 0, error: 'No puzzle today' });
      }

      const validList = puzzleData.cells[cellKey];
      if (!Array.isArray(validList)) {
        return res.status(400).json({ valid: false, fighter: null, rarity_score: 0, error: 'Invalid cell' });
      }

      const nameNorm = normalizeName(fighterName);
      const matchedName = validList.find((n) => normalizeName(n) === nameNorm);
      if (!matchedName) {
        // Fuzzy: try matching by nickname in fighters table
        return pool
          .query(
            `SELECT name, nickname FROM fighters WHERE LOWER(TRIM(nickname)) = $1 OR LOWER(TRIM(name)) = $1 LIMIT 5`,
            [nameNorm]
          )
          .then((fResult) => {
            const byNick = fResult.rows.find((r) => validList.some((v) => normalizeName(v) === normalizeName(r.name)));
            if (byNick) {
              return sendGridValid(res, pool, byNick.name, Math.round(1000 / validList.length));
            }
            return res.json({ valid: false, fighter: null, rarity_score: 0 });
          });
      }
      return sendGridValid(res, pool, matchedName, Math.round(1000 / validList.length));
    })
    .catch((err) => next(err));
}

function sendGridValid(res, pool, fighterName, rarity_score) {
  return pool
    .query(
      `SELECT name, nationality, gym, weight_classes, image_url FROM fighters WHERE name = $1 LIMIT 1`,
      [fighterName]
    )
    .then((result) => {
      const row = result.rows[0];
      const fighter = row
        ? {
            name: row.name,
            nationality: row.nationality,
            gym: row.gym,
            weight_classes: row.weight_classes,
            image_url: row.image_url,
          }
        : { name: fighterName };
      res.json({ valid: true, fighter, rarity_score });
    })
    .catch(() => {
      res.json({ valid: true, fighter: { name: fighterName }, rarity_score });
    });
}

// POST /api/validate/connections — body: { puzzleDate?, fighterNames: [4 names] }
// Returns { valid, color, label, isOneAway }
router.post('/connections', (req, res, next) => {
  const body = req.body || {};
  const fighterNames = Array.isArray(body.fighterNames) ? body.fighterNames.map((n) => (n || '').trim()).filter(Boolean) : [];
  const pool = req.app.get('pool');
  if (!pool) {
    return res.status(500).json({ error: 'Database not configured' });
  }
  if (fighterNames.length !== 4) {
    return res.status(400).json({ valid: false, color: null, label: null, isOneAway: false, error: 'Need exactly 4 fighter names' });
  }

  const puzzleDate = /^\d{4}-\d{2}-\d{2}$/.test((body.puzzleDate || '').trim())
    ? body.puzzleDate.trim()
    : todayEST();

  pool
    .query(
      `SELECT puzzle_data FROM daily_puzzles WHERE game_type = 'connections' AND puzzle_date = $1::date LIMIT 1`,
      [puzzleDate]
    )
    .then((result) => {
      const row_db = result.rows[0];
      const puzzleData = row_db ? parsePuzzleData(row_db.puzzle_data) : null;
      if (!puzzleData || !puzzleData.categories) {
        return res.status(404).json({ valid: false, color: null, label: null, isOneAway: false, error: 'No puzzle today' });
      }

      const categories = puzzleData.categories || [];
      const norm = (s) => normalizeName(s);
      const namesSet = new Set(fighterNames.map(norm));

      let matchedGroup = null;
      let oneAwayGroup = null;
      let oneAwayCount = 0;

      for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        const groupNames = (cat.fighters || []).map(norm);
        const matchCount = fighterNames.filter((n) => groupNames.includes(norm(n))).length;
        if (matchCount === 4) {
          matchedGroup = { color: cat.color || CONNECTIONS_COLORS[i], label: cat.name || cat.label };
          break;
        }
        if (matchCount === 3 && matchCount > oneAwayCount) {
          oneAwayCount = 3;
          oneAwayGroup = { color: cat.color || CONNECTIONS_COLORS[i], label: cat.name || cat.label };
        }
      }

      const isOneAway = !matchedGroup && oneAwayCount === 3;
      if (matchedGroup) {
        return res.json({ valid: true, color: matchedGroup.color, label: matchedGroup.label, isOneAway: false });
      }
      res.json({
        valid: false,
        color: null,
        label: null,
        isOneAway,
      });
    })
    .catch((err) => next(err));
});

module.exports = router;
