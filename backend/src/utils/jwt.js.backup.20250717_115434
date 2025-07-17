// JWT Utilities with Proper Error Handling Architecture
// This implementation demonstrates how to properly integrate with the AppError system

const jwt = require('jsonwebtoken');
const config = require('../config');

// Import AppError from the error handler
// This is the key to proper error handling - using the existing infrastructure
const { AppError } = require('../middleware/errorHandler');

/**
 * Generate a JWT token for a user
 *
 * This function creates a signed JWT containing the user's ID and email.
 * The token is used for authenticating subsequent API requests.
 *
 * @param {Object} user - The user object
 * @param {number} user.id - The user's database ID
 * @param {string} user.email - The user's email address
 * @returns {string} The signed JWT token
 */
const generateToken = (user) => {
  // Create the payload - what data goes inside the token
  // Keep this minimal for security and performance
  const payload = {
    userId: user.id,
    email: user.email
  };

  // Sign the token with our secret
  // The expiresIn option automatically adds an 'exp' claim
  const token = jwt.sign(payload, config.security.jwtSecret, {
    expiresIn: config.security.jwtExpiration
  });

  return token;
};

/**
 * Verify a JWT token and return the decoded payload
 *
 * ARCHITECTURAL IMPROVEMENT: This function now properly propagates
 * JWT-specific errors so they can be handled appropriately by the
 * error handling middleware. This is crucial for maintaining proper
 * HTTP status codes and error messages.
 *
 * @param {string} token - The JWT token to verify
 * @returns {object} The decoded payload if valid
 * @throws {AppError} If the token is invalid, expired, or verification fails
 */
const verifyToken = (token) => {
  try {
    // Let jwt.verify do its work - it will throw specific errors if needed
    const decoded = jwt.verify(token, config.security.jwtSecret);
    return decoded;
  } catch (error) {
    // Here's the key architectural improvement: instead of converting
    // specific JWT errors into generic errors, we preserve the error
    // type information by either re-throwing the original error or
    // wrapping it in our AppError class with appropriate status codes

    if (error.name === 'TokenExpiredError') {
      // For expired tokens, we want a 401 status with a clear message
      throw new AppError('Token has expired', 401);
    } else if (error.name === 'JsonWebTokenError') {
      // For invalid tokens (malformed, wrong signature, etc.)
      throw new AppError('Invalid token', 401);
    } else if (error.name === 'NotBeforeError') {
      // For tokens used before their validity period
      throw new AppError('Token not yet valid', 401);
    } else {
      // For any other errors (like missing secret), this is a server issue
      // We log the original error for debugging but don't expose internals
      console.error('JWT verification error:', error);
      throw new AppError('Token verification failed', 500);
    }
  }
};

/**
 * Extract token from Authorization header
 *
 * Tokens are typically sent in the format: "Bearer <token>"
 * This function extracts just the token part.
 *
 * @param {string} authHeader - The Authorization header value
 * @returns {string|null} The extracted token or null if not found
 */
const extractTokenFromHeader = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  // Remove 'Bearer ' prefix (7 characters)
  return authHeader.substring(7);
};

/**
 * Decode a token without verifying it
 *
 * This is useful for extracting information from expired tokens
 * or for client-side operations where you need the payload
 * but can't verify the signature.
 *
 * WARNING: Never trust the contents of an unverified token for
 * security decisions. This should only be used for non-sensitive
 * operations like displaying a user's name in the UI.
 *
 * @param {string} token - The JWT token to decode
 * @returns {object|null} The decoded payload or null if invalid
 */
const decodeToken = (token) => {
  try {
    // The second parameter 'true' means decode without verification
    return jwt.decode(token, { complete: true });
  } catch (error) {
    console.error('Token decode error:', error);
    return null;
  }
};

// Export all utility functions
module.exports = {
  generateToken,
  verifyToken,
  extractTokenFromHeader,
  decodeToken
};