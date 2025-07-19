// Test script for Hugging Face service
require('dotenv').config();
const huggingFaceService = require('./src/services/ai/huggingfaceService');

async function testHuggingFaceConnection() {
    console.log('Testing Hugging Face service connection...');
    console.log('API Key configured:', process.env.HUGGINGFACE_API_KEY ? 'Yes' : 'No');
    
    // Test with a simple text to see if the API responds
    try {
        const testResult = await huggingFaceService.parseResumeWithTextGeneration(
            'John Doe\nEmail: john@example.com\nPhone: 555-1234\nSkills: JavaScript, Node.js'
        );
        
        console.log('\nTest Result:', JSON.stringify(testResult, null, 2));
        
        if (testResult.success) {
            console.log('\n✓ Hugging Face service is working correctly!');
        } else {
            console.log('\n✗ Hugging Face service returned an error:', testResult.error);
        }
    } catch (error) {
        console.log('\n✗ Error testing Hugging Face service:', error.message);
    }
}

testHuggingFaceConnection();
