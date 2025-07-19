// Test script for the complete resume upload and parsing API flow
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs').promises;
const path = require('path');

// Configuration - adjust if your server runs on a different port
const API_BASE_URL = 'http://localhost:5000/api/v1';

// Test credentials - you'll need to update these with a real test user
const TEST_USER = {
    email: 'test@example.com',
    password: 'testpassword123'
};

async function testResumeAPI() {
    console.log('Testing Resume Upload and Parsing API...\n');
    
    try {
        // Step 1: Login to get authentication token
        console.log('1. Logging in to get auth token...');
        const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
            email: TEST_USER.email,
            password: TEST_USER.password
        });
        
        const token = loginResponse.data.token;
        console.log('✓ Login successful, got token\n');
        
        // Step 2: Create a test resume file
        console.log('2. Creating test resume file...');
        const testResumeContent = `Sarah Johnson
Senior Full Stack Developer

Contact: sarah.johnson@techmail.com | (555) 987-6543

PROFESSIONAL SUMMARY
Experienced full-stack developer with 7 years building scalable web applications.
Expert in React, Node.js, Python, and cloud technologies.

WORK EXPERIENCE
Lead Developer - InnovateTech Solutions (2020-Present)
- Architected microservices handling 1M+ daily requests
- Led team of 5 developers on e-commerce platform
- Reduced API response time by 60%

Senior Developer - Digital Dynamics (2018-2020)
- Built React Native mobile app with 50K+ downloads
- Implemented CI/CD pipeline using Jenkins and Docker

EDUCATION
Master of Computer Science - Tech University (2018)
Bachelor of Science in Software Engineering - State College (2016)

TECHNICAL SKILLS
Languages: JavaScript, TypeScript, Python, Java, Go
Frontend: React, Vue.js, Angular, React Native
Backend: Node.js, Express, Django, FastAPI
Databases: PostgreSQL, MongoDB, Redis, Elasticsearch
Cloud: AWS, Google Cloud, Docker, Kubernetes
`;
        
        const testFilePath = './test-resume-api.txt';
        await fs.writeFile(testFilePath, testResumeContent);
        console.log('✓ Test resume created\n');
        
        // Step 3: Upload the resume
        console.log('3. Uploading resume...');
        const formData = new FormData();
        formData.append('resume', await fs.readFile(testFilePath), 'sarah-johnson-resume.txt');
        
        const uploadResponse = await axios.post(
            `${API_BASE_URL}/resume/upload`,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        console.log('✓ Upload response:', JSON.stringify(uploadResponse.data, null, 2));
        const resumeId = uploadResponse.data.data.id;
        console.log(`\nResume ID: ${resumeId}\n`);
        
        // Step 4: Wait a bit for parsing to complete
        console.log('4. Waiting 10 seconds for AI parsing to complete...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Step 5: Fetch the parsed data
        console.log('\n5. Fetching parsed data...');
        const parsedResponse = await axios.get(
            `${API_BASE_URL}/resume/${resumeId}/parsed`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        console.log('✓ Parsed data response:', JSON.stringify(parsedResponse.data, null, 2));
        
        // Step 6: List all resumes to see the status
        console.log('\n6. Listing all resumes...');
        const listResponse = await axios.get(
            `${API_BASE_URL}/resume`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        console.log('✓ Resumes list:', JSON.stringify(listResponse.data, null, 2));
        
        // Cleanup
        await fs.unlink(testFilePath);
        console.log('\n✓ Test completed successfully!');
        
    } catch (error) {
        console.error('\n✗ Test failed:', error.response?.data || error.message);
        
        // Cleanup on error
        try {
            await fs.unlink('./test-resume-api.txt');
        } catch (e) {}
    }
}

// Run the test
testResumeAPI();
