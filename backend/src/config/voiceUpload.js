// Voice Upload Configuration
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

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

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/voice-resumes');
    },
    filename: function (req, file, cb) {
        const userId = req.user.id;
        const timestamp = Date.now();
        const uniqueId = uuidv4();
        const extension = ALLOWED_AUDIO_TYPES[file.mimetype] || 'audio';
        const filename = `${userId}_${timestamp}_${uniqueId}.${extension}`;
        req.uploadedFileOriginalName = file.originalname;
        cb(null, filename);
    }
});

const fileFilter = (req, file, cb) => {
    if (ALLOWED_AUDIO_TYPES[file.mimetype]) {
        cb(null, true);
    } else {
        cb(new Error('Invalid audio format. Supported formats: MP3, WAV, M4A, OGG, WebM'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: MAX_AUDIO_SIZE,
        files: 1
    }
});

module.exports = { upload, ALLOWED_AUDIO_TYPES, MAX_AUDIO_SIZE };