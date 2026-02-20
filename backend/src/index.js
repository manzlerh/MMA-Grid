const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');

const { pool } = require('./db');
const fightersRouter = require('./routes/fighters');
const dailyRouter = require('./routes/daily');
const validateRouter = require('./routes/validate');
const scoresRouter = require('./routes/scores');

const app = express();
app.set('pool', pool);

app.use(cors());
app.use(express.json());

app.use('/api/fighters', fightersRouter);
app.use('/api/daily', dailyRouter);
app.use('/api/validate', validateRouter);
app.use('/api/scores', scoresRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
