const { Pool } = require('pg');
const config = require('./index');

// Production-ready connection configuration
const poolConfig = {
  connectionString: config.database.url,
  ssl: { rejectUnauthorized: false },
  
  // Connection pool settings
  max: 20,
  min: 2,
  idleTimeoutMillis: 30000,
  
  // Increased timeout for cloud database connections
  connectionTimeoutMillis: 5000,
  
  // Statement timeout to prevent long-running queries
  statement_timeout: 30000,
  
  // Application name for monitoring
  application_name: `hackathon-app-${config.env}`
};

// Create the connection pool
const pool = new Pool(poolConfig);

// Implement connection lifecycle logging
pool.on('connect', (client) => {
  console.log('✅ New client connected to database pool');
});

pool.on('acquire', (client) => {
  console.log('🔄 Client checked out from pool');
});

pool.on('error', (err, client) => {
  // Only log unexpected errors
  if (!err.message.includes('Connection terminated unexpectedly')) {
    console.error('❌ Unexpected database error:', err);
  }
});

pool.on('remove', (client) => {
  console.log('♻️  Client removed from pool');
});

// Enhanced connection test with retry logic
const testConnection = async (retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW() as current_time, current_database() as database');
      client.release();
      
      console.log('🔍 Database connection verified:', {
        time: result.rows[0].current_time,
        database: result.rows[0].database,
        attempt: attempt
      });
      
      return true;
    } catch (error) {
      console.error(`❌ Connection attempt ${attempt} failed:`, error.message);
      
      if (attempt === retries) {
        return false;
      }
      
      // Wait before retrying (exponential backoff)
      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`⏳ Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};

// Export the enhanced interface
module.exports = {
  pool,
  query: pool.query.bind(pool),
  testConnection
};
