// Database Migration: Add Voice Resume Support
// Location: backend/src/db/migrations/003_add_voice_resume_support.js

async function up(client) {
    await client.query(`
        ALTER TABLE resumes 
        ADD COLUMN IF NOT EXISTS resume_type VARCHAR(20) DEFAULT 'document',
        ADD COLUMN IF NOT EXISTS transcription_data JSON,
        ADD COLUMN IF NOT EXISTS transcribed_at TIMESTAMP;
    `);

    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_resumes_type ON resumes(resume_type);
    `);

    console.log('✓ Added voice resume support columns');
}

async function down(client) {
    await client.query(`
        ALTER TABLE resumes 
        DROP COLUMN IF EXISTS resume_type,
        DROP COLUMN IF EXISTS transcription_data,
        DROP COLUMN IF EXISTS transcribed_at;
    `);

    console.log('✓ Removed voice resume support columns');
}

module.exports = { up, down };