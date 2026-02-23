const express = require('express');
const router = express.Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Compute consecutive days with at least one completed game going back from today.
 * @param {string[]} completedDates - sorted unique dates (YYYY-MM-DD) when user completed at least one game
 * @param {string} fromDate - start date (e.g. today UTC)
 * @returns {number}
 */
function computeStreakFrom(completedDates, fromDate) {
  const set = new Set(completedDates);
  let streak = 0;
  let d = new Date(fromDate + 'T12:00:00Z');
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (set.has(key)) {
      streak++;
      d.setUTCDate(d.getUTCDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/**
 * From a list of dates (YYYY-MM-DD), find longest run of consecutive calendar days.
 * @param {string[]} dates - unique dates, any order
 * @returns {number}
 */
function longestConsecutiveDayStreak(dates) {
  if (dates.length === 0) return 0;
  const sorted = [...new Set(dates)].sort();
  let max = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T12:00:00Z').getTime();
    const curr = new Date(sorted[i] + 'T12:00:00Z').getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    if (curr - prev === oneDay) {
      run++;
      max = Math.max(max, run);
    } else {
      run = 1;
    }
  }
  return max;
}

// POST /api/scores — submit a score
router.post('/', async (req, res) => {
  const pool = req.app.get('pool');
  if (!pool) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const body = req.body || {};

  const errors = {};
  const anonymousUserId = typeof body.anonymousUserId === 'string' ? body.anonymousUserId.trim() : '';
  if (!anonymousUserId) errors.anonymousUserId = 'Required';
  else if (!UUID_REGEX.test(anonymousUserId)) errors.anonymousUserId = 'Must be a valid UUID';

  const gameType = typeof body.gameType === 'string' ? body.gameType.toLowerCase().trim() : '';
  if (!gameType) errors.gameType = 'Required';
  else if (gameType !== 'grid' && gameType !== 'connections') errors.gameType = 'Must be "grid" or "connections"';

  const puzzleDate = typeof body.puzzleDate === 'string' ? body.puzzleDate.trim() : '';
  if (!puzzleDate) errors.puzzleDate = 'Required';
  else if (!DATE_REGEX.test(puzzleDate)) errors.puzzleDate = 'Must be YYYY-MM-DD';

  let score = null;
  if (body.score == null) errors.score = 'Required';
  else {
    score = Number(body.score);
    if (Number.isNaN(score) || !Number.isInteger(score)) errors.score = 'Must be an integer';
  }

  if (typeof body.completed !== 'boolean') errors.completed = 'Required and must be boolean';

  let attempts = null;
  if (body.attempts == null) errors.attempts = 'Required';
  else {
    attempts = Number(body.attempts);
    if (Number.isNaN(attempts) || !Number.isInteger(attempts)) errors.attempts = 'Must be an integer';
  }

  let timeSeconds = null;
  if (body.timeSeconds != null) {
    timeSeconds = Number(body.timeSeconds);
    if (Number.isNaN(timeSeconds) || !Number.isInteger(timeSeconds)) errors.timeSeconds = 'Must be an integer';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: 'Validation failed', fields: errors });
  }

  try {
    const existsSql = `
      SELECT 1 FROM user_scores
      WHERE anonymous_user_id = $1::uuid AND game_type = $2 AND puzzle_date = $3::date
      LIMIT 1
    `;
    const existsResult = await pool.query(existsSql, [anonymousUserId, gameType, puzzleDate]);
    if (existsResult.rows.length > 0) {
      return res.status(409).json({ error: 'Already submitted' });
    }

    const insertSql = `
      INSERT INTO user_scores (anonymous_user_id, game_type, puzzle_date, score, completed, attempts, time_seconds)
      VALUES ($1::uuid, $2, $3::date, $4, $5, $6, $7)
      RETURNING id
    `;
    const insertResult = await pool.query(insertSql, [
      anonymousUserId,
      gameType,
      puzzleDate,
      score,
      body.completed,
      attempts,
      timeSeconds,
    ]);
    const scoreId = insertResult.rows[0].id;

    const sixtyDaysSql = `
      SELECT DISTINCT puzzle_date::text AS d
      FROM user_scores
      WHERE anonymous_user_id = $1::uuid
        AND completed = true
        AND puzzle_date >= (CURRENT_DATE - INTERVAL '60 days')
      ORDER BY d DESC
    `;
    const sixtyResult = await pool.query(sixtyDaysSql, [anonymousUserId]);
    const completedDates = sixtyResult.rows.map((r) => r.d);
    const streak = computeStreakFrom(completedDates, todayUTC());

    return res.status(201).json({ success: true, streak, scoreId });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save score' });
  }
});

// GET /api/scores/stats/:anonymousUserId
router.get('/stats/:anonymousUserId', async (req, res) => {
  const pool = req.app.get('pool');
  if (!pool) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const anonymousUserId = (req.params.anonymousUserId || '').trim();
  if (!UUID_REGEX.test(anonymousUserId)) {
    return res.status(400).json({ error: 'Invalid userId format' });
  }

  try {
    const sql = `
      SELECT game_type, puzzle_date::text AS puzzle_date, score, completed, attempts, played_at
      FROM user_scores
      WHERE anonymous_user_id = $1::uuid
      ORDER BY played_at DESC
    `;
    const result = await pool.query(sql, [anonymousUserId]);
    const rows = result.rows;

    const emptyStats = {
      totalGamesPlayed: 0,
      totalGamesCompleted: 0,
      completionRate: 0,
      currentStreak: 0,
      longestStreak: 0,
      gridStats: { played: 0, completed: 0, avgScore: 0, bestScore: 0, avgAttempts: 0 },
      connectionsStats: { played: 0, completed: 0, avgScore: 0, bestScore: 0, avgAttempts: 0 },
      recentGames: [],
      scoresByDate: {},
    };

    if (rows.length === 0) {
      return res.json(emptyStats);
    }

    const totalGamesPlayed = rows.length;
    const totalGamesCompleted = rows.filter((r) => r.completed).length;
    const completionRate = totalGamesPlayed ? Math.round((100 * totalGamesCompleted) / totalGamesPlayed) : 0;

    const completedDates = [...new Set(rows.filter((r) => r.completed).map((r) => r.puzzle_date))];
    const currentStreak = computeStreakFrom(completedDates, todayUTC());
    const longestStreak = longestConsecutiveDayStreak(completedDates);

    function gameStats(list) {
      const completedList = list.filter((r) => r.completed);
      const played = list.length;
      const completed = completedList.length;
      const scores = completedList.map((r) => r.score).filter((s) => s != null && !Number.isNaN(s));
      const attemptsList = completedList.map((r) => r.attempts).filter((a) => a != null && !Number.isNaN(a));
      const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const bestScore = scores.length ? Math.max(...scores) : 0;
      const avgAttempts = attemptsList.length ? Math.round((attemptsList.reduce((a, b) => a + b, 0) * 10) / attemptsList.length) / 10 : 0;
      return { played, completed, avgScore, bestScore, avgAttempts };
    }

    const gridRows = rows.filter((r) => r.game_type === 'grid');
    const connectionsRows = rows.filter((r) => r.game_type === 'connections');
    const gridStats = gameStats(gridRows);
    const connectionsStats = gameStats(connectionsRows);

    const recentGames = rows.slice(0, 10).map((r) => ({
      gameType: r.game_type,
      puzzleDate: r.puzzle_date,
      score: r.score,
      completed: r.completed,
      attempts: r.attempts,
      playedAt: r.played_at,
    }));

    const scoresByDate = {};
    for (const r of rows) {
      const d = r.puzzle_date;
      if (!scoresByDate[d]) scoresByDate[d] = [];
      scoresByDate[d].push({
        gameType: r.game_type,
        puzzleDate: r.puzzle_date,
        score: r.score,
        completed: r.completed,
        attempts: r.attempts,
        playedAt: r.played_at,
      });
    }

    return res.json({
      totalGamesPlayed,
      totalGamesCompleted,
      completionRate,
      currentStreak,
      longestStreak,
      gridStats,
      connectionsStats,
      recentGames,
      scoresByDate,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load stats' });
  }
});

// GET /api/scores/daily/:gameType/:puzzleDate — aggregate stats for a specific puzzle (public, cacheable)
router.get('/daily/:gameType/:puzzleDate', async (req, res) => {
  const pool = req.app.get('pool');
  if (!pool) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const gameType = (req.params.gameType || '').toLowerCase();
  if (gameType !== 'grid' && gameType !== 'connections') {
    return res.status(400).json({ error: 'gameType must be "grid" or "connections"' });
  }

  const puzzleDate = (req.params.puzzleDate || '').trim();
  if (!DATE_REGEX.test(puzzleDate)) {
    return res.status(400).json({ error: 'puzzleDate must be YYYY-MM-DD' });
  }

  res.set('Cache-Control', 'public, max-age=300');

  try {
    const allSql = `
      SELECT score, completed, attempts
      FROM user_scores
      WHERE game_type = $1 AND puzzle_date = $2::date
    `;
    const result = await pool.query(allSql, [gameType, puzzleDate]);
    const rows = result.rows;

    const totalPlayers = rows.length;
    const completers = rows.filter((r) => r.completed);
    const completionRate = totalPlayers ? Math.round((100 * completers.length) / totalPlayers) : 0;

    const scores = completers.map((r) => r.score).filter((s) => s != null && !Number.isNaN(s));
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    const attemptsList = completers.map((r) => r.attempts).filter((a) => a != null && !Number.isNaN(a));
    const avgAttempts = attemptsList.length ? Math.round((attemptsList.reduce((a, b) => a + b, 0) * 10) / attemptsList.length) / 10 : 0;

    const scoreDistribution = {
      under200: 0,
      '200to400': 0,
      '400to600': 0,
      '600to800': 0,
      over800: 0,
    };
    for (const s of scores) {
      if (s < 200) scoreDistribution.under200++;
      else if (s < 400) scoreDistribution['200to400']++;
      else if (s < 600) scoreDistribution['400to600']++;
      else if (s < 800) scoreDistribution['600to800']++;
      else scoreDistribution.over800++;
    }

    return res.json({
      totalPlayers,
      completionRate,
      avgScore,
      scoreDistribution,
      avgAttempts,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load daily stats' });
  }
});

// GET /api/scores?anonymousUserId=...&gameType=...&puzzleDate=... — get user scores (legacy)
router.get('/', async (req, res) => {
  const pool = req.app.get('pool');
  if (!pool) {
    return res.status(500).json({ error: 'Database not configured' });
  }
  const { anonymousUserId, gameType, puzzleDate } = req.query;
  if (!anonymousUserId) {
    return res.json({ scores: [] });
  }
  try {
    let sql = 'SELECT * FROM user_scores WHERE anonymous_user_id = $1::uuid';
    const params = [anonymousUserId];
    let n = 2;
    if (gameType) {
      sql += ` AND game_type = $${n}`;
      params.push(gameType);
      n++;
    }
    if (puzzleDate) {
      sql += ` AND puzzle_date = $${n}::date`;
      params.push(puzzleDate);
    }
    sql += ' ORDER BY played_at DESC';
    const result = await pool.query(sql, params);
    return res.json({ scores: result.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load scores' });
  }
});

module.exports = router;
