// User Controller
// This controller handles HTTP requests and responses for user-related operations
// It acts as the bridge between HTTP requests and the business logic in userService

const userService = require('../services/userService');

/**
 * User Controller
 * 
 * This controller follows the principle of separation of concerns:
 * - It only handles HTTP-specific logic (request/response)
 * - All business logic is delegated to the UserService
 * - Error handling is centralized and consistent
 */
class UserController {
  /**
   * Register a new user
   * 
   * POST /api/users/register
   * 
   * Expected body:
   * {
   *   email: string,
   *   username: string,
   *   password: string,
   *   fullName: string (optional)
   * }
   */
  async register(req, res, next) {
    try {
      // Extract user data from request body
      const userData = {
        email: req.body.email,
        username: req.body.username,
        password: req.body.password,
        fullName: req.body.fullName || null
      };

      // Call the service layer to handle business logic
      const result = await userService.createUser(userData);

      // Send successful response
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: result.user,
          token: result.token
        }
      });
    } catch (error) {
      // Log error for debugging (in production, use proper logging)
      console.error('Registration error:', error);

      // Determine appropriate error response
      if (error.message.includes('already exists')) {
        res.status(409).json({
          success: false,
          message: error.message
        });
      } else if (error.message.includes('required') || error.message.includes('Invalid')) {
        res.status(400).json({
          success: false,
          message: error.message
        });
      } else {
        // For unexpected errors, don't expose internal details
        res.status(500).json({
          success: false,
          message: 'An error occurred during registration'
        });
      }
    }
  }

  /**
   * User login
   * 
   * POST /api/users/login
   * 
   * Expected body:
   * {
   *   email: string (or username),
   *   password: string
   * }
   */
  async login(req, res, next) {
    try {
      const { email, username, password } = req.body;
      
      // Extract identifier - can be either email or username
      const identifier = email || username;
      
      // Validate input
      if (!identifier || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email/username and password are required'
        });
      }
      
      // Call service layer for authentication
      const result = await userService.loginUser(identifier, password);
      
      // Send successful response
      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          token: result.token
        }
      });
    } catch (error) {
      console.error('Login controller error:', error);
      
      // Handle specific errors
      if (error.message === 'Invalid credentials' || 
          error.message.includes('deactivated')) {
        return res.status(401).json({
          success: false,
          message: error.message
        });
      }
      
      // Generic error response
      res.status(500).json({
        success: false,
        message: 'An error occurred during login'
      });
    }
  }

  /**
   * Get user profile
   * 
   * GET /api/users/profile
   * 
   * Requires authentication (JWT token in Authorization header)
   */
  async getProfile(req, res, next) {
    try {
      // The user ID should be set by authentication middleware
      const userId = req.user.id;

      const user = await userService.getUserById(userId);

      res.status(200).json({
        success: true,
        data: { user }
      });
    } catch (error) {
      console.error('Get profile error:', error);

      if (error.message === 'User not found') {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'An error occurred while fetching profile'
        });
      }
    }
  }

  /**
   * Update user profile
   * 
   * PUT /api/users/profile
   * 
   * Requires authentication
   */
  async updateProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const updates = req.body;

      // Remove fields that shouldn't be updated through this endpoint
      delete updates.password;
      delete updates.email;
      delete updates.id;

      const updatedUser = await userService.updateUser(userId, updates);

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: { user: updatedUser }
      });
    } catch (error) {
      console.error('Update profile error:', error);

      res.status(500).json({
        success: false,
        message: 'An error occurred while updating profile'
      });
    }
  }
}

// Export a singleton instance of the controller
module.exports = new UserController();
