// Upload Configuration
// This module centralizes all file upload settings and creates configured multer instances

const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Define allowed file types and their MIME types
// This is a security measure to ensure only expected file types are uploaded
const ALLOWED_FILE_TYPES = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
};

// Maximum file size (5MB in bytes)
// This prevents users from uploading extremely large files that could fill up your server
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Configure storage engine
// The storage engine determines where and how files are saved
const storage = multer.diskStorage({
    // Destination function determines where to store the file
    destination: function (req, file, cb) {
        // All resumes go to the uploads/resumes directory
        // The callback pattern (cb) is Node.js convention for async operations
        cb(null, 'uploads/resumes');
    },

    // Filename function determines what to name the file
    filename: function (req, file, cb) {
        // Generate a unique filename to prevent collisions
        // Format: userid_timestamp_uuid.extension
        // This ensures we can track who uploaded what and when
        const userId = req.user.id; // From our auth middleware
        const timestamp = Date.now();
        const uniqueId = uuidv4();
        const extension = ALLOWED_FILE_TYPES[file.mimetype] || 'pdf';

        // Construct the filename
        const filename = `${userId}_${timestamp}_${uniqueId}.${extension}`;

        // Store the original filename in the request for later use
        // This allows us to show users their original filename while storing it safely
        req.uploadedFileOriginalName = file.originalname;

        cb(null, filename);
    }
});

// File filter function to validate uploads before they're saved
// This runs before the file is saved to disk, preventing invalid files from being stored
const fileFilter = (req, file, cb) => {
    // Check if the file type is allowed
    if (ALLOWED_FILE_TYPES[file.mimetype]) {
        // Accept the file
        cb(null, true);
    } else {
        // Reject the file with an error
        // This error will be caught by multer and can be handled in our route
        cb(new Error('Invalid file type. Only PDF, DOC, and DOCX files are allowed.'), false);
    }
};

// Create the multer instance with our configuration
// This combines all our settings into a configured uploader
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1 // Only allow 1 file per upload request
    }
});

// Export both the configured upload instance and our constants
// This allows other modules to use the uploader and reference the settings
module.exports = {
    upload,
    ALLOWED_FILE_TYPES,
    MAX_FILE_SIZE
};