// Debug script to check the exact format of resume data from the backend
const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api/v1';
const TEST_USER = {
    email: 'testuser1752826561@example.com',
    password: 'testpassword123'
};

async function checkDataFormat() {
    try {
        // Login first
        const loginResponse = await axios.post(`${API_BASE_URL}/users/login`, {
            email: TEST_USER.email,
            password: TEST_USER.password
        });
        
        const token = loginResponse.data.data.token;
        
        // Get resumes
        const resumesResponse = await axios.get(`${API_BASE_URL}/resumes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('Raw resume data from backend:');
        console.log(JSON.stringify(resumesResponse.data, null, 2));
        
        // Check the first resume's date fields
        if (resumesResponse.data.data && resumesResponse.data.data.length > 0) {
            const firstResume = resumesResponse.data.data[0];
            console.log('\nFirst resume date fields:');
            console.log('uploaded_at:', firstResume.uploadedAt, typeof firstResume.uploadedAt);
            console.log('parsed_at:', firstResume.parsedAt, typeof firstResume.parsedAt);
            
            // Try parsing the date
            console.log('\nDate parsing test:');
            try {
                const date = new Date(firstResume.uploadedAt);
                console.log('Parsed date:', date);
                console.log('Is valid date?', !isNaN(date.getTime()));
            } catch (error) {
                console.log('Date parsing error:', error.message);
            }
        }
        
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

checkDataFormat();
