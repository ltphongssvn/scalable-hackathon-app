// Test script to find working Hugging Face models for resume parsing
require('dotenv').config();
const axios = require('axios');

async function testModel(modelName, requestBody) {
    try {
        console.log(`\nTesting model: ${modelName}`);
        const response = await axios.post(
            `https://api-inference.huggingface.co/models/${modelName}`,
            requestBody,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );
        console.log('✓ Success! Response:', JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
        return true;
    } catch (error) {
        if (error.response) {
            console.log(`✗ Failed with status ${error.response.status}: ${error.response.data}`);
        } else {
            console.log(`✗ Failed with error: ${error.message}`);
        }
        return false;
    }
}

async function findWorkingModels() {
    console.log('Finding available models for resume parsing...');
    console.log('API Key:', process.env.HUGGINGFACE_API_KEY ? 'Configured' : 'Missing');
    
    // Test various models that might work for our use case
    const modelsToTest = [
        {
            name: 'facebook/bart-large-mnli',
            body: {
                inputs: "I am a software engineer with 5 years of experience in JavaScript and Python.",
                parameters: {
                    candidate_labels: ["name", "experience", "skills", "education"]
                }
            }
        },
        {
            name: 'deepset/roberta-base-squad2',
            body: {
                inputs: {
                    question: "What are the technical skills?",
                    context: "John Doe is a software engineer. Skills include JavaScript, Python, and Node.js."
                }
            }
        },
        {
            name: 'distilbert-base-uncased-distilled-squad',
            body: {
                inputs: {
                    question: "What is the person's name?",
                    context: "My name is John Doe. I am a software engineer with experience in web development."
                }
            }
        },
        {
            name: 'google/flan-t5-base',
            body: {
                inputs: "Extract the name from this text: John Doe is a software engineer.",
                parameters: {
                    max_length: 50
                }
            }
        }
    ];
    
    let workingModels = [];
    
    for (const model of modelsToTest) {
        const works = await testModel(model.name, model.body);
        if (works) {
            workingModels.push(model.name);
        }
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n=== Summary ===');
    console.log('Working models:', workingModels.length > 0 ? workingModels.join(', ') : 'None found');
    
    if (workingModels.length === 0) {
        console.log('\nTroubleshooting tips:');
        console.log('1. Check if your API key has the necessary permissions');
        console.log('2. Some models may be loading - try again in a few minutes');
        console.log('3. Consider using the free tier models or upgrading your account');
    }
}

findWorkingModels();
