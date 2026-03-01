const { Pool } = require('pg');

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
};
if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

module.exports = { pool };
