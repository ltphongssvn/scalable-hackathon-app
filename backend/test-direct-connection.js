require('dotenv').config();
const { Pool } = require('pg');

console.log('Testing direct connection to Neon...');
console.log('Connection string (masked):', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000, // 10 seconds instead of 2
});

async function testConnection() {
  const startTime = Date.now();
  try {
    console.log('Attempting to connect...');
    const client = await pool.connect();
    const connectTime = Date.now() - startTime;
    console.log(`Connected in ${connectTime}ms`);
    
    const result = await client.query('SELECT NOW()');
    console.log('Query successful:', result.rows[0]);
    
    client.release();
    await pool.end();
  } catch (error) {
    const failTime = Date.now() - startTime;
    console.log(`Failed after ${failTime}ms`);
    console.log('Error details:', error.message);
    console.log('Error code:', error.code);
  }
}

testConnection();
