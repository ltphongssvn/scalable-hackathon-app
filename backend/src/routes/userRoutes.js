// User Routes
// This file defines all user-related API endpoints

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

/**
 * User Routes Configuration
 * 
 * Public routes (no authentication required):
 * - POST /api/users/register - Create a new user account
 * - POST /api/users/login - Authenticate and get a token
 * 
 * Protected routes (authentication required):
 * - GET /api/users/profile - Get current user's profile
 * - PUT /api/users/profile - Update current user's profile
 */

// Public routes
router.post('/register', userController.register);
router.post('/login', userController.login);

// Protected routes (require authentication)
router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, userController.updateProfile);

// Health check endpoint for this router
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'User routes are working',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
