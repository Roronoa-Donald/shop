require('dotenv').config();

const config = {
  development: {
   client: 'postgresql',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    },
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
    migrations: {
      directory: './backend/migrations'
    },
    seeds: {
      directory: './backend/seeds'
    }
  }
};

module.exports = config;