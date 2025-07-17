// Resume Routes
// Defines all API endpoints related to resume operations

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { upload } = require('../config/upload');
const resumeController = require('../controllers/resumeController');

// All resume routes require authentication
// This ensures only logged-in users can upload, view, or delete resumes

/**
 * POST /api/v1/resume/upload
 * Upload a new resume
 *
 * The upload.single('resume') middleware:
 * 1. Looks for a file in the 'resume' field of the multipart request
 * 2. Validates the file type and size
 * 3. Saves the file to disk
 * 4. Adds file info to req.file
 * 5. Passes control to the controller
 */
router.post(
    '/upload',
    authenticate,                    // First, verify the user is logged in
    upload.single('resume'),         // Then, handle the file upload
    resumeController.uploadResume    // Finally, process the upload
);

/**
 * GET /api/v1/resume
 * Get all resumes for the authenticated user
 */
router.get(
    '/',
    authenticate,
    resumeController.getUserResumes
);

/**
 * DELETE /api/v1/resume/:id
 * Delete a specific resume
 */
router.delete(
    '/:id',
    authenticate,
    resumeController.deleteResume
);

module.exports = router;