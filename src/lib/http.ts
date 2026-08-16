import { config } from '../config.js';

export class HttpError extends Error {
  readonly status: number;
  readonly url: string;
  readonly body: string;

  constructor(message: string, status: number, url: string, body: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

const defaultHeaders = (): Record<string, string> => ({
  Accept: 'application/json;q=0.9,*/*;q=0.8',
  'User-Agent': config.userAgent,
});

export function isRetryableHttpStatus(status: number): boolean {
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

export function parseRetryAfterMs(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const seconds = Number.parseFloat(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(30_000, Math.round(seconds * 1_000));
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.min(30_000, timestamp - now));
}

function safeToRetry(init: RequestInit): boolean {
  const method = (init.method ?? 'GET').toUpperCase();
  return method === 'GET' || method === 'HEAD';
}

function retryDelayMs(attempt: number, response?: Response): number {
  const headerDelay = response ? parseRetryAfterMs(response.headers.get('retry-after')) : null;
  if (headerDelay !== null) return headerDelay;
  const base = config.httpRetryBaseMs;
  return Math.min(3_000, base * (2 ** Math.max(0, attempt - 1)));
}

function sleep(ms: number): Promise<void> {
  return ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const retryable = safeToRetry(init);
  const attempts = retryable ? config.httpRetryAttempts : 1;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(timeoutMs),
      });
      if (response.ok || !retryable || !isRetryableHttpStatus(response.status) || attempt >= attempts) return response;
      await response.body?.cancel().catch(() => undefined);
      await sleep(retryDelayMs(attempt, response));
    } catch (error) {
      lastError = error;
      if (!retryable || attempt >= attempts || error instanceof DOMException && error.name === 'AbortError') throw error;
      await sleep(retryDelayMs(attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Request failed after ${attempts} attempts: ${url}`);
}

function requestHeaders(init: RequestInit): Headers {
  const headers = new Headers(defaultHeaders());
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  return headers;
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = config.httpTimeoutMs,
): Promise<T> {
  const response = await fetchWithRetry(url, { ...init, headers: requestHeaders(init) }, timeoutMs);

  if (!response.ok) {
    const body = (await response.text()).slice(0, 4_000);
    throw new HttpError(
      `HTTP ${response.status} ${response.statusText} from ${url}`,
      response.status,
      url,
      body,
    );
  }

  return (await response.json()) as T;
}

export async function fetchText(
  url: string,
  init: RequestInit = {},
  timeoutMs = config.httpTimeoutMs,
): Promise<string> {
  const response = await fetchWithRetry(url, { ...init, headers: requestHeaders(init) }, timeoutMs);

  if (!response.ok) {
    const body = (await response.text()).slice(0, 4_000);
    throw new HttpError(
      `HTTP ${response.status} ${response.statusText} from ${url}`,
      response.status,
      url,
      body,
    );
  }

  return response.text();
}
