// Quick test script using our newly registered user
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs').promises;

const API_BASE_URL = 'http://localhost:5000/api/v1';

// Use the credentials we just created
const TEST_USER = {
    email: 'testuser1752826561@example.com',
    password: 'testpassword123'
};

// We already have a token from registration, but let's login fresh to test the full flow
async function testResumeUpload() {
    console.log('Testing Resume Upload with newly registered user...\n');
    
    try {
        // Step 1: Login with our new user
        console.log('1. Logging in with our test user...');
        const loginResponse = await axios.post(`${API_BASE_URL}/users/login`, {
            email: TEST_USER.email,
            password: TEST_USER.password
        });
        
        const token = loginResponse.data.data.token;
        console.log('✓ Login successful!\n');
        
        // Step 2: Upload our downloaded PDF resume
        console.log('2. Uploading the sample PDF resume...');
        const formData = new FormData();
        
        // Use the PDF we downloaded earlier
        const pdfBuffer = await fs.readFile('./sample-resume.pdf');
        formData.append('resume', pdfBuffer, 'sample-resume.pdf');
        
        const uploadResponse = await axios.post(
            `${API_BASE_URL}/resumes/upload`,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        console.log('✓ Upload response:', JSON.stringify(uploadResponse.data, null, 2));
        
    } catch (error) {
        console.error('\n✗ Test failed:', error.response?.data || error.message);
        if (error.response?.data?.details) {
            console.error('Details:', error.response.data.details);
        }
    }
}

testResumeUpload();
