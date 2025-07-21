-- Migration: Add upload_tracking_id column to resumes table
-- This column stores the unique identifier used for real-time progress tracking
-- It allows us to connect a resume upload to its progress tracking session

-- Add the column as nullable first (so existing records won't fail)
ALTER TABLE resumes 
ADD COLUMN IF NOT EXISTS upload_tracking_id VARCHAR(255);

-- Add an index for performance when looking up resumes by tracking ID
-- This is important because the progress system might need to find resumes by their tracking ID
CREATE INDEX IF NOT EXISTS idx_resumes_upload_tracking_id 
ON resumes(upload_tracking_id) 
WHERE upload_tracking_id IS NOT NULL;

-- Add a comment to document the column's purpose
COMMENT ON COLUMN resumes.upload_tracking_id IS 
'Unique identifier for tracking upload progress in real-time. Links to progress tracking sessions.';
