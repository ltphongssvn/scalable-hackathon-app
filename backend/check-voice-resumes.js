require('dotenv').config();
const { Pool } = require('pg');

async function checkDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Connecting to database...');
    
    // First, let's see what tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n=== Tables in your database ===');
    tablesResult.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
    
    // Now let's check if voice_resumes table exists and show its structure
    const voiceTableExists = tablesResult.rows.some(row => 
      row.table_name.toLowerCase().includes('voice')
    );
    
    if (voiceTableExists) {
      const voiceTableName = tablesResult.rows.find(row => 
        row.table_name.toLowerCase().includes('voice')
      ).table_name;
      
      console.log(`\n=== Structure of ${voiceTableName} table ===`);
      const columnsResult = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [voiceTableName]);
      
      columnsResult.rows.forEach(col => {
        console.log(`- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
      
      // Check for the voice resume with ID 18
      console.log(`\n=== Checking for voice resume ID 18 ===`);
      const dataResult = await pool.query(`
        SELECT * FROM ${voiceTableName} WHERE id = 18
      `);
      
      if (dataResult.rows.length > 0) {
        console.log('Found voice resume:', JSON.stringify(dataResult.rows[0], null, 2));
      }
    }
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await pool.end();
    console.log('\nDatabase connection closed.');
  }
}

checkDatabase();
