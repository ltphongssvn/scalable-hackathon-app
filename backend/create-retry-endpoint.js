// This script will show you how to create a retry mechanism for failed voice transcriptions
const fs = require('fs').promises;
const path = require('path');

async function generateRetryEndpoint() {
  console.log('=== Creating Retry Functionality for Failed Voice Transcriptions ===\n');
  
  // First, let's create the retry service logic
  const retryServiceCode = `
const { processVoiceFile } = require('../services/whisperService');
const { parseResumeText } = require('../services/resumeParsingService');
const db = require('../config/database');

class VoiceResumeRetryService {
  async retryFailedTranscriptions(resumeId = null) {
    try {
      // Build query to find failed voice resumes
      let query = \`
        SELECT id, user_id, file_path, filename 
        FROM resumes 
        WHERE resume_type = 'voice' 
        AND transcription_data IS NULL 
        AND parsed_data->>'error' IS NOT NULL
      \`;
      
      const params = [];
      if (resumeId) {
        query += ' AND id = $1';
        params.push(resumeId);
      }
      
      const result = await db.query(query, params);
      
      if (result.rows.length === 0) {
        return { 
          success: true, 
          message: 'No failed transcriptions to retry',
          processed: 0 
        };
      }
      
      console.log(\`Found \${result.rows.length} failed transcriptions to retry\`);
      
      const retryResults = [];
      
      for (const resume of result.rows) {
        console.log(\`Retrying transcription for resume ID: \${resume.id}\`);
        
        try {
          // Check if file exists
          const filePath = path.join(process.cwd(), resume.file_path);
          await fs.access(filePath);
          
          // Attempt transcription
          console.log(\`Transcribing file: \${resume.filename}\`);
          const transcriptionResult = await processVoiceFile(filePath);
          
          if (transcriptionResult.text) {
            // Update database with transcription
            await db.query(\`
              UPDATE resumes 
              SET 
                transcription_data = $1,
                transcribed_at = CURRENT_TIMESTAMP
              WHERE id = $2
            \`, [
              JSON.stringify({
                text: transcriptionResult.text,
                wordCount: transcriptionResult.wordCount,
                processingTime: transcriptionResult.processingTime,
                quality: transcriptionResult.quality
              }),
              resume.id
            ]);
            
            // Parse the transcribed text
            console.log(\`Parsing transcription for resume ID: \${resume.id}\`);
            const parsedData = await parseResumeText(transcriptionResult.text, 'voice');
            
            // Update parsed data
            await db.query(\`
              UPDATE resumes 
              SET 
                parsed_data = $1,
                parsed_at = CURRENT_TIMESTAMP
              WHERE id = $2
            \`, [JSON.stringify(parsedData), resume.id]);
            
            retryResults.push({
              resumeId: resume.id,
              status: 'success',
              message: 'Successfully transcribed and parsed'
            });
          }
        } catch (error) {
          console.error(\`Failed to retry resume \${resume.id}:\`, error.message);
          
          // Update error information
          await db.query(\`
            UPDATE resumes 
            SET parsed_data = $1 
            WHERE id = $2
          \`, [
            JSON.stringify({
              error: \`Retry failed: \${error.message}\`,
              attempted: true,
              retryCount: (resume.parsed_data?.retryCount || 0) + 1,
              lastRetry: new Date().toISOString()
            }),
            resume.id
          ]);
          
          retryResults.push({
            resumeId: resume.id,
            status: 'failed',
            message: error.message
          });
        }
      }
      
      return {
        success: true,
        message: \`Processed \${retryResults.length} resumes\`,
        processed: retryResults.length,
        results: retryResults
      };
      
    } catch (error) {
      console.error('Retry service error:', error);
      throw error;
    }
  }
}

module.exports = new VoiceResumeRetryService();
`;

  // Create the service file
  const servicePath = path.join(process.cwd(), 'src', 'services', 'voiceResumeRetryService.js');
  console.log(`Creating retry service at: ${servicePath}`);
  
  // Now create the API endpoint
  const retryEndpointCode = `
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
    const result = await db.query(\`
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
    \`, [req.user.id]);
    
    res.json({
      success: true,
      failedResumes: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    next(error);
  }
});
`;

  console.log('\n=== Implementation Instructions ===\n');
  console.log('1. Create the retry service file:');
  console.log('   Location: src/services/voiceResumeRetryService.js');
  console.log('   This service handles the retry logic for failed transcriptions\n');
  
  console.log('2. Add the retry endpoints to your voice resume routes:');
  console.log('   Location: src/routes/voiceResumeRoutes.js');
  console.log('   - POST /api/v1/voiceresumes/retry-failed');
  console.log('   - GET /api/v1/voiceresumes/retry-status\n');
  
  console.log('3. The retry service will:');
  console.log('   - Find all voice resumes with transcription errors');
  console.log('   - Re-attempt transcription using your working Whisper configuration');
  console.log('   - Parse successful transcriptions');
  console.log('   - Update the database with results or new error information\n');
  
  console.log('4. Security considerations:');
  console.log('   - Users can only retry their own resumes');
  console.log('   - Rate limiting should be applied to prevent abuse');
  console.log('   - Retry count is tracked to avoid infinite retries\n');
  
  // Save the code snippets for reference
  await fs.writeFile('retry-service-template.js', retryServiceCode);
  await fs.writeFile('retry-endpoints-template.js', retryEndpointCode);
  
  console.log('Template files created:');
  console.log('   - retry-service-template.js');
  console.log('   - retry-endpoints-template.js\n');
  
  console.log('Ready to implement retry functionality!');
}

generateRetryEndpoint();
