// Main API Router
// This file aggregates all route modules and applies common middleware
const express = require('express');
const router = express.Router();
const userRoutes = require('./userRoutes');
const resumeRoutes = require('./resumeRoutes');

/**
 * API Routes Configuration
 *
 * All API routes are prefixed with /api
 * This router aggregates all feature-specific routers
 */

// Health check for the entire API
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Feature routes
router.use('/users', userRoutes);
router.use('/resumes', resumeRoutes);

// 404 handler for API routes - Express 5 compatible
// In Express 5, we need to use a different approach for catch-all routes
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.path
  });
});

module.exports = router;
