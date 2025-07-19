// backend/src/db/migrate.js
// Database migration runner
// This tool helps us manage database schema changes in a controlled way

const { query } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

// Create migrations table if it doesn't exist
const createMigrationsTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Migrations table ready');
};

// Get list of executed migrations
const getExecutedMigrations = async () => {
  const result = await query('SELECT filename FROM migrations ORDER BY executed_at');
  return result.rows.map(row => row.filename);
};

// Run a single migration file
const runMigration = async (filename) => {
  const filepath = path.join(__dirname, 'migrations', filename);
  const sql = await fs.readFile(filepath, 'utf8');
  
  console.log(`📄 Running migration: ${filename}`);
  
  try {
    // Execute the migration SQL
    await query(sql);
    
    // Record that this migration has been executed
    await query(
      'INSERT INTO migrations (filename) VALUES ($1)',
      [filename]
    );
    
    console.log(`✅ Migration completed: ${filename}`);
  } catch (error) {
    console.error(`❌ Migration failed: ${filename}`, error.message);
    throw error;
  }
};

// Main migration runner
const runMigrations = async () => {
  try {
    console.log('🔄 Starting database migrations...\n');
    
    // Ensure migrations table exists
    await createMigrationsTable();
    
    // Get all migration files
    const files = await fs.readdir(path.join(__dirname, 'migrations'));
    const migrationFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort(); // Ensure migrations run in order
    
    // Get already executed migrations
    const executedMigrations = await getExecutedMigrations();
    
    // Find pending migrations
    const pendingMigrations = migrationFiles.filter(
      file => !executedMigrations.includes(file)
    );
    
    if (pendingMigrations.length === 0) {
      console.log('✨ No pending migrations');
      return;
    }
    
    console.log(`📋 Found ${pendingMigrations.length} pending migrations\n`);
    
    // Run each pending migration
    for (const migration of pendingMigrations) {
      await runMigration(migration);
    }
    
    console.log('\n✨ All migrations completed successfully');
  } catch (error) {
    console.error('\n❌ Migration process failed:', error.message);
    process.exit(1);
  }
};

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigrations };
