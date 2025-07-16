// Test script to verify Neon database connection
const { testConnection, query } = require('./config/database');

async function runDatabaseTests() {
  console.log('🚀 Starting database connection tests...\n');
  
  // Test 1: Basic connection test
  console.log('Test 1: Basic Connection');
  const isConnected = await testConnection();
  if (!isConnected) {
    console.error('❌ Failed to connect to database. Exiting tests.');
    process.exit(1);
  }
  
  // Test 2: Create a test table
  console.log('\nTest 2: Creating test table');
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS connection_test (
        id SERIAL PRIMARY KEY,
        test_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Test table created successfully');
  } catch (error) {
    console.error('❌ Failed to create test table:', error.message);
  }
  
  // Test 3: Insert test data
  console.log('\nTest 3: Inserting test data');
  try {
    const result = await query(
      'INSERT INTO connection_test (test_name) VALUES ($1) RETURNING *',
      ['Initial connection test from Node.js']
    );
    console.log('✅ Test data inserted:', result.rows[0]);
  } catch (error) {
    console.error('❌ Failed to insert test data:', error.message);
  }
  
  // Test 4: Query test data
  console.log('\nTest 4: Querying test data');
  try {
    const result = await query('SELECT COUNT(*) as count FROM connection_test');
    console.log('✅ Found', result.rows[0].count, 'test records');
  } catch (error) {
    console.error('❌ Failed to query test data:', error.message);
  }
  
  // Test 5: Check Neon-specific features
  console.log('\nTest 5: Checking Neon-specific information');
  try {
    const versionResult = await query('SELECT version()');
    console.log('✅ PostgreSQL version:', versionResult.rows[0].version);
    
    const connectionResult = await query("SELECT current_database(), current_user, inet_server_addr()");
    console.log('✅ Connection info:', connectionResult.rows[0]);
  } catch (error) {
    console.error('❌ Failed to get database info:', error.message);
  }
  
  // Cleanup
  console.log('\nCleaning up test data...');
  try {
    await query('DROP TABLE IF EXISTS connection_test');
    console.log('✅ Test table dropped successfully');
  } catch (error) {
    console.error('❌ Failed to drop test table:', error.message);
  }
  
  console.log('\n✨ All database tests completed!');
  process.exit(0);
}

// Run the tests
runDatabaseTests().catch(error => {
  console.error('❌ Unexpected error during tests:', error);
  process.exit(1);
});
