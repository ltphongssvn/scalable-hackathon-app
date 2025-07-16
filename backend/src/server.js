// Main server file - the heart of your application
// This file orchestrates all the pieces of your Express API

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Import our configuration
const config = require('./config');

// Import database connection - this is the new crucial part
const { pool, testConnection } = require('./config/database');

// Import middleware (we'll create these next)
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

// Import API routes
const apiRoutes = require('./routes');

// Create Express application
const app = express();

// Trust proxy - important for deployments behind reverse proxies (like Render)
app.set('trust proxy', 1);

// Security middleware - Helmet helps secure Express apps by setting various HTTP headers
app.use(helmet({
  contentSecurityPolicy: config.isProduction ? undefined : false, // Disable CSP in development for hot-reloading
}));

// CORS configuration - this allows your frontend to communicate with the backend
app.use(cors({
  origin: config.frontendUrl,
  credentials: true, // Allow cookies to be sent with requests
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
}));

// Request logging - Morgan provides detailed logs of all HTTP requests
// In production, you might want to log to a file or external service
app.use(morgan(config.isDevelopment ? 'dev' : 'combined'));

// Body parsing middleware - allows us to read JSON request bodies
app.use(express.json({ limit: '10mb' })); // Limit prevents DoS attacks with huge payloads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware - reduces the size of responses
app.use(compression());

// Rate limiting - prevents abuse by limiting requests per IP
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting to all API routes
app.use(config.apiPrefix, limiter);

// Enhanced health check endpoint - now includes database status
app.get('/health', async (req, res) => {
  try {
    // Check database connectivity
    const dbHealthy = await testConnection();
    
    const healthStatus = {
      status: dbHealthy ? 'healthy' : 'degraded',
      environment: config.env,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        api: 'operational',
        database: dbHealthy ? 'operational' : 'unavailable'
      }
    };
    
    res.status(dbHealthy ? 200 : 503).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Failed to check system health',
      timestamp: new Date().toISOString()
    });
  }
});

// API routes will be mounted here
app.get(`${config.apiPrefix}/${config.apiVersion}`, (req, res) => {
  res.json({
    message: 'Welcome to the Scalable Hackathon API',
    version: config.apiVersion,
    endpoints: {
      health: '/health',
      api: `${config.apiPrefix}/${config.apiVersion}`,
      // We'll add more endpoints as we build them
    },
  });
});

// Mount all API routes
app.use(`${config.apiPrefix}/${config.apiVersion}`, apiRoutes);

// Error handling middleware - must be last!
app.use(notFound);
app.use(errorHandler);

// Initialize server with database connection verification
const startServer = async () => {
  try {
    // Test database connection before starting server
    console.log('🔄 Testing database connection...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }
    
    console.log('✅ Database connection established');
    
    // Start the server only after confirming database connectivity
    const server = app.listen(config.port, () => {
      console.log(`
    🚀 Server is running!
    🔧 Environment: ${config.env}
    🏠 Local: http://localhost:${config.port}
    📍 API Base: http://localhost:${config.port}${config.apiPrefix}/${config.apiVersion}
    🗄️  Database: Connected to Neon PostgreSQL
      `);
    });
    
    // Graceful shutdown handling
    process.on('SIGTERM', gracefulShutdown(server));
    process.on('SIGINT', gracefulShutdown(server));
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Graceful shutdown function
const gracefulShutdown = (server) => {
  return async () => {
    console.log('\n🛑 Shutdown signal received: closing HTTP server');
    
    server.close(async () => {
      console.log('📭 HTTP server closed');
      
      try {
        // Close database pool connections
        await pool.end();
        console.log('🗄️  Database connections closed');
      } catch (error) {
        console.error('❌ Error closing database connections:', error.message);
      }
      
      console.log('👋 Graceful shutdown complete');
      process.exit(0);
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('❌ Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };
};

// Start the server
startServer();

module.exports = app;
