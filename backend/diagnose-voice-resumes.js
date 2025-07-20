require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

async function diagnoseVoiceResumes() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Performing detailed diagnosis of voice resumes...\n');
    
    // Get all voice resumes with full details
    const result = await pool.query(`
      SELECT 
        id,
        user_id,
        filename,
        file_path,
        file_size,
        uploaded_at,
        transcribed_at,
        parsed_at,
        transcription_data IS NOT NULL as has_transcription,
        parsed_data IS NOT NULL as has_parsed_data,
        CASE 
          WHEN transcription_data->>'error' IS NOT NULL 
          THEN transcription_data->>'error'
          ELSE NULL
        END as transcription_error
      FROM resumes 
      WHERE resume_type = 'voice'
      ORDER BY id ASC
    `);
    
    console.log('=== Voice Resume Processing Status ===\n');
    
    for (const resume of result.rows) {
      console.log(`Resume ID ${resume.id}:`);
      console.log(`  Uploaded: ${resume.uploaded_at}`);
      console.log(`  User ID: ${resume.user_id}`);
      console.log(`  File Size: ${(resume.file_size / 1024).toFixed(2)} KB`);
      console.log(`  File Path: ${resume.file_path}`);
      
      // Check if file exists on disk
      try {
        const filePath = path.join(process.cwd(), resume.file_path);
        const stats = await fs.stat(filePath);
        console.log(`  File Status: EXISTS (${(stats.size / 1024).toFixed(2)} KB on disk)`);
      } catch (error) {
        console.log(`  File Status: MISSING (${error.code})`);
      }
      
      console.log(`  Processing Status:`);
      console.log(`    - Has Transcription: ${resume.has_transcription ? 'YES' : 'NO'}`);
      console.log(`    - Has Parsed Data: ${resume.has_parsed_data ? 'YES' : 'NO'}`);
      
      if (resume.transcription_error) {
        console.log(`    - Error: ${resume.transcription_error}`);
      }
      
      if (resume.transcribed_at) {
        const transcriptionTime = (new Date(resume.transcribed_at) - new Date(resume.uploaded_at)) / 1000;
        console.log(`    - Transcription Time: ${transcriptionTime.toFixed(1)} seconds`);
      }
      
      if (resume.parsed_at && resume.transcribed_at) {
        const parsingTime = (new Date(resume.parsed_at) - new Date(resume.transcribed_at)) / 1000;
        console.log(`    - Parsing Time: ${parsingTime.toFixed(1)} seconds`);
      }
      
      console.log('');
    }
    
    // Check for any patterns in timing
    console.log('=== Upload Timeline Analysis ===\n');
    result.rows.forEach((resume, index) => {
      if (index > 0) {
        const timeSinceLast = (new Date(resume.uploaded_at) - new Date(result.rows[index-1].uploaded_at)) / 1000 / 60;
        console.log(`Time between ID ${result.rows[index-1].id} and ID ${resume.id}: ${timeSinceLast.toFixed(1)} minutes`);
      }
    });
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await pool.end();
  }
}

diagnoseVoiceResumes();
