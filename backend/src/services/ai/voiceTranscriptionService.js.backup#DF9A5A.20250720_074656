// Voice Transcription Service using Whisper
// This service handles converting audio files (voice resumes) into text
// Uses Whisper model through Hugging Face for consistency with existing architecture

const axios = require('axios');
const fs = require('fs').promises;
const FormData = require('form-data');

class VoiceTranscriptionService {
    constructor() {
        // Use the same Hugging Face API key
        this.apiKey = process.env.HUGGINGFACE_API_KEY;

        // Whisper models available on Hugging Face
        // We'll use the small model for a good balance of speed and accuracy
        // Options: openai/whisper-tiny, openai/whisper-small, openai/whisper-medium, openai/whisper-large
        this.whisperModel = 'openai/whisper-small';

        // Base URL for Hugging Face inference API
        this.baseURL = `https://api-inference.huggingface.co/models/${this.whisperModel}`;

        // Supported audio formats
        this.supportedFormats = ['.mp3', '.wav', '.m4a', '.ogg', '.webm'];
        this.maxFileSize = 25 * 1024 * 1024; // 25MB limit for audio files
    }

    /**
     * Transcribe an audio file to text
     * This is the main entry point for voice resume processing
     * @param {string} audioFilePath - Path to the audio file
     * @returns {Object} Transcription result with text and metadata
     */
    async transcribeAudio(audioFilePath) {
        try {
            console.log(`Starting voice transcription for file: ${audioFilePath}`);

            // First, validate the audio file
            const validation = await this.validateAudioFile(audioFilePath);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // Read the audio file
            const audioBuffer = await fs.readFile(audioFilePath);
            console.log(`Audio file size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`);

            // Prepare the request to Hugging Face
            // Whisper expects audio data in binary format
            const startTime = Date.now();

            try {
                // Make the transcription request
                const response = await axios.post(
                    this.baseURL,
                    audioBuffer,
                    {
                        headers: {
                            'Authorization': `Bearer ${this.apiKey}`,
                            'Content-Type': 'audio/wav', // Hugging Face will handle format detection
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
                    wordCount: transcribedText.split(/\s+/).length,
                    characterCount: transcribedText.length
                };

            } catch (apiError) {
                // Handle specific API errors
                if (apiError.response && apiError.response.status === 503) {
                    console.log('Whisper model is loading, waiting and retrying...');
                    await new Promise(resolve => setTimeout(resolve, 20000)); // Wait 20 seconds

                    // Retry once
                    const retryResponse = await axios.post(
                        this.baseURL,
                        audioBuffer,
                        {
                            headers: {
                                'Authorization': `Bearer ${this.apiKey}`,
                                'Content-Type': 'audio/wav',
                            },
                            timeout: 120000
                        }
                    );

                    const transcribedText = this.processTranscriptionResponse(retryResponse.data);
                    return {
                        success: true,
                        text: transcribedText,
                        processingTime: Date.now() - startTime,
                        quality: this.assessTranscriptionQuality(transcribedText),
                        wordCount: transcribedText.split(/\s+/).length,
                        characterCount: transcribedText.length
                    };
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
     * Process the transcription response from Hugging Face
     * Different Whisper models might return data in slightly different formats
     */
    processTranscriptionResponse(responseData) {
        // Hugging Face Whisper models typically return an object with a 'text' field
        if (typeof responseData === 'object' && responseData.text) {
            return responseData.text.trim();
        }

        // Sometimes the response might be a direct string
        if (typeof responseData === 'string') {
            return responseData.trim();
        }

        // Handle array responses (some models return segments)
        if (Array.isArray(responseData)) {
            return responseData.map(segment =>
                segment.text || segment
            ).join(' ').trim();
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
            wordCount: text.split(/\s+/).length,
            hasEmail: /[\w.-]+@[\w.-]+\.\w+/.test(text),
            hasPhone: /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(text),
            sentenceCount: text.split(/[.!?]+/).length - 1,
            avgWordLength: text.length / text.split(/\s+/).length
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
            detectedSections: Object.keys(sections),
            metadata: {
                ...metadata,
                transcriptionMethod: 'whisper',
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
            'previous role', 'current role', 'position'
        ];

        sections.experience = this.extractSectionByKeywords(text, experienceKeywords);

        // Look for education mentions
        const educationKeywords = [
            'studied at', 'graduated from', 'degree in',
            'university', 'college', 'education',
            'bachelor', 'master', 'phd', 'certification'
        ];

        sections.education = this.extractSectionByKeywords(text, educationKeywords);

        // Look for skills mentions
        const skillsKeywords = [
            'skills include', 'proficient in', 'experienced with',
            'technologies', 'programming languages', 'familiar with'
        ];

        sections.skills = this.extractSectionByKeywords(text, skillsKeywords);

        return sections;
    }

    /**
     * Extract section content based on keywords
     */
    extractSectionByKeywords(text, keywords) {
        const lowerText = text.toLowerCase();

        for (const keyword of keywords) {
            const index = lowerText.indexOf(keyword);
            if (index !== -1) {
                // Extract content around the keyword (before and after)
                const startIndex = Math.max(0, index - 50);
                const words = text.substring(startIndex).split(/\s+/).slice(0, 100);
                return words.join(' ');
            }
        }

        return null;
    }
}

// Export singleton instance
module.exports = new VoiceTranscriptionService();