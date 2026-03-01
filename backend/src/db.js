const dns = require('dns');
const { Pool } = require('pg');

// Force IPv4 resolution
dns.setDefaultResultOrder('ipv4first');

const connectionString = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === 'production';

let poolConfig;

if (connectionString && isProduction) {
  // Force IPv4: Render has no outbound IPv6, Supabase DNS returns IPv6 first → ENETUNREACH.
  // Resolve host to IPv4 and connect by IP so pg never tries IPv6.
  try {
    const url = new URL(connectionString.replace(/^postgresql:\/\//, 'https://'));
    const hostname = url.hostname;
    const resolvedIp = dns.lookupSync(hostname, { family: 4 });
    poolConfig = {
      host: resolvedIp,
      port: url.port || '5432',
      database: (url.pathname || '/postgres').slice(1) || 'postgres',
      user: url.username || undefined,
      password: url.password || undefined,
      ssl: { rejectUnauthorized: false },
    };
  } catch (err) {
    console.warn('[db] IPv4 resolution failed, using connectionString:', err.message);
    poolConfig = { connectionString, ssl: { rejectUnauthorized: false } };
  }
} else if (connectionString) {
  poolConfig = { connectionString };
  if (isProduction) poolConfig.ssl = { rejectUnauthorized: false };
} else {
  poolConfig = { connectionString: '' };
}

const pool = new Pool(poolConfig);

module.exports = { pool };
