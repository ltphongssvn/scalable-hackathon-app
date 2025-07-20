// Enhanced Resume Controller with Real-Time Progress Tracking
// This version integrates the progress tracking service to provide
// real-time feedback during resume upload and processing

const path = require('path');
const fs = require('fs').promises;
const { query } = require('../config/database');
const huggingFaceService = require('../services/ai/huggingfaceService');
const uploadProgressService = require('../services/uploadProgressService');
const { v4: uuidv4 } = require('uuid'); // You'll need to install uuid package

/**
 * Enhanced upload function with progress tracking
 *
 * This version of uploadResume demonstrates how to integrate
 * real-time progress tracking into existing functionality.
 * The key architectural principle here is "progressive enhancement" -
 * we add new capabilities without breaking existing contracts.
 */
async function uploadResumeWithProgress(req, res) {
    // Generate a unique upload ID for tracking
    // This ID will be used to subscribe to progress updates
    const uploadId = uuidv4();

    try {
        // Start progress tracking before any processing
        uploadProgressService.startTracking(uploadId, {
            userId: req.user.id,
            fileName: req.file?.originalname || 'unknown',
            fileSize: req.file?.size || 0,
            uploadStarted: new Date().toISOString()
        });

        // Update progress: File upload complete (since multer already handled it)
        uploadProgressService.updateProgress(uploadId, 'upload', 100, {
            message: 'File received successfully'
        });

        // Check if a file was uploaded
        if (!req.file) {
            uploadProgressService.failTracking(uploadId, 'No file uploaded', 'upload');
            return res.status(400).json({
                success: false,
                message: 'No file uploaded',
                uploadId // Include uploadId even on failure for consistency
            });
        }

        // Update progress: Starting validation
        uploadProgressService.updateProgress(uploadId, 'validation', 20, {
            message: 'Validating file format and size'
        });

        // Extract file information
        const {
            filename,
            path: filePath,
            size,
            mimetype
        } = req.file;

        const originalName = req.uploadedFileOriginalName || req.file.originalname;

        console.log(`Processing resume upload: ${originalName} (Track ID: ${uploadId})`);

        // Validate file type and size
        const allowedTypes = ['application/pdf', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!allowedTypes.includes(mimetype)) {
            uploadProgressService.failTracking(uploadId, 'Invalid file type', 'validation');
            await fs.unlink(filePath); // Clean up the file
            return res.status(400).json({
                success: false,
                message: 'Please upload a PDF or Word document',
                uploadId
            });
        }

        if (size > maxSize) {
            uploadProgressService.failTracking(uploadId, 'File too large', 'validation');
            await fs.unlink(filePath); // Clean up the file
            return res.status(400).json({
                success: false,
                message: 'File size must be less than 5MB',
                uploadId
            });
        }

        // Update progress: Validation complete
        uploadProgressService.updateProgress(uploadId, 'validation', 100, {
            message: 'File validation successful'
        });

        // Update progress: Starting database storage
        uploadProgressService.updateProgress(uploadId, 'storing', 20, {
            message: 'Saving resume metadata'
        });

        // Store file metadata in database
        const insertQuery = `
            INSERT INTO resumes (
                user_id,
                filename,
                original_name,
                file_path,
                file_size,
                mime_type,
                upload_tracking_id,
                uploaded_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING id, filename, original_name, file_size, uploaded_at
        `;

        const values = [
            req.user.id,
            filename,
            originalName,
            `uploads/resumes/${filename}`,
            size,
            mimetype,
            uploadId // Store the tracking ID for reference
        ];

        const result = await query(insertQuery, values);
        const resume = result.rows[0];

        console.log(`Resume saved to database with ID: ${resume.id}`);

        // Update progress: Database storage complete
        uploadProgressService.updateProgress(uploadId, 'storing', 100, {
            message: 'Resume metadata saved successfully',
            resumeId: resume.id
        });

        // Update progress: Starting AI parsing
        uploadProgressService.updateProgress(uploadId, 'parsing', 10, {
            message: 'Initiating AI resume parsing'
        });

        // Trigger enhanced async parsing with progress tracking
        parseResumeAsyncWithProgress(resume.id, filePath, req.user.id, uploadId);

        // Send response with upload ID for progress tracking
        res.status(201).json({
            success: true,
            message: 'Resume uploaded successfully. AI parsing in progress...',
            uploadId, // Critical: Frontend needs this to subscribe to progress
            data: {
                id: resume.id,
                filename: resume.original_name,
                size: resume.file_size,
                uploadedAt: resume.uploaded_at,
                parsingStatus: 'in_progress',
                progressUrl: `/api/v1/resumes/progress/${uploadId}` // SSE endpoint
            }
        });

    } catch (error) {
        console.error('Resume upload error:', error);
        uploadProgressService.failTracking(uploadId, error.message, 'storing');

        // Clean up file if database operation failed
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
                console.log('Cleaned up uploaded file after error');
            } catch (unlinkError) {
                console.error('Error deleting file:', unlinkError);
            }
        }

        res.status(500).json({
            success: false,
            message: 'Failed to upload resume',
            uploadId
        });
    }
}

/**
 * Enhanced async parsing with progress updates
 *
 * This function demonstrates how to provide granular progress updates
 * during a long-running AI operation. The key is to break down the
 * operation into measurable steps and report progress at each step.
 */
async function parseResumeAsyncWithProgress(resumeId, filePath, userId, uploadId) {
    try {
        console.log(`Starting AI parsing for resume ID: ${resumeId} (Track: ${uploadId})`);

        // Simulate parsing progress stages
        // In a real implementation, you might get progress callbacks from the AI service
        uploadProgressService.updateProgress(uploadId, 'parsing', 30, {
            message: 'Extracting text from document'
        });

        // Add a small delay to make progress visible (remove in production)
        await new Promise(resolve => setTimeout(resolve, 1000));

        uploadProgressService.updateProgress(uploadId, 'parsing', 50, {
            message: 'Analyzing resume structure'
        });

        // Call the Hugging Face service
        const parseResult = await huggingFaceService.parseResume(filePath);

        uploadProgressService.updateProgress(uploadId, 'parsing', 80, {
            message: 'Processing extracted information'
        });

        if (parseResult.success) {
            // Update database with parsed data
            const updateQuery = `
                UPDATE resumes 
                SET 
                    parsed_data = $1,
                    parsed_at = NOW()
                WHERE id = $2 AND user_id = $3
            `;

            await query(updateQuery, [
                JSON.stringify(parseResult.data),
                resumeId,
                userId
            ]);

            // Update progress: Parsing complete
            uploadProgressService.updateProgress(uploadId, 'parsing', 100, {
                message: 'AI parsing completed successfully',
                extractedFields: Object.keys(parseResult.data).length
            });

            // Mark the entire upload as complete
            uploadProgressService.completeTracking(uploadId, {
                resumeId,
                parsedData: parseResult.data,
                message: 'Resume processing completed successfully'
            });

            console.log(`✓ Resume ID ${resumeId} parsed successfully`);

        } else {
            console.error(`Failed to parse resume ID ${resumeId}:`, parseResult.error);

            // Update progress: Parsing failed
            uploadProgressService.failTracking(uploadId, parseResult.error, 'parsing');

            // Still update the database to record the attempt
            const updateQuery = `
                UPDATE resumes 
                SET 
                    parsed_data = $1,
                    parsed_at = NOW()
                WHERE id = $2 AND user_id = $3
            `;

            await query(updateQuery, [
                JSON.stringify({ error: parseResult.error, attempted: true }),
                resumeId,
                userId
            ]);
        }
    } catch (error) {
        console.error(`Error in async resume parsing for ID ${resumeId}:`, error);
        uploadProgressService.failTracking(uploadId, error.message, 'parsing');
    }
}

/**
 * Progress tracking endpoint - provides SSE stream
 *
 * This endpoint demonstrates how to expose real-time progress updates
 * to the frontend using Server-Sent Events. It's a separate endpoint
 * that the frontend can connect to after initiating an upload.
 */
async function streamUploadProgress(req, res) {
    const { uploadId } = req.params;

    // Verify the user has access to this upload
    // In a production system, you'd check if this uploadId belongs to the user
    // For now, we'll just check if they're authenticated
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    console.log(`📡 Starting progress stream for upload: ${uploadId}`);

    // Create SSE stream for this upload
    uploadProgressService.createSSEStream(uploadId, res);
}

// Export all functions including the original ones
// This allows for gradual migration - existing code continues to work
// while new code can use the enhanced versions
module.exports = {
    // Enhanced versions with progress tracking
    uploadResume: uploadResumeWithProgress,
    streamUploadProgress,

    // Original functions remain available
    getUserResumes: require('../controllers/resumeController').getUserResumes,
    getResumeParsedData: require('../controllers/resumeController').getResumeParsedData,
    reparseResume: require('../controllers/resumeController').reparseResume,
    deleteResume: require('../controllers/resumeController').deleteResume
};