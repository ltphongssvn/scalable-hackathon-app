-- Migration: Add Enhancement Features for Voice Resume Processing
-- File: src/db/migrations/003_add_enhancement_features.sql
-- 
-- This migration adds comprehensive tracking, scoring, and comparison capabilities
-- to the voice resume system. It transforms the database from a simple storage
-- system into an intelligent platform that can track processing states,
-- measure confidence in AI predictions, and maintain comparison history.

-- =========================================================================
-- PART 1: Processing Status Tracking
-- =========================================================================

-- Create an enum type for processing stages
-- This ensures data integrity by limiting status values to valid states
-- The order represents the typical flow through the pipeline
CREATE TYPE resume_processing_status AS ENUM (
    'uploaded',      -- Initial state when file is received
    'transcribing',  -- Audio is being converted to text
    'transcribed',   -- Audio successfully converted
    'parsing',       -- Extracting structured data from text
    'parsed',        -- Information successfully extracted
    'enhancing',     -- Adding AI-powered insights
    'enhanced',      -- Enhancement complete
    'completed',     -- All processing finished successfully
    'failed'         -- Processing failed at some stage
    );

-- Add status tracking columns to the resumes table
-- These columns enable real-time monitoring and historical analysis
ALTER TABLE resumes
    ADD COLUMN IF NOT EXISTS processing_status resume_processing_status DEFAULT 'uploaded',
    ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS processing_metadata JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS confidence_scores JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_status_update TIMESTAMP DEFAULT NOW();

-- Add comments to document column purposes
COMMENT ON COLUMN resumes.processing_status IS 'Current processing stage of the resume';
COMMENT ON COLUMN resumes.status_history IS 'Array of status changes with timestamps and metadata';
COMMENT ON COLUMN resumes.processing_metadata IS 'Accumulated metadata from all processing stages';
COMMENT ON COLUMN resumes.confidence_scores IS 'AI confidence scores for various aspects of the resume';
COMMENT ON COLUMN resumes.processing_started_at IS 'When processing began (after upload)';
COMMENT ON COLUMN resumes.processing_completed_at IS 'When processing finished (success or failure)';
COMMENT ON COLUMN resumes.last_status_update IS 'Most recent status change timestamp';

-- Create indexes for efficient status queries
-- These support common query patterns in the application
CREATE INDEX IF NOT EXISTS idx_resumes_processing_status
    ON resumes(processing_status)
    WHERE processing_status NOT IN ('completed', 'failed');  -- Partial index for active items

CREATE INDEX IF NOT EXISTS idx_resumes_user_status
    ON resumes(user_id, processing_status);

CREATE INDEX IF NOT EXISTS idx_resumes_status_update
    ON resumes(last_status_update DESC);

-- =========================================================================
-- PART 2: Status Update Function
-- =========================================================================

-- Create a function to update resume status with automatic history tracking
-- This function ensures consistent status updates and maintains audit trail
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
    -- Get current status for validation
    SELECT processing_status, status_history
    INTO v_current_status, v_status_history
    FROM resumes
    WHERE id = p_resume_id;

    -- Check if resume exists
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Resume % not found', p_resume_id;
    END IF;

    -- Update the resume with new status
    UPDATE resumes
    SET
        processing_status = p_new_status,
        last_status_update = NOW(),
        -- Append new status entry to history array
        status_history = v_status_history || jsonb_build_array(
                jsonb_build_object(
                        'from_status', v_current_status::text,
                        'to_status', p_new_status::text,
                        'timestamp', NOW(),
                        'metadata', p_metadata
                )
                                             ),
        -- Merge new metadata with existing
        processing_metadata = processing_metadata || p_metadata,
        -- Set processing_started_at on first status change from 'uploaded'
        processing_started_at = CASE
                                    WHEN processing_started_at IS NULL AND v_current_status = 'uploaded'
                                        THEN NOW()
                                    ELSE processing_started_at
            END,
        -- Set processing_completed_at when reaching terminal state
        processing_completed_at = CASE
                                      WHEN p_new_status IN ('completed', 'failed') THEN NOW()
                                      ELSE processing_completed_at
            END
    WHERE id = p_resume_id;

    -- Log status change for debugging
    RAISE NOTICE 'Resume % status changed from % to %',
        p_resume_id, v_current_status, p_new_status;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_resume_status IS
    'Updates resume processing status with automatic history tracking and metadata management';

-- =========================================================================
-- PART 3: Resume-Job Comparison Tables
-- =========================================================================

-- Create table to store job comparison results
-- This enables users to compare their resume against multiple job descriptions
CREATE TABLE IF NOT EXISTS resume_job_comparisons (
                                                      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                                                      resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
                                                      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                                      job_description TEXT NOT NULL,
                                                      job_title VARCHAR(255),  -- Extracted or provided job title
                                                      company_name VARCHAR(255),  -- Extracted or provided company name
                                                      comparison_result JSONB NOT NULL,  -- Full comparison analysis
                                                      overall_match_score INTEGER CHECK (overall_match_score >= 0 AND overall_match_score <= 100),
                                                      match_quality VARCHAR(20),  -- 'excellent', 'good', 'fair', 'poor'
                                                      created_at TIMESTAMP DEFAULT NOW(),

    -- Ensure users can only see their own comparisons
                                                      CONSTRAINT resume_job_comparisons_user_check
                                                          CHECK (user_id = (SELECT user_id FROM resumes WHERE id = resume_id))
);

-- Add comments for documentation
COMMENT ON TABLE resume_job_comparisons IS
    'Stores AI-powered comparisons between resumes and job descriptions';
COMMENT ON COLUMN resume_job_comparisons.comparison_result IS
    'Complete analysis including skill matches, experience alignment, and recommendations';
COMMENT ON COLUMN resume_job_comparisons.overall_match_score IS
    'Weighted score from 0-100 indicating fit between resume and job';

-- Create indexes for efficient querying
CREATE INDEX idx_comparisons_resume_user
    ON resume_job_comparisons(resume_id, user_id);

CREATE INDEX idx_comparisons_created_at
    ON resume_job_comparisons(created_at DESC);

CREATE INDEX idx_comparisons_match_score
    ON resume_job_comparisons(overall_match_score DESC);

-- =========================================================================
-- PART 4: Analytics Views
-- =========================================================================

-- Create a view for easy access to resume processing analytics
CREATE OR REPLACE VIEW resume_processing_analytics AS
SELECT
    user_id,
    COUNT(*) as total_resumes,
    COUNT(*) FILTER (WHERE processing_status = 'completed') as completed_resumes,
    COUNT(*) FILTER (WHERE processing_status = 'failed') as failed_resumes,
    COUNT(*) FILTER (WHERE processing_status NOT IN ('completed', 'failed')) as processing_resumes,
    AVG(EXTRACT(EPOCH FROM (processing_completed_at - processing_started_at)))
    FILTER (WHERE processing_completed_at IS NOT NULL) as avg_processing_seconds,
    AVG((confidence_scores->>'overallScore')::numeric)
    FILTER (WHERE confidence_scores IS NOT NULL) as avg_confidence_score,
    MAX(last_status_update) as last_activity
FROM resumes
WHERE resume_type = 'voice'
GROUP BY user_id;

COMMENT ON VIEW resume_processing_analytics IS
    'Aggregated statistics for voice resume processing by user';

-- =========================================================================
-- PART 5: Helper Functions
-- =========================================================================

-- Function to get resume processing statistics for a user
CREATE OR REPLACE FUNCTION get_user_resume_stats(p_user_id UUID)
    RETURNS TABLE (
                      total_resumes INTEGER,
                      completed_resumes INTEGER,
                      failed_resumes INTEGER,
                      processing_resumes INTEGER,
                      avg_processing_time INTERVAL,
                      avg_confidence_score NUMERIC,
                      success_rate NUMERIC
                  ) AS $$
BEGIN
    RETURN QUERY
        SELECT
            COUNT(*)::INTEGER as total_resumes,
            COUNT(*) FILTER (WHERE processing_status = 'completed')::INTEGER as completed_resumes,
            COUNT(*) FILTER (WHERE processing_status = 'failed')::INTEGER as failed_resumes,
            COUNT(*) FILTER (WHERE processing_status NOT IN ('completed', 'failed'))::INTEGER as processing_resumes,
            AVG(processing_completed_at - processing_started_at)
            FILTER (WHERE processing_completed_at IS NOT NULL) as avg_processing_time,
            AVG((confidence_scores->>'overallScore')::numeric)
            FILTER (WHERE confidence_scores IS NOT NULL) as avg_confidence_score,
            CASE
                WHEN COUNT(*) > 0 THEN
                    ROUND(100.0 * COUNT(*) FILTER (WHERE processing_status = 'completed') / COUNT(*), 2)
                ELSE 0
                END as success_rate
        FROM resumes
        WHERE user_id = p_user_id AND resume_type = 'voice';
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- PART 6: Data Migration for Existing Records
-- =========================================================================

-- Update existing resumes to have proper status based on their current state
UPDATE resumes
SET
    processing_status = CASE
                            WHEN parsed_data IS NOT NULL AND parsed_data::text != '{}' THEN 'completed'
                            WHEN transcription_data IS NOT NULL THEN 'parsed'
                            ELSE 'uploaded'
        END,
    processing_started_at = uploaded_at,
    processing_completed_at = CASE
                                  WHEN parsed_data IS NOT NULL AND parsed_data::text != '{}' THEN parsed_at
                                  ELSE NULL
        END
WHERE processing_status IS NULL;

-- Initialize status history for existing records
UPDATE resumes
SET status_history = jsonb_build_array(
        jsonb_build_object(
                'from_status', 'uploaded',
                'to_status', processing_status::text,
                'timestamp', COALESCE(parsed_at, uploaded_at),
                'metadata', jsonb_build_object('migration', true)
        )
                     )
WHERE status_history = '[]'::jsonb OR status_history IS NULL;

-- =========================================================================
-- PART 7: Permissions and Security
-- =========================================================================

-- Ensure row-level security is enabled on new table
ALTER TABLE resume_job_comparisons ENABLE ROW LEVEL SECURITY;

-- Create policy for users to only access their own comparisons
CREATE POLICY resume_job_comparisons_user_policy ON resume_job_comparisons
    FOR ALL
    USING (user_id = current_setting('app.user_id')::uuid);

-- Grant necessary permissions (adjust role names as needed)
-- GRANT SELECT, INSERT ON resume_job_comparisons TO authenticated_user;
-- GRANT EXECUTE ON FUNCTION update_resume_status TO authenticated_user;
-- GRANT EXECUTE ON FUNCTION get_user_resume_stats TO authenticated_user;

-- =========================================================================
-- MIGRATION COMPLETION
-- =========================================================================

-- Add migration completion notice
DO $$
    BEGIN
        RAISE NOTICE 'Migration 003_add_enhancement_features completed successfully';
        RAISE NOTICE 'Added: processing status tracking, confidence scoring, job comparison features';
        RAISE NOTICE 'Updated % existing resume records', (SELECT COUNT(*) FROM resumes WHERE resume_type = 'voice');
    END $$;