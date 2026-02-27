import pino from 'pino';
import socket from 'net';

// Stream to Vector's TCP source
const vectorStream = socket.connect(9000, '127.0.0.1');

export const logger = pino({
  level: 'info',
  base: { section: 'tsdk' }
}, vectorStream);

export const LoggersSection = { logger };
