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

export class HttpRequestError extends Error {
  readonly provider: string;
  readonly method: string;
  readonly url: string;
  readonly attempts: number;
  readonly timeoutMs: number;
  readonly causeName: string;

  constructor(
    provider: string,
    method: string,
    url: string,
    attempts: number,
    timeoutMs: number,
    cause: unknown,
  ) {
    const causeName = cause instanceof Error ? cause.name : typeof cause;
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    super(
      `${provider} ${method} ${url} failed after ${attempts} attempt${attempts === 1 ? '' : 's'} `
      + `(timeout ${timeoutMs}ms per attempt): ${causeName}: ${causeMessage}`,
    );
    this.name = 'HttpRequestError';
    this.provider = provider;
    this.method = method;
    this.url = url;
    this.attempts = attempts;
    this.timeoutMs = timeoutMs;
    this.causeName = causeName;
  }
}

type HttpProvider = 'scryfall' | 'commander-spellbook' | 'default';

interface HttpRequestPolicy {
  provider: HttpProvider;
  timeoutMs: number;
  attempts: number;
  retryable: boolean;
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

function pathUnderBase(url: string, base: string): string | null {
  try {
    const target = new URL(url);
    const root = new URL(base);
    if (target.origin !== root.origin) return null;
    const rootPath = root.pathname.replace(/\/+$/, '');
    if (rootPath && target.pathname !== rootPath && !target.pathname.startsWith(`${rootPath}/`)) return null;
    const relative = rootPath ? target.pathname.slice(rootPath.length) : target.pathname;
    return (relative || '/').replace(/\/+$/, '') || '/';
  } catch {
    return null;
  }
}

function providerForUrl(url: string): { provider: HttpProvider; path: string } {
  const scryfallPath = pathUnderBase(url, config.scryfallApiBase);
  if (scryfallPath !== null) return { provider: 'scryfall', path: scryfallPath };

  const spellbookPath = pathUnderBase(url, config.commanderSpellbookApiBase);
  if (spellbookPath !== null) return { provider: 'commander-spellbook', path: spellbookPath };

  return { provider: 'default', path: '' };
}

function isKnownIdempotentReadPost(provider: HttpProvider, path: string): boolean {
  if (provider === 'scryfall') return path === '/cards/collection';
  if (provider === 'commander-spellbook') {
    return path === '/find-my-combos' || path === '/estimate-bracket';
  }
  return false;
}

function safeToRetry(url: string, init: RequestInit): boolean {
  const method = (init.method ?? 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD') return true;
  if (method !== 'POST') return false;
  const { provider, path } = providerForUrl(url);
  return isKnownIdempotentReadPost(provider, path);
}

function resolveRequestPolicy(url: string, init: RequestInit, timeoutOverrideMs?: number): HttpRequestPolicy {
  const { provider } = providerForUrl(url);
  const retryable = safeToRetry(url, init);

  if (provider === 'scryfall') {
    return {
      provider,
      timeoutMs: timeoutOverrideMs ?? config.scryfallHttpTimeoutMs,
      attempts: retryable ? config.scryfallHttpRetryAttempts : 1,
      retryable,
    };
  }

  if (provider === 'commander-spellbook') {
    return {
      provider,
      timeoutMs: timeoutOverrideMs ?? config.commanderSpellbookHttpTimeoutMs,
      attempts: retryable ? config.commanderSpellbookHttpRetryAttempts : 1,
      retryable,
    };
  }

  return {
    provider,
    timeoutMs: timeoutOverrideMs ?? config.httpTimeoutMs,
    attempts: retryable ? config.httpRetryAttempts : 1,
    retryable,
  };
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

function requestSignal(externalSignal: AbortSignal | null | undefined, timeoutMs: number): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!externalSignal) return timeoutSignal;
  const signalConstructor = AbortSignal as typeof AbortSignal & {
    any?: (signals: AbortSignal[]) => AbortSignal;
  };
  return signalConstructor.any ? signalConstructor.any([externalSignal, timeoutSignal]) : externalSignal;
}

function callerAborted(error: unknown, externalSignal: AbortSignal | null | undefined): boolean {
  if (externalSignal?.aborted) return true;
  return error instanceof DOMException && error.name === 'AbortError';
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  timeoutOverrideMs?: number,
): Promise<Response> {
  const policy = resolveRequestPolicy(url, init, timeoutOverrideMs);
  const method = (init.method ?? 'GET').toUpperCase();
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= policy.attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: requestSignal(init.signal, policy.timeoutMs),
      });
      if (
        response.ok
        || !policy.retryable
        || !isRetryableHttpStatus(response.status)
        || attempt >= policy.attempts
      ) {
        return response;
      }
      await response.body?.cancel().catch(() => undefined);
      await sleep(retryDelayMs(attempt, response));
    } catch (error) {
      lastError = error;
      if (callerAborted(error, init.signal)) throw error;
      if (!policy.retryable || attempt >= policy.attempts) {
        throw new HttpRequestError(
          policy.provider,
          method,
          url,
          attempt,
          policy.timeoutMs,
          error,
        );
      }
      await sleep(retryDelayMs(attempt));
    }
  }

  throw new HttpRequestError(
    policy.provider,
    method,
    url,
    policy.attempts,
    policy.timeoutMs,
    lastError,
  );
}

function requestHeaders(init: RequestInit): Headers {
  const headers = new Headers(defaultHeaders());
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  return headers;
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs?: number,
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
  timeoutMs?: number,
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
