// JWT (JSON Web Token) utilities
// JWTs are used for maintaining user sessions without storing session data on the server

const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Generate a JWT token for a user
 * 
 * How JWTs work:
 * - The token contains user information (payload) that's cryptographically signed
 * - The server can verify the token hasn't been tampered with using the secret
 * - The token can include an expiration time after which it's no longer valid
 * 
 * @param {object} payload - The data to include in the token (typically user id and email)
 * @returns {string} The signed JWT token
 */
const generateToken = (payload) => {
  // We'll use a 7-day expiration for the hackathon
  // In production, you might use shorter times and implement refresh tokens
  const options = {
    expiresIn: '7d',
    issuer: 'scalable-hackathon-api'
  };
  
  try {
    const token = jwt.sign(payload, config.security.jwtSecret, options);
    return token;
  } catch (error) {
    throw new Error('Failed to generate token');
  }
};

/**
 * Verify and decode a JWT token
 * 
 * This function checks if:
 * - The token was signed with our secret (hasn't been forged)
 * - The token hasn't expired
 * - The token structure is valid
 * 
 * @param {string} token - The JWT token to verify
 * @returns {object} The decoded payload if valid
 * @throws {Error} If the token is invalid or expired
 */
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, config.security.jwtSecret);
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    } else {
      throw new Error('Failed to verify token');
    }
  }
};

/**
 * Extract token from Authorization header
 * 
 * Tokens are typically sent in the format: "Bearer <token>"
 * This function extracts just the token part
 * 
 * @param {string} authHeader - The Authorization header value
 * @returns {string|null} The extracted token or null if not found
 */
const extractTokenFromHeader = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  // Remove "Bearer " prefix to get just the token
  return authHeader.substring(7);
};

module.exports = {
  generateToken,
  verifyToken,
  extractTokenFromHeader
};
