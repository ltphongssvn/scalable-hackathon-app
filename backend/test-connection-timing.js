require('dotenv').config();
const { Pool } = require('pg');

console.log('Testing connection timing variability...\n');

async function measureConnectionTime(attemptNumber) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const startTime = Date.now();
  try {
    const client = await pool.connect();
    const connectTime = Date.now() - startTime;
    client.release();
    await pool.end();
    return { success: true, time: connectTime };
  } catch (error) {
    const failTime = Date.now() - startTime;
    return { success: false, time: failTime, error: error.message };
  }
}

async function runTests() {
  const results = [];
  
  console.log('Running 5 connection attempts...');
  for (let i = 1; i <= 5; i++) {
    process.stdout.write(`Attempt ${i}: `);
    const result = await measureConnectionTime(i);
    results.push(result);
    
    if (result.success) {
      console.log(`✓ Connected in ${result.time}ms`);
    } else {
      console.log(`✗ Failed after ${result.time}ms - ${result.error}`);
    }
    
    // Wait a bit between attempts
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Calculate statistics
  const successfulAttempts = results.filter(r => r.success);
  if (successfulAttempts.length > 0) {
    const times = successfulAttempts.map(r => r.time);
    const avgTime = Math.round(times.reduce((a, b) => a + b) / times.length);
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    
    console.log('\nConnection timing statistics:');
    console.log(`  Successful: ${successfulAttempts.length}/${results.length}`);
    console.log(`  Average: ${avgTime}ms`);
    console.log(`  Fastest: ${minTime}ms`);
    console.log(`  Slowest: ${maxTime}ms`);
    console.log(`\nRecommendation: Set connectionTimeoutMillis to at least ${Math.round(maxTime * 1.5)}ms`);
  }
}

runTests();
