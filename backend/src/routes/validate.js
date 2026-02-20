const express = require('express');
const router = express.Router();

// POST /api/validate — check a grid answer (body: { gameType, puzzleDate, answer, ... })
router.post('/', (req, res) => {
  const { gameType, puzzleDate, answer } = req.body || {};
  // TODO: load puzzle, compare answer, return { correct: boolean, ... }
  res.json({ correct: false, gameType, puzzleDate });
});

module.exports = router;
