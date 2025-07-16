// User Service
// This service handles all business logic related to users
// It's the layer between your controllers (which handle HTTP) and your database

const { query, transaction } = require('../config/database');
const { hashPassword, comparePassword, validatePassword, validateEmail } = require('../utils/auth');
const { generateToken } = require('../utils/jwt');

class UserService {
  /**
   * Create a new user account
   * 
   * This method handles the complete user registration process:
   * 1. Validates the input data
   * 2. Checks if the user already exists
   * 3. Hashes the password
   * 4. Creates the user record
   * 5. Generates an authentication token
   * 
   * @param {object} userData - The user registration data
   * @returns {object} The created user and authentication token
   */
  async createUser(userData) {
    const { email, username, password, fullName } = userData;
    
    // Step 1: Validate input data
    if (!email || !username || !password) {
      throw new Error('Email, username, and password are required');
    }
    
    if (!validateEmail(email)) {
      throw new Error('Invalid email format');
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.message);
    }
    
    // Normalize email and username to prevent case-sensitivity issues
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.toLowerCase().trim();
    
    try {
      // Step 2: Check if user already exists
      // We check both email and username since both must be unique
      const existingUserCheck = await query(
        `SELECT id, email, username 
         FROM users 
         WHERE LOWER(email) = $1 OR LOWER(username) = $2`,
        [normalizedEmail, normalizedUsername]
      );
      
      if (existingUserCheck.rows.length > 0) {
        const existingUser = existingUserCheck.rows[0];
        if (existingUser.email.toLowerCase() === normalizedEmail) {
          throw new Error('A user with this email already exists');
        }
        if (existingUser.username.toLowerCase() === normalizedUsername) {
          throw new Error('This username is already taken');
        }
      }
      
      // Step 3: Hash the password
      const hashedPassword = await hashPassword(password);
      
      // Step 4: Create the user record
      // We use RETURNING * to get the created user data back without a separate query
      const result = await query(
        `INSERT INTO users (email, username, password_hash, full_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, username, full_name, is_active, is_verified, created_at`,
        [normalizedEmail, username, hashedPassword, fullName || null]
      );
      
      const newUser = result.rows[0];
      
      // Step 5: Generate authentication token
      const token = generateToken({
        userId: newUser.id,
        email: newUser.email,
        username: newUser.username
      });
      
      // Return user data (excluding sensitive information) and token
      return {
        user: {
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
          fullName: newUser.full_name,
          isActive: newUser.is_active,
          isVerified: newUser.is_verified,
          createdAt: newUser.created_at
        },
        token
      };
      
    } catch (error) {
      // Log the actual error for debugging (in production, you'd use a proper logger)
      console.error('Error creating user:', error.message);
      
      // Re-throw with a user-friendly message if it's not already one of our custom errors
      if (error.message.includes('already exists') || error.message.includes('already taken')) {
        throw error;
      }
      throw new Error('Failed to create user account');
    }
  }
  
  /**
   * Authenticate a user by email or username
   * 
   * @param {string} identifier - Email or username
   * @param {string} password - Plain text password
   * @returns {object} The authenticated user and token
   */
  async loginUser(identifier, password) {
    if (!identifier || !password) {
      throw new Error('Email/username and password are required');
    }
    
    const normalizedIdentifier = identifier.toLowerCase().trim();
    
    try {
      // Find user by email or username
      const result = await query(
        `SELECT id, email, username, password_hash, full_name, 
                is_active, is_verified, last_login_at
         FROM users
         WHERE LOWER(email) = $1 OR LOWER(username) = $1`,
        [normalizedIdentifier]
      );
      
      if (result.rows.length === 0) {
        // Don't reveal whether the email/username exists
        throw new Error('Invalid credentials');
      }
      
      const user = result.rows[0];
      
      // Check if account is active
      if (!user.is_active) {
        throw new Error('Account is deactivated. Please contact support.');
      }
      
      // Verify password
      const isPasswordValid = await comparePassword(password, user.password_hash);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }
      
      // Update last login timestamp
      await query(
        'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );
      
      // Generate token
      const token = generateToken({
        userId: user.id,
        email: user.email,
        username: user.username
      });
      
      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.full_name,
          isActive: user.is_active,
          isVerified: user.is_verified,
          lastLoginAt: user.last_login_at
        },
        token
      };
      
    } catch (error) {
      console.error('Login error:', error.message);
      
      // Always return the same error for security
      if (error.message === 'Invalid credentials' || 
          error.message.includes('deactivated')) {
        throw error;
      }
      throw new Error('Invalid credentials');
    }
  }
  
  /**
   * Get user by ID
   * 
   * @param {number} userId - The user's ID
   * @returns {object} The user data
   */
  async getUserById(userId) {
    try {
      const result = await query(
        `SELECT id, email, username, full_name, avatar_url, bio,
                is_active, is_verified, created_at, updated_at
         FROM users
         WHERE id = $1`,
        [userId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const user = result.rows[0];
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.full_name,
        avatarUrl: user.avatar_url,
        bio: user.bio,
        isActive: user.is_active,
        isVerified: user.is_verified,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
      
    } catch (error) {
      console.error('Error fetching user:', error.message);
      throw error;
    }
  }
}

// Export a singleton instance
module.exports = new UserService();
