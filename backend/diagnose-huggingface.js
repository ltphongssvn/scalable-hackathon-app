// Diagnostic script to test Hugging Face parsing directly
const path = require('path');
require('dotenv').config();

// Import the Hugging Face service directly
const huggingFaceService = require('./src/services/ai/huggingfaceService');

async function diagnoseHuggingFace() {
    console.log('=== Hugging Face Service Diagnostic ===\n');
    
    // Step 1: Check API key
    console.log('1. Checking API Key Configuration:');
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (apiKey) {
        console.log(`✓ API Key found: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
    } else {
        console.log('✗ API Key not found in environment!');
        return;
    }
    console.log('');
    
    // Step 2: Test parsing with our sample PDF
    console.log('2. Testing Resume Parsing:');
    const testFile = './sample-resume.pdf';
    console.log(`   Using file: ${testFile}`);
    
    try {
        console.log('   Starting parse operation...\n');
        
        // Call the parsing service directly
        const result = await huggingFaceService.parseResume(testFile);
        
        if (result.success) {
            console.log('✓ Parsing completed successfully!\n');
            console.log('Extracted Information:');
            console.log(JSON.stringify(result.data, null, 2));
            
            if (result.rawText) {
                console.log('\nFirst 200 characters of extracted text:');
                console.log(result.rawText.substring(0, 200) + '...');
            }
        } else {
            console.log('✗ Parsing failed with error:');
            console.log(result.error);
        }
        
    } catch (error) {
        console.log('✗ Exception during parsing:');
        console.log('Error Type:', error.constructor.name);
        console.log('Error Message:', error.message);
        
        if (error.response) {
            console.log('\nAPI Response Details:');
            console.log('Status:', error.response.status);
            console.log('Status Text:', error.response.statusText);
            if (error.response.data) {
                console.log('Response Data:', JSON.stringify(error.response.data, null, 2));
            }
        }
        
        if (error.code) {
            console.log('Error Code:', error.code);
        }
        
        console.log('\nFull Error Stack:');
        console.log(error.stack);
    }
    
    console.log('\n=== Diagnostic Complete ===');
}

// Run the diagnostic
diagnoseHuggingFace().catch(error => {
    console.error('Diagnostic script error:', error);
});
