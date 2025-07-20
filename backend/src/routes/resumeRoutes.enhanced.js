// Enhanced Resume Routes with Progress Tracking
// This demonstrates how to gradually migrate existing functionality
// to include new features without breaking backward compatibility

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { upload } = require('../config/upload');
const resumeController = require('../controllers/resumeController.enhanced');

/**
 * POST /api/v1/resumes/upload
 * Enhanced upload endpoint with progress tracking
 *
 * This endpoint maintains the same API contract as the original
 * but adds progress tracking capabilities. This is a key architectural
 * principle: enhance without breaking.
 *
 * The response now includes an `uploadId` that clients can use
 * to subscribe to progress updates via Server-Sent Events.
 *
 * Backward Compatibility:
 * - Old clients that ignore the uploadId continue to work
 * - New clients can use the uploadId for enhanced experience
 * - The response structure remains compatible
 */
router.post(
    '/upload',
    authenticate,
    upload.single('resume'),
    resumeController.uploadResume  // Now uses the enhanced version
);

/**
 * GET /api/v1/resumes
 * Get all resumes for the authenticated user
 * (No changes needed - progress tracking doesn't affect listing)
 */
router.get(
    '/',
    authenticate,
    resumeController.getUserResumes
);

/**
 * GET /api/v1/resumes/:id/parsed
 * Get detailed parsed data for a specific resume
 * (No changes needed - works the same as before)
 */
router.get(
    '/:id/parsed',
    authenticate,
    resumeController.getResumeParsedData
);

/**
 * POST /api/v1/resumes/:id/reparse
 * Trigger re-parsing of a resume
 *
 * Enhancement Opportunity: This endpoint could also return
 * an uploadId for tracking the re-parsing progress.
 * For now, it maintains original behavior.
 */
router.post(
    '/:id/reparse',
    authenticate,
    resumeController.reparseResume
);

/**
 * DELETE /api/v1/resumes/:id
 * Delete a specific resume
 * (No changes needed)
 */
router.delete(
    '/:id',
    authenticate,
    resumeController.deleteResume
);

/**
 * GET /api/v1/resumes/features
 * Endpoint to check which features are available
 *
 * This is useful for feature detection in the frontend.
 * The client can check which enhanced features are available
 * and adapt its UI accordingly.
 */
router.get(
    '/features',
    authenticate,
    (req, res) => {
        res.json({
            success: true,
            features: {
                progressTracking: true,
                aiParsing: true,
                voiceUpload: true,
                realtimeUpdates: true,
                confidenceScoring: true
            },
            endpoints: {
                upload: '/api/v1/resumes/upload',
                progress: '/api/v1/progress/:uploadId',
                progressDemo: '/api/v1/progress/demo'
            }
        });
    }
);

module.exports = router;