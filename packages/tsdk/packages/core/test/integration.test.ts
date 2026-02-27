import { describe, it, expect } from 'vitest';
import { RSdk, CoreSection } from '../../src/index.js';

describe('TSRLib Integration', () => {
  it('should verify the Rust FFI is loaded', () => {
    // This will fail if the .node file is missing
    expect(RSdk.checkRsdkStatus()).toBe('RSdk Core Online');
  });

  it('should access internal TSdk modules', () => {
    expect(CoreSection.status).toBe('active');
  });
});
