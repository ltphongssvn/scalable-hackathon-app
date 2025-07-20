require('dotenv').config();
const { Pool } = require('pg');

async function investigateResumes() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Connecting to database...\n');
    
    // First, let's see the complete structure of the resumes table
    console.log('=== Structure of resumes table ===');
    const columnsResult = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        character_maximum_length,
        column_default,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'resumes'
      ORDER BY ordinal_position
    `);
    
    columnsResult.rows.forEach(col => {
      let typeInfo = col.data_type;
      if (col.character_maximum_length) {
        typeInfo += `(${col.character_maximum_length})`;
      }
      console.log(`- ${col.column_name}: ${typeInfo} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      if (col.column_default) {
        console.log(`  Default: ${col.column_default}`);
      }
    });
    
    // Now let's look for resume with ID 18
    console.log('\n=== Looking for resume ID 18 ===');
    const resume18 = await pool.query(`
      SELECT * FROM resumes WHERE id = 18
    `);
    
    if (resume18.rows.length > 0) {
      console.log('Found resume with ID 18:');
      console.log(JSON.stringify(resume18.rows[0], null, 2));
    } else {
      console.log('No resume found with ID 18');
    }
    
    // Let's check the most recent resumes to understand the pattern
    console.log('\n=== Most recent 5 resumes ===');
    const recentResumes = await pool.query(`
      SELECT id, created_at, 
        CASE 
          WHEN file_path IS NOT NULL THEN 'Has file_path'
          ELSE 'No file_path'
        END as file_status,
        CASE
          WHEN transcription_text IS NOT NULL THEN LENGTH(transcription_text) || ' chars'
          ELSE 'No transcription'
        END as transcription_status
      FROM resumes 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('ID | Created At | File Status | Transcription Status');
    console.log('---|------------|-------------|---------------------');
    recentResumes.rows.forEach(row => {
      console.log(`${row.id} | ${row.created_at} | ${row.file_status} | ${row.transcription_status}`);
    });
    
    // Let's also check if there are any columns that might indicate resume type
    console.log('\n=== Checking for type indicators ===');
    const typeCheck = await pool.query(`
      SELECT DISTINCT 
        resume_type,
        COUNT(*) as count
      FROM resumes
      WHERE resume_type IS NOT NULL
      GROUP BY resume_type
    `).catch(err => {
      // This will fail if resume_type column doesn't exist
      return null;
    });
    
    if (typeCheck && typeCheck.rows.length > 0) {
      console.log('Found resume types:');
      typeCheck.rows.forEach(row => {
        console.log(`- ${row.resume_type}: ${row.count} resumes`);
      });
    } else {
      console.log('No resume_type column found or all values are NULL');
    }
    
  } catch (error) {
    console.error('Database error:', error.message);
    if (error.detail) {
      console.error('Details:', error.detail);
    }
  } finally {
    await pool.end();
    console.log('\nDatabase connection closed.');
  }
}

investigateResumes();
