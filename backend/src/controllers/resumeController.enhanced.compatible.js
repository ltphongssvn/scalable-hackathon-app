// Enhanced Resume Controller with Compatibility Mode
// This version works with the existing database schema while providing progress tracking
// Updated to support both local and S3 storage
const path = require('path');
const fs = require('fs').promises;
const { query } = require('../config/database');
const huggingFaceService = require('../services/ai/huggingfaceService');
const uploadProgressService = require('../services/uploadProgressService');
const { v4: uuidv4 } = require('uuid');

/**
 * Enhanced upload function with progress tracking (Compatible Version)
 * Now supports both local and S3 storage
 *
 * This version works with the existing database schema by:
 * 1. Not storing the upload_tracking_id in the database
 * 2. Still providing progress tracking functionality
 * 3. Maintaining backward compatibility
 * 4. Supporting both local and S3 storage
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

        // Detect storage type and extract file information accordingly
        let fileInfo = {};

        // Check if this is an S3 upload (multer-s3 adds these properties)
        if (req.file.location && req.file.key) {
            // S3 storage
            console.log('Processing S3 upload');
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
            console.log('Processing local upload');
            fileInfo = {
                filename: req.file.filename,
                filePath: req.file.path,
                storagePath: `uploads/resumes/${req.file.filename}`,
                size: req.file.size,
                mimetype: req.file.mimetype,
                isS3: false
            };
        }

        const originalName = req.uploadedFileOriginalName || req.file.originalname;
        console.log(`Processing resume upload: ${originalName} (Track ID: ${uploadId})`);
        console.log(`Storage type: ${fileInfo.isS3 ? 'S3' : 'Local'}`);

        // Validate file type and size
        const allowedTypes = ['application/pdf', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!allowedTypes.includes(fileInfo.mimetype)) {
            uploadProgressService.failTracking(uploadId, 'Invalid file type', 'validation');

            // Clean up file if using local storage
            if (!fileInfo.isS3 && req.file.path) {
                await fs.unlink(req.file.path);
            }

            return res.status(400).json({
                success: false,
                message: 'Please upload a PDF or Word document',
                uploadId
            });
        }

        if (fileInfo.size > maxSize) {
            uploadProgressService.failTracking(uploadId, 'File too large', 'validation');

            // Clean up file if using local storage
            if (!fileInfo.isS3 && req.file.path) {
                await fs.unlink(req.file.path);
            }

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
            fileInfo.filename,
            originalName,
            fileInfo.storagePath,  // This will be S3 key or local path
            fileInfo.size,
            fileInfo.mimetype
        ];

        const result = await query(insertQuery, values);
        const resume = result.rows[0];

        console.log(`Resume saved to database with ID: ${resume.id}`);

        // Store the mapping between uploadId and resumeId in memory
        uploadProgressService.setMetadata(uploadId, {
            resumeId: resume.id,
            storageType: fileInfo.isS3 ? 's3' : 'local'
        });

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
        // For S3 files, we pass the S3 URL; for local files, we pass the file path
        parseResumeAsyncWithProgress(resume.id, fileInfo.filePath, req.user.id, uploadId);

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
                progressUrl: `/api/v1/progress/${uploadId}`,
                storageType: fileInfo.isS3 ? 's3' : 'local'
            }
        });

    } catch (error) {
        console.error('Resume upload error:', error);
        uploadProgressService.failTracking(uploadId, error.message, 'storing');

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
            message: 'Failed to upload resume',
            uploadId,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

/**
 * Enhanced async parsing with progress updates
 * Now handles both local files and S3 URLs
 */
async function parseResumeAsyncWithProgress(resumeId, filePath, userId, uploadId) {
    try {
        console.log(`Starting AI parsing for resume ID: ${resumeId} (Track: ${uploadId})`);
        console.log(`File path/URL: ${filePath}`);

        // Update progress through parsing stages
        uploadProgressService.updateProgress(uploadId, 'parsing', 30, {
            message: 'Extracting text from document'
        });

        await new Promise(resolve => setTimeout(resolve, 1000));

        uploadProgressService.updateProgress(uploadId, 'parsing', 50, {
            message: 'Analyzing resume structure'
        });

        // Call the Hugging Face service
        // The service should be able to handle both local paths and S3 URLs
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
// Note: We're using the updated base controller functions that now support both storage types
module.exports = {
    uploadResume: uploadResumeWithProgress,
    streamUploadProgress,
    getUserResumes: require('../controllers/resumeController').getUserResumes,
    getResumeParsedData: require('../controllers/resumeController').getResumeParsedData,
    reparseResume: require('../controllers/resumeController').reparseResume,
    deleteResume: require('../controllers/resumeController').deleteResume
};