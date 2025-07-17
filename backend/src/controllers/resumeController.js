// Resume Controller
// Handles all resume-related operations including upload, retrieval, and deletion

const path = require('path');
const fs = require('fs').promises;
const { query } = require('../config/database');

/**
 * Upload a resume
 *
 * This function handles the resume upload process after multer has processed the file.
 * It stores metadata in the database and prepares the response.
 */
async function uploadResume(req, res) {
    try {
        // Check if a file was uploaded
        // Multer adds the 'file' object to the request when a file is successfully uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Extract file information
        // req.file is populated by multer with details about the uploaded file
        const {
            filename,      // The name we gave the file on our server
            size,          // File size in bytes
            mimetype       // MIME type of the file
        } = req.file;

        // Get the original filename from our middleware
        const originalName = req.uploadedFileOriginalName || req.file.originalname;

        // Store file metadata in the database
        // We don't store the actual file in the database, just information about it
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
            req.user.id,                    // From our auth middleware
            filename,                        // Unique filename on server
            originalName,                    // Original filename from user
            `uploads/resumes/${filename}`,   // Full path to file
            size,                           // File size
            mimetype                        // File type
        ];

        const result = await query(insertQuery, values);
        const resume = result.rows[0];

        // Send success response
        res.status(201).json({
            success: true,
            message: 'Resume uploaded successfully',
            data: {
                id: resume.id,
                filename: resume.original_name,  // Show user their original filename
                size: resume.file_size,
                uploadedAt: resume.uploaded_at
            }
        });

    } catch (error) {
        console.error('Resume upload error:', error);

        // If there was an error after the file was saved, we should delete it
        // This prevents orphaned files on the server
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Error deleting file after failed upload:', unlinkError);
            }
        }

        res.status(500).json({
            success: false,
            message: 'Failed to upload resume'
        });
    }
}

/**
 * Get all resumes for the authenticated user
 *
 * This function retrieves metadata for all resumes uploaded by the current user
 */
async function getUserResumes(req, res) {
    try {
        const selectQuery = `
      SELECT 
        id,
        original_name,
        file_size,
        mime_type,
        uploaded_at
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
 * Delete a resume
 *
 * This function deletes both the file from the filesystem and its metadata from the database
 */
async function deleteResume(req, res) {
    try {
        const resumeId = req.params.id;

        // First, get the file information to ensure it belongs to the user
        const selectQuery = `
      SELECT filename, file_path
      FROM resumes
      WHERE id = $1 AND user_id = $2
    `;

        const result = await query(selectQuery, [resumeId, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Resume not found'
            });
        }

        const resume = result.rows[0];

        // Delete the file from filesystem
        try {
            await fs.unlink(resume.file_path);
        } catch (fileError) {
            console.error('Error deleting file:', fileError);
            // Continue even if file deletion fails (it might already be deleted)
        }

        // Delete the database record
        await query('DELETE FROM resumes WHERE id = $1', [resumeId]);

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

module.exports = {
    uploadResume,
    getUserResumes,
    deleteResume
};