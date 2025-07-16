// Database configuration module
// This module handles all database connection logic and provides a clean interface
// for the rest of your application to interact with PostgreSQL

const { Pool } = require('pg');
const config = require('./index');

// PostgreSQL connection pool configuration
// A pool maintains multiple connections and reuses them, which is much more
// efficient than creating a new connection for each query
const poolConfig = {
  connectionString: config.database.url,
  // SSL is required for Neon connections
  ssl: {
    rejectUnauthorized: false
  },
  // Pool size configuration
  max: 20, // Maximum number of clients in the pool
  min: 2,  // Minimum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client can sit idle before being removed
  connectionTimeoutMillis: 5000, // How long to wait when connecting a new client
};

// Create the connection pool
const pool = new Pool(poolConfig);

// Log successful connections (helpful for debugging)
pool.on('connect', (client) => {
  console.log('✅ Connected to PostgreSQL database');
});

// Handle errors on idle clients more gracefully
pool.on('error', (err, client) => {
  // Neon serverless PostgreSQL closes idle connections, which is expected behavior
  if (err.message === 'Connection terminated unexpectedly') {
    if (config.isDevelopment) {
      console.log('🔄 Idle database connection closed by server (normal for Neon)');
    }
    // Don't log scary error messages for expected behavior
    return;
  }
  
  // For other errors, log them as before
  console.error('❌ Database error:', err.message);
});

// Helper function to test the database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    console.log('🔍 Database connection test successful:', result.rows[0].current_time);
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    return false;
  }
};

// Query helper with automatic error handling and logging
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries in development (queries taking more than 100ms)
    if (config.isDevelopment && duration > 100) {
      console.log('🐌 Slow query detected:', {
        text: text.substring(0, 100) + '...', // Truncate long queries
        duration: `${duration}ms`,
        rows: result.rowCount
      });
    }
    
    return result;
  } catch (error) {
    console.error('❌ Database query error:', {
      text,
      error: error.message,
      params
    });
    throw error;
  }
};

// Transaction helper for operations that need to be atomic
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  query,
  transaction,
  testConnection
};
