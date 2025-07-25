// Hugging Face Service - Enhanced with Context-Aware Question Strategies
// This service handles all interactions with Hugging Face's API for resume parsing
// Updated to use context-aware questions for better extraction accuracy

const axios = require('axios');
const fs = require('fs').promises;
const pdf = require('pdf-parse');

class HuggingFaceService {
    constructor() {
        // Initialize with API key from environment
        this.apiKey = process.env.HUGGINGFACE_API_KEY;
        this.baseURL = 'https://api-inference.huggingface.co/models/';
        this.qaModel = 'deepset/roberta-base-squad2';
        this.classificationModel = 'facebook/bart-large-mnli';
    }

    /**
     * Parse a resume file and extract structured information
     * Enhanced with better extraction strategies
     */
    async parseResume(filePath) {
        try {
            console.log(`Starting resume parsing for file: ${filePath}`);

            // Extract text from the file
            let resumeText = '';
            try {
                if (filePath.toLowerCase().endsWith('.pdf')) {
                    const fileBuffer = await fs.readFile(filePath);
                    const pdfData = await pdf(fileBuffer);
                    resumeText = pdfData.text;
                } else {
                    resumeText = await fs.readFile(filePath, 'utf8');
                }
            } catch (readError) {
                console.error('Error reading file:', readError);
                resumeText = await fs.readFile(filePath, 'utf8');
            }

            // Clean up the text
            resumeText = resumeText.replace(/\s+/g, ' ').trim();
            console.log(`Extracted text length: ${resumeText.length} characters`);

            // ENHANCED: First, try to identify the candidate's section
            // Most resumes start with the candidate's information
            const firstSection = this.extractFirstSection(resumeText);
            console.log('Analyzing first section of resume for primary candidate info...');

            // ENHANCED: Define context-aware questions
            // These questions are designed to specifically target the resume owner's information
            const questions = [
                {
                    question: "What is the name at the very beginning of this resume?",
                    key: 'name',
                    fallbackQuestion: "Whose resume is this?",
                    context: firstSection // Use first section for name extraction
                },
                {
                    question: "What is the first email address mentioned in this resume?",
                    key: 'email',
                    fallbackQuestion: "What email address appears near the name at the top?",
                    context: firstSection // Use first section for email
                },
                {
                    question: "What is the first phone number listed in this resume?",
                    key: 'phone',
                    fallbackQuestion: "What phone number appears in the contact information?",
                    context: firstSection // Use first section for phone
                },
                {
                    question: "What programming languages and technical skills are mentioned?",
                    key: 'skills',
                    fallbackQuestion: "What are the technical skills?",
                    context: resumeText // Use full text for skills
                },
                {
                    question: "What is the most recent job title and company?",
                    key: 'currentJob',
                    fallbackQuestion: "What is their current position?",
                    context: resumeText // Use full text for job info
                },
                {
                    question: "What is the highest education degree and institution?",
                    key: 'education',
                    fallbackQuestion: "What education is listed?",
                    context: resumeText // Use full text for education
                },
                {
                    question: "How many years of experience are mentioned?",
                    key: 'experience',
                    fallbackQuestion: "What is the work experience?",
                    context: resumeText // Use full text for experience
                }
            ];

            // Store all extracted information
            const extractedInfo = {};

            // Process each question with the appropriate context
            for (const { question, key, fallbackQuestion, context } of questions) {
                try {
                    console.log(`Extracting: ${key}`);

                    // Use the specific context for each question
                    let answer = await this.extractWithQA(context, question);

                    // If we didn't get a good answer, try the fallback
                    if (!answer || answer.length < 2) {
                        answer = await this.extractWithQA(context, fallbackQuestion);
                    }

                    if (answer) {
                        extractedInfo[key] = answer;
                        console.log(`✓ Extracted ${key}: ${answer.substring(0, 50)}...`);
                    }
                } catch (error) {
                    console.error(`Error extracting ${key}:`, error.message);
                }

                // Add delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // ENHANCED: Apply additional validation and cleaning
            const processedInfo = this.enhancedPostProcessing(extractedInfo, resumeText);

            return {
                success: true,
                data: processedInfo,
                rawText: resumeText.substring(0, 1000)
            };
        } catch (error) {
            console.error('Resume parsing error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Extract the first section of the resume
     * This typically contains the candidate's personal information
     */
    extractFirstSection(resumeText) {
        // Most resumes have contact info in the first 500-800 characters
        // We'll look for common section breaks
        const sectionBreakers = [
            'experience', 'education', 'skills', 'summary', 'objective',
            'professional', 'work history', 'employment', 'projects'
        ];

        let firstSectionEnd = 800; // Default to first 800 characters

        // Find the earliest section break
        for (const breaker of sectionBreakers) {
            const breakerIndex = resumeText.toLowerCase().indexOf(breaker);
            if (breakerIndex > 100 && breakerIndex < firstSectionEnd) {
                firstSectionEnd = breakerIndex;
            }
        }

        return resumeText.substring(0, firstSectionEnd);
    }

    /**
     * Extract information using the Question-Answering model
     * (Same as before, no changes needed here)
     */
    async extractWithQA(context, question) {
        try {
            const response = await axios.post(
                `${this.baseURL}${this.qaModel}`,
                {
                    inputs: {
                        question: question,
                        context: context
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            if (response.data && response.data.answer && response.data.score > 0.01) {
                return response.data.answer;
            }
            return null;
        } catch (error) {
            if (error.response && error.response.status === 503) {
                console.log('Model is loading, waiting 5 seconds...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                try {
                    const retryResponse = await axios.post(
                        `${this.baseURL}${this.qaModel}`,
                        {
                            inputs: {
                                question: question,
                                context: context
                            }
                        },
                        {
                            headers: {
                                'Authorization': `Bearer ${this.apiKey}`,
                                'Content-Type': 'application/json'
                            },
                            timeout: 30000
                        }
                    );
                    if (retryResponse.data && retryResponse.data.answer) {
                        return retryResponse.data.answer;
                    }
                } catch (retryError) {
                    console.error('Retry failed:', retryError.message);
                }
            }
            throw error;
        }
    }

    /**
     * Enhanced post-processing with validation
     * This ensures we're getting the candidate's information, not references
     */
    enhancedPostProcessing(rawInfo, fullText) {
        const processed = {};

        // Clean up name - remove titles and validate it's at the beginning
        if (rawInfo.name) {
            let cleanName = rawInfo.name
                .replace(/^(Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s*/i, '')
                .trim();

            // Verify this name appears in the first 200 characters
            // This helps ensure it's the candidate's name, not a reference
            const firstPart = fullText.substring(0, 200).toLowerCase();
            if (firstPart.includes(cleanName.toLowerCase().split(' ')[0])) {
                processed.name = cleanName;
            } else {
                console.log('Name validation failed - might be from references section');
                processed.name = cleanName; // Still use it, but log the issue
            }
        }

        // Enhanced email validation
        if (rawInfo.email) {
            // First, try to extract a properly formatted email
            const emailMatch = rawInfo.email.match(/[\w.-]+@[\w.-]+\.\w+/);
            if (emailMatch) {
                const extractedEmail = emailMatch[0].toLowerCase();

                // Check if this email appears early in the document
                // Candidate emails are usually in the first 300 characters
                const emailPosition = fullText.toLowerCase().indexOf(extractedEmail);
                if (emailPosition > -1 && emailPosition < 500) {
                    processed.email = extractedEmail;
                } else {
                    // Email found but it's far from the beginning
                    // Might be a reference's email
                    console.log(`Email found at position ${emailPosition} - might not be candidate's`);
                    processed.email = extractedEmail;
                }
            } else {
                processed.email = rawInfo.email;
            }
        }

        // Clean phone number
        if (rawInfo.phone) {
            const phoneDigits = rawInfo.phone.replace(/\D/g, '');
            processed.phone = phoneDigits.length >= 10 ? phoneDigits : rawInfo.phone;
        }

        // Process skills
        if (rawInfo.skills) {
            const skillArray = rawInfo.skills
                .split(/[,;]/)
                .map(skill => skill.trim())
                .filter(skill => skill.length > 0);
            processed.skills = skillArray.length > 0 ? skillArray : [rawInfo.skills];
        }

        // Keep other fields as extracted
        ['currentJob', 'education', 'experience'].forEach(field => {
            if (rawInfo[field]) {
                processed[field] = rawInfo[field];
            }
        });

        processed.extractedAt = new Date().toISOString();

        // Add extraction confidence indicator
        processed.extractionConfidence = this.calculateConfidence(processed);

        return processed;
    }

    /**
     * Calculate confidence score for the extraction
     * This helps identify when extraction might be unreliable
     */
    calculateConfidence(extractedData) {
        let confidence = 'high';

        // Check if we have the basic fields
        const hasName = !!extractedData.name;
        const hasEmail = !!extractedData.email && extractedData.email.includes('@');
        const hasContactInfo = hasName || hasEmail || !!extractedData.phone;

        if (!hasContactInfo) {
            confidence = 'low';
        } else if (!hasName || !hasEmail) {
            confidence = 'medium';
        }

        return confidence;
    }

    /**
     * Alternative method to classify resume sections
     * (Same as before, no changes needed)
     */
    async classifyText(text, labels) {
        try {
            const response = await axios.post(
                `${this.baseURL}${this.classificationModel}`,
                {
                    inputs: text,
                    parameters: {
                        candidate_labels: labels
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            console.error('Classification error:', error.message);
            return null;
        }
    }
}

// Export a singleton instance
module.exports = new HuggingFaceService();