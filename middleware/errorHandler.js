function isPgError(err) {
  return err && typeof err.code === 'string' && /^[0-9A-Z]{5}$/.test(err.code);
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (isPgError(err)) {
    const dev = process.env.NODE_ENV === 'development';
    const detail = err.detail || err.message || 'Database error';

    if (err.code === '23503') {
      return res.status(400).json({
        success: false,
        data: null,
        error: dev ? detail : 'Referenced record does not exist or violates a constraint',
      });
    }
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        data: null,
        error: dev ? detail : 'Conflict with existing data',
      });
    }
    if (err.code === '22P02') {
      return res.status(400).json({
        success: false,
        data: null,
        error: dev ? detail : 'Invalid data format',
      });
    }
  }

  const status = err.statusCode || err.status || 500;
  const hideDetails = process.env.NODE_ENV === 'production';
  const message =
    status === 500 && hideDetails
      ? 'Internal server error'
      : err.message || 'Internal server error';
  if (status >= 500) {
    console.error('[api]', err);
  }
  res.status(status).json({ success: false, data: null, error: message });
}

module.exports = { errorHandler };
