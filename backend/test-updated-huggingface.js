// Test script for the updated Hugging Face service
require('dotenv').config();
const huggingFaceService = require('./src/services/ai/huggingfaceService');
const fs = require('fs').promises;

async function testUpdatedService() {
    console.log('Testing updated Hugging Face service...');
    console.log('API Key configured:', process.env.HUGGINGFACE_API_KEY ? 'Yes' : 'No');
    
    // Create a test resume file
    const testResumeContent = `
John Smith
Software Engineer

Contact Information:
Email: john.smith@email.com
Phone: (555) 123-4567

Professional Summary:
Experienced software engineer with 5 years of experience in full-stack development.
Specializing in JavaScript, React, Node.js, and Python.

Work Experience:
Senior Software Engineer - Tech Corp (2021-Present)
- Led development of microservices architecture
- Implemented CI/CD pipelines
- Mentored junior developers

Software Engineer - StartupXYZ (2019-2021)
- Built RESTful APIs using Node.js
- Developed React-based front-end applications

Education:
Bachelor of Science in Computer Science
University of Technology (2015-2019)

Skills:
Programming Languages: JavaScript, Python, Java, TypeScript
Frameworks: React, Node.js, Express, Django
Databases: PostgreSQL, MongoDB, Redis
Tools: Git, Docker, Kubernetes, AWS

Certifications:
- AWS Certified Developer
- Certified Kubernetes Administrator
`;

    // Save this content to a temporary file
    const testFilePath = './test-resume.txt';
    await fs.writeFile(testFilePath, testResumeContent);
    
    console.log('\nCreated test resume file at:', testFilePath);
    console.log('Testing resume parsing...\n');
    
    try {
        // Test the parseResume method
        const result = await huggingFaceService.parseResume(testFilePath);
        
        console.log('Parsing Result:', JSON.stringify(result, null, 2));
        
        if (result.success) {
            console.log('\n✓ Resume parsing successful!');
            console.log('\nExtracted Information:');
            const data = result.data;
            
            if (data.name) console.log(`  Name: ${data.name}`);
            if (data.email) console.log(`  Email: ${data.email}`);
            if (data.phone) console.log(`  Phone: ${data.phone}`);
            if (data.skills) console.log(`  Skills: ${Array.isArray(data.skills) ? data.skills.join(', ') : data.skills}`);
            if (data.currentJob) console.log(`  Current Job: ${data.currentJob}`);
            if (data.education) console.log(`  Education: ${data.education}`);
            if (data.experience) console.log(`  Experience: ${data.experience}`);
        } else {
            console.log('\n✗ Resume parsing failed:', result.error);
        }
        
        // Clean up the test file
        await fs.unlink(testFilePath);
        console.log('\nTest file cleaned up.');
        
    } catch (error) {
        console.error('\n✗ Error during testing:', error);
        // Try to clean up even if there was an error
        try {
            await fs.unlink(testFilePath);
        } catch (cleanupError) {
            console.error('Failed to clean up test file:', cleanupError.message);
        }
    }
}

testUpdatedService();
