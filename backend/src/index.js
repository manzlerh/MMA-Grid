const path = require('path');
const nodeEnv = process.env.NODE_ENV || 'development';
require('dotenv').config({ path: path.join(__dirname, '..', `.env.${nodeEnv}`) });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');

const { pool } = require('./db');
const fighters = require('./routes/fighters');
const fightersRouter = fighters;
const fightersSearch = fighters.handleSearch;
const dailyRouter = require('./routes/daily');
const validateRouter = require('./routes/validate');
const scoresRouter = require('./routes/scores');

const app = express();
app.set('pool', pool);

// CORS: comma-separated list; if CORS_ORIGIN_VERCEL_PREVIEWS=true, also allow *.vercel.app preview URLs for same project
const corsOriginRaw = process.env.CORS_ORIGIN || (nodeEnv === 'development' ? 'http://localhost:5173' : '');
const allowedOrigins = corsOriginRaw.split(',').map((o) => o.trim()).filter(Boolean);
const allowVercelPreviews = process.env.CORS_ORIGIN_VERCEL_PREVIEWS === 'true';

function corsOrigin(origin, callback) {
  if (!origin) return callback(null, true); // same-origin or non-browser
  if (allowedOrigins.includes(origin)) return callback(null, true);
  if (allowVercelPreviews && allowedOrigins.length > 0) {
    const prod = allowedOrigins.find((o) => o.includes('.vercel.app'));
    if (prod) {
      const base = prod.replace(/^https:\/\//, '').replace(/\.vercel\.app$/, '');
      if (base && new RegExp(`^https://${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-.+\\.vercel\\.app$`).test(origin)) {
        return callback(null, true);
      }
    }
  }
  callback(null, false);
}

app.use(cors(allowedOrigins.length > 0 || allowVercelPreviews ? { origin: corsOrigin } : { origin: false }));
app.use(express.json());

app.get('/api', (req, res) => res.json({ ok: true, message: 'UFC trivia API' }));

// Debug: test DB connectivity (remove or protect in production)
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ ok: true, now: result.rows[0]?.now });
  } catch (err) {
    console.error('[test-db]', err.message || err);
    if (err.stack) console.error(err.stack);
    res.status(500).json({ error: err.message || 'DB connection failed' });
  }
});

// Explicit route so GET /api/fighters/search is always matched (avoids 404 from router mount)
app.get('/api/fighters/search', fightersSearch);
app.use('/api/fighters', fightersRouter);
app.use('/api/daily', dailyRouter);
app.use('/api/validate', validateRouter);
app.use('/api/scores', scoresRouter);

app.use((err, req, res, next) => {
  console.error('[server error]', err.message || err);
  if (err.stack) console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error', message: err.message || 'An error occurred' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
