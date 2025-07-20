// Upload Progress Service
// Implements real-time progress tracking using Server-Sent Events (SSE)
// This demonstrates advanced Node.js patterns for handling long-running operations

const EventEmitter = require('events');

/**
 * ProgressTracker manages the lifecycle of upload progress events
 *
 * Think of this like a broadcasting station that sends updates about
 * ongoing uploads to interested clients. Each upload gets its own
 * "channel" that clients can subscribe to.
 */
class ProgressTracker extends EventEmitter {
    constructor() {
        super();
        // Store active upload sessions
        // Key: uploadId, Value: progress data
        this.activeSessions = new Map();

        // Clean up stale sessions every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanupStaleSessions();
        }, 5 * 60 * 1000);
    }

    /**
     * Start tracking a new upload
     * @param {string} uploadId - Unique identifier for this upload
     * @param {object} metadata - Additional info about the upload
     */
    startTracking(uploadId, metadata = {}) {
        const session = {
            id: uploadId,
            startTime: Date.now(),
            status: 'initializing',
            progress: 0,
            stages: {
                upload: { status: 'pending', progress: 0 },
                validation: { status: 'pending', progress: 0 },
                parsing: { status: 'pending', progress: 0 },
                storing: { status: 'pending', progress: 0 }
            },
            metadata,
            lastUpdate: Date.now()
        };

        this.activeSessions.set(uploadId, session);
        this.emit(`progress:${uploadId}`, session);

        console.log(`📊 Started tracking upload: ${uploadId}`);
        return session;
    }

    /**
     * Update progress for a specific stage
     * @param {string} uploadId - Upload identifier
     * @param {string} stage - Stage name (upload, validation, parsing, storing)
     * @param {number} progress - Progress percentage (0-100)
     * @param {object} additionalData - Extra data to include in the update
     */
    updateProgress(uploadId, stage, progress, additionalData = {}) {
        const session = this.activeSessions.get(uploadId);
        if (!session) {
            console.warn(`No active session found for upload: ${uploadId}`);
            return null;
        }

        // Update the specific stage
        if (session.stages[stage]) {
            session.stages[stage] = {
                ...session.stages[stage],
                status: progress === 100 ? 'completed' : 'in_progress',
                progress: Math.min(100, Math.max(0, progress)),
                ...additionalData
            };
        }

        // Calculate overall progress as weighted average
        const stageWeights = {
            upload: 0.4,      // 40% - File upload is usually the longest
            validation: 0.1,  // 10% - Quick validation
            parsing: 0.4,     // 40% - AI parsing can take time
            storing: 0.1      // 10% - Database storage is quick
        };

        let overallProgress = 0;
        Object.entries(session.stages).forEach(([stageName, stageData]) => {
            overallProgress += (stageData.progress * (stageWeights[stageName] || 0.25));
        });

        session.progress = Math.round(overallProgress);
        session.lastUpdate = Date.now();
        session.currentStage = stage;

        // Determine overall status
        if (overallProgress === 100) {
            session.status = 'completed';
        } else if (overallProgress > 0) {
            session.status = 'processing';
        }

        // Emit the update event
        this.emit(`progress:${uploadId}`, session);

        return session;
    }

    /**
     * Mark an upload as completed
     */
    completeTracking(uploadId, result = {}) {
        const session = this.activeSessions.get(uploadId);
        if (!session) return null;

        session.status = 'completed';
        session.progress = 100;
        session.completedAt = Date.now();
        session.duration = session.completedAt - session.startTime;
        session.result = result;

        // Mark all stages as completed
        Object.keys(session.stages).forEach(stage => {
            session.stages[stage].status = 'completed';
            session.stages[stage].progress = 100;
        });

        this.emit(`progress:${uploadId}`, session);

        // Remove from active sessions after a delay
        setTimeout(() => {
            this.activeSessions.delete(uploadId);
        }, 60000); // Keep completed sessions for 1 minute

        return session;
    }

    /**
     * Mark an upload as failed
     */
    failTracking(uploadId, error, failedAtStage = null) {
        const session = this.activeSessions.get(uploadId);
        if (!session) return null;

        session.status = 'failed';
        session.error = error;
        session.failedAt = Date.now();
        session.failedAtStage = failedAtStage;

        if (failedAtStage && session.stages[failedAtStage]) {
            session.stages[failedAtStage].status = 'failed';
            session.stages[failedAtStage].error = error;
        }

        this.emit(`progress:${uploadId}`, session);

        // Remove from active sessions after a delay
        setTimeout(() => {
            this.activeSessions.delete(uploadId);
        }, 300000); // Keep failed sessions for 5 minutes for debugging

        return session;
    }

    /**
     * Get current session data
     */
    getSession(uploadId) {
        return this.activeSessions.get(uploadId);
    }

    /**
     * Clean up sessions older than 30 minutes
     */
    cleanupStaleSessions() {
        const now = Date.now();
        const maxAge = 30 * 60 * 1000; // 30 minutes

        for (const [uploadId, session] of this.activeSessions) {
            if (now - session.lastUpdate > maxAge) {
                console.log(`🧹 Cleaning up stale session: ${uploadId}`);
                this.activeSessions.delete(uploadId);
            }
        }
    }

    /**
     * Create a Server-Sent Events stream for a specific upload
     * This is what enables real-time updates in the browser
     */
    createSSEStream(uploadId, res) {
        // Set headers for SSE
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        // Send initial connection message
        res.write('event: connected\n');
        res.write(`data: ${JSON.stringify({ message: 'Connected to progress stream' })}\n\n`);

        // Function to send progress updates
        const sendProgress = (session) => {
            res.write(`event: progress\n`);
            res.write(`data: ${JSON.stringify(session)}\n\n`);
        };

        // Send current session state if exists
        const currentSession = this.getSession(uploadId);
        if (currentSession) {
            sendProgress(currentSession);
        }

        // Listen for progress updates
        const progressListener = (session) => {
            sendProgress(session);

            // Close connection if upload is completed or failed
            if (session.status === 'completed' || session.status === 'failed') {
                setTimeout(() => {
                    res.end();
                }, 1000); // Give time for final update to be sent
            }
        };

        this.on(`progress:${uploadId}`, progressListener);

        // Clean up on client disconnect
        res.on('close', () => {
            this.removeListener(`progress:${uploadId}`, progressListener);
            console.log(`📡 SSE connection closed for upload: ${uploadId}`);
        });

        // Send heartbeat every 30 seconds to keep connection alive
        const heartbeat = setInterval(() => {
            res.write(':heartbeat\n\n');
        }, 30000);

        res.on('close', () => {
            clearInterval(heartbeat);
        });
    }

    /**
     * Cleanup when shutting down
     */
    destroy() {
        clearInterval(this.cleanupInterval);
        this.removeAllListeners();
        this.activeSessions.clear();
    }
}

// Export a singleton instance
module.exports = new ProgressTracker();