// Script to check the AI parsing results from our resume upload
const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api/v1';

// We'll use the same credentials from our earlier test
const TEST_USER = {
    email: 'testuser1752826561@example.com',
    password: 'testpassword123'
};

async function checkParsingResults() {
    console.log('Checking AI Resume Parsing Results...\n');
    
    try {
        // Step 1: Login to get fresh token
        console.log('1. Logging in...');
        const loginResponse = await axios.post(`${API_BASE_URL}/users/login`, {
            email: TEST_USER.email,
            password: TEST_USER.password
        });
        
        const token = loginResponse.data.data.token;
        console.log('✓ Login successful\n');
        
        // Step 2: Get list of resumes to see parsing status
        console.log('2. Fetching resume list...');
        const listResponse = await axios.get(
            `${API_BASE_URL}/resumes`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        console.log(`✓ Found ${listResponse.data.count} resume(s)\n`);
        
        // Display summary of each resume
        listResponse.data.data.forEach((resume, index) => {
            console.log(`Resume ${index + 1}:`);
            console.log(`  - Original Name: ${resume.originalName}`);
            console.log(`  - Uploaded At: ${new Date(resume.uploadedAt).toLocaleString()}`);
            console.log(`  - Parsing Status: ${resume.parsingStatus}`);
            
            if (resume.parsedPreview) {
                console.log('  - Extracted Information:');
                console.log(`    • Name: ${resume.parsedPreview.name || 'Not found'}`);
                console.log(`    • Email: ${resume.parsedPreview.email || 'Not found'}`);
                console.log(`    • Skills Count: ${resume.parsedPreview.skillsCount}`);
                console.log(`    • Has Education: ${resume.parsedPreview.hasEducation ? 'Yes' : 'No'}`);
                console.log(`    • Has Experience: ${resume.parsedPreview.hasExperience ? 'Yes' : 'No'}`);
            }
            console.log('');
        });
        
        // Step 3: If we have a parsed resume, get the full details
        const parsedResume = listResponse.data.data.find(r => r.parsingStatus === 'completed');
        
        if (parsedResume) {
            console.log('3. Fetching complete parsed data for resume ID:', parsedResume.id);
            
            const detailResponse = await axios.get(
                `${API_BASE_URL}/resumes/${parsedResume.id}/parsed`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            
            console.log('\n✓ Complete Parsed Data:');
            console.log(JSON.stringify(detailResponse.data.data.parsedData, null, 2));
        } else {
            console.log('\n⏳ No resumes have completed parsing yet.');
            console.log('   The AI parsing might still be in progress.');
            console.log('   Try running this script again in a few moments.');
        }
        
    } catch (error) {
        console.error('\n✗ Error:', error.response?.data || error.message);
    }
}

// Run the check
checkParsingResults();
