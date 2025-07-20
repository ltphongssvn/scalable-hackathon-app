require('dotenv').config();
const { Pool } = require('pg');

async function examineParsedData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Examining the parsed_data content for all voice resumes...\n');
    
    // Get all voice resumes with their data
    const result = await pool.query(`
      SELECT 
        id,
        uploaded_at,
        transcription_data,
        parsed_data,
        transcribed_at,
        parsed_at
      FROM resumes 
      WHERE resume_type = 'voice'
      ORDER BY id ASC
    `);
    
    console.log('=== Detailed Content Analysis ===\n');
    
    result.rows.forEach(resume => {
      console.log(`Resume ID ${resume.id} (Uploaded: ${new Date(resume.uploaded_at).toLocaleString()}):`);
      
      // Check transcription data
      console.log('\n  Transcription Data:');
      if (resume.transcription_data) {
        console.log('    Has transcription: YES');
        if (resume.transcription_data.text) {
          console.log(`    Text length: ${resume.transcription_data.text.length} characters`);
          console.log(`    First 100 chars: "${resume.transcription_data.text.substring(0, 100)}..."`);
        }
        if (resume.transcription_data.error) {
          console.log(`    Error: ${resume.transcription_data.error}`);
        }
      } else {
        console.log('    Has transcription: NO');
      }
      
      // Check parsed data
      console.log('\n  Parsed Data:');
      if (resume.parsed_data) {
        console.log('    Content:', JSON.stringify(resume.parsed_data, null, 4));
        
        // Analyze what fields are present
        const fields = Object.keys(resume.parsed_data);
        console.log(`    Fields present: ${fields.join(', ')}`);
        
        // Check for signs of actual vs placeholder data
        const hasActualContent = fields.some(field => 
          resume.parsed_data[field] && 
          resume.parsed_data[field] !== '' &&
          resume.parsed_data[field] !== 'Not specified'
        );
        console.log(`    Appears to have actual content: ${hasActualContent ? 'YES' : 'NO'}`);
      } else {
        console.log('    No parsed data');
      }
      
      console.log('\n  Timestamps:');
      console.log(`    Uploaded at: ${resume.uploaded_at}`);
      console.log(`    Transcribed at: ${resume.transcribed_at || 'Never'}`);
      console.log(`    Parsed at: ${resume.parsed_at || 'Never'}`);
      
      console.log('\n' + '='.repeat(70) + '\n');
    });
    
    // Look for patterns in the parsed_data
    console.log('=== Pattern Analysis ===\n');
    
    const parsedDataPatterns = result.rows.map(r => ({
      id: r.id,
      hasTranscription: !!r.transcription_data,
      parsedDataKeys: r.parsed_data ? Object.keys(r.parsed_data).sort().join(',') : 'none'
    }));
    
    console.log('Checking if all parsed_data structures have the same fields...');
    const uniquePatterns = [...new Set(parsedDataPatterns.map(p => p.parsedDataKeys))];
    
    if (uniquePatterns.length === 1) {
      console.log('All resumes have identical parsed_data structure');
    } else {
      console.log('Different parsed_data structures found:');
      uniquePatterns.forEach((pattern, index) => {
        const resumesWithPattern = parsedDataPatterns.filter(p => p.parsedDataKeys === pattern);
        console.log(`  Pattern ${index + 1}: ${pattern}`);
        console.log(`    Used by resumes: ${resumesWithPattern.map(r => r.id).join(', ')}`);
      });
    }
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await pool.end();
  }
}

examineParsedData();
