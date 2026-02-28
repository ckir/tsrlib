import { RequestUnlimited } from '@tsrlib/retrieve';
import { serializeError } from 'serialize-error';

export interface NasdaqStatus {
  rCode: number;
  bCodeMessage: Array<{ code: string; errorMessage: string }> | null;
  developerMessage: string | null;
}

export type NasdaqResult<T = any> = 
  | { status: 'success'; value: T; details?: any }
  | { status: 'error'; reason: { message: string; [key: string]: any } };

export class ApiNasdaqUnlimited extends RequestUnlimited {
  protected static readonly CHROME_VERSION = "145";

  private static apiErrorToString(status: NasdaqStatus): string {
    if (!status.bCodeMessage || status.bCodeMessage.length === 0) {
      return status.developerMessage || 'Unknown Nasdaq API Error';
    }
    return status.bCodeMessage
      .map(err => `code: ${err.code} = ${err.errorMessage}`)
      .join('::');
  }

  protected static log(level: 'info' | 'warn' | 'error', msg: string, data?: any): void {
    const logger = (globalThis as any).logger;
    const payload = data instanceof Error ? { error: serializeError(data) } : data;

    if (logger && typeof logger[level] === 'function') {
      logger[level]({ msg: `[Nasdaq] ${msg}`, ...payload });
    } else {
      console[level](`[Nasdaq] ${msg}`, payload || '');
    }
  }

  public static getHeaders(url: string): Record<string, string> {
    const isCharting = url.includes('charting');
    const headers: Record<string, string> = isCharting ? {
      "accept": "*/*",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "priority": "u=1, i",
      "sec-ch-ua": `"Google Chrome";v="${this.CHROME_VERSION}", "Not-A.Brand";v="8", "Chromium";v="${this.CHROME_VERSION}"`,
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "Referer": "https://charting.nasdaq.com/dynamic/chart.html",
      "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${this.CHROME_VERSION}.0.0.0 Safari/537.36`
    } : {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      'origin': 'https://www.nasdaq.com',
      'referer': 'https://www.nasdaq.com/',
      'sec-ch-ua': `"Google Chrome";v="${this.CHROME_VERSION}", "Not-A.Brand";v="8", "Chromium";v="${this.CHROME_VERSION}"`,
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'user-agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${this.CHROME_VERSION}.0.0.0 Safari/537.36`
    };

    const configHeaders = (globalThis as any).sysconfig?.markets?.nasdaq?.headers;
    return configHeaders ? { ...headers, ...configHeaders } : headers;
  }

  public static override async endPoint<T = any>(
    url: string, 
    options: any = {}
  ): Promise<any> {
    options.headers = { ...this.getHeaders(url), ...options.headers };

    const response = await super.endPoint(url, options);

    if (response.status === 'error') {
      return { 
        status: 'error', 
        reason: { message: 'Transport Error', original: response.reason } 
      };
    }

    // Access value safely after the error check
    const val = response.value;
    const nasdaqBody = val?.body;

    if (nasdaqBody?.status?.rCode !== 200) {
      this.log('warn', `Request to ${url} failed logic check`, { status: response.status });
      
      const errorMessage = nasdaqBody?.status 
        ? this.apiErrorToString(nasdaqBody.status) 
        : 'Malformed Nasdaq Response';

      return { 
        status: 'error', 
        reason: { message: errorMessage } 
      };
    }

    // Success path
    const { body, ...details } = val;
    
    return {
      status: 'success',
      value: body.data as T,
      details: details
    };
  }
}