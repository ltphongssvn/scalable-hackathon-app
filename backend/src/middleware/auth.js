// Authentication Middleware
// This middleware verifies JWT tokens and protects routes

const { verifyToken } = require('../utils/jwt');
const { query } = require('../config/database');

/**
 * Authentication middleware
 * 
 * This middleware:
 * 1. Extracts the JWT token from the Authorization header
 * 2. Verifies the token
 * 3. Loads the user from the database
 * 4. Attaches the user to the request object
 */
async function authenticate(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Extract the token (remove 'Bearer ' prefix)
    const token = authHeader.substring(7);

    // Verify the token
    const decoded = verifyToken(token);

    // Load user from database
    const result = await query(
      'SELECT id, email, username, full_name, created_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Attach user to request object
    req.user = {
      id: result.rows[0].id,
      email: result.rows[0].email,
      username: result.rows[0].username,
      fullName: result.rows[0].full_name
    };

    // Continue to next middleware/route handler
    next();
  } catch (error) {
    console.error('Authentication error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
}

/**
 * Optional authentication middleware
 * 
 * Similar to authenticate, but doesn't fail if no token is provided
 * Useful for routes that can work with or without authentication
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, but that's okay for optional auth
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    const result = await query(
      'SELECT id, email, username, full_name FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length > 0) {
      req.user = {
        id: result.rows[0].id,
        email: result.rows[0].email,
        username: result.rows[0].username,
        fullName: result.rows[0].full_name
      };
    }

    next();
  } catch (error) {
    // Token is invalid, but since this is optional auth, we continue anyway
    console.error('Optional auth error:', error);
    next();
  }
}

module.exports = {
  authenticate,
  optionalAuth
};
