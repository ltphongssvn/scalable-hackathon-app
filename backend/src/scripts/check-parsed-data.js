// Diagnostic script to check parsed data storage
// This script helps us understand how resume parsing results are being stored in the database
// and identify any issues with data serialization

require('dotenv').config();
const { query } = require('../config/database');

async function checkParsedData() {
    try {
        console.log('🔍 Checking parsed resume data...\n');
        console.log('===============================================\n');

        // First, let's check if we have any resumes at all
        const countResult = await query('SELECT COUNT(*) as total FROM resumes');
        console.log(`Total resumes in database: ${countResult.rows[0].total}\n`);

        // Query the resumes with parsing results
        // We're specifically looking at resumes 10, 11, and 12 which showed errors
        const result = await query(`
            SELECT 
                id, 
                original_name,
                parsed_at,
                parsed_data,
                LENGTH(parsed_data::text) as data_length,
                pg_typeof(parsed_data) as data_type
            FROM resumes 
            WHERE id IN (10, 11, 12) 
            ORDER BY id DESC
        `);

        console.log(`Found ${result.rows.length} resumes with IDs 10, 11, 12:\n`);

        // Analyze each resume's parsed data
        for (const resume of result.rows) {
            console.log(`📄 Resume ID: ${resume.id}`);
            console.log(`   File: ${resume.original_name}`);
            console.log(`   Parsed at: ${resume.parsed_at || 'Not parsed'}`);
            console.log(`   PostgreSQL data type: ${resume.data_type}`);
            console.log(`   Data length: ${resume.data_length} characters`);

            // Show the raw data as stored in the database
            console.log(`   Raw data from DB: ${resume.parsed_data}`);
            console.log(`   Type of raw data: ${typeof resume.parsed_data}`);

            // Try to understand what's in the parsed_data field
            if (resume.parsed_data) {
                // First, let's see if it's already an object (which would be unexpected)
                if (typeof resume.parsed_data === 'object') {
                    console.log(`   ⚠️  Data is already an object (not a string)!`);
                    console.log(`   Object content:`, resume.parsed_data);
                } else {
                    // It should be a string, so let's try to parse it
                    try {
                        const parsed = JSON.parse(resume.parsed_data);
                        console.log(`   ✅ Successfully parsed JSON!`);
                        console.log(`   Parsed content:`, JSON.stringify(parsed, null, 2));

                        // Check if it's an error object
                        if (parsed.error) {
                            console.log(`   ⚠️  This is an error record:`, parsed.error);
                        } else {
                            // Show what was extracted
                            console.log(`   Extracted fields:`);
                            if (parsed.name) console.log(`     - Name: ${parsed.name}`);
                            if (parsed.email) console.log(`     - Email: ${parsed.email}`);
                            if (parsed.phone) console.log(`     - Phone: ${parsed.phone}`);
                            if (parsed.skills) console.log(`     - Skills: ${Array.isArray(parsed.skills) ? parsed.skills.length : 0} found`);
                            if (parsed.currentJob) console.log(`     - Current Job: ${parsed.currentJob}`);
                            if (parsed.education) console.log(`     - Education: ${parsed.education}`);
                            if (parsed.experience) console.log(`     - Experience: ${parsed.experience}`);
                        }
                    } catch (e) {
                        console.log(`   ❌ Failed to parse as JSON: ${e.message}`);

                        // Let's see what's actually in there
                        const dataStr = String(resume.parsed_data);
                        console.log(`   First 200 chars: "${dataStr.substring(0, 200)}"`);

                        // Check for common serialization issues
                        if (dataStr === '[object Object]') {
                            console.log(`   🐛 BUG DETECTED: Data was stored as "[object Object]"`);
                            console.log(`      This happens when an object is converted to string without JSON.stringify()`);
                        } else if (dataStr.includes('\\') && dataStr.includes('"')) {
                            console.log(`   🐛 Possible double-encoding detected (escaped quotes found)`);
                        }
                    }
                }
            } else {
                console.log(`   No parsed data found (NULL)`);
            }

            console.log('   ' + '='.repeat(50));
        }

        // Let's also check one resume that hasn't been parsed yet
        console.log('\n📊 Checking an unparsed resume for comparison:');
        const unparsedResult = await query(`
            SELECT id, original_name, parsed_at, parsed_data 
            FROM resumes 
            WHERE parsed_at IS NULL 
            LIMIT 1
        `);

        if (unparsedResult.rows.length > 0) {
            const unparsed = unparsedResult.rows[0];
            console.log(`   Resume ID ${unparsed.id}: ${unparsed.original_name}`);
            console.log(`   Parsed data: ${unparsed.parsed_data || 'NULL (as expected)'}`);
        }

        console.log('\n✅ Diagnostic check complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error checking parsed data:', error);
        console.error('   Error details:', error.message);
        console.error('   Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the diagnostic check
console.log('Starting diagnostic check of resume parsing data...\n');
checkParsedData();