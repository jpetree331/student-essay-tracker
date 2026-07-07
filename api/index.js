// Vercel serverless entry point. The Express app is a valid (req, res) handler,
// so we can hand it straight to Vercel's Node runtime.
module.exports = require('../server');
