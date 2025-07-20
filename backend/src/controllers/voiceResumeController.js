// Enhanced Voice Resume Controller
// File: src/controllers/voiceResumeController.js

const path = require('path');
const fs = require('fs').promises;
const { query } = require('../config/database');
const voiceTranscriptionService = require('../services/ai/voiceTranscriptionService');
const huggingFaceService = require('../services/ai/huggingfaceService');
const huggingFaceResumeService = require('../services/huggingFaceResumeService');
const resumeStatusService = require('../services/resumeStatusService');
const confidenceScoreService = require('../services/confidenceScoreService');

/**
 * Upload and process a voice resume with enhanced features
 * Now includes real-time status tracking and confidence scoring
 */
async function uploadVoiceResume(req, res) {
    try {
        // Check if an audio file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No audio file uploaded'
            });
        }

        const {
            filename,
            path: filePath,
            size,
            mimetype
        } = req.file;

        const originalName = req.uploadedFileOriginalName || req.file.originalname;
        console.log(`Processing voice resume upload: ${originalName}`);

        // Store the audio file metadata in database with initial status
        const insertQuery = `
            INSERT INTO resumes (
                user_id,
                filename,
                original_name,
                file_path,
                file_size,
                mime_type,
                resume_type,
                processing_status,
                processing_started_at,
                uploaded_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
            RETURNING id, filename, original_name, file_size, uploaded_at
        `;

        const values = [
            req.user.id,
            filename,
            originalName,
            `uploads/voice-resumes/${filename}`,
            size,
            mimetype,
            'voice',
            'uploaded' // Initial status
        ];

        const result = await query(insertQuery, values);
        const resume = result.rows[0];

        console.log(`Voice resume saved to database with ID: ${resume.id}`);

        // Trigger async processing
        processVoiceResumeAsync(resume.id, filePath, req.user.id);

        res.status(201).json({
            success: true,
            message: 'Voice resume uploaded successfully. Transcription and parsing in progress...',
            data: {
                id: resume.id,
                filename: resume.original_name,
                size: resume.file_size,
                uploadedAt: resume.uploaded_at,
                processingStatus: 'uploaded',
                statusEndpoint: `/api/v1/voiceresumes/${resume.id}/status`
            }
        });

    } catch (error) {
        console.error('Voice resume upload error:', error);

        // Clean up file if database operation failed
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Error deleting file:', unlinkError);
            }
        }

        res.status(500).json({
            success: false,
            message: 'Failed to upload voice resume'
        });
    }
}

/**
 * Enhanced async processing with status tracking and confidence scoring
 */
async function processVoiceResumeAsync(resumeId, audioFilePath, userId) {
    let currentStage = 'uploaded';

    try {
        console.log(`Starting enhanced voice resume processing for ID: ${resumeId}`);

        // Step 1: Update status to transcribing
        await resumeStatusService.updateStatus(resumeId, 'transcribing', {
            audioFilePath,
            startTime: new Date().toISOString()
        });
        currentStage = 'transcribing';

        console.log('Step 1: Transcribing audio...');
        const transcriptionResult = await voiceTranscriptionService.transcribeAudio(audioFilePath);

        if (!transcriptionResult.success) {
            throw new Error(`Transcription failed: ${transcriptionResult.error}`);
        }

        console.log(`Transcription complete. Word count: ${transcriptionResult.wordCount}`);

        // Update status to transcribed
        await resumeStatusService.updateStatus(resumeId, 'transcribed', {
            wordCount: transcriptionResult.wordCount,
            transcriptionQuality: transcriptionResult.quality,
            processingTime: transcriptionResult.processingTime
        });
        currentStage = 'transcribed';

        // Store transcription result
        await query(
            `UPDATE resumes 
             SET transcription_data = $1, 
                 transcribed_at = NOW() 
             WHERE id = $2 AND user_id = $3`,
            [
                JSON.stringify({
                    text: transcriptionResult.text,
                    quality: transcriptionResult.quality,
                    wordCount: transcriptionResult.wordCount,
                    processingTime: transcriptionResult.processingTime
                }),
                resumeId,
                userId
            ]
        );

        // Step 2: Update status to parsing
        await resumeStatusService.updateStatus(resumeId, 'parsing', {
            stage: 'formatting_for_parser'
        });
        currentStage = 'parsing';

        console.log('Step 2: Formatting transcription for parsing...');
        const formatted = voiceTranscriptionService.formatTranscriptionForParsing(
            transcriptionResult.text,
            { resumeId, userId }
        );

        // Create a temporary text file for the parser
        const tempTextPath = path.join(
            path.dirname(audioFilePath),
            `transcript_${resumeId}.txt`
        );
        await fs.writeFile(tempTextPath, formatted.formattedText, 'utf8');

        console.log('Step 3: Parsing transcribed text...');
        const parseResult = await huggingFaceService.parseResume(tempTextPath);

        // Clean up temporary file
        try {
            await fs.unlink(tempTextPath);
        } catch (e) {
            console.error('Error cleaning up temp file:', e);
        }

        if (!parseResult.success) {
            throw new Error(`Parsing failed: ${parseResult.error}`);
        }

        // Update status to parsed
        await resumeStatusService.updateStatus(resumeId, 'parsed', {
            fieldsExtracted: Object.keys(parseResult.data).length,
            hasBasicInfo: !!(parseResult.data.name && parseResult.data.email)
        });
        currentStage = 'parsed';

        // Step 4: Update status to enhancing
        await resumeStatusService.updateStatus(resumeId, 'enhancing', {
            stage: 'ai_analysis'
        });
        currentStage = 'enhancing';

        console.log('Step 4: Enhancing parsed data with AI insights...');

        let enhancedParsedData = parseResult.data;

        try {
            // Call the enhancement service
            const enhancementResult = await huggingFaceResumeService.enhanceResumeData(
                parseResult.data,
                transcriptionResult.text
            );

            if (enhancementResult.success) {
                console.log('✓ Enhancement successful:', {
                    skillsCategorized: enhancementResult.data.categorizedSkills ?
                        Object.keys(enhancementResult.data.categorizedSkills).length : 0,
                    experienceLevel: enhancementResult.data.experienceLevel,
                    completenessScore: enhancementResult.data.completenessScore
                });

                // Update status to enhanced
                await resumeStatusService.updateStatus(resumeId, 'enhanced', {
                    skillsCategorized: Object.keys(enhancementResult.data.categorizedSkills || {}).length,
                    experienceLevel: enhancementResult.data.experienceLevel,
                    entitiesFound: enhancementResult.data.huggingFaceEnhancement?.entities ? {
                        persons: enhancementResult.data.huggingFaceEnhancement.entities.persons.length,
                        organizations: enhancementResult.data.huggingFaceEnhancement.entities.organizations.length
                    } : null
                });
                currentStage = 'enhanced';

                // Merge enhanced data
                enhancedParsedData = {
                    ...parseResult.data,
                    ...enhancementResult.data,
                    enhanced: true,
                    enhancementTimestamp: new Date().toISOString()
                };
            } else {
                console.warn('Enhancement failed, continuing with basic parsed data:',
                    enhancementResult.error);
                enhancedParsedData = {
                    ...parseResult.data,
                    enhanced: false,
                    enhancementError: enhancementResult.error
                };
            }
        } catch (enhancementError) {
            console.error('Enhancement service error:', enhancementError);
            enhancedParsedData = {
                ...parseResult.data,
                enhanced: false,
                enhancementError: enhancementError.message
            };
        }

        // Step 5: Calculate confidence scores
        console.log('Step 5: Calculating confidence scores...');

        // Prepare data for confidence scoring
        const resumeDataForScoring = {
            ...enhancedParsedData,
            transcriptionQuality: transcriptionResult.quality
        };

        const confidenceData = confidenceScoreService.calculateOverallConfidence(resumeDataForScoring);

        console.log(`Overall confidence score: ${confidenceData.overallScore}% (${confidenceData.level.label})`);

        // Store confidence scores
        await confidenceScoreService.storeConfidenceScores(resumeId, confidenceData);

        // Create final enhanced data with all metadata
        const finalEnhancedData = {
            ...enhancedParsedData,
            sourceType: 'voice',
            transcriptionQuality: transcriptionResult.quality,
            originalAudioDuration: formatted.metadata?.duration,
            detectedSections: formatted.detectedSections,
            confidenceScore: confidenceData.overallScore,
            confidenceLevel: confidenceData.level.label,
            processingSteps: {
                transcribed: true,
                parsed: true,
                enhanced: enhancedParsedData.enhanced || false,
                confidenceScored: true
            }
        };

        // Update database with enhanced parsed data
        await query(
            `UPDATE resumes 
             SET parsed_data = $1, 
                 parsed_at = NOW(),
                 confidence_scores = $2
             WHERE id = $3 AND user_id = $4`,
            [
                JSON.stringify(finalEnhancedData),
                JSON.stringify(confidenceData),
                resumeId,
                userId
            ]
        );

        // Final status update to completed
        await resumeStatusService.updateStatus(resumeId, 'completed', {
            overallConfidence: confidenceData.overallScore,
            confidenceLevel: confidenceData.level.label,
            totalProcessingSteps: 5
        });

        console.log(`✓ Voice resume ID ${resumeId} fully processed with enhancements`);
        console.log(`  Confidence Score: ${confidenceData.overallScore}%`);
        console.log(`  Processing Time: ${confidenceData.metadata?.totalProcessingTime || 'N/A'}`);

        // Log recommendations if any
        if (transcriptionResult.quality.recommendations?.length > 0) {
            console.log('Audio quality recommendations:',
                transcriptionResult.quality.recommendations);
        }

        if (finalEnhancedData.improvementSuggestions?.length > 0) {
            console.log('Resume improvement suggestions:',
                finalEnhancedData.improvementSuggestions);
        }

        if (confidenceData.recommendations?.length > 0) {
            console.log('Confidence improvement recommendations:',
                confidenceData.recommendations.map(r => r.suggestion));
        }

    } catch (error) {
        console.error(`Error processing voice resume ID ${resumeId}:`, error);

        // Update status to failed
        await resumeStatusService.updateStatus(resumeId, 'failed', {
            error: error.message,
            failedAtStage: currentStage,
            canRetry: true
        });

        // Store error state
        await query(
            `UPDATE resumes 
             SET parsed_data = $1, 
                 parsed_at = NOW() 
             WHERE id = $2 AND user_id = $3`,
            [
                JSON.stringify({
                    error: error.message,
                    attempted: true,
                    stage: currentStage,
                    timestamp: new Date().toISOString()
                }),
                resumeId,
                userId
            ]
        );
    }
}

/**
 * Get transcription for a voice resume
 * Enhanced to include confidence scores and processing status
 */
async function getVoiceResumeTranscription(req, res) {
    try {
        const resumeId = req.params.id;

        const result = await query(
            `SELECT 
                id, 
                original_name, 
                transcription_data, 
                transcribed_at,
                processing_status,
                confidence_scores,
                parsed_data
             FROM resumes
             WHERE id = $1 AND user_id = $2 AND resume_type = 'voice'`,
            [resumeId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Voice resume not found'
            });
        }

        const resume = result.rows[0];
        let transcriptionData = null;
        let confidenceData = null;
        let parsedData = null;

        if (resume.transcription_data) {
            try {
                transcriptionData = typeof resume.transcription_data === 'object'
                    ? resume.transcription_data
                    : JSON.parse(resume.transcription_data);
            } catch (e) {
                console.error('Error parsing transcription data:', e);
            }
        }

        if (resume.confidence_scores) {
            try {
                confidenceData = typeof resume.confidence_scores === 'object'
                    ? resume.confidence_scores
                    : JSON.parse(resume.confidence_scores);
            } catch (e) {
                console.error('Error parsing confidence data:', e);
            }
        }

        if (resume.parsed_data) {
            try {
                parsedData = typeof resume.parsed_data === 'object'
                    ? resume.parsed_data
                    : JSON.parse(resume.parsed_data);
            } catch (e) {
                console.error('Error parsing parsed data:', e);
            }
        }

        res.json({
            success: true,
            data: {
                id: resume.id,
                filename: resume.original_name,
                processingStatus: resume.processing_status,
                transcribedAt: resume.transcribed_at,
                transcription: transcriptionData,
                confidence: confidenceData,
                parsedData: parsedData,
                isComplete: resume.processing_status === 'completed'
            }
        });

    } catch (error) {
        console.error('Error fetching transcription:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch transcription'
        });
    }
}

module.exports = {
    uploadVoiceResume,
    getVoiceResumeTranscription
};