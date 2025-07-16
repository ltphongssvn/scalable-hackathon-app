// Authentication utilities
// These functions handle the security-critical aspects of user authentication

const bcrypt = require('bcrypt');
const config = require('../config');

/**
 * Hash a plain text password using bcrypt
 * 
 * Why we hash passwords:
 * - If your database is ever compromised, attackers can't see actual passwords
 * - Each password gets a unique "salt" which prevents rainbow table attacks
 * - The hashing is intentionally slow to prevent brute force attempts
 * 
 * @param {string} password - The plain text password to hash
 * @returns {Promise<string>} The hashed password
 */
const hashPassword = async (password) => {
  // The salt rounds determine how computationally expensive the hashing is
  // More rounds = more secure but slower. 10 is a good balance for most apps
  const saltRounds = config.security.bcryptRounds;
  
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
  } catch (error) {
    throw new Error('Failed to hash password');
  }
};

/**
 * Compare a plain text password with a hashed password
 * 
 * This is used during login to verify the user's password without ever
 * storing or comparing plain text passwords
 * 
 * @param {string} password - The plain text password to check
 * @param {string} hashedPassword - The hashed password from the database
 * @returns {Promise<boolean>} True if the password matches, false otherwise
 */
const comparePassword = async (password, hashedPassword) => {
  try {
    const isMatch = await bcrypt.compare(password, hashedPassword);
    return isMatch;
  } catch (error) {
    throw new Error('Failed to compare passwords');
  }
};

/**
 * Validate password strength
 * 
 * For a hackathon, we'll keep this simple, but in production you might
 * want to check for common passwords, require special characters, etc.
 * 
 * @param {string} password - The password to validate
 * @returns {object} Validation result with isValid flag and message
 */
const validatePassword = (password) => {
  if (!password || password.length < 8) {
    return {
      isValid: false,
      message: 'Password must be at least 8 characters long'
    };
  }
  
  // Check for at least one number
  if (!/\d/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one number'
    };
  }
  
  // Check for at least one letter
  if (!/[a-zA-Z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one letter'
    };
  }
  
  return {
    isValid: true,
    message: 'Password is valid'
  };
};

/**
 * Validate email format
 * 
 * Uses a simple regex pattern to check if the email looks valid
 * In production, you might also want to verify the email actually exists
 * 
 * @param {string} email - The email to validate
 * @returns {boolean} True if the email format is valid
 */
const validateEmail = (email) => {
  // This regex covers most common email formats
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

module.exports = {
  hashPassword,
  comparePassword,
  validatePassword,
  validateEmail
};
