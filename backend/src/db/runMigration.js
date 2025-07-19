// Simple Migration Runner
// Location: backend/src/db/runMigration.js

require('dotenv').config();
const { query } = require('../config/database');

async function runMigration() {
    const migrationFile = process.argv[2];

    if (!migrationFile) {
        console.error('Please specify a migration file');
        process.exit(1);
    }

    try {
        const migration = require(`./migrations/${migrationFile}`);

        console.log(`Running migration: ${migrationFile}`);
        await migration.up({ query });

        console.log('Migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();