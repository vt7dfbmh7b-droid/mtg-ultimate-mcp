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

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = config.httpTimeoutMs,
): Promise<T> {
  const headers = new Headers(defaultHeaders());
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));

  const response = await fetch(url, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(timeoutMs),
  });

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
  const headers = new Headers(defaultHeaders());
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));

  const response = await fetch(url, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(timeoutMs),
  });

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
