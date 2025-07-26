// S3 Upload Configuration
// This module configures multer to use AWS S3 as the storage backend instead of local disk
const { S3Client } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Create S3 client
// This client will be used to communicate with AWS S3
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// Define allowed file types for resumes (same as original upload.js)
const ALLOWED_FILE_TYPES = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
};

// Define allowed audio types (same as original voiceUpload.js)
const ALLOWED_AUDIO_TYPES = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/wave': 'wav',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a'
};

// File size limits
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB for documents
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB for audio

// Create S3 storage configuration for regular resume uploads
const createResumeS3Storage = () => {
    return multerS3({
        s3: s3Client,
        bucket: process.env.S3_BUCKET_NAME,
        // The key is the filename in S3
        key: function (req, file, cb) {
            const userId = req.user.id;
            const timestamp = Date.now();
            const uniqueId = uuidv4();
            const extension = ALLOWED_FILE_TYPES[file.mimetype] || 'pdf';
            // Organize files in S3 with a folder structure
            const filename = `resumes/${userId}_${timestamp}_${uniqueId}.${extension}`;

            // Store original filename for later use
            req.uploadedFileOriginalName = file.originalname;

            cb(null, filename);
        },
        // Set proper content type so files can be viewed in browser
        contentType: multerS3.AUTO_CONTENT_TYPE,
        // Set metadata
        metadata: function (req, file, cb) {
            cb(null, {
                originalName: file.originalname,
                userId: req.user.id.toString()
            });
        }
    });
};

// Create S3 storage configuration for voice uploads
const createVoiceS3Storage = () => {
    return multerS3({
        s3: s3Client,
        bucket: process.env.S3_BUCKET_NAME,
        key: function (req, file, cb) {
            const userId = req.user.id;
            const timestamp = Date.now();
            const uniqueId = uuidv4();
            const extension = ALLOWED_AUDIO_TYPES[file.mimetype] || 'audio';
            // Organize voice files in a separate folder
            const filename = `voice-resumes/${userId}_${timestamp}_${uniqueId}.${extension}`;

            req.uploadedFileOriginalName = file.originalname;

            cb(null, filename);
        },
        contentType: multerS3.AUTO_CONTENT_TYPE,
        metadata: function (req, file, cb) {
            cb(null, {
                originalName: file.originalname,
                userId: req.user.id.toString()
            });
        }
    });
};

// File filter for resume uploads
const resumeFileFilter = (req, file, cb) => {
    if (ALLOWED_FILE_TYPES[file.mimetype]) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, DOC, and DOCX files are allowed.'), false);
    }
};

// File filter for voice uploads
const voiceFileFilter = (req, file, cb) => {
    if (ALLOWED_AUDIO_TYPES[file.mimetype]) {
        cb(null, true);
    } else {
        cb(new Error('Invalid audio format. Supported formats: MP3, WAV, M4A, OGG, WebM'), false);
    }
};

// Create configured multer instances
const resumeUpload = multer({
    storage: createResumeS3Storage(),
    fileFilter: resumeFileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1
    }
});

const voiceUpload = multer({
    storage: createVoiceS3Storage(),
    fileFilter: voiceFileFilter,
    limits: {
        fileSize: MAX_AUDIO_SIZE,
        files: 1
    }
});

// Export everything needed by other modules
module.exports = {
    resumeUpload,
    voiceUpload,
    s3Client,
    ALLOWED_FILE_TYPES,
    ALLOWED_AUDIO_TYPES,
    MAX_FILE_SIZE,
    MAX_AUDIO_SIZE
};