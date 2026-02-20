const express = require('express');
const router = express.Router();

// GET /api/daily?gameType=grid|connections — get today's puzzle by game type
router.get('/', (req, res) => {
  const gameType = req.query.gameType || 'grid';
  // TODO: fetch from daily_puzzles where puzzle_date = today and game_type = gameType
  res.json({ gameType, puzzle: null });
});

module.exports = router;
