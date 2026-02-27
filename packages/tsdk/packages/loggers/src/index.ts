import pino from 'pino';

// Placeholder for Vector local socket transport
export const logger = pino({
  level: 'info',
  base: { section: 'tsdk' }
});

export const LoggersSection = { logger };
