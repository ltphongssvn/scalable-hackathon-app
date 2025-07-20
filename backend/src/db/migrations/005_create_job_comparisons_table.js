const { query } = require('../../config/database');

/**
 * This migration creates the resume_job_comparisons table with the correct
 * column types to match the existing database schema.
 *
 * Note: This is a follow-up to migration 004 which partially succeeded.
 * The resumes table already has the enhancement columns, so this migration
 * only needs to create the comparisons table.
 */

async function up() {
    console.log('Starting migration: 005_create_job_comparisons_table');

    try {
        // Check if the table already exists
        const checkTable = await query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'resume_job_comparisons'
            )
        `);

        if (checkTable.rows[0].exists) {
            console.log('✓ Table resume_job_comparisons already exists, skipping creation');
            return;
        }

        // Create the comparisons table with integer foreign keys
        console.log('Creating resume_job_comparisons table...');
        await query(`
            CREATE TABLE resume_job_comparisons (
                id SERIAL PRIMARY KEY,
                resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                job_description TEXT NOT NULL,
                job_title VARCHAR(255),
                company_name VARCHAR(255),
                comparison_result JSONB NOT NULL,
                overall_match_score INTEGER CHECK (overall_match_score >= 0 AND overall_match_score <= 100),
                match_quality VARCHAR(20) CHECK (match_quality IN ('excellent', 'good', 'fair', 'poor')),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✓ Table created successfully');

        // Create indexes
        console.log('Creating indexes...');
        await query(`
            CREATE INDEX idx_comparisons_resume_user 
            ON resume_job_comparisons(resume_id, user_id)
        `);
        await query(`
            CREATE INDEX idx_comparisons_created_at 
            ON resume_job_comparisons(created_at DESC)
        `);
        console.log('✓ Indexes created successfully');

        console.log('\n✅ Migration 005_create_job_comparisons_table completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    }
}

async function down() {
    console.log('Rolling back migration: 005_create_job_comparisons_table');

    try {
        await query('DROP TABLE IF EXISTS resume_job_comparisons CASCADE');
        console.log('✅ Rollback completed successfully');
    } catch (error) {
        console.error('❌ Rollback failed:', error);
        throw error;
    }
}

module.exports = { up, down };