require('dotenv').config();

async function testEnhancement() {
  console.log('=== Testing Hugging Face Enhancement ===\n');
  
  // Check if API key is configured
  if (!process.env.HUGGINGFACE_API_KEY) {
    console.log('❌ HUGGINGFACE_API_KEY not found in .env file');
    console.log('Please add your API key before testing\n');
    return;
  }
  
  console.log('✅ Hugging Face API key configured\n');
  
  // Test with sample resume text
  const sampleText = `
    Hello, my name is Thanh Phong Le. I'm a full-stack developer with 3 years 
    of experience. I graduated from CoderDream Academy in 2021. My main skills 
    include Node.js for backend development, React for frontend, and Ruby on Rails 
    for rapid prototyping. I've worked on several e-commerce projects using 
    PostgreSQL and Redis. My email is ltpsongssvn@gmail.com and phone is 413-290-2912.
    I'm passionate about building scalable web applications and learning new technologies.
  `;
  
  console.log('Testing with sample resume text...\n');
  
  try {
    const huggingFaceService = require('./src/services/huggingFaceResumeService');
    
    // Test basic parsing first
    const basicParsed = {
      name: "Thanh Phong Le",
      email: "ltpsongssvn@gmail.com",
      phone: "413-290-2912",
      skills: ["Node.js", "React", "Ruby on Rails", "PostgreSQL", "Redis"],
      education: "CoderDream Academy",
      experience: "3 years full-stack development"
    };
    
    console.log('Basic parsed data:');
    console.log(JSON.stringify(basicParsed, null, 2));
    
    console.log('\n🤖 Enhancing with Hugging Face...\n');
    
    const enhanced = await huggingFaceService.enhanceResumeData(basicParsed, sampleText);
    
    console.log('Enhanced data:');
    console.log(JSON.stringify(enhanced, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testEnhancement();
