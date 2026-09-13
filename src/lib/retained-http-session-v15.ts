import { createHash } from 'node:crypto';

export interface RetainedHttpEntryV15 {
  request: { url: string; method: string; body: string };
  requestHash: string;
  observedAt: string;
  status: number;
  contentType: string;
  responseBase64: string;
  responseHash: string;
}
export interface RetainedHttpCaptureV15 {
  schema: 'retained-http-capture-v15.1';
  sourceSha: string;
  scryfallManifestFingerprint: string;
  evaluationTime: string;
  entries: RetainedHttpEntryV15[];
}
export const sha256V15 = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex');

export function verifyRetainedHttpCaptureV15(capture: RetainedHttpCaptureV15): void {
  if (capture.schema !== 'retained-http-capture-v15.1' || !/^[a-f0-9]{40}$/.test(capture.sourceSha)
    || !capture.scryfallManifestFingerprint || !Number.isFinite(Date.parse(capture.evaluationTime))
    || !Array.isArray(capture.entries) || capture.entries.length > 20_000) throw new Error('Invalid retained HTTP capture metadata.');
  const seen = new Set<string>();
  for (const entry of capture.entries) {
    if (entry.requestHash !== sha256V15(JSON.stringify(entry.request)) || seen.has(entry.requestHash)
      || entry.responseHash !== sha256V15(Buffer.from(entry.responseBase64, 'base64'))
      || !Number.isFinite(Date.parse(entry.observedAt)) || entry.status < 200 || entry.status > 599) {
      throw new Error(`Invalid retained HTTP response integrity: ${entry.request?.url}`);
    }
    seen.add(entry.requestHash);
  }
}

/** Capture only actual provider bytes; replay has no network fallback, even on a cache miss.
 * One fresh process per pass keeps product caches and partial builds out of the replay seed. */
export function createRetainedHttpSessionV15(options: {
  mode: 'capture' | 'replay';
  capture: RetainedHttpCaptureV15;
  allowedOrigins: string[];
  fetchImpl?: typeof fetch;
  onEntry?: (entry: RetainedHttpEntryV15) => void;
  onRequest?: (event: Record<string, unknown>) => void;
}): { fetch: typeof fetch; assertComplete: () => void; misses: string[] } {
  verifyRetainedHttpCaptureV15(options.capture);
  const entries = new Map(options.capture.entries.map(entry => [entry.requestHash, entry]));
  const pending = new Map<string, Promise<RetainedHttpEntryV15>>();
  const unresolved = new Map<string, string>();
  const misses: string[] = [];
  const response = (entry: RetainedHttpEntryV15): Response => new Response(
    entry.status === 204 || entry.status === 205 || entry.status === 304 ? null : Buffer.from(entry.responseBase64, 'base64'),
    { status: entry.status, headers: { 'content-type': entry.contentType } },
  );
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const retainedFetch: typeof fetch = async (input, init) => {
    const req = new Request(input, init);
    const request = { url: req.url, method: req.method, body: await req.clone().text() };
    const key = sha256V15(JSON.stringify(request));
    if (!options.allowedOrigins.includes(new URL(req.url).origin)
      || !['GET', 'HEAD', 'POST'].includes(req.method)
      || (req.method === 'POST' && !/\/(?:find-my-combos|estimate-bracket)\/?$/.test(new URL(req.url).pathname))) {
      const message = `Retained session refuses unexpected request: ${req.method} ${req.url}`;
      misses.push(message); throw new Error(message);
    }
    const cached = entries.get(key);
    options.onRequest?.({ event: 'provider-request', method: req.method, url: req.url, requestHash: key, mode: options.mode, cached: Boolean(cached) });
    if (cached) return response(cached);
    if (options.mode === 'replay') {
      const message = `Missing retained provider response: ${req.method} ${req.url} bodySha256=${sha256V15(request.body)}`;
      misses.push(message); throw new Error(message);
    }
    unresolved.set(key, `${req.method} ${req.url} bodySha256=${sha256V15(request.body)}`);
    let job = pending.get(key);
    if (!job) {
      job = (async () => {
        const started = performance.now();
        const raw = await fetchImpl(req);
        const bytes = new Uint8Array(await raw.arrayBuffer());
        if (bytes.length > 50_000_000 || entries.size >= 20_000) throw new Error('Retained HTTP capture exceeds safety ceiling.');
        const entry: RetainedHttpEntryV15 = {
          request, requestHash: key, observedAt: new Date().toISOString(), status: raw.status,
          contentType: raw.headers.get('content-type') ?? 'application/octet-stream',
          responseBase64: Buffer.from(bytes).toString('base64'), responseHash: sha256V15(bytes),
        };
        options.onRequest?.({ event: 'provider-response', url: req.url, requestHash: key, status: raw.status, durationMs: performance.now() - started });
        // Retryable failures are observed in the trace, not frozen as permanent absence.
        if (![408, 425, 429, 500, 502, 503, 504].includes(raw.status)) {
          entries.set(key, entry); options.capture.entries.push(entry); options.onEntry?.(entry);
          unresolved.delete(key);
        }
        return entry;
      })();
      pending.set(key, job);
    }
    try { return response(await job); } finally { pending.delete(key); }
  };
  return { fetch: retainedFetch, misses, assertComplete: () => {
    const missing = [...new Set([...misses, ...unresolved.values()])];
    if (missing.length) throw new Error(`Retained HTTP replay incomplete: ${missing.join('; ')}`);
  } };
}
