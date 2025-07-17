// Route Auto-Discovery System
// File: src/routes/index.js
//
// This architectural solution automatically discovers and loads all route files,
// preventing the manual integration issues that can occur as applications grow.
// It transforms route management from a manual checklist item to an automated process.

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

/**
 * Route Registry
 *
 * This array tracks all successfully loaded routes, providing:
 * 1. Runtime introspection capabilities
 * 2. Debugging information
 * 3. API documentation support
 *
 * Each entry contains the filename, mount path, and load status
 */
const loadedRoutes = [];

/**
 * API Health Check Endpoint
 *
 * This endpoint serves multiple architectural purposes:
 * 1. Basic health monitoring for load balancers and monitoring systems
 * 2. Route discovery verification during development
 * 3. API introspection for debugging
 *
 * The enhanced response includes loaded routes, making it easy to verify
 * that new routes are being discovered and mounted correctly.
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    // In development, show loaded routes for debugging
    // In production, you might want to hide this for security
    loadedRoutes: process.env.NODE_ENV === 'development' ? loadedRoutes : undefined,
    totalRoutes: loadedRoutes.length
  });
});

/**
 * Automatic Route Discovery and Loading System
 *
 * This function implements the core architectural improvement. It:
 * 1. Scans the routes directory for all JavaScript files
 * 2. Identifies route files by naming convention (ending with 'Routes.js')
 * 3. Automatically loads and mounts them
 * 4. Handles errors gracefully to prevent one bad route from breaking everything
 *
 * Naming Convention:
 * - userRoutes.js -> mounted at /users
 * - resumeRoutes.js -> mounted at /resumes
 * - profileRoutes.js -> mounted at /profiles
 *
 * This convention-over-configuration approach reduces cognitive load
 * and ensures consistency across the application.
 */
function autoDiscoverAndLoadRoutes() {
  const routesDirectory = __dirname;
  const indexFileName = path.basename(__filename);

  // Architectural logging - visibility into the system's behavior
  console.log('\n🔍 Route Auto-Discovery System Starting...');
  console.log(`📁 Scanning directory: ${routesDirectory}`);

  try {
    // Read all files in the routes directory
    const files = fs.readdirSync(routesDirectory);

    // Filter and process route files
    const routeFiles = files.filter(file => {
      // Must be a JavaScript file
      if (!file.endsWith('.js')) return false;

      // Skip the index file itself
      if (file === indexFileName) return false;

      // Skip test files, backups, and other non-route files
      if (file.includes('test') ||
          file.includes('backup') ||
          file.includes('original') ||
          file.includes('.spec.') ||
          file.includes('.test.')) {
        return false;
      }

      // Only process files that follow the naming convention
      return file.endsWith('Routes.js');
    });

    console.log(`📋 Found ${routeFiles.length} route files to load`);

    // Load each route file
    routeFiles.forEach(file => {
      try {
        // Construct the full path to the route file
        const routeFilePath = path.join(routesDirectory, file);

        // Load the route module
        const routeModule = require(routeFilePath);

        // Derive the mount path from the filename
        // This is the convention: someEntityRoutes.js -> /someentitys
        // We could make this smarter to handle pluralization better
        const entityName = file.replace('Routes.js', '').toLowerCase();
        const mountPath = `/${entityName}s`; // Simple pluralization

        // Special case handling for better pluralization
        const mountPathAdjusted = adjustMountPath(entityName);

        // Mount the routes on the router
        router.use(mountPathAdjusted, routeModule);

        // Track the successfully loaded route
        loadedRoutes.push({
          file: file,
          path: mountPathAdjusted,
          loadedAt: new Date().toISOString(),
          status: 'active'
        });

        console.log(`✅ Successfully loaded: ${file} -> ${mountPathAdjusted}`);

      } catch (error) {
        // Error handling is crucial for robustness
        // One broken route file shouldn't break the entire API
        console.error(`❌ Failed to load ${file}:`, error.message);

        // Track the failed route for debugging
        loadedRoutes.push({
          file: file,
          path: 'N/A',
          loadedAt: new Date().toISOString(),
          status: 'failed',
          error: error.message
        });
      }
    });

    // Summary logging for system observability
    const successCount = loadedRoutes.filter(r => r.status === 'active').length;
    const failCount = loadedRoutes.filter(r => r.status === 'failed').length;

    console.log('\n📊 Route Loading Summary:');
    console.log(`   ✅ Success: ${successCount} routes`);
    if (failCount > 0) {
      console.log(`   ❌ Failed: ${failCount} routes`);
    }
    console.log(`   📍 Total: ${loadedRoutes.length} routes processed\n`);

  } catch (error) {
    // Catastrophic failure - couldn't even read the directory
    console.error('🚨 Critical: Route discovery system failed:', error.message);
    console.error('   The API will start but without auto-discovered routes');
  }
}

/**
 * Intelligent Mount Path Adjustment
 *
 * This function handles special cases in pluralization and path naming.
 * It's a place where domain knowledge meets technical implementation.
 *
 * @param {string} entityName - The entity name extracted from the filename
 * @returns {string} The adjusted mount path
 */
function adjustMountPath(entityName) {
  // Handle special pluralization cases
  const specialCases = {
    'user': '/users',
    'resume': '/resumes',
    'profile': '/profiles',
    'category': '/categories',
    'company': '/companies',
    'person': '/people',
    'child': '/children'
  };

  // Check if we have a special case
  if (specialCases[entityName]) {
    return specialCases[entityName];
  }

  // Default: just add 's'
  return `/${entityName}s`;
}

/**
 * Execute the Auto-Discovery Process
 *
 * This is where the magic happens. By calling this function,
 * we transform the route loading from imperative (listing each route)
 * to declarative (describing the pattern for routes).
 */
autoDiscoverAndLoadRoutes();

/**
 * API Documentation Endpoint (Optional)
 *
 * This endpoint provides runtime API documentation.
 * It's an architectural nice-to-have that improves developer experience.
 */
router.get('/routes', (req, res) => {
  // Only expose in development for security reasons
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({
      success: false,
      message: 'This endpoint is only available in development mode'
    });
  }

  res.json({
    success: true,
    message: 'Available API routes',
    baseUrl: `${req.protocol}://${req.get('host')}`,
    apiPrefix: '/api/v1',
    routes: loadedRoutes.filter(r => r.status === 'active').map(r => ({
      path: r.path,
      fullPath: `/api/v1${r.path}`,
      file: r.file,
      loadedAt: r.loadedAt
    }))
  });
});

/**
 * 404 Handler - Catch-all for unmatched routes
 *
 * This must be the last route registered. It provides:
 * 1. Clear error messages for API consumers
 * 2. Available routes hint in development
 * 3. Consistent error response format
 *
 * The architectural principle here is "fail informatively" -
 * when something goes wrong, provide actionable information.
 */
router.use((req, res) => {
  const response = {
    success: false,
    message: 'API endpoint not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  };

  // In development, provide hints about available routes
  if (process.env.NODE_ENV === 'development') {
    response.hint = 'Available route prefixes: ' +
        loadedRoutes
            .filter(r => r.status === 'active')
            .map(r => r.path)
            .join(', ');
    response.documentation = '/api/v1/routes';
  }

  res.status(404).json(response);
});

/**
 * Export the configured router
 *
 * This router now includes:
 * 1. All auto-discovered routes
 * 2. Health check endpoint
 * 3. Optional documentation endpoint
 * 4. 404 handler for unmatched routes
 *
 * The module is now self-contained and self-organizing,
 * requiring no manual updates as new routes are added.
 */
module.exports = router;