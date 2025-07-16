const express = require('express');
const app = express();

app.use(express.json());

// Use our test router
const testRouter = require('./routes/test-index');
app.use('/api', testRouter);

const PORT = 5002;
app.listen(PORT, () => {
  console.log(`Minimal test server running on port ${PORT}`);
});
