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

const corsOrigin = process.env.CORS_ORIGIN || (nodeEnv === 'development' ? 'http://localhost:5173' : undefined);
app.use(cors(corsOrigin != null ? { origin: corsOrigin } : { origin: false }));
app.use(express.json());

app.get('/api', (req, res) => res.json({ ok: true, message: 'UFC trivia API' }));

// Explicit route so GET /api/fighters/search is always matched (avoids 404 from router mount)
app.get('/api/fighters/search', fightersSearch);
app.use('/api/fighters', fightersRouter);
app.use('/api/daily', dailyRouter);
app.use('/api/validate', validateRouter);
app.use('/api/scores', scoresRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
