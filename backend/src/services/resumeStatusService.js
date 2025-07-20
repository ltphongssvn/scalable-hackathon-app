// Resume Status Service
// File: src/services/resumeStatusService.js

const { query } = require('../config/database');

class ResumeStatusService {
    constructor() {
        // Define the valid status transitions to ensure state machine integrity
        this.validTransitions = {
            'uploaded': ['transcribing', 'failed'],
            'transcribing': ['transcribed', 'failed'],
            'transcribed': ['parsing', 'failed'],
            'parsing': ['parsed', 'failed'],
            'parsed': ['enhancing', 'completed', 'failed'],
            'enhancing': ['enhanced', 'failed'],
            'enhanced': ['completed', 'failed'],
            'completed': [], // Terminal state
            'failed': ['transcribing'] // Allow retry from failed state
        };

        // Define status messages that are user-friendly
        this.statusMessages = {
            'uploaded': 'Your voice resume has been received and is queued for processing',
            'transcribing': 'Converting your audio to text using AI speech recognition',
            'transcribed': 'Audio successfully converted to text',
            'parsing': 'Extracting information from your resume text',
            'parsed': 'Resume information successfully extracted',
            'enhancing': 'Analyzing your resume with AI for additional insights',
            'enhanced': 'AI analysis complete',
            'completed': 'Your resume has been fully processed and is ready',
            'failed': 'An error occurred during processing'
        };
    }

    /**
     * Update the status of a resume with validation and history tracking
     * This method ensures that status transitions follow our defined state machine
     */
    async updateStatus(resumeId, newStatus, metadata = {}) {
        try {
            // First, get the current status to validate the transition
            const currentStatusResult = await query(
                'SELECT processing_status FROM resumes WHERE id = $1',
                [resumeId]
            );

            if (currentStatusResult.rows.length === 0) {
                throw new Error('Resume not found');
            }

            const currentStatus = currentStatusResult.rows[0].processing_status;

            // Validate the status transition
            if (!this.isValidTransition(currentStatus, newStatus)) {
                console.warn(`Invalid status transition attempted: ${currentStatus} -> ${newStatus}`);
                return false;
            }

            // Add processing time to metadata if transitioning to a completed state
            if (newStatus === 'completed' || newStatus === 'failed') {
                const timingResult = await query(
                    'SELECT processing_started_at FROM resumes WHERE id = $1',
                    [resumeId]
                );

                if (timingResult.rows[0].processing_started_at) {
                    const processingTime = Date.now() - new Date(timingResult.rows[0].processing_started_at).getTime();
                    metadata.totalProcessingTime = processingTime;
                    metadata.processingTimeFormatted = this.formatDuration(processingTime);
                }
            }

            // Update the status using our database function
            await query(
                'SELECT update_resume_status($1, $2, $3)',
                [resumeId, newStatus, JSON.stringify(metadata)]
            );

            console.log(`Resume ${resumeId} status updated: ${currentStatus} -> ${newStatus}`);
            return true;

        } catch (error) {
            console.error('Error updating resume status:', error);
            throw error;
        }
    }

    /**
     * Check if a status transition is valid according to our state machine
     */
    isValidTransition(fromStatus, toStatus) {
        if (!this.validTransitions[fromStatus]) {
            return false;
        }
        return this.validTransitions[fromStatus].includes(toStatus);
    }

    /**
     * Get the current status and processing details for a resume
     * This provides a comprehensive view of the resume's processing journey
     */
    async getStatus(resumeId, userId = null) {
        try {
            let queryText = `
                SELECT 
                    id,
                    original_name,
                    processing_status,
                    status_history,
                    processing_metadata,
                    confidence_scores,
                    processing_started_at,
                    processing_completed_at,
                    last_status_update,
                    uploaded_at
                FROM resumes
                WHERE id = $1
            `;

            const params = [resumeId];

            // Add user check if userId provided for security
            if (userId) {
                queryText += ' AND user_id = $2';
                params.push(userId);
            }

            const result = await query(queryText, params);

            if (result.rows.length === 0) {
                return null;
            }

            const resume = result.rows[0];

            // Calculate processing progress percentage
            const progress = this.calculateProgress(resume.processing_status);

            // Get the user-friendly message
            const message = this.statusMessages[resume.processing_status];

            // Calculate time in current status
            const timeInCurrentStatus = Date.now() - new Date(resume.last_status_update).getTime();

            return {
                resumeId: resume.id,
                fileName: resume.original_name,
                currentStatus: resume.processing_status,
                message: message,
                progress: progress,
                statusHistory: resume.status_history || [],
                metadata: resume.processing_metadata || {},
                confidenceScores: resume.confidence_scores || {},
                timeInCurrentStatus: this.formatDuration(timeInCurrentStatus),
                totalProcessingTime: resume.processing_completed_at
                    ? this.formatDuration(
                        new Date(resume.processing_completed_at) - new Date(resume.processing_started_at)
                    )
                    : null,
                isComplete: ['completed', 'failed'].includes(resume.processing_status),
                canRetry: resume.processing_status === 'failed'
            };

        } catch (error) {
            console.error('Error getting resume status:', error);
            throw error;
        }
    }

    /**
     * Calculate progress percentage based on current status
     * This gives users a visual indication of how far along their resume is
     */
    calculateProgress(status) {
        const progressMap = {
            'uploaded': 10,
            'transcribing': 25,
            'transcribed': 40,
            'parsing': 55,
            'parsed': 70,
            'enhancing': 85,
            'enhanced': 95,
            'completed': 100,
            'failed': 0
        };

        return progressMap[status] || 0;
    }

    /**
     * Format duration in milliseconds to human-readable format
     */
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Get processing statistics for a user
     * This helps users understand their usage patterns
     */
    async getUserStats(userId) {
        try {
            const statsQuery = `
                SELECT 
                    COUNT(*) as total_resumes,
                    COUNT(*) FILTER (WHERE processing_status = 'completed') as completed_resumes,
                    COUNT(*) FILTER (WHERE processing_status = 'failed') as failed_resumes,
                    COUNT(*) FILTER (WHERE processing_status NOT IN ('completed', 'failed')) as processing_resumes,
                    AVG(
                        EXTRACT(EPOCH FROM (processing_completed_at - processing_started_at))
                    ) FILTER (WHERE processing_completed_at IS NOT NULL) as avg_processing_seconds
                FROM resumes
                WHERE user_id = $1 AND resume_type = 'voice'
            `;

            const result = await query(statsQuery, [userId]);
            const stats = result.rows[0];

            return {
                totalResumes: parseInt(stats.total_resumes),
                completedResumes: parseInt(stats.completed_resumes),
                failedResumes: parseInt(stats.failed_resumes),
                processingResumes: parseInt(stats.processing_resumes),
                averageProcessingTime: stats.avg_processing_seconds
                    ? this.formatDuration(stats.avg_processing_seconds * 1000)
                    : null,
                successRate: stats.total_resumes > 0
                    ? Math.round((stats.completed_resumes / stats.total_resumes) * 100)
                    : 0
            };

        } catch (error) {
            console.error('Error getting user stats:', error);
            throw error;
        }
    }
}

module.exports = new ResumeStatusService();