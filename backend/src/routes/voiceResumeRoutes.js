// Enhanced Voice Resume Routes
// File: src/routes/voiceResumeRoutes.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const {
    uploadVoiceResume,
    getVoiceResumeTranscription
} = require('../controllers/voiceResumeController');
const resumeStatusService = require('../services/resumeStatusService');
const resumeJobComparisonService = require('../services/resumeJobComparisonService');
const { query } = require('../config/database');

// Configure multer for voice resume uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../uploads/voice-resumes');

        // Ensure the directory exists
        const fs = require('fs').promises;
        try {
            await fs.mkdir(uploadPath, { recursive: true });
        } catch (error) {
            console.error('Error creating upload directory:', error);
        }

        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const filename = `voice-resume-${req.user.id}-${uniqueSuffix}${ext}`;

        // Store original name for later use
        req.uploadedFileOriginalName = file.originalname;

        cb(null, filename);
    }
});

// File filter to ensure only audio files are accepted
const fileFilter = (req, file, cb) => {
    // Accept common audio formats
    const allowedMimeTypes = [
        'audio/mpeg',        // MP3
        'audio/mp3',
        'audio/wav',         // WAV
        'audio/wave',
        'audio/x-wav',
        'audio/webm',        // WebM
        'audio/ogg',         // OGG
        'audio/m4a',         // M4A
        'audio/x-m4a',
        'audio/mp4',         // MP4 audio
        'audio/aac',         // AAC
        'audio/flac',        // FLAC
        'audio/x-flac',
        'audio/3gpp',        // 3GP
        'audio/3gpp2'        // 3G2
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type. Accepted formats: MP3, WAV, WebM, OGG, M4A, AAC, FLAC. Received: ${file.mimetype}`), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 50MB.'
            });
        }
        return res.status(400).json({
            success: false,
            message: `Upload error: ${err.message}`
        });
    } else if (err) {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
    next();
};

// Main routes
router.post('/upload-voice',
    authenticate,
    upload.single('audio'),
    handleMulterError,
    uploadVoiceResume
);

router.get('/:id/transcription',
    authenticate,
    getVoiceResumeTranscription
);

// New Enhancement Routes

/**
 * Get real-time processing status for a voice resume
 */
router.get('/:id/status', authenticate, async (req, res) => {
    try {
        const resumeId = req.params.id;
        const userId = req.user.id;

        // Get the current status with user verification
        const status = await resumeStatusService.getStatus(resumeId, userId);

        if (!status) {
            return res.status(404).json({
                success: false,
                message: 'Resume not found or access denied'
            });
        }

        res.json({
            success: true,
            data: status
        });

    } catch (error) {
        console.error('Error fetching resume status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch resume status'
        });
    }
});

/**
 * Get user's resume processing statistics
 */
router.get('/stats', authenticate, async (req, res) => {
    try {
        const stats = await resumeStatusService.getUserStats(req.user.id);

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics'
        });
    }
});

/**
 * Compare a resume against a job description
 */
router.post('/:id/compare', authenticate, async (req, res) => {
    try {
        const resumeId = req.params.id;
        const { jobDescription } = req.body;

        if (!jobDescription || jobDescription.trim().length < 50) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a job description (at least 50 characters)'
            });
        }

        // Fetch the resume data
        const resumeQuery = `
            SELECT id, parsed_data, processing_status, user_id
            FROM resumes
            WHERE id = $1 AND user_id = $2
        `;

        const resumeResult = await query(resumeQuery, [resumeId, req.user.id]);

        if (resumeResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Resume not found or access denied'
            });
        }

        const resume = resumeResult.rows[0];

        // Check if resume is fully processed
        if (resume.processing_status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: `Resume is still being processed. Current status: ${resume.processing_status}`,
                currentStatus: resume.processing_status
            });
        }

        const parsedData = typeof resume.parsed_data === 'object'
            ? resume.parsed_data
            : JSON.parse(resume.parsed_data);

        // Perform comparison
        const comparisonResult = await resumeJobComparisonService.compareResumeToJob(
            parsedData,
            jobDescription
        );

        // Store comparison result for future reference (create table if needed)
        try {
            await query(
                `INSERT INTO resume_job_comparisons 
                 (resume_id, user_id, job_description, comparison_result, created_at)
                 VALUES ($1, $2, $3, $4, NOW())`,
                [
                    resumeId,
                    req.user.id,
                    jobDescription,
                    JSON.stringify(comparisonResult)
                ]
            );
        } catch (dbError) {
            console.error('Error storing comparison result:', dbError);
            // Continue even if storage fails
        }

        res.json({
            success: true,
            data: comparisonResult
        });

    } catch (error) {
        console.error('Error comparing resume to job:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to compare resume with job description'
        });
    }
});

/**
 * Get comparison history for a resume
 */
router.get('/:id/comparisons', authenticate, async (req, res) => {
    try {
        const resumeId = req.params.id;

        // First verify the user owns this resume
        const verifyQuery = `
            SELECT id FROM resumes 
            WHERE id = $1 AND user_id = $2
        `;

        const verifyResult = await query(verifyQuery, [resumeId, req.user.id]);

        if (verifyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Resume not found or access denied'
            });
        }

        const comparisonsQuery = `
            SELECT 
                id,
                job_description,
                comparison_result,
                created_at
            FROM resume_job_comparisons
            WHERE resume_id = $1 AND user_id = $2
            ORDER BY created_at DESC
            LIMIT 10
        `;

        const result = await query(comparisonsQuery, [resumeId, req.user.id]);

        const comparisons = result.rows.map(row => {
            const comparisonResult = typeof row.comparison_result === 'object'
                ? row.comparison_result
                : JSON.parse(row.comparison_result);

            return {
                id: row.id,
                jobDescription: row.job_description.substring(0, 200) + '...',
                overallMatch: comparisonResult.overallMatch,
                createdAt: row.created_at
            };
        });

        res.json({
            success: true,
            data: comparisons
        });

    } catch (error) {
        console.error('Error fetching comparison history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch comparison history'
        });
    }
});

/**
 * Get all voice resumes for the authenticated user with enhanced metadata
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 10, status = 'all' } = req.query;
        const offset = (page - 1) * limit;

        let queryText = `
            SELECT 
                r.id,
                r.original_name,
                r.file_size,
                r.processing_status,
                r.confidence_scores,
                r.uploaded_at,
                r.parsed_at,
                r.processing_started_at,
                r.processing_completed_at,
                CASE 
                    WHEN r.parsed_data IS NOT NULL 
                    THEN jsonb_build_object(
                        'name', r.parsed_data->'name',
                        'email', r.parsed_data->'email',
                        'skills', r.parsed_data->'skills',
                        'experienceLevel', r.parsed_data->'experienceLevel',
                        'confidenceScore', r.parsed_data->'confidenceScore'
                    )
                    ELSE NULL
                END as summary
            FROM resumes r
            WHERE r.user_id = $1 AND r.resume_type = 'voice'
        `;

        const params = [req.user.id];

        // Add status filter if specified
        if (status !== 'all') {
            queryText += ` AND r.processing_status = $${params.length + 1}`;
            params.push(status);
        }

        queryText += ` ORDER BY r.uploaded_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await query(queryText, params);

        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM resumes 
            WHERE user_id = $1 AND resume_type = 'voice'
            ${status !== 'all' ? 'AND processing_status = $2' : ''}
        `;

        const countParams = [req.user.id];
        if (status !== 'all') countParams.push(status);

        const countResult = await query(countQuery, countParams);
        const totalCount = parseInt(countResult.rows[0].total);

        // Format the response
        const resumes = result.rows.map(row => {
            const confidenceScores = row.confidence_scores
                ? (typeof row.confidence_scores === 'object'
                    ? row.confidence_scores
                    : JSON.parse(row.confidence_scores))
                : null;

            return {
                id: row.id,
                filename: row.original_name,
                fileSize: row.file_size,
                status: row.processing_status,
                uploadedAt: row.uploaded_at,
                parsedAt: row.parsed_at,
                processingTime: row.processing_completed_at && row.processing_started_at
                    ? new Date(row.processing_completed_at) - new Date(row.processing_started_at)
                    : null,
                summary: row.summary,
                confidence: confidenceScores ? {
                    overall: confidenceScores.overallScore,
                    level: confidenceScores.level
                } : null
            };
        });

        res.json({
            success: true,
            data: {
                resumes,
                pagination: {
                    total: totalCount,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(totalCount / limit)
                }
            }
        });

    } catch (error) {
        console.error('Error fetching voice resumes:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch voice resumes'
        });
    }
});

/**
 * Retry processing for a failed resume
 */
router.post('/:id/retry', authenticate, async (req, res) => {
    try {
        const resumeId = req.params.id;

        // Verify ownership and check if retry is allowed
        const resumeQuery = `
            SELECT id, file_path, processing_status
            FROM resumes
            WHERE id = $1 AND user_id = $2 AND resume_type = 'voice'
        `;

        const result = await query(resumeQuery, [resumeId, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Resume not found or access denied'
            });
        }

        const resume = result.rows[0];

        if (resume.processing_status !== 'failed') {
            return res.status(400).json({
                success: false,
                message: 'Only failed resumes can be retried',
                currentStatus: resume.processing_status
            });
        }

        // Reset status to transcribing to restart the process
        await resumeStatusService.updateStatus(resumeId, 'transcribing', {
            retryAttempt: true,
            previousFailure: resume.processing_status
        });

        // Trigger reprocessing
        const { processVoiceResumeAsync } = require('../controllers/voiceResumeController');
        const fullFilePath = path.join(__dirname, '../../', resume.file_path);

        processVoiceResumeAsync(resumeId, fullFilePath, req.user.id);

        res.json({
            success: true,
            message: 'Resume processing retry initiated',
            data: {
                resumeId,
                status: 'transcribing',
                statusEndpoint: `/api/v1/voiceresumes/${resumeId}/status`
            }
        });

    } catch (error) {
        console.error('Error retrying resume processing:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retry resume processing'
        });
    }
});

module.exports = router;