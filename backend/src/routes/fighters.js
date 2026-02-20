const express = require('express');
const router = express.Router();

// GET /api/fighters?q=... — search/autocomplete
router.get('/', (req, res) => {
  const q = req.query.q || '';
  // TODO: query fighters by name (ILIKE), return matches
  res.json({ fighters: [], query: q });
});

module.exports = router;
