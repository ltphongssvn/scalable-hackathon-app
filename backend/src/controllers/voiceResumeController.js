// Enhanced Voice Resume Controller
// Updated to support both local and S3 storage
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
 * Now supports both local and S3 storage
 * Includes real-time status tracking and confidence scoring
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

        // Detect storage type and extract file information accordingly
        let fileInfo = {};

        // Check if this is an S3 upload (multer-s3 adds these properties)
        if (req.file.location && req.file.key) {
            // S3 storage
            console.log('Processing S3 voice upload');
            fileInfo = {
                filename: req.file.key.split('/').pop(), // Extract filename from S3 key
                filePath: req.file.location,             // Full S3 URL
                storagePath: req.file.key,               // S3 key for database
                size: req.file.size,
                mimetype: req.file.contentType || req.file.mimetype,
                isS3: true
            };
        } else {
            // Local storage
            console.log('Processing local voice upload');
            fileInfo = {
                filename: req.file.filename,
                filePath: req.file.path,
                storagePath: `uploads/voice-resumes/${req.file.filename}`,
                size: req.file.size,
                mimetype: req.file.mimetype,
                isS3: false
            };
        }

        const originalName = req.uploadedFileOriginalName || req.file.originalname;

        console.log(`Processing voice resume upload: ${originalName}`);
        console.log(`Storage type: ${fileInfo.isS3 ? 'S3' : 'Local'}`);

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
            fileInfo.filename,
            originalName,
            fileInfo.storagePath,  // This will be S3 key or local path
            fileInfo.size,
            fileInfo.mimetype,
            'voice',
            'uploaded' // Initial status
        ];

        const result = await query(insertQuery, values);
        const resume = result.rows[0];

        console.log(`Voice resume saved to database with ID: ${resume.id}`);

        // Trigger async processing
        // For S3 files, we pass the S3 URL; for local files, we pass the file path
        processVoiceResumeAsync(resume.id, fileInfo.filePath, req.user.id, fileInfo.isS3);

        res.status(201).json({
            success: true,
            message: 'Voice resume uploaded successfully. Transcription and parsing in progress...',
            data: {
                id: resume.id,
                filename: resume.original_name,
                size: resume.file_size,
                uploadedAt: resume.uploaded_at,
                processingStatus: 'uploaded',
                statusEndpoint: `/api/v1/voiceresumes/${resume.id}/status`,
                storageType: fileInfo.isS3 ? 's3' : 'local'
            }
        });

    } catch (error) {
        console.error('Voice resume upload error:', error);

        // Clean up file if database operation failed and using local storage
        if (req.file && req.file.path && !req.file.location) {
            try {
                await fs.unlink(req.file.path);
                console.log('Cleaned up uploaded file after error');
            } catch (unlinkError) {
                console.error('Error deleting file:', unlinkError);
            }
        }

        res.status(500).json({
            success: false,
            message: 'Failed to upload voice resume',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

/**
 * Enhanced async processing with status tracking and confidence scoring
 * Now handles both local files and S3 URLs
 */
async function processVoiceResumeAsync(resumeId, audioFilePath, userId, isS3 = false) {
    let currentStage = 'uploaded';
    let tempTextPath = null;

    try {
        console.log(`Starting enhanced voice resume processing for ID: ${resumeId}`);
        console.log(`Processing from ${isS3 ? 'S3 URL' : 'local file'}: ${audioFilePath}`);

        // Step 1: Update status to transcribing
        await resumeStatusService.updateStatus(resumeId, 'transcribing', {
            audioFilePath,
            storageType: isS3 ? 's3' : 'local',
            startTime: new Date().toISOString()
        });
        currentStage = 'transcribing';

        console.log('Step 1: Transcribing audio...');
        // The transcription service should be able to handle both local paths and S3 URLs
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
        // For S3 files, we'll create the temp file in the system temp directory
        const tempDir = isS3 ? require('os').tmpdir() : path.dirname(audioFilePath);
        tempTextPath = path.join(tempDir, `transcript_${resumeId}.txt`);

        await fs.writeFile(tempTextPath, formatted.formattedText, 'utf8');

        console.log('Step 3: Parsing transcribed text...');
        const parseResult = await huggingFaceService.parseResume(tempTextPath);

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
            storageType: isS3 ? 's3' : 'local',
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
                 confidence_scores = $2,
                 processing_status = 'completed',
                 processing_completed_at = NOW()
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
                 parsed_at = NOW(),
                 processing_status = 'failed'
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
    } finally {
        // Clean up temporary file if it was created
        if (tempTextPath) {
            try {
                await fs.unlink(tempTextPath);
                console.log('Cleaned up temporary transcript file');
            } catch (unlinkError) {
                console.error('Error cleaning up temp file:', unlinkError);
                // Don't throw, as this is just cleanup
            }
        }
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
                isComplete: resume.processing_status === 'completed',
                storageType: parsedData?.storageType || 'unknown'
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
    getVoiceResumeTranscription,
    processVoiceResumeAsync  // Exported for retry functionality
};