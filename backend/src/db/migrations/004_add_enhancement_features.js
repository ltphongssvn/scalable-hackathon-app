// File: src/db/migrations/004_add_enhancement_features.js

const { query } = require('../../config/database');

/**
 * This migration adds three major enhancements to the voice resume system:
 *
 * 1. Real-time Status Tracking: Adds fields to track the resume through each
 *    processing stage, maintaining a complete history of state changes.
 *
 * 2. Confidence Scoring: Stores AI confidence metrics to help users understand
 *    how reliable the automated analysis is.
 *
 * 3. Job Comparison: Creates infrastructure to compare resumes against job
 *    descriptions and maintain a history of these comparisons.
 */

async function up() {
    console.log('Starting migration: 004_add_enhancement_features');
    console.log('This migration will add status tracking, confidence scoring, and job comparison features');

    try {
        // First, let's check if this migration has already been partially applied
        // This makes the migration more robust and re-runnable
        const checkStatusColumn = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'resumes' 
            AND column_name = 'processing_status'
        `);

        if (checkStatusColumn.rows.length > 0) {
            console.log('⚠️  Migration appears to have been partially applied already');
            console.log('Checking what needs to be completed...');
        }

        // Step 1: Create the enum type if it doesn't exist
        // We need to check first because CREATE TYPE doesn't support IF NOT EXISTS
        console.log('\nStep 1: Creating processing status enum type...');
        const checkEnum = await query(`
            SELECT 1 FROM pg_type WHERE typname = 'resume_processing_status'
        `);

        if (checkEnum.rows.length === 0) {
            await query(`
                CREATE TYPE resume_processing_status AS ENUM (
                    'uploaded',      -- File received but not processed
                    'transcribing',  -- Converting audio to text
                    'transcribed',   -- Audio conversion complete
                    'parsing',       -- Extracting structured data
                    'parsed',        -- Basic information extracted
                    'enhancing',     -- Adding AI insights
                    'enhanced',      -- AI analysis complete
                    'completed',     -- All processing finished
                    'failed'         -- Processing encountered an error
                )
            `);
            console.log('✓ Enum type created successfully');
        } else {
            console.log('✓ Enum type already exists, skipping');
        }

        // Step 2: Add columns to track processing state
        console.log('\nStep 2: Adding status tracking columns...');

        // We'll add each column individually to handle cases where some might already exist
        const columnsToAdd = [
            {
                name: 'processing_status',
                definition: 'resume_processing_status DEFAULT \'uploaded\'',
                comment: 'Current stage in the processing pipeline'
            },
            {
                name: 'status_history',
                definition: 'JSONB DEFAULT \'[]\'::jsonb',
                comment: 'Complete history of status changes with timestamps'
            },
            {
                name: 'processing_metadata',
                definition: 'JSONB DEFAULT \'{}\'::jsonb',
                comment: 'Metadata accumulated during processing'
            },
            {
                name: 'confidence_scores',
                definition: 'JSONB DEFAULT \'{}\'::jsonb',
                comment: 'AI confidence scores for various aspects'
            },
            {
                name: 'processing_started_at',
                definition: 'TIMESTAMP',
                comment: 'When processing began'
            },
            {
                name: 'processing_completed_at',
                definition: 'TIMESTAMP',
                comment: 'When processing finished'
            },
            {
                name: 'last_status_update',
                definition: 'TIMESTAMP DEFAULT NOW()',
                comment: 'Most recent status change'
            }
        ];

        for (const column of columnsToAdd) {
            try {
                await query(`
                    ALTER TABLE resumes 
                    ADD COLUMN ${column.name} ${column.definition}
                `);
                console.log(`✓ Added column: ${column.name}`);
            } catch (error) {
                if (error.message.includes('already exists')) {
                    console.log(`✓ Column ${column.name} already exists, skipping`);
                } else {
                    throw error;
                }
            }
        }

        // Step 3: Create performance indexes
        console.log('\nStep 3: Creating indexes for performance...');

        // Index for finding resumes in active processing states
        await query(`
            CREATE INDEX IF NOT EXISTS idx_resumes_processing_status 
            ON resumes(processing_status) 
            WHERE processing_status NOT IN ('completed', 'failed')
        `);
        console.log('✓ Created partial index for active processing states');

        // Index for user queries filtered by status
        await query(`
            CREATE INDEX IF NOT EXISTS idx_resumes_user_status 
            ON resumes(user_id, processing_status)
        `);
        console.log('✓ Created composite index for user status queries');

        // Step 4: Create the status update function
        console.log('\nStep 4: Creating status update function...');
        await query(`
            CREATE OR REPLACE FUNCTION update_resume_status(
                p_resume_id UUID,
                p_new_status resume_processing_status,
                p_metadata JSONB DEFAULT '{}'::jsonb
            )
            RETURNS void AS $$
            DECLARE
                v_current_status resume_processing_status;
                v_status_history JSONB;
            BEGIN
                -- Get current state
                SELECT processing_status, COALESCE(status_history, '[]'::jsonb)
                INTO v_current_status, v_status_history
                FROM resumes 
                WHERE id = p_resume_id;
                
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Resume % not found', p_resume_id;
                END IF;
                
                -- Update with new status and maintain history
                UPDATE resumes
                SET 
                    processing_status = p_new_status,
                    last_status_update = NOW(),
                    status_history = v_status_history || jsonb_build_array(
                        jsonb_build_object(
                            'from_status', COALESCE(v_current_status::text, 'unknown'),
                            'to_status', p_new_status::text,
                            'timestamp', NOW(),
                            'metadata', p_metadata
                        )
                    ),
                    processing_metadata = COALESCE(processing_metadata, '{}'::jsonb) || p_metadata,
                    processing_started_at = CASE 
                        WHEN processing_started_at IS NULL AND v_current_status = 'uploaded' 
                        THEN NOW()
                        ELSE processing_started_at
                    END,
                    processing_completed_at = CASE 
                        WHEN p_new_status IN ('completed', 'failed') THEN NOW()
                        ELSE processing_completed_at
                    END
                WHERE id = p_resume_id;
                
                -- Log the status change
                RAISE NOTICE 'Resume % status: % -> %', p_resume_id, v_current_status, p_new_status;
            END;
            $$ LANGUAGE plpgsql
        `);
        console.log('✓ Status update function created');

        // Step 5: Create the job comparisons table
        console.log('\nStep 5: Creating job comparisons table...');

        const checkComparisonTable = await query(`
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'resume_job_comparisons'
        `);

        if (checkComparisonTable.rows.length === 0) {
            await query(`
                CREATE TABLE resume_job_comparisons (
                    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    job_description TEXT NOT NULL,
                    job_title VARCHAR(255),
                    company_name VARCHAR(255),
                    comparison_result JSONB NOT NULL,
                    overall_match_score INTEGER CHECK (overall_match_score >= 0 AND overall_match_score <= 100),
                    match_quality VARCHAR(20) CHECK (match_quality IN ('excellent', 'good', 'fair', 'poor')),
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);
            console.log('✓ Job comparisons table created');

            // Create indexes for the new table
            await query(`
                CREATE INDEX idx_comparisons_resume_user 
                ON resume_job_comparisons(resume_id, user_id)
            `);
            await query(`
                CREATE INDEX idx_comparisons_created_at 
                ON resume_job_comparisons(created_at DESC)
            `);
            console.log('✓ Indexes created for comparisons table');
        } else {
            console.log('✓ Job comparisons table already exists, skipping');
        }

        // Step 6: Update existing resume records
        console.log('\nStep 6: Updating existing resume records...');

        // Set appropriate status for existing records
        const updateResult = await query(`
            UPDATE resumes
            SET 
                processing_status = CASE
                    WHEN parsed_data IS NOT NULL 
                         AND parsed_data::text != '{}' 
                         AND parsed_data::text != 'null' THEN 'completed'
                    WHEN transcription_data IS NOT NULL 
                         AND transcription_data::text != '{}' 
                         AND transcription_data::text != 'null' THEN 'parsed'
                    ELSE 'uploaded'
                END,
                processing_started_at = COALESCE(processing_started_at, uploaded_at),
                processing_completed_at = CASE
                    WHEN parsed_data IS NOT NULL 
                         AND parsed_data::text != '{}' 
                         AND parsed_data::text != 'null' 
                    THEN COALESCE(processing_completed_at, parsed_at, uploaded_at)
                    ELSE processing_completed_at
                END
            WHERE processing_status IS NULL
            RETURNING id
        `);

        console.log(`✓ Updated ${updateResult.rows.length} existing resume records`);

        // Initialize status history for records that need it
        const historyResult = await query(`
            UPDATE resumes
            SET status_history = jsonb_build_array(
                jsonb_build_object(
                    'from_status', 'uploaded',
                    'to_status', processing_status::text,
                    'timestamp', COALESCE(parsed_at, uploaded_at, NOW()),
                    'metadata', jsonb_build_object('source', 'migration_004')
                )
            )
            WHERE (status_history IS NULL OR status_history = '[]'::jsonb)
            AND processing_status IS NOT NULL
            RETURNING id
        `);

        console.log(`✓ Initialized status history for ${historyResult.rows.length} records`);

        // Final summary
        console.log('\n========================================');
        console.log('✅ Migration 004_add_enhancement_features completed successfully!');
        console.log('========================================');
        console.log('Added features:');
        console.log('  • Real-time processing status tracking');
        console.log('  • AI confidence score storage');
        console.log('  • Resume-job comparison capability');
        console.log('  • Complete audit trail for all operations');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('Full error:', error);
        throw error;
    }
}

/**
 * Rollback function to undo this migration
 * This removes all the features added by the up() function
 */
async function down() {
    console.log('Rolling back migration: 004_add_enhancement_features');

    try {
        // Remove in reverse order of creation
        console.log('Dropping job comparisons table...');
        await query('DROP TABLE IF EXISTS resume_job_comparisons CASCADE');

        console.log('Dropping functions...');
        await query('DROP FUNCTION IF EXISTS update_resume_status CASCADE');

        console.log('Removing columns from resumes table...');
        await query(`
            ALTER TABLE resumes
            DROP COLUMN IF EXISTS processing_status,
            DROP COLUMN IF EXISTS status_history,
            DROP COLUMN IF EXISTS processing_metadata,
            DROP COLUMN IF EXISTS confidence_scores,
            DROP COLUMN IF EXISTS processing_started_at,
            DROP COLUMN IF EXISTS processing_completed_at,
            DROP COLUMN IF EXISTS last_status_update
        `);

        console.log('Dropping enum type...');
        await query('DROP TYPE IF EXISTS resume_processing_status CASCADE');

        console.log('✅ Rollback completed successfully');

    } catch (error) {
        console.error('❌ Rollback failed:', error);
        throw error;
    }
}

module.exports = { up, down };