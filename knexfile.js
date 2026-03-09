require('dotenv').config();

// Serverless requires minimal pool to avoid connection exhaustion
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

// Use Neon pooler endpoint if available (append ?pgbouncer=true or use pooler subdomain)
let connectionString = process.env.DATABASE_URL;

// Serverless: Use single connection that's released immediately
const poolConfig = isServerless 
  ? { min: 0, max: 1, acquireTimeoutMillis: 5000, idleTimeoutMillis: 500, reapIntervalMillis: 100, propagateCreateError: false }
  : { min: 2, max: 10 };

const config = {
  development: {
    client: 'postgresql',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    },
    pool: { min: 2, max: 10 },
    migrations: {
      directory: './backend/migrations'
    },
    seeds: {
      directory: './backend/seeds'
    }
  },
  production: {
    client: 'postgresql',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    },
    pool: poolConfig,
    acquireConnectionTimeout: 10000,
    migrations: {
      directory: './backend/migrations'
    },
    seeds: {
      directory: './backend/seeds'
    }
  }
};

module.exports = config;