const express = require('express');
const router = express.Router();

// POST /api/scores — submit a score
router.post('/', (req, res) => {
  const body = req.body || {};
  // TODO: insert into user_scores (anonymous_user_id, game_type, puzzle_date, score, completed, attempts, time_seconds)
  res.status(201).json({ ok: true, score: body });
});

// GET /api/scores?anonymousUserId=...&gameType=...&puzzleDate=... — get user scores
router.get('/', (req, res) => {
  const { anonymousUserId, gameType, puzzleDate } = req.query;
  // TODO: query user_scores by filters
  res.json({ scores: [] });
});

module.exports = router;
