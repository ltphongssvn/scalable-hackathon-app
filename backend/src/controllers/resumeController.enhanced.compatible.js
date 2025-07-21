// Enhanced Resume Controller with Compatibility Mode
// This version works with the existing database schema while providing progress tracking
// It demonstrates how to add new features without breaking existing systems

const path = require('path');
const fs = require('fs').promises;
const { query } = require('../config/database');
const huggingFaceService = require('../services/ai/huggingfaceService');
const uploadProgressService = require('../services/uploadProgressService');
const { v4: uuidv4 } = require('uuid');

/**
 * Enhanced upload function with progress tracking (Compatible Version)
 *
 * This version works with the existing database schema by:
 * 1. Not storing the upload_tracking_id in the database
 * 2. Still providing progress tracking functionality
 * 3. Maintaining backward compatibility
 */
async function uploadResumeWithProgress(req, res) {
    const uploadId = uuidv4();

    try {
        // Start progress tracking
        uploadProgressService.startTracking(uploadId, {
            userId: req.user.id,
            fileName: req.file?.originalname || 'unknown',
            fileSize: req.file?.size || 0,
            uploadStarted: new Date().toISOString()
        });

        // Update progress: File upload complete
        uploadProgressService.updateProgress(uploadId, 'upload', 100, {
            message: 'File received successfully'
        });

        // Check if a file was uploaded
        if (!req.file) {
            uploadProgressService.failTracking(uploadId, 'No file uploaded', 'upload');
            return res.status(400).json({
                success: false,
                message: 'No file uploaded',
                uploadId
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
            await fs.unlink(filePath);
            return res.status(400).json({
                success: false,
                message: 'Please upload a PDF or Word document',
                uploadId
            });
        }

        if (size > maxSize) {
            uploadProgressService.failTracking(uploadId, 'File too large', 'validation');
            await fs.unlink(filePath);
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

        // Store file metadata in database (using existing schema)
        const insertQuery = `
            INSERT INTO resumes (
                user_id,
                filename,
                original_name,
                file_path,
                file_size,
                mime_type,
                uploaded_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING id, filename, original_name, file_size, uploaded_at
        `;

        const values = [
            req.user.id,
            filename,
            originalName,
            `uploads/resumes/${filename}`,
            size,
            mimetype
        ];

        const result = await query(insertQuery, values);
        const resume = result.rows[0];

        console.log(`Resume saved to database with ID: ${resume.id}`);

        // Store the mapping between uploadId and resumeId in memory
        // This is a temporary solution until we can add the column to the database
        uploadProgressService.setMetadata(uploadId, { resumeId: resume.id });

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
            uploadId,
            data: {
                id: resume.id,
                filename: resume.original_name,
                size: resume.file_size,
                uploadedAt: resume.uploaded_at,
                parsingStatus: 'in_progress',
                progressUrl: `/api/v1/progresss/${uploadId}`
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
 */
async function parseResumeAsyncWithProgress(resumeId, filePath, userId, uploadId) {
    try {
        console.log(`Starting AI parsing for resume ID: ${resumeId} (Track: ${uploadId})`);

        // Update progress through parsing stages
        uploadProgressService.updateProgress(uploadId, 'parsing', 30, {
            message: 'Extracting text from document'
        });

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

// Add a method to the progress service for storing metadata
if (!uploadProgressService.setMetadata) {
    uploadProgressService.setMetadata = function(uploadId, metadata) {
        const session = this.getSession(uploadId);
        if (session) {
            session.metadata = { ...session.metadata, ...metadata };
        }
    };
}

/**
 * Progress tracking endpoint
 */
async function streamUploadProgress(req, res) {
    const { uploadId } = req.params;

    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    console.log(`📡 Starting progress stream for upload: ${uploadId}`);
    uploadProgressService.createSSEStream(uploadId, res);
}

// Export all functions
module.exports = {
    uploadResume: uploadResumeWithProgress,
    streamUploadProgress,
    getUserResumes: require('../controllers/resumeController').getUserResumes,
    getResumeParsedData: require('../controllers/resumeController').getResumeParsedData,
    reparseResume: require('../controllers/resumeController').reparseResume,
    deleteResume: require('../controllers/resumeController').deleteResume
};