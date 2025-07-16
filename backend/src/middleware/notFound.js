// 404 Not Found middleware
// This handles requests to routes that don't exist

const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.originalUrl} not found`,
      statusCode: 404,
    },
    timestamp: new Date().toISOString(),
  });
};

module.exports = notFound;
