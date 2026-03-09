require('dotenv').config();

// Serverless requires minimal pool to avoid connection exhaustion
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

// Aiven free tier has limited connections (~25)
// Each serverless invocation should use only 1 connection
const poolConfig = isServerless 
  ? { 
      min: 0, 
      max: 1, 
      acquireTimeoutMillis: 10000,
      createTimeoutMillis: 10000,
      idleTimeoutMillis: 100,        // Release idle connections very quickly
      reapIntervalMillis: 50,        // Check for idle connections frequently
      createRetryIntervalMillis: 100,
      propagateCreateError: false    // Don't throw on first failure
    }
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