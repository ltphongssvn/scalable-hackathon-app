const { query } = require('../config/database');

async function checkTables() {
  try {
    console.log('🔍 Inspecting database structure...\n');
    
    // List all tables in our database
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    console.log('📊 Tables in your database:');
    tables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Check users table structure
    const columns = await query(`
      SELECT 
        column_name, 
        data_type, 
        character_maximum_length,
        is_nullable, 
        column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n👤 Users table structure:');
    console.log('┌─────────────────┬──────────────┬──────────┬────────────────────────┐');
    console.log('│ Column          │ Type         │ Nullable │ Default                │');
    console.log('├─────────────────┼──────────────┼──────────┼────────────────────────┤');
    
    columns.rows.forEach(col => {
      const columnName = col.column_name.padEnd(15);
      const dataType = col.data_type === 'character varying' 
        ? `varchar(${col.character_maximum_length})`.padEnd(12)
        : col.data_type.padEnd(12);
      const nullable = (col.is_nullable === 'YES' ? 'YES' : 'NO').padEnd(8);
      const defaultVal = (col.column_default || 'none').substring(0, 22).padEnd(22);
      console.log(`│ ${columnName} │ ${dataType} │ ${nullable} │ ${defaultVal} │`);
    });
    console.log('└─────────────────┴──────────────┴──────────┴────────────────────────┘');
    
    // Check indexes
    const indexes = await query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'users' 
      AND schemaname = 'public';
    `);
    
    console.log('\n🔍 Indexes on users table:');
    indexes.rows.forEach(idx => {
      console.log(`  - ${idx.indexname}`);
    });
    
    // Check if our trigger was created
    const triggers = await query(`
      SELECT trigger_name 
      FROM information_schema.triggers 
      WHERE event_object_table = 'users';
    `);
    
    console.log('\n⚡ Triggers on users table:');
    triggers.rows.forEach(trg => {
      console.log(`  - ${trg.trigger_name}`);
    });
    
    // Check the migrations table to see what's been run
    const migrations = await query(`
      SELECT filename, executed_at 
      FROM migrations 
      ORDER BY executed_at;
    `);
    
    console.log('\n📋 Executed migrations:');
    migrations.rows.forEach(mig => {
      const executedAt = new Date(mig.executed_at).toLocaleString();
      console.log(`  - ${mig.filename} (executed: ${executedAt})`);
    });
    
  } catch (error) {
    console.error('❌ Error checking tables:', error.message);
  }
  process.exit(0);
}

checkTables();
