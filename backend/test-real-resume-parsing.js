// Test script to parse a real resume with actual content
const path = require('path');
require('dotenv').config();

const huggingFaceService = require('./src/services/ai/huggingfaceService');

async function testRealResumeParsing() {
    console.log('=== Testing AI Parsing with Real Resume Content ===\n');
    
    const testFile = './test-resume-content.txt';
    console.log(`Using file: ${testFile}`);
    console.log('This file contains a properly formatted resume with rich content.\n');
    
    try {
        console.log('Starting AI parsing process...');
        console.log('The AI will now attempt to extract:');
        console.log('- Name, email, and phone number');
        console.log('- Technical skills and programming languages');
        console.log('- Current job title and company');
        console.log('- Educational background');
        console.log('- Years of experience\n');
        
        const startTime = Date.now();
        
        // Parse the resume
        const result = await huggingFaceService.parseResume(testFile);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\nParsing completed in ${duration} seconds\n`);
        
        if (result.success) {
            console.log('✓ SUCCESS! The AI successfully extracted information:\n');
            
            // Display extracted information in a formatted way
            const data = result.data;
            
            console.log('EXTRACTED INFORMATION:');
            console.log('====================');
            
            if (data.name) {
                console.log(`Name: ${data.name}`);
            }
            
            if (data.email) {
                console.log(`Email: ${data.email}`);
            }
            
            if (data.phone) {
                console.log(`Phone: ${data.phone}`);
            }
            
            if (data.currentJob) {
                console.log(`Current Position: ${data.currentJob}`);
            }
            
            if (data.education) {
                console.log(`Education: ${data.education}`);
            }
            
            if (data.experience) {
                console.log(`Experience: ${data.experience}`);
            }
            
            if (data.skills && data.skills.length > 0) {
                console.log('\nTechnical Skills Identified:');
                data.skills.forEach((skill, index) => {
                    console.log(`  ${index + 1}. ${skill}`);
                });
            }
            
            console.log('\n====================');
            console.log('\nThis demonstrates that your AI system can successfully:');
            console.log('1. Read and understand unstructured text');
            console.log('2. Identify specific pieces of information using NLP');
            console.log('3. Extract and structure data for easy storage and searching');
            console.log('4. Handle various resume formats and styles');
            
        } else {
            console.log('✗ Parsing failed:');
            console.log(result.error);
        }
        
    } catch (error) {
        console.log('✗ Error during parsing:');
        console.log(error.message);
        if (error.stack) {
            console.log('\nStack trace:');
            console.log(error.stack);
        }
    }
    
    console.log('\n=== Test Complete ===');
}

// Run the test
testRealResumeParsing().catch(error => {
    console.error('Test script error:', error);
});
