// Voice Transcription Service using OpenAI's Whisper API
// This service handles converting audio files (voice resumes) into text
// Updated to use OpenAI's official Whisper API for reliable transcription

const axios = require('axios');
const fs = require('fs').promises;
const FormData = require('form-data');
const path = require('path');

class VoiceTranscriptionService {
    constructor() {
        // Initialize the API key - will be retrieved when needed
        // This prevents timing issues with environment variable loading
        this.apiKey = null;

        // OpenAI's Whisper API endpoint
        // This is the official, reliable endpoint for audio transcription
        this.baseURL = 'https://api.openai.com/v1/audio/transcriptions';

        // Whisper model to use - 'whisper-1' is the current model
        this.model = 'whisper-1';

        // Supported audio formats by OpenAI's Whisper
        // These formats are officially supported and tested
        this.supportedFormats = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm'];

        // OpenAI has a 25MB file size limit for audio files
        this.maxFileSize = 25 * 1024 * 1024; // 25MB limit
    }

    /**
     * Get the API key, ensuring it's loaded from environment if not already cached
     * This method handles the timing issue where env vars might not be loaded when the service is instantiated
     * @returns {string} The OpenAI API key
     */
    getApiKey() {
        // If we don't have the API key cached, try to get it from environment
        if (!this.apiKey) {
            // First try OpenAI key, then fall back to Hugging Face key if needed
            this.apiKey = process.env.OPENAI_API_KEY || process.env.HUGGINGFACE_API_KEY;

            // Log warning if still no API key (helps with debugging)
            if (!this.apiKey) {
                console.error('WARNING: No API key found. Please set OPENAI_API_KEY in your .env file');
            }
        }

        return this.apiKey;
    }

    /**
     * Transcribe an audio file to text using OpenAI's Whisper API
     * This is the main entry point for voice resume processing
     * @param {string} audioFilePath - Path to the audio file
     * @returns {Object} Transcription result with text and metadata
     */
    async transcribeAudio(audioFilePath) {
        try {
            console.log(`Starting voice transcription for file: ${audioFilePath}`);

            // Get the API key when we actually need it
            const apiKey = this.getApiKey();

            // Check if we have an API key before proceeding
            if (!apiKey) {
                throw new Error('API key not configured. Please add OPENAI_API_KEY to your .env file');
            }

            // Debug log to confirm API key is present (shows first 10 chars only for security)
            console.log(`API Key status: Present (${apiKey.substring(0, 10)}...)`);

            // First, validate the audio file
            const validation = await this.validateAudioFile(audioFilePath);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // Read the audio file
            const audioBuffer = await fs.readFile(audioFilePath);
            console.log(`Audio file size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`);

            // Create form data for multipart upload
            // OpenAI's API expects multipart/form-data with the audio file
            const formData = new FormData();

            // Add the audio file to the form
            // We need to provide the buffer, filename, and content type
            const fileName = path.basename(audioFilePath);
            formData.append('file', audioBuffer, {
                filename: fileName,
                contentType: this.getContentType(fileName)
            });

            // Add the model parameter
            formData.append('model', this.model);

            // Optional: Add prompt to help with resume-specific terminology
            formData.append('prompt', 'This is a voice resume. Please transcribe accurately, including technical terms, company names, and personal information.');

            // Optional: Set response format to verbose JSON for more details
            formData.append('response_format', 'json');

            const startTime = Date.now();

            try {
                // Make the transcription request to OpenAI
                const response = await axios.post(
                    this.baseURL,
                    formData,
                    {
                        headers: {
                            ...formData.getHeaders(),
                            'Authorization': `Bearer ${apiKey}`,
                        },
                        maxContentLength: Infinity,
                        maxBodyLength: Infinity,
                        timeout: 120000 // 2 minutes timeout for longer audio files
                    }
                );

                const transcriptionTime = Date.now() - startTime;
                console.log(`Transcription completed in ${transcriptionTime}ms`);

                // Process the response
                const transcribedText = this.processTranscriptionResponse(response.data);

                // Analyze the transcription for quality
                const quality = this.assessTranscriptionQuality(transcribedText);

                return {
                    success: true,
                    text: transcribedText,
                    processingTime: transcriptionTime,
                    quality: quality,
                    wordCount: transcribedText.split(/\s+/).filter(word => word.length > 0).length,
                    characterCount: transcribedText.length
                };

            } catch (apiError) {
                // Handle specific API errors
                if (apiError.response) {
                    console.error('API Error Response:', {
                        status: apiError.response.status,
                        statusText: apiError.response.statusText,
                        data: apiError.response.data
                    });

                    // Provide user-friendly error messages
                    if (apiError.response.status === 401) {
                        throw new Error('Invalid API key. Please check your OPENAI_API_KEY.');
                    } else if (apiError.response.status === 429) {
                        throw new Error('Rate limit exceeded. Please try again later.');
                    } else if (apiError.response.status === 413) {
                        throw new Error('Audio file too large. Maximum size is 25MB.');
                    }
                }

                throw apiError;
            }

        } catch (error) {
            console.error('Voice transcription error:', error);

            return {
                success: false,
                error: error.message,
                details: error.response?.data || 'No additional details available'
            };
        }
    }

    /**
     * Get the appropriate content type for an audio file
     * This helps the API understand the format of the uploaded file
     */
    getContentType(fileName) {
        const ext = path.extname(fileName).toLowerCase();
        const contentTypes = {
            '.mp3': 'audio/mpeg',
            '.mp4': 'audio/mp4',
            '.mpeg': 'audio/mpeg',
            '.mpga': 'audio/mpeg',
            '.m4a': 'audio/m4a',
            '.wav': 'audio/wav',
            '.webm': 'audio/webm'
        };

        return contentTypes[ext] || 'audio/mpeg';
    }

    /**
     * Validate audio file before processing
     * This prevents issues with unsupported formats or oversized files
     */
    async validateAudioFile(filePath) {
        try {
            // Check file extension
            const extension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
            if (!this.supportedFormats.includes(extension)) {
                return {
                    valid: false,
                    error: `Unsupported audio format. Supported formats: ${this.supportedFormats.join(', ')}`
                };
            }

            // Check file size
            const stats = await fs.stat(filePath);
            if (stats.size > this.maxFileSize) {
                return {
                    valid: false,
                    error: `Audio file too large. Maximum size: ${this.maxFileSize / 1024 / 1024}MB`
                };
            }

            // Check if file exists and is readable
            await fs.access(filePath, fs.constants.R_OK);

            return { valid: true };

        } catch (error) {
            return {
                valid: false,
                error: `File validation error: ${error.message}`
            };
        }
    }

    /**
     * Process the transcription response from OpenAI
     * OpenAI returns a JSON object with the transcribed text
     */
    processTranscriptionResponse(responseData) {
        // OpenAI returns an object with a 'text' field
        if (typeof responseData === 'object' && responseData.text) {
            return responseData.text.trim();
        }

        // If response_format was set to 'json', we might get more detailed data
        if (typeof responseData === 'object' && responseData.segments) {
            // Join all segments into one text
            return responseData.segments
                .map(segment => segment.text)
                .join(' ')
                .trim();
        }

        // Handle unexpected formats
        if (typeof responseData === 'string') {
            return responseData.trim();
        }

        throw new Error('Unexpected transcription response format');
    }

    /**
     * Assess the quality of the transcription
     * This helps identify if the audio quality was good enough
     */
    assessTranscriptionQuality(text) {
        const indicators = {
            length: text.length,
            wordCount: text.split(/\s+/).filter(word => word.length > 0).length,
            hasEmail: /[\w.-]+@[\w.-]+\.\w+/.test(text),
            hasPhone: /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(text),
            sentenceCount: text.split(/[.!?]+/).filter(s => s.trim().length > 0).length,
            avgWordLength: text.length / Math.max(1, text.split(/\s+/).filter(word => word.length > 0).length)
        };

        // Quality assessment logic
        let quality = 'high';

        // Very short transcriptions might indicate audio issues
        if (indicators.wordCount < 50) {
            quality = 'low';
        } else if (indicators.wordCount < 100) {
            quality = 'medium';
        }

        // Check for transcription artifacts that indicate issues
        const hasRepetitions = /(\b\w+\b)(?:\s+\1){2,}/.test(text); // Same word repeated 3+ times
        const hasGibberish = indicators.avgWordLength > 15 || indicators.avgWordLength < 2;

        if (hasRepetitions || hasGibberish) {
            quality = 'low';
        }

        return {
            score: quality,
            indicators: indicators,
            recommendations: this.getQualityRecommendations(quality, indicators)
        };
    }

    /**
     * Provide recommendations based on transcription quality
     */
    getQualityRecommendations(quality, indicators) {
        const recommendations = [];

        if (quality === 'low') {
            recommendations.push('Consider re-recording in a quieter environment');
            recommendations.push('Speak more clearly and at a moderate pace');
            if (indicators.wordCount < 50) {
                recommendations.push('Provide more detail about your experience');
            }
        }

        if (!indicators.hasEmail) {
            recommendations.push('Remember to mention your email address');
        }

        if (!indicators.hasPhone) {
            recommendations.push('Consider including your phone number');
        }

        if (indicators.sentenceCount < 5) {
            recommendations.push('Try to speak in complete sentences for better clarity');
        }

        return recommendations;
    }

    /**
     * Convert transcribed text into a structured format
     * This prepares the text for the existing resume parsing pipeline
     */
    formatTranscriptionForParsing(transcribedText, metadata = {}) {
        // Add structure to help the resume parser
        // This is important because spoken resumes lack the visual cues of written ones

        const sections = this.identifySectionsInSpeech(transcribedText);

        let formattedText = '';

        // Add a header section if we detected introduction
        if (sections.introduction) {
            formattedText += `PERSONAL INFORMATION\n${sections.introduction}\n\n`;
        }

        // Add other sections with headers
        if (sections.experience) {
            formattedText += `EXPERIENCE\n${sections.experience}\n\n`;
        }

        if (sections.education) {
            formattedText += `EDUCATION\n${sections.education}\n\n`;
        }

        if (sections.skills) {
            formattedText += `SKILLS\n${sections.skills}\n\n`;
        }

        // If we couldn't identify sections, use the raw text
        if (formattedText.trim() === '') {
            formattedText = transcribedText;
        }

        return {
            originalTranscription: transcribedText,
            formattedText: formattedText,
            detectedSections: Object.keys(sections).filter(key => sections[key] !== null),
            metadata: {
                ...metadata,
                transcriptionMethod: 'whisper-openai',
                isVoiceResume: true
            }
        };
    }

    /**
     * Identify sections in spoken resume based on keywords
     * Speech patterns are different from written text
     */
    identifySectionsInSpeech(text) {
        const sections = {};
        const lowerText = text.toLowerCase();

        // Look for introduction patterns
        const introPatterns = [
            /my name is .+? and/i,
            /i am .+? with/i,
            /hello,? i'm/i,
            /hi,? my name/i
        ];

        for (const pattern of introPatterns) {
            const match = text.match(pattern);
            if (match) {
                // Extract introduction section (usually first 100-200 words)
                const startIndex = match.index;
                const words = text.substring(startIndex).split(/\s+/).slice(0, 50);
                sections.introduction = words.join(' ');
                break;
            }
        }

        // Look for experience mentions
        const experienceKeywords = [
            'worked at', 'working at', 'currently work',
            'experience includes', 'my experience',
            'previous role', 'current role', 'position',
            'job', 'employment', 'company'
        ];

        sections.experience = this.extractSectionByKeywords(text, experienceKeywords, 150);

        // Look for education mentions
        const educationKeywords = [
            'studied at', 'graduated from', 'degree in',
            'university', 'college', 'education',
            'bachelor', 'master', 'phd', 'certification',
            'school', 'major', 'minor'
        ];

        sections.education = this.extractSectionByKeywords(text, educationKeywords, 100);

        // Look for skills mentions
        const skillsKeywords = [
            'skills include', 'proficient in', 'experienced with',
            'technologies', 'programming languages', 'familiar with',
            'expertise', 'knowledge of', 'certified in'
        ];

        sections.skills = this.extractSectionByKeywords(text, skillsKeywords, 100);

        return sections;
    }

    /**
     * Extract section content based on keywords
     * Enhanced to capture more context around keywords
     */
    extractSectionByKeywords(text, keywords, contextWords = 100) {
        const lowerText = text.toLowerCase();

        for (const keyword of keywords) {
            const index = lowerText.indexOf(keyword);
            if (index !== -1) {
                // Extract content around the keyword with better boundaries
                const beforeContext = 20; // Words before the keyword to include
                const words = text.split(/\s+/);

                // Find word index containing our keyword
                let wordIndex = 0;
                let charCount = 0;
                for (let i = 0; i < words.length; i++) {
                    if (charCount <= index && charCount + words[i].length >= index) {
                        wordIndex = i;
                        break;
                    }
                    charCount += words[i].length + 1; // +1 for space
                }

                // Extract section with context
                const startIdx = Math.max(0, wordIndex - beforeContext);
                const endIdx = Math.min(words.length, startIdx + contextWords);

                return words.slice(startIdx, endIdx).join(' ');
            }
        }

        return null;
    }
}

// Export singleton instance
module.exports = new VoiceTranscriptionService();