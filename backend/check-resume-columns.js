const { query } = require('./src/config/database');

async function checkResumeColumns() {
    try {
        console.log('Checking resumes table structure...\n');
        
        // Get all columns
        const result = await query(`
            SELECT 
                column_name, 
                data_type, 
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_name = 'resumes'
            ORDER BY ordinal_position
        `);
        
        console.log('Columns in resumes table:');
        console.log('------------------------');
        result.rows.forEach(col => {
            console.log(`${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });
        
        // Check if status column exists
        const hasStatus = result.rows.some(col => col.column_name === 'processing_status');
        console.log(`\nHas processing_status column: ${hasStatus}`);
        
        // Try a simple query
        console.log('\nTesting simple query...');
        const testQuery = await query('SELECT COUNT(*) FROM resumes');
        console.log(`Total resumes: ${testQuery.rows[0].count}`);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkResumeColumns();
