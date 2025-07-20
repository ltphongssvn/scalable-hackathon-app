require('dotenv').config();
const { Pool } = require('pg');

async function checkAllVoiceResumes() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Retrieving all voice resumes from the database...\n');
    
    const result = await pool.query(`
      SELECT 
        id,
        user_id,
        original_name,
        uploaded_at,
        transcribed_at,
        transcription_data->>'wordCount' as word_count,
        transcription_data->'quality'->>'score' as quality_score,
        parsed_data->>'name' as candidate_name,
        parsed_data->>'email' as candidate_email
      FROM resumes 
      WHERE resume_type = 'voice'
      ORDER BY uploaded_at DESC
    `);
    
    console.log(`Found ${result.rows.length} voice resume(s) in the system:\n`);
    
    result.rows.forEach((resume, index) => {
      console.log(`Voice Resume #${index + 1}:`);
      console.log(`  ID: ${resume.id}`);
      console.log(`  Candidate: ${resume.candidate_name || 'Not extracted'}`);
      console.log(`  Email: ${resume.candidate_email || 'Not extracted'}`);
      console.log(`  Original File: ${resume.original_name}`);
      console.log(`  Word Count: ${resume.word_count || 'N/A'}`);
      console.log(`  Quality Score: ${resume.quality_score || 'N/A'}`);
      console.log(`  Processing Time: ${
        resume.transcribed_at && resume.uploaded_at 
          ? Math.round((new Date(resume.transcribed_at) - new Date(resume.uploaded_at)) / 1000) + ' seconds'
          : 'N/A'
      }`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAllVoiceResumes();
