// Progress Tracking Routes
// Demonstrates real-time communication patterns in Node.js
// This file will be auto-discovered by your route loading system

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const resumeController = require('../controllers/resumeController.enhanced');

/**
 * GET /api/v1/progress/:uploadId
 * Server-Sent Events endpoint for real-time upload progress
 *
 * This endpoint demonstrates a sophisticated pattern for real-time
 * communication in Node.js. Unlike traditional REST endpoints that
 * return data once and close the connection, this endpoint keeps
 * the connection open and streams updates as they happen.
 *
 * Architecture Notes:
 * - SSE is perfect for progress updates because it's unidirectional
 * - The browser automatically handles reconnection if the connection drops
 * - Works through proxies and firewalls that might block WebSockets
 * - No special client libraries needed - just standard EventSource API
 *
 * Frontend Usage Example:
 * ```javascript
 * const eventSource = new EventSource(`/api/v1/progress/${uploadId}`);
 * eventSource.addEventListener('progress', (event) => {
 *     const data = JSON.parse(event.data);
 *     updateProgressBar(data.progress);
 *     updateStatusMessage(data.stages[data.currentStage].message);
 * });
 * ```
 */
router.get(
    '/:uploadId',
    authenticate,  // Ensure user is logged in
    resumeController.streamUploadProgress
);

/**
 * GET /api/v1/progress/:uploadId/status
 * Get current progress status without streaming
 *
 * This endpoint provides a snapshot of the current progress state.
 * Useful for:
 * - Checking progress when reconnecting after a disconnect
 * - Polling-based progress updates (though SSE is preferred)
 * - Debugging and monitoring
 */
router.get(
    '/:uploadId/status',
    authenticate,
    async (req, res) => {
        const uploadProgressService = require('../services/uploadProgressService');
        const { uploadId } = req.params;

        const session = uploadProgressService.getSession(uploadId);

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'No progress information found for this upload',
                uploadId
            });
        }

        res.json({
            success: true,
            data: session
        });
    }
);

/**
 * POST /api/v1/progress/demo
 * Demo endpoint to showcase progress tracking without file upload
 *
 * This endpoint is invaluable for:
 * - Testing the progress tracking system
 * - Demonstrating the feature to stakeholders
 * - Frontend development without backend dependencies
 *
 * It simulates a long-running operation with realistic progress updates
 */
router.post(
    '/demo',
    authenticate,
    async (req, res) => {
        const uploadProgressService = require('../services/uploadProgressService');
        const { v4: uuidv4 } = require('uuid');

        const demoId = uuidv4();
        const { duration = 30000 } = req.body; // Default 30 second demo

        // Start tracking
        uploadProgressService.startTracking(demoId, {
            type: 'demo',
            userId: req.user.id,
            startTime: new Date().toISOString()
        });

        // Simulate progress through stages
        const stages = [
            { name: 'upload', duration: 0.4 },
            { name: 'validation', duration: 0.1 },
            { name: 'parsing', duration: 0.4 },
            { name: 'storing', duration: 0.1 }
        ];

        let elapsed = 0;

        // Simulate progress updates
        const simulateProgress = async () => {
            for (const stage of stages) {
                const stageDuration = duration * stage.duration;
                const steps = 10; // Update progress 10 times per stage
                const stepDuration = stageDuration / steps;

                for (let i = 1; i <= steps; i++) {
                    const progress = (i / steps) * 100;

                    uploadProgressService.updateProgress(demoId, stage.name, progress, {
                        message: `Processing ${stage.name}: ${Math.round(progress)}%`,
                        demo: true
                    });

                    await new Promise(resolve => setTimeout(resolve, stepDuration));
                }
            }

            // Complete the tracking
            uploadProgressService.completeTracking(demoId, {
                message: 'Demo completed successfully',
                totalDuration: duration
            });
        };

        // Start simulation asynchronously
        simulateProgress().catch(error => {
            console.error('Demo simulation error:', error);
            uploadProgressService.failTracking(demoId, error.message);
        });

        // Return immediately with tracking info
        res.json({
            success: true,
            message: 'Progress tracking demo started',
            demoId,
            progressUrl: `/api/v1/progress/${demoId}`,
            duration: `${duration / 1000} seconds`
        });
    }
);

module.exports = router;