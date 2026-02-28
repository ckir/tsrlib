import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiNasdaqUnlimited } from '../src/Nasdaq/ApiNasdaqUnlimited.js';
import { RequestUnlimited } from '@tsrlib/retrieve';
import { rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('ApiNasdaqUnlimited Integration Tests', () => {
  let tempDir: string;
  const mockUrl = 'https://api.nasdaq.com/api/market-info';

  const mockNasdaqBody = {
    data: { country: "U.S.", mrktStatus: "Closed" },
    message: null,
    status: { rCode: 200, bCodeMessage: null, developerMessage: null }
  };

  const createMockResponse = (body: any, status = 200) => ({
    status: 'success' as const,
    value: {
      body,
      status,
      ok: status >= 200 && status < 300,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: {} as any,
      url: mockUrl,
      redirected: false,
      type: 'basic' as ResponseType,
      bodyUsed: true
    }
  });

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nasdaq-test-'));
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    (globalThis as any).sysconfig = {};
    (globalThis as any).logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
    delete (globalThis as any).sysconfig;
    delete (globalThis as any).logger;
  });

  it('should successfully fetch and strip the Nasdaq envelope', async () => {
    vi.spyOn(RequestUnlimited, 'endPoint').mockResolvedValue(createMockResponse(mockNasdaqBody));
    const result = await ApiNasdaqUnlimited.endPoint(mockUrl);
    expect(result.status).toBe('success');
    expect(result.value?.country).toBe("U.S.");
  });

  it('should include correct Chrome 145 headers by default', async () => {
    const spy = vi.spyOn(RequestUnlimited, 'endPoint').mockResolvedValue(createMockResponse(mockNasdaqBody));
    await ApiNasdaqUnlimited.endPoint(mockUrl);

    // FIX: Use non-null assertions and casting to any for the headers object
    const callArgs = spy.mock.calls[0]![1];
    const callHeaders = (callArgs as any).headers;
    
    expect(callHeaders['user-agent']).toContain('Chrome/145');
    expect(callHeaders['sec-ch-ua']).toContain('"Google Chrome";v="145"');
  });

  it('should allow overriding headers via global sysconfig', async () => {
    (globalThis as any).sysconfig = {
      markets: { nasdaq: { headers: { 'x-test': 'val' } } }
    };

    const spy = vi.spyOn(RequestUnlimited, 'endPoint').mockResolvedValue(createMockResponse(mockNasdaqBody));
    await ApiNasdaqUnlimited.endPoint(mockUrl);

    const callHeaders = (spy.mock.calls[0]![1] as any).headers;
    expect(callHeaders['x-test']).toBe('val');
  });

  it('should use charting headers when applicable', async () => {
    const chartUrl = 'https://charting.nasdaq.com/api/v1';
    const spy = vi.spyOn(RequestUnlimited, 'endPoint').mockResolvedValue(createMockResponse(mockNasdaqBody));
    
    await ApiNasdaqUnlimited.endPoint(chartUrl);

    const callHeaders = (spy.mock.calls[0]![1] as any).headers;
    expect(callHeaders['Referer']).toBe('https://charting.nasdaq.com/dynamic/chart.html');
  });
});