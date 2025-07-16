const express = require('express');
const app = express();

// Basic middleware
app.use(express.json());

// Test route
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});

// Import and use our routes
const apiRoutes = require('./routes');
app.use('/api/v1', apiRoutes);

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
  console.log(`Test endpoint: http://localhost:${PORT}/test`);
  console.log(`API health: http://localhost:${PORT}/api/v1/health`);
  console.log(`User routes: http://localhost:${PORT}/api/v1/users/health`);
});
