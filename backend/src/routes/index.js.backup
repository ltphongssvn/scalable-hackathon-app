// Main API Router
// This file aggregates all route modules and applies common middleware

const express = require('express');
const router = express.Router();
const userRoutes = require('./userRoutes');

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

// 404 handler for API routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

module.exports = router;
