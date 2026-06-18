const logger = require('../config/logger');

/**
 * Middleware to validate request body against a Zod schema
 * @param {ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware
 */
const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      const issues = Array.isArray(error.issues) ? error.issues : [];
      const errors = issues.reduce((acc, err) => {
        const field = err.path.join('.') || 'body';
        if (!acc[field]) {
          acc[field] = [];
        }
        acc[field].push(err.message);
        return acc;
      }, {});

      logger.warn(`Validation error on ${req.method} ${req.path}:`, errors);

      res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        code: 'VALIDATION_ERROR',
        errors,
      });
    }
  };
};

module.exports = { validateRequest };
