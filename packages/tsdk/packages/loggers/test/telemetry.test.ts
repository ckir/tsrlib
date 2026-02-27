import { describe, it, expect } from 'vitest';
import { LoggersSection } from '../src/index';
import { RSdk } from '../../../src/index';

describe('Loggers Telemetry Pipeline', () => {
  it('should dispatch log to Vector and verify Rust bridge status', async () => {
    const status = RSdk.checkRsdkStatus();
    
    // Send the log
    LoggersSection.logger.info({ 
      event: 'test_telemetry', 
      rust_status: status 
    });

    // Verification
    expect(status).toContain('Online');
    
    // We wait briefly to ensure the pino-socket worker sends the data
    await new Promise(resolve => setTimeout(resolve, 500));
  });
});