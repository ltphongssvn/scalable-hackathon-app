
// Add this to your voiceResumeRoutes.js file

const retryService = require('../services/voiceResumeRetryService');

// Retry failed transcriptions
router.post('/retry-failed', authMiddleware, async (req, res, next) => {
  try {
    const { resumeId } = req.body; // Optional: retry specific resume
    
    // If resumeId provided, verify ownership
    if (resumeId) {
      const ownerCheck = await db.query(
        'SELECT user_id FROM resumes WHERE id = $1 AND resume_type = $2',
        [resumeId, 'voice']
      );
      
      if (ownerCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Voice resume not found' });
      }
      
      if (ownerCheck.rows[0].user_id !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
    }
    
    const result = await retryService.retryFailedTranscriptions(resumeId);
    
    res.json({
      success: true,
      message: result.message,
      processed: result.processed,
      results: result.results
    });
    
  } catch (error) {
    next(error);
  }
});

// Get retry status for user's failed resumes
router.get('/retry-status', authMiddleware, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        id,
        original_name,
        uploaded_at,
        parsed_data->>'error' as error_message,
        parsed_data->>'retryCount' as retry_count,
        parsed_data->>'lastRetry' as last_retry
      FROM resumes 
      WHERE user_id = $1 
      AND resume_type = 'voice' 
      AND transcription_data IS NULL
      ORDER BY uploaded_at DESC
    `, [req.user.id]);
    
    res.json({
      success: true,
      failedResumes: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    next(error);
  }
});
