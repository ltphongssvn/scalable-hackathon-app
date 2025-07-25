// Centralized configuration management
// This pattern allows us to validate and structure our environment variables
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Configuration object with validation and defaults
const config = {
  // Environment
  env: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Server
  port: parseInt(process.env.PORT, 10) || 5000,
  apiPrefix: process.env.API_PREFIX || '/api',
  apiVersion: process.env.API_VERSION || 'v1',

  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Database
  database: {
    url: process.env.DATABASE_URL,
    // We'll add more database config as needed
  },

  // Security
  // This section manages all security-related settings including authentication
  security: {
    jwtSecret: process.env.JWT_SECRET,
    // CRITICAL FIX: Added JWT expiration configuration
    // This tells the system how long authentication tokens should remain valid
    // Format can be: '7d' (days), '24h' (hours), '60m' (minutes), or number of seconds
    // Default of 7 days provides a good balance for hackathon development
    jwtExpiration: process.env.JWT_EXPIRATION || '7d',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  }
};

// Validate required configuration
const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0 && config.isProduction) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

// In development, warn about missing variables but don't crash
if (missingVars.length > 0 && config.isDevelopment) {
  console.warn('⚠️  Warning: Missing environment variables:', missingVars.join(', '));
  console.warn('   The application may not function properly without these.');
}

// Log successful configuration load in development
if (config.isDevelopment) {
  console.log('✅ Configuration loaded successfully');
  console.log(`   JWT tokens will expire in: ${config.security.jwtExpiration}`);
}

module.exports = config;