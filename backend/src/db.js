const dns = require('dns');
const { Pool } = require('pg');

// Prefer IPv4 so Render (no outbound IPv6) can reach Supabase
dns.setDefaultResultOrder('ipv4first');

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
};
if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

module.exports = { pool };
