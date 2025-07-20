
const { processVoiceFile } = require('../services/whisperService');
const { parseResumeText } = require('../services/resumeParsingService');
const db = require('../config/database');

class VoiceResumeRetryService {
  async retryFailedTranscriptions(resumeId = null) {
    try {
      // Build query to find failed voice resumes
      let query = `
        SELECT id, user_id, file_path, filename 
        FROM resumes 
        WHERE resume_type = 'voice' 
        AND transcription_data IS NULL 
        AND parsed_data->>'error' IS NOT NULL
      `;
      
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
      
      console.log(`Found ${result.rows.length} failed transcriptions to retry`);
      
      const retryResults = [];
      
      for (const resume of result.rows) {
        console.log(`Retrying transcription for resume ID: ${resume.id}`);
        
        try {
          // Check if file exists
          const filePath = path.join(process.cwd(), resume.file_path);
          await fs.access(filePath);
          
          // Attempt transcription
          console.log(`Transcribing file: ${resume.filename}`);
          const transcriptionResult = await processVoiceFile(filePath);
          
          if (transcriptionResult.text) {
            // Update database with transcription
            await db.query(`
              UPDATE resumes 
              SET 
                transcription_data = $1,
                transcribed_at = CURRENT_TIMESTAMP
              WHERE id = $2
            `, [
              JSON.stringify({
                text: transcriptionResult.text,
                wordCount: transcriptionResult.wordCount,
                processingTime: transcriptionResult.processingTime,
                quality: transcriptionResult.quality
              }),
              resume.id
            ]);
            
            // Parse the transcribed text
            console.log(`Parsing transcription for resume ID: ${resume.id}`);
            const parsedData = await parseResumeText(transcriptionResult.text, 'voice');
            
            // Update parsed data
            await db.query(`
              UPDATE resumes 
              SET 
                parsed_data = $1,
                parsed_at = CURRENT_TIMESTAMP
              WHERE id = $2
            `, [JSON.stringify(parsedData), resume.id]);
            
            retryResults.push({
              resumeId: resume.id,
              status: 'success',
              message: 'Successfully transcribed and parsed'
            });
          }
        } catch (error) {
          console.error(`Failed to retry resume ${resume.id}:`, error.message);
          
          // Update error information
          await db.query(`
            UPDATE resumes 
            SET parsed_data = $1 
            WHERE id = $2
          `, [
            JSON.stringify({
              error: `Retry failed: ${error.message}`,
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
        message: `Processed ${retryResults.length} resumes`,
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
