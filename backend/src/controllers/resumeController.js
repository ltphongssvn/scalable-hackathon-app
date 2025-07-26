// Resume Controller
// Handles all business logic related to resume operations
// Updated to support both local and S3 storage

const { query } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const huggingFaceService = require('../services/huggingFaceResumeService');

/**
 * Upload Resume Controller
 * Handles file upload for both local and S3 storage
 *
 * Process:
 * 1. File validation (handled by multer)
 * 2. Storage-agnostic file handling
 * 3. Database record creation
 * 4. Async parsing trigger
 */
async function uploadResume(req, res) {
    try {
        // Check if a file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

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
                mimetype: req.file.contentType || req.file.mimetype
            };
        } else {
            // Local storage
            console.log('Processing local upload');
            fileInfo = {
                filename: req.file.filename,
                filePath: req.file.path,
                storagePath: `uploads/resumes/${req.file.filename}`,
                size: req.file.size,
                mimetype: req.file.mimetype
            };
        }

        // Get the original filename
        const originalName = req.uploadedFileOriginalName || req.file.originalname;

        console.log(`Processing resume upload: ${originalName}`);
        console.log(`Storage type: ${req.file.location ? 'S3' : 'Local'}`);

        // Store the file metadata in database
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

        // Trigger AI parsing asynchronously
        // For S3 files, we pass the S3 URL; for local files, we pass the file path
        parseResumeAsync(resume.id, fileInfo.filePath, req.user.id);

        // Send immediate success response
        res.json({
            success: true,
            message: 'Resume uploaded successfully',
            data: {
                id: resume.id,
                filename: resume.filename,
                originalName: resume.original_name,
                fileSize: resume.file_size,
                uploadedAt: resume.uploaded_at,
                status: 'processing'
            }
        });

    } catch (error) {
        console.error('Upload error:', error);

        // If upload failed and we're using local storage, try to clean up the file
        if (req.file && req.file.path && !req.file.location) {
            try {
                await fs.unlink(req.file.path);
                console.log('Cleaned up failed upload file');
            } catch (cleanupError) {
                console.error('Error cleaning up file:', cleanupError);
            }
        }

        res.status(500).json({
            success: false,
            message: 'Failed to upload resume',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

/**
 * Parse Resume Asynchronously
 * This runs in the background after upload response is sent
 *
 * @param {number} resumeId - Database ID of the resume
 * @param {string} filePath - Path to the uploaded file (local path or S3 URL)
 * @param {number} userId - ID of the user who uploaded
 */
async function parseResumeAsync(resumeId, filePath, userId) {
    console.log(`Starting async parsing for resume ${resumeId}`);

    try {
        // Call the Hugging Face service to parse the resume
        const parseResult = await huggingFaceService.parseResume(filePath);

        // Update the resume record with parsed data
        const updateQuery = `
            UPDATE resumes 
            SET 
                parsed_data = $1,
                parsed_at = NOW(),
                status = 'completed'
            WHERE id = $2 AND user_id = $3
        `;

        await query(updateQuery, [
            JSON.stringify(parseResult),
            resumeId,
            userId
        ]);

        console.log(`Successfully parsed resume ${resumeId}`);

    } catch (error) {
        console.error(`Error parsing resume ${resumeId}:`, error);

        // Update status to failed
        const errorQuery = `
            UPDATE resumes 
            SET 
                status = 'failed',
                error_message = $1
            WHERE id = $2 AND user_id = $3
        `;

        await query(errorQuery, [
            error.message,
            resumeId,
            userId
        ]);
    }
}

/**
 * Get all resumes for the authenticated user
 */
async function getUserResumes(req, res) {
    try {
        const selectQuery = `
            SELECT 
                id,
                filename,
                original_name,
                file_size,
                mime_type,
                status,
                uploaded_at,
                parsed_at,
                CASE 
                    WHEN parsed_data IS NOT NULL 
                    THEN jsonb_build_object(
                        'name', parsed_data->'name',
                        'email', parsed_data->'email',
                        'summary', parsed_data->'summary'
                    )
                    ELSE NULL
                END as preview
            FROM resumes
            WHERE user_id = $1
            ORDER BY uploaded_at DESC
        `;

        const result = await query(selectQuery, [req.user.id]);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Error fetching resumes:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch resumes'
        });
    }
}

/**
 * Get parsed data for a specific resume
 */
async function getResumeParsedData(req, res) {
    try {
        const { id } = req.params;

        const selectQuery = `
            SELECT 
                id,
                original_name,
                parsed_data,
                status,
                error_message,
                parsed_at
            FROM resumes
            WHERE id = $1 AND user_id = $2
        `;

        const result = await query(selectQuery, [id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Resume not found'
            });
        }

        const resume = result.rows[0];

        // Check if parsing is complete
        if (resume.status !== 'completed' || !resume.parsed_data) {
            return res.status(200).json({
                success: true,
                data: {
                    id: resume.id,
                    status: resume.status,
                    error: resume.error_message,
                    message: resume.status === 'processing'
                        ? 'Resume is still being processed. Please check back later.'
                        : 'Resume parsing failed or is incomplete.'
                }
            });
        }

        res.json({
            success: true,
            data: {
                id: resume.id,
                originalName: resume.original_name,
                parsedData: resume.parsed_data,
                parsedAt: resume.parsed_at
            }
        });

    } catch (error) {
        console.error('Error fetching parsed data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch parsed data'
        });
    }
}

/**
 * Trigger re-parsing of a resume
 */
async function reparseResume(req, res) {
    try {
        const { id } = req.params;

        // Get the resume details
        const selectQuery = `
            SELECT id, file_path
            FROM resumes
            WHERE id = $1 AND user_id = $2
        `;

        const result = await query(selectQuery, [id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Resume not found'
            });
        }

        const resume = result.rows[0];

        // Reset status to processing
        const updateQuery = `
            UPDATE resumes 
            SET 
                status = 'processing',
                error_message = NULL,
                parsed_data = NULL,
                parsed_at = NULL
            WHERE id = $1 AND user_id = $2
        `;

        await query(updateQuery, [id, req.user.id]);

        // Determine file path based on storage type
        let filePath;
        if (resume.file_path.startsWith('http') || resume.file_path.startsWith('https')) {
            // S3 URL stored in database
            filePath = resume.file_path;
        } else if (resume.file_path.startsWith('resumes/')) {
            // S3 key stored in database - need to construct URL
            // This assumes you have S3_BUCKET_NAME and AWS_REGION in env
            const bucketName = process.env.S3_BUCKET_NAME;
            const region = process.env.AWS_REGION || 'us-east-1';
            filePath = `https://${bucketName}.s3.${region}.amazonaws.com/${resume.file_path}`;
        } else {
            // Local file path
            filePath = path.join(__dirname, '../../', resume.file_path);
        }

        // Trigger re-parsing
        parseResumeAsync(resume.id, filePath, req.user.id);

        res.json({
            success: true,
            message: 'Resume re-parsing initiated',
            data: {
                id: resume.id,
                status: 'processing'
            }
        });

    } catch (error) {
        console.error('Error triggering re-parse:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to trigger re-parsing'
        });
    }
}

/**
 * Delete a resume
 */
async function deleteResume(req, res) {
    try {
        const { id } = req.params;

        // Get file information before deleting
        const selectQuery = `
            SELECT id, filename, file_path
            FROM resumes
            WHERE id = $1 AND user_id = $2
        `;

        const result = await query(selectQuery, [id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Resume not found'
            });
        }

        const resume = result.rows[0];

        // Delete from database first
        const deleteQuery = `
            DELETE FROM resumes
            WHERE id = $1 AND user_id = $2
        `;

        await query(deleteQuery, [id, req.user.id]);

        // Try to delete the file (handle both storage types)
        try {
            if (resume.file_path.startsWith('http') || resume.file_path.startsWith('https')) {
                // S3 file - need to use AWS SDK to delete
                console.log('S3 file deletion should be handled here');
                // TODO: Implement S3 deletion using AWS SDK
                // const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
                // await s3Client.send(new DeleteObjectCommand({
                //     Bucket: process.env.S3_BUCKET_NAME,
                //     Key: resume.file_path
                // }));
            } else if (resume.file_path.startsWith('resumes/')) {
                // S3 key stored in database
                console.log('S3 file deletion should be handled here for key:', resume.file_path);
                // TODO: Implement S3 deletion
            } else {
                // Local file
                const fullPath = path.join(__dirname, '../../', resume.file_path);
                await fs.unlink(fullPath);
                console.log('Deleted local file:', fullPath);
            }
        } catch (fileError) {
            // Log error but don't fail the request since DB record is already deleted
            console.error('Error deleting file:', fileError);
        }

        res.json({
            success: true,
            message: 'Resume deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting resume:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete resume'
        });
    }
}

// Export all controller functions
module.exports = {
    uploadResume,
    getUserResumes,
    getResumeParsedData,
    reparseResume,
    deleteResume
};