// Unified Upload Configuration
// This module provides intelligent switching between local and S3 storage based on environment settings
// It allows development with local storage while using S3 in production

const path = require('path');

// Determine which storage type to use based on environment
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Log the storage configuration on startup for visibility
console.log(`📁 Storage Configuration: Using ${STORAGE_TYPE} storage (Environment: ${process.env.NODE_ENV || 'development'})`);

// Validate S3 configuration if S3 storage is selected
if (STORAGE_TYPE === 's3') {
    const requiredS3Vars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET_NAME'];
    const missingVars = requiredS3Vars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
        console.error('❌ S3 storage selected but missing required environment variables:', missingVars);
        console.error('   Falling back to local storage. Please set the missing variables to use S3.');
        // Don't crash the app, just fall back to local storage
        module.exports = require('./upload');
        module.exports.voiceUpload = require('./voiceUpload').upload;
        return;
    }
}

// Helper function to create a consistent interface for both storage types
function createUnifiedUploadInterface(uploadConfig, voiceUploadConfig) {
    return {
        // Resume upload configuration (for PDFs, DOCs, etc.)
        resumeUpload: uploadConfig.resumeUpload || uploadConfig.upload,

        // Voice upload configuration (for audio files)
        voiceUpload: voiceUploadConfig.voiceUpload || voiceUploadConfig.upload,

        // Export individual components for flexibility
        ALLOWED_FILE_TYPES: uploadConfig.ALLOWED_FILE_TYPES,
        ALLOWED_AUDIO_TYPES: voiceUploadConfig.ALLOWED_AUDIO_TYPES,
        MAX_FILE_SIZE: uploadConfig.MAX_FILE_SIZE,
        MAX_AUDIO_SIZE: voiceUploadConfig.MAX_AUDIO_SIZE,

        // Storage type indicator for debugging and conditional logic
        storageType: STORAGE_TYPE,

        // Helper method to get the file URL/path based on storage type
        getFileUrl: (fileInfo) => {
            if (STORAGE_TYPE === 's3') {
                // For S3, the location property contains the full URL
                return fileInfo.location;
            } else {
                // For local storage, construct a URL path
                // This assumes your Express app serves static files from /uploads
                return `/uploads/${fileInfo.filename}`;
            }
        },

        // Helper method to get the storage-specific file key/path
        getStorageKey: (fileInfo) => {
            if (STORAGE_TYPE === 's3') {
                // For S3, use the key property
                return fileInfo.key;
            } else {
                // For local storage, use the path property
                return fileInfo.path;
            }
        }
    };
}

// Load the appropriate configuration based on storage type
let uploadModule;
try {
    if (STORAGE_TYPE === 's3') {
        // Use S3 storage configuration
        console.log('🚀 Loading S3 storage configuration...');
        uploadModule = require('./s3Upload');

        // Create the unified interface with S3 configuration
        const unifiedConfig = createUnifiedUploadInterface(uploadModule, uploadModule);

        // Add S3-specific utilities
        unifiedConfig.s3Client = uploadModule.s3Client;

        module.exports = unifiedConfig;
    } else {
        // Use local storage configuration
        console.log('💾 Loading local storage configuration...');
        const localUploadConfig = require('./upload');
        const localVoiceConfig = require('./voiceUpload');

        // Create the unified interface with local configuration
        const unifiedConfig = createUnifiedUploadInterface(localUploadConfig, localVoiceConfig);

        // For local storage, we need to ensure upload directories exist
        const fs = require('fs');
        const uploadsDir = path.join(__dirname, '../../uploads');
        const resumesDir = path.join(uploadsDir, 'resumes');
        const voiceDir = path.join(uploadsDir, 'voice-resumes');

        // Create directories if they don't exist
        [uploadsDir, resumesDir, voiceDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 Created directory: ${dir}`);
            }
        });

        module.exports = unifiedConfig;
    }
} catch (error) {
    console.error('❌ Error loading upload configuration:', error.message);
    console.error('   Falling back to local storage configuration.');

    // Fallback to local storage if there's any error
    const localUploadConfig = require('./upload');
    const localVoiceConfig = require('./voiceUpload');
    module.exports = createUnifiedUploadInterface(localUploadConfig, localVoiceConfig);
}

// Add a configuration summary for debugging
if (process.env.NODE_ENV === 'development') {
    console.log('📋 Upload Configuration Summary:');
    console.log(`   Storage Type: ${STORAGE_TYPE}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    if (STORAGE_TYPE === 's3') {
        console.log(`   S3 Bucket: ${process.env.S3_BUCKET_NAME}`);
        console.log(`   AWS Region: ${process.env.AWS_REGION || 'us-east-1'}`);
    } else {
        console.log(`   Local Upload Path: uploads/`);
    }
}