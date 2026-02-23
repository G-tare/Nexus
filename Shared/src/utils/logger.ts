import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, module, ...meta }) => {
  const moduleTag = module ? `[${module}]` : '';
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  if (stack) {
    return `${timestamp} ${level} ${moduleTag} ${message}\n${stack}${metaStr}`;
  }
  return `${timestamp} ${level} ${moduleTag} ${message}${metaStr}`;
});

const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
  ],
});

// Add file transports in production
if (config.isProd) {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
  }));
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    maxsize: 10 * 1024 * 1024,
    maxFiles: 10,
  }));
}

/**
 * Create a child logger scoped to a specific module
 */
export function createModuleLogger(moduleName: string) {
  return logger.child({ module: moduleName });
}

export default logger;
