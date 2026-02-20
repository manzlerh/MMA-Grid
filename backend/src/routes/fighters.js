const express = require('express');
const router = express.Router();

// Escape LIKE wildcards so % and _ in user input are treated as literal
function escapeLike(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function handleSearch(req, res, next) {
  const raw = (req.query.q || '').trim();
  const pool = req.app.get('pool');
  if (!pool) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  if (!raw) {
    return res.json({ fighters: [] });
  }

  const escaped = escapeLike(raw);
  const pattern = `%${escaped}%`;
  const startsWithPattern = `${escaped}%`;

  const sql = `
    SELECT id, name, nickname, weight_classes, nationality, gym, image_url
    FROM fighters
    WHERE name ILIKE $1
    ORDER BY name ILIKE $2 DESC, name
    LIMIT 10
  `;

  pool.query(sql, [pattern, startsWithPattern])
    .then((result) => res.json({ fighters: result.rows }))
    .catch((err) => next(err));
}

// GET /api/fighters/search?q=... — search fighters (case-insensitive, starts-with or contains)
router.get('/search', handleSearch);

// GET /api/fighters?q=... — search/autocomplete (alias)
router.get('/', handleSearch);

module.exports = router;
module.exports.handleSearch = handleSearch;
