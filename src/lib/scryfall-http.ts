import { config } from '../config.js';
import { fetchJson } from './http.js';

let scryfallQueue: Promise<void> = Promise.resolve();
let lastScryfallRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));
}

function boundedGap(value: number): number {
  if (!Number.isFinite(value)) return config.scryfallMinRequestGapMs;
  return Math.max(0, Math.min(5_000, Math.trunc(value)));
}

export function effectiveScryfallRequestGapMs(requestedMinimumMs?: number): number {
  return Math.max(
    config.scryfallMinRequestGapMs,
    requestedMinimumMs === undefined ? 0 : boundedGap(requestedMinimumMs),
  );
}

/**
 * Single process-wide Scryfall pacing gate.
 *
 * Every normal Scryfall request path should pass through this helper so card lookups,
 * catalog reads, bounded pagination, unrestricted sampling, and collection POSTs do
 * not each maintain independent rate-limit clocks. The existing HTTP layer still owns
 * retry/timeout semantics; this layer only serializes Scryfall traffic and enforces a
 * minimum start-to-start gap.
 */
export async function scryfallFetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs?: number,
  requestedMinimumGapMs?: number,
): Promise<T> {
  let releaseQueue: () => void = () => undefined;
  const previous = scryfallQueue;
  scryfallQueue = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });

  await previous;
  try {
    const gapMs = effectiveScryfallRequestGapMs(requestedMinimumGapMs);
    const waitMs = Math.max(0, gapMs - (Date.now() - lastScryfallRequestAt));
    if (waitMs > 0) await sleep(waitMs);
    lastScryfallRequestAt = Date.now();
    return await fetchJson<T>(url, init, timeoutMs);
  } finally {
    releaseQueue();
  }
}
