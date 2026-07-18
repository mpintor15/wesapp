const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const { sanitizeLogMetadata } = require('../utils/logSanitizer');

const logsDir = path.join(__dirname, '../../logs');
const isProduction = process.env.NODE_ENV === 'production';
const logToFiles = process.env.LOG_TO_FILES === 'true';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

const metadataFormat = winston.format((info) => {
  const sanitized = sanitizeLogMetadata(info, {
    includeStack: !isProduction,
    production: isProduction,
  });

  if (sanitized && typeof sanitized === 'object') {
    for (const key of Object.keys(info)) {
      delete info[key];
    }
    Object.assign(info, sanitized);
    return info;
  }

  info.message = sanitized;
  return info;
});

let consoleFormat;
if (isProduction) {
  consoleFormat = winston.format.combine(
    metadataFormat(),
    winston.format.timestamp(),
    winston.format.json()
  );
} else {
  consoleFormat = winston.format.combine(
    metadataFormat(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.colorize({ all: true }),
    winston.format.errors({ stack: true }),
    winston.format.printf((info) => {
      const { timestamp, level, message, ...meta } = info;
      const metaText = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} ${level}: ${message}${metaText}`;
    })
  );
}

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const transports = [new winston.transports.Console({ format: consoleFormat })];

if (logToFiles) {
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxDays: '14d',
      level: 'error',
      format: fileFormat,
    }),
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxDays: '14d',
      format: fileFormat,
    })
  );
}

const exceptionHandlers = [];
const rejectionHandlers = [];

if (logToFiles) {
  exceptionHandlers.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxDays: '14d',
      format: fileFormat,
    })
  );
  rejectionHandlers.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxDays: '14d',
      format: fileFormat,
    })
  );
} else {
  exceptionHandlers.push(new winston.transports.Console({ format: consoleFormat }));
  rejectionHandlers.push(new winston.transports.Console({ format: consoleFormat }));
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  levels,
  format: fileFormat,
  transports,
  exceptionHandlers,
  rejectionHandlers,
});

module.exports = logger;
