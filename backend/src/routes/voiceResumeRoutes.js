// Voice Resume Routes
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const voiceResumeController = require('../controllers/voiceResumeController');
const { upload } = require('../config/voiceUpload'); // We'll create this next

// Upload voice resume
router.post('/upload-voice',
    authenticate,
    upload.single('audio'),
    voiceResumeController.uploadVoiceResume
);

// Get transcription for a voice resume
router.get('/:id/transcription',
    authenticate,
    voiceResumeController.getVoiceResumeTranscription
);

module.exports = router;