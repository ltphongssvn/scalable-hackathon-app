// Add this after the welcome API endpoint and before error handling middleware

// Mount API routes
app.use(`${config.apiPrefix}/${config.apiVersion}`, apiRoutes);

