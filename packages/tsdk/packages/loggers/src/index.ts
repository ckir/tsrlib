import pino from 'pino';

const transport = pino.transport({
  target: 'pino-socket',
  options: {
    address: '127.0.0.1',
    port: 9000,
    mode: 'tcp',
    reconnect: true,
  },
});

export const LoggersSection = {
  // We use the transport for high-performance non-blocking logs
  logger: pino(transport),
};