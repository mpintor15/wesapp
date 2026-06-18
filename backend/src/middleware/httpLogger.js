const logger = require('../config/logger');

/**
 * HTTP request logging middleware
 * Logs incoming requests and outgoing responses
 */
const httpLogger = (req, res, next) => {
  const start = Date.now();

  // Log incoming request
  logger.http(`${req.method} ${req.path} - IP: ${req.ip} - User-Agent: ${req.get('user-agent')}`);

  // Log outgoing response
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'http';
    logger[level](
      `${req.method} ${req.path} - Status: ${res.statusCode} - Duration: ${duration}ms`
    );
  });

  next();
};

module.exports = httpLogger;
