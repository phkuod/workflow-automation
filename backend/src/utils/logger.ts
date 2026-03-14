import pino from 'pino';
import { Request, Response, NextFunction } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
});

// Create child loggers for different modules
export const createLogger = (module: string) => {
  return logger.child({ module });
};

// Convenience logging functions
export const log = {
  info: (message: string, data?: object) => logger.info(data, message),
  error: (message: string, error?: Error | object) => logger.error(error, message),
  warn: (message: string, data?: object) => logger.warn(data, message),
  debug: (message: string, data?: object) => logger.debug(data, message),
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
    }, 'HTTP Request');
  });
  
  next();
};

export default logger;
