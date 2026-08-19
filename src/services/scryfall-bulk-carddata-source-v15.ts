import { config } from '../config.js';
import type { HistoricalCardDataAcquisitionOptionsV15 } from './historical-carddata-acquisition-v15.js';
import {
  SCRYFALL_DEFAULT_CARDS_SOURCE_ID_V15,
  captureScryfallDefaultCardsForwardV15,
  type ScryfallForwardCardDataCaptureV15,
} from './scryfall-forward-carddata-capture-v15.js';

export const SCRYFALL_BULK_CARD_DATA_SOURCE_SCHEMA_V15 = 'scryfall-bulk-carddata-source-v15.2' as const;
export const SCRYFALL_BULK_DISCOVERY_ACCEPT_V15 = 'application/json;q=0.9,*/*;q=0.8' as const;

const DEFAULT_CARDS_TYPE = 'default_cards';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface ScryfallBulkDiscoveryOptionsV15 {
  fetchImpl?: FetchLike;
  apiBase?: string;
  userAgent?: string;
  timeoutMs?: number;
  now?: string;
}

export interface ScryfallDefaultCardsDiscoveryV15 {
  schemaVersion: typeof SCRYFALL_BULK_CARD_DATA_SOURCE_SCHEMA_V15;
  sourceId: typeof SCRYFALL_DEFAULT_CARDS_SOURCE_ID_V15;
  manifestUri: string;
  discoveredAt: string;
  providerObjectId: string;
  providerMetadataUri: string;
  providerUpdatedAt: string;
  providerCompressedSizeBytes: number;
  downloadUri: string;
  requestPolicy: {
    userAgent: string;
    accept: typeof SCRYFALL_BULK_DISCOVERY_ACCEPT_V15;
    automaticRetries: 0;
  };
  temporalPolicy: 'current-provider-metadata-only-not-historical-proof';
}

export interface DiscoverAndCaptureScryfallDefaultCardsOptionsV15 extends ScryfallBulkDiscoveryOptionsV15 {
  maxBytes?: HistoricalCardDataAcquisitionOptionsV15['maxBytes'];
  maxDecodedBytes?: number;
}

export interface DiscoveredScryfallForwardCardDataCaptureV15 {
  discovery: ScryfallDefaultCardsDiscoveryV15;
  capture: ScryfallForwardCardDataCaptureV15;
}

export class ScryfallBulkDiscoveryErrorV15 extends Error {
  readonly code:
    | 'source-request-failed'
    | 'source-timeout'
    | 'invalid-manifest'
    | 'missing-default-cards'
    | 'duplicate-default-cards'
    | 'invalid-default-cards-entry';

  constructor(code: ScryfallBulkDiscoveryErrorV15['code'], message: string) {
    super(message);
    this.name = 'ScryfallBulkDiscoveryErrorV15';
    this.code = code;
  }
}

function requiredText(name: string, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ScryfallBulkDiscoveryErrorV15('invalid-default-cards-entry', `${name} must be a non-empty string.`);
  }
  return value.trim();
}

function normalizedTimestamp(name: string, value: unknown, code: 'invalid-manifest' | 'invalid-default-cards-entry'): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ScryfallBulkDiscoveryErrorV15(code, `${name} must be a valid timestamp.`);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new ScryfallBulkDiscoveryErrorV15(code, `${name} must be a valid timestamp.`);
  }
  return new Date(milliseconds).toISOString();
}

function positiveSafeInteger(name: string, value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new ScryfallBulkDiscoveryErrorV15(
      'invalid-default-cards-entry',
      `${name} must be a positive safe integer.`,
    );
  }
  return value as number;
}

function absoluteHttpsScryfallApiBulkUri(value: unknown): string {
  const text = requiredText('uri', value);
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw new ScryfallBulkDiscoveryErrorV15(
      'invalid-default-cards-entry',
      'uri must be an absolute HTTPS api.scryfall.com/bulk-data URL.',
    );
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.hostname.toLocaleLowerCase() !== 'api.scryfall.com'
    || !parsed.pathname.startsWith('/bulk-data/')
  ) {
    throw new ScryfallBulkDiscoveryErrorV15(
      'invalid-default-cards-entry',
      'uri must be an absolute HTTPS api.scryfall.com/bulk-data URL.',
    );
  }
  return parsed.toString();
}

function absoluteHttpsScryfallJsonlGzipUri(value: unknown): string {
  const text = requiredText('jsonl_download_uri', value);
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw new ScryfallBulkDiscoveryErrorV15(
      'invalid-default-cards-entry',
      'jsonl_download_uri must be an absolute HTTPS *.scryfall.io .jsonl.gz URL.',
    );
  }
  const hostname = parsed.hostname.toLocaleLowerCase();
  if (
    parsed.protocol !== 'https:'
    || !hostname.endsWith('.scryfall.io')
    || !parsed.pathname.toLocaleLowerCase().endsWith('.jsonl.gz')
  ) {
    throw new ScryfallBulkDiscoveryErrorV15(
      'invalid-default-cards-entry',
      'jsonl_download_uri must be an absolute HTTPS *.scryfall.io .jsonl.gz URL.',
    );
  }
  return parsed.toString();
}

function manifestUri(apiBase: string | undefined): string {
  const baseText = (apiBase ?? config.scryfallApiBase).trim().replace(/\/$/, '');
  let parsed: URL;
  try {
    parsed = new URL(`${baseText}/bulk-data`);
  } catch {
    throw new Error('Scryfall bulk discovery apiBase must be an absolute HTTP/HTTPS URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Scryfall bulk discovery apiBase must be an absolute HTTP/HTTPS URL.');
  }
  return parsed.toString();
}

function timeoutMs(value: number | undefined): number {
  const timeout = value ?? config.scryfallHttpTimeoutMs;
  if (!Number.isInteger(timeout) || timeout <= 0) throw new Error('timeoutMs must be a positive integer.');
  return timeout;
}

function userAgent(value: string | undefined): string {
  const agent = (value ?? config.userAgent).trim();
  if (!agent) throw new Error('userAgent must be a non-empty string.');
  return agent;
}

function discoveryTime(value: string | undefined): string {
  return value === undefined
    ? new Date().toISOString()
    : normalizedTimestamp('now', value, 'invalid-manifest');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseDefaultCardsEntry(
  entry: Record<string, unknown>,
  shared: {
    manifestUri: string;
    discoveredAt: string;
    userAgent: string;
  },
): ScryfallDefaultCardsDiscoveryV15 {
  const type = requiredText('type', entry.type);
  if (type !== DEFAULT_CARDS_TYPE) {
    throw new ScryfallBulkDiscoveryErrorV15(
      'invalid-default-cards-entry',
      `Expected Scryfall bulk type ${DEFAULT_CARDS_TYPE}; received ${type}.`,
    );
  }
  return {
    schemaVersion: SCRYFALL_BULK_CARD_DATA_SOURCE_SCHEMA_V15,
    sourceId: SCRYFALL_DEFAULT_CARDS_SOURCE_ID_V15,
    manifestUri: shared.manifestUri,
    discoveredAt: shared.discoveredAt,
    providerObjectId: requiredText('id', entry.id),
    providerMetadataUri: absoluteHttpsScryfallApiBulkUri(entry.uri),
    providerUpdatedAt: normalizedTimestamp('updated_at', entry.updated_at, 'invalid-default-cards-entry'),
    providerCompressedSizeBytes: positiveSafeInteger('compressed_size', entry.compressed_size),
    downloadUri: absoluteHttpsScryfallJsonlGzipUri(entry.jsonl_download_uri),
    requestPolicy: {
      userAgent: shared.userAgent,
      accept: SCRYFALL_BULK_DISCOVERY_ACCEPT_V15,
      automaticRetries: 0,
    },
    temporalPolicy: 'current-provider-metadata-only-not-historical-proof',
  };
}

export async function discoverScryfallDefaultCardsV15(
  options: ScryfallBulkDiscoveryOptionsV15 = {},
): Promise<ScryfallDefaultCardsDiscoveryV15> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = manifestUri(options.apiBase);
  const agent = userAgent(options.userAgent);
  const discoveredAt = discoveryTime(options.now);
  const requestTimeoutMs = timeoutMs(options.timeoutMs);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        'User-Agent': agent,
        Accept: SCRYFALL_BULK_DISCOVERY_ACCEPT_V15,
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ScryfallBulkDiscoveryErrorV15(
        'source-timeout',
        `Scryfall bulk manifest request timed out after ${requestTimeoutMs}ms.`,
      );
    }
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    throw new ScryfallBulkDiscoveryErrorV15(
      'source-request-failed',
      `Scryfall bulk manifest request failed: ${detail}`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new ScryfallBulkDiscoveryErrorV15(
      'source-request-failed',
      `Scryfall bulk manifest returned HTTP ${response.status} ${response.statusText}.`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json() as unknown;
  } catch {
    throw new ScryfallBulkDiscoveryErrorV15('invalid-manifest', 'Scryfall bulk manifest is not valid JSON.');
  }
  const record = asRecord(payload);
  if (!record || !Array.isArray(record.data)) {
    throw new ScryfallBulkDiscoveryErrorV15(
      'invalid-manifest',
      'Scryfall bulk manifest must be an object containing a data array.',
    );
  }

  const matches = record.data
    .map(asRecord)
    .filter((entry): entry is Record<string, unknown> => entry !== null && entry.type === DEFAULT_CARDS_TYPE);
  if (matches.length === 0) {
    throw new ScryfallBulkDiscoveryErrorV15(
      'missing-default-cards',
      'Scryfall bulk manifest does not contain a default_cards entry.',
    );
  }
  if (matches.length !== 1) {
    throw new ScryfallBulkDiscoveryErrorV15(
      'duplicate-default-cards',
      `Scryfall bulk manifest contains ${matches.length} default_cards entries; exactly one is required.`,
    );
  }

  return parseDefaultCardsEntry(matches[0]!, {
    manifestUri: url,
    discoveredAt,
    userAgent: agent,
  });
}

export async function discoverAndCaptureScryfallDefaultCardsForwardV15(
  options: DiscoverAndCaptureScryfallDefaultCardsOptionsV15 = {},
): Promise<DiscoveredScryfallForwardCardDataCaptureV15> {
  const captureObservedAt = discoveryTime(options.now);
  const discovery = await discoverScryfallDefaultCardsV15({
    ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
    ...(options.apiBase === undefined ? {} : { apiBase: options.apiBase }),
    ...(options.userAgent === undefined ? {} : { userAgent: options.userAgent }),
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    now: captureObservedAt,
  });
  const capture = await captureScryfallDefaultCardsForwardV15(discovery.downloadUri, {
    ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
    ...(options.maxBytes === undefined ? {} : { maxBytes: options.maxBytes }),
    ...(options.maxDecodedBytes === undefined ? {} : { maxDecodedBytes: options.maxDecodedBytes }),
    expectedCompressedBytes: discovery.providerCompressedSizeBytes,
    now: captureObservedAt,
  });
  return { discovery, capture };
}
