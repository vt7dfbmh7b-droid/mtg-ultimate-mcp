import { createHash } from 'node:crypto';
import type { ScryfallCard, ScryfallLegalities } from '../types/scryfall.js';
import {
  assessHistoricalCardDataProvenanceV15,
  extractProvenancedDeckFeatureSnapshotV15,
  type HistoricalCardDataProvenanceV15,
  type ProvenancedDeckFeatureSnapshotV15,
} from './historical-carddata-provenance-v15.js';

export const HISTORICAL_CARD_DATA_ACQUISITION_SCHEMA_V15 = 'historical-carddata-acquisition-v15.1' as const;
export const SCRYFALL_CARD_ARRAY_FORMAT_V15 = 'scryfall-card-array-v1' as const;
export const DEFAULT_HISTORICAL_CARD_DATA_MAX_BYTES_V15 = 768 * 1024 * 1024;

const LEGALITY_VALUES = new Set(['legal', 'not_legal', 'restricted', 'banned']);

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type ArchivedProvenanceV15 = Extract<HistoricalCardDataProvenanceV15, { method: 'archived-versioned-snapshot' }>;
type ContemporaneousProvenanceV15 = Extract<HistoricalCardDataProvenanceV15, { method: 'contemporaneous-capture' }>;

export interface HistoricalCardDataArchivePinV15 {
  sourceId: string;
  sourceUri: string;
  sourceContentHash: string;
  archiveVersion: string;
  snapshotEffectiveAt: string;
  archivePublishedAt: string;
  format: typeof SCRYFALL_CARD_ARRAY_FORMAT_V15;
  expectedByteLength?: number;
}

export interface CurrentCardDataCaptureSourceV15 {
  sourceId: string;
  sourceUri: string;
  format: typeof SCRYFALL_CARD_ARRAY_FORMAT_V15;
}

export interface HistoricalCardDataAcquisitionOptionsV15 {
  fetchImpl?: FetchLike;
  maxBytes?: number;
  now?: string;
}

export interface AcquiredHistoricalCardDataV15<
  TProvenance extends ArchivedProvenanceV15 | ContemporaneousProvenanceV15 = ArchivedProvenanceV15 | ContemporaneousProvenanceV15,
> {
  schemaVersion: typeof HISTORICAL_CARD_DATA_ACQUISITION_SCHEMA_V15;
  format: typeof SCRYFALL_CARD_ARRAY_FORMAT_V15;
  bytes: Uint8Array;
  byteLength: number;
  cards: ScryfallCard[];
  provenance: TProvenance;
  integrity: {
    algorithm: 'sha256';
    expectedHash: string | null;
    actualHash: string;
    exactHashMatch: boolean;
  };
}

export class HistoricalCardDataAcquisitionErrorV15 extends Error {
  readonly code:
    | 'unsupported-historical-range'
    | 'source-request-failed'
    | 'source-too-large'
    | 'source-byte-length-mismatch'
    | 'source-hash-mismatch'
    | 'source-invalid-utf8'
    | 'source-invalid-json'
    | 'source-invalid-card-data';

  constructor(code: HistoricalCardDataAcquisitionErrorV15['code'], message: string) {
    super(message);
    this.name = 'HistoricalCardDataAcquisitionErrorV15';
    this.code = code;
  }
}

function required(name: string, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  return value.trim();
}

function absoluteHttpUrl(name: string, value: unknown): string {
  const text = required(name, value);
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error(`${name} must be an absolute http/https URL.`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${name} must be an absolute http/https URL.`);
  }
  return parsed.toString();
}

function sha256(value: unknown): string {
  const text = required('sourceContentHash', value).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(text)) throw new Error('sourceContentHash must be a SHA-256 hex digest.');
  return text;
}

function normalizedTimestamp(name: string, value: unknown): string {
  const text = required(name, value);
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) throw new Error(`${name} must be a valid timestamp.`);
  return new Date(ms).toISOString();
}

function acquisitionTime(now?: string): string {
  return now === undefined ? new Date().toISOString() : normalizedTimestamp('now', now);
}

function byteLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_HISTORICAL_CARD_DATA_MAX_BYTES_V15;
  if (!Number.isInteger(limit) || limit <= 0) throw new Error('maxBytes must be a positive integer.');
  return limit;
}

function expectedByteLength(value: number | undefined): number | null {
  if (value === undefined) return null;
  if (!Number.isInteger(value) || value < 0) throw new Error('expectedByteLength must be a non-negative integer.');
  return value;
}

function sourceTooLarge(total: number, limit: number): HistoricalCardDataAcquisitionErrorV15 {
  return new HistoricalCardDataAcquisitionErrorV15(
    'source-too-large',
    `Historical card-data source returned more than ${limit} bytes (at least ${total}), above the safety limit.`,
  );
}

function sourceLengthMismatch(total: number, expectedLength: number): HistoricalCardDataAcquisitionErrorV15 {
  return new HistoricalCardDataAcquisitionErrorV15(
    'source-byte-length-mismatch',
    `Historical card-data source returned ${total} bytes but the archive pin requires ${expectedLength}.`,
  );
}

async function readBoundedResponseBytes(
  response: Response,
  url: string,
  limit: number,
  expectedLength: number | null,
): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > limit) throw sourceTooLarge(bytes.byteLength, limit);
    if (expectedLength !== null && bytes.byteLength !== expectedLength) {
      throw sourceLengthMismatch(bytes.byteLength, expectedLength);
    }
    return bytes;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => undefined);
        throw sourceTooLarge(total, limit);
      }
      if (expectedLength !== null && total > expectedLength) {
        await reader.cancel().catch(() => undefined);
        throw sourceLengthMismatch(total, expectedLength);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof HistoricalCardDataAcquisitionErrorV15) throw error;
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    throw new HistoricalCardDataAcquisitionErrorV15(
      'source-request-failed',
      `Historical card-data response stream failed for ${url}: ${detail}`,
    );
  }

  if (expectedLength !== null && total !== expectedLength) {
    throw sourceLengthMismatch(total, expectedLength);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function downloadBytes(
  url: string,
  options: HistoricalCardDataAcquisitionOptionsV15,
  expectedLength: number | null,
): Promise<Uint8Array> {
  const limit = byteLimit(options.maxBytes);
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json;q=0.9,*/*;q=0.8',
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    throw new HistoricalCardDataAcquisitionErrorV15(
      'source-request-failed',
      `Historical card-data request failed for ${url}: ${detail}`,
    );
  }
  if (!response.ok) {
    throw new HistoricalCardDataAcquisitionErrorV15(
      'source-request-failed',
      `Historical card-data request returned HTTP ${response.status} ${response.statusText} for ${url}.`,
    );
  }

  const headerLengthText = response.headers.get('content-length');
  if (headerLengthText !== null) {
    const headerLength = Number(headerLengthText);
    if (Number.isFinite(headerLength) && headerLength > limit) {
      await response.body?.cancel().catch(() => undefined);
      throw new HistoricalCardDataAcquisitionErrorV15(
        'source-too-large',
        `Historical card-data source declares ${headerLength} bytes, above the ${limit}-byte safety limit.`,
      );
    }
    if (expectedLength !== null && Number.isFinite(headerLength) && headerLength !== expectedLength) {
      await response.body?.cancel().catch(() => undefined);
      throw new HistoricalCardDataAcquisitionErrorV15(
        'source-byte-length-mismatch',
        `Historical card-data source declares ${headerLength} bytes but the archive pin requires ${expectedLength}.`,
      );
    }
  }

  return readBoundedResponseBytes(response, url, limit, expectedLength);
}

function contentHash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function legalities(value: unknown): value is ScryfallLegalities {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every((item) => typeof item === 'string' && LEGALITY_VALUES.has(item));
}

function scryfallCard(value: unknown): value is ScryfallCard {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const card = value as Partial<ScryfallCard>;
  return typeof card.id === 'string' && card.id.length > 0
    && typeof card.name === 'string' && card.name.length > 0
    && typeof card.lang === 'string' && card.lang.length > 0
    && typeof card.cmc === 'number' && Number.isFinite(card.cmc)
    && typeof card.type_line === 'string'
    && stringArray(card.color_identity)
    && stringArray(card.keywords)
    && legalities(card.legalities)
    && typeof card.set === 'string' && card.set.length > 0
    && typeof card.set_name === 'string' && card.set_name.length > 0
    && typeof card.collector_number === 'string' && card.collector_number.length > 0
    && typeof card.rarity === 'string' && card.rarity.length > 0
    && typeof card.scryfall_uri === 'string' && card.scryfall_uri.length > 0;
}

function parseScryfallCardArray(bytes: Uint8Array): ScryfallCard[] {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new HistoricalCardDataAcquisitionErrorV15(
      'source-invalid-utf8',
      'Historical card-data source is not valid UTF-8.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new HistoricalCardDataAcquisitionErrorV15(
      'source-invalid-json',
      'Historical card-data source is not valid JSON.',
    );
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new HistoricalCardDataAcquisitionErrorV15(
      'source-invalid-card-data',
      'Historical card-data source must be a non-empty Scryfall card array.',
    );
  }
  for (let index = 0; index < parsed.length; index += 1) {
    if (!scryfallCard(parsed[index])) {
      throw new HistoricalCardDataAcquisitionErrorV15(
        'source-invalid-card-data',
        `Historical card-data source contains an invalid Scryfall card at index ${index}.`,
      );
    }
  }
  return parsed as ScryfallCard[];
}

function archiveProvenance(
  pin: HistoricalCardDataArchivePinV15,
  retrievedAt: string,
): ArchivedProvenanceV15 {
  if (pin.format !== SCRYFALL_CARD_ARRAY_FORMAT_V15) throw new Error(`Unsupported historical card-data format: ${String(pin.format)}.`);
  return {
    method: 'archived-versioned-snapshot',
    sourceId: required('sourceId', pin.sourceId),
    sourceUri: absoluteHttpUrl('sourceUri', pin.sourceUri),
    sourceContentHash: sha256(pin.sourceContentHash),
    archiveVersion: required('archiveVersion', pin.archiveVersion),
    snapshotEffectiveAt: normalizedTimestamp('snapshotEffectiveAt', pin.snapshotEffectiveAt),
    archivePublishedAt: normalizedTimestamp('archivePublishedAt', pin.archivePublishedAt),
    retrievedAt,
  };
}

export async function acquirePinnedHistoricalCardDataV15(
  pin: HistoricalCardDataArchivePinV15,
  featureAvailableAt: string,
  options: HistoricalCardDataAcquisitionOptionsV15 = {},
): Promise<AcquiredHistoricalCardDataV15<ArchivedProvenanceV15>> {
  const retrievedAt = acquisitionTime(options.now);
  const provenance = archiveProvenance(pin, retrievedAt);
  const assessment = assessHistoricalCardDataProvenanceV15(provenance, featureAvailableAt);
  if (!assessment.eligibleForRichStructuralFeatures) {
    throw new HistoricalCardDataAcquisitionErrorV15(
      'unsupported-historical-range',
      `Historical archive pin is not eligible for the requested feature cutoff: ${assessment.reasons.join(' ')}`,
    );
  }

  const expectedLength = expectedByteLength(pin.expectedByteLength);
  const bytes = await downloadBytes(provenance.sourceUri, options, expectedLength);
  const actualHash = contentHash(bytes);
  if (actualHash !== provenance.sourceContentHash) {
    throw new HistoricalCardDataAcquisitionErrorV15(
      'source-hash-mismatch',
      `Historical card-data SHA-256 mismatch: expected ${provenance.sourceContentHash}, received ${actualHash}.`,
    );
  }
  const cards = parseScryfallCardArray(bytes);
  return {
    schemaVersion: HISTORICAL_CARD_DATA_ACQUISITION_SCHEMA_V15,
    format: pin.format,
    bytes,
    byteLength: bytes.byteLength,
    cards,
    provenance,
    integrity: {
      algorithm: 'sha256',
      expectedHash: provenance.sourceContentHash,
      actualHash,
      exactHashMatch: true,
    },
  };
}

export async function captureCurrentCardDataV15(
  source: CurrentCardDataCaptureSourceV15,
  options: HistoricalCardDataAcquisitionOptionsV15 = {},
): Promise<AcquiredHistoricalCardDataV15<ContemporaneousProvenanceV15>> {
  if (source.format !== SCRYFALL_CARD_ARRAY_FORMAT_V15) throw new Error(`Unsupported current card-data format: ${String(source.format)}.`);
  const observedAt = acquisitionTime(options.now);
  const sourceUri = absoluteHttpUrl('sourceUri', source.sourceUri);
  const bytes = await downloadBytes(sourceUri, options, null);
  const actualHash = contentHash(bytes);
  const cards = parseScryfallCardArray(bytes);
  const provenance: ContemporaneousProvenanceV15 = {
    method: 'contemporaneous-capture',
    sourceId: required('sourceId', source.sourceId),
    sourceUri,
    sourceContentHash: actualHash,
    observedAt,
    retrievedAt: observedAt,
  };
  return {
    schemaVersion: HISTORICAL_CARD_DATA_ACQUISITION_SCHEMA_V15,
    format: source.format,
    bytes,
    byteLength: bytes.byteLength,
    cards,
    provenance,
    integrity: {
      algorithm: 'sha256',
      expectedHash: null,
      actualHash,
      exactHashMatch: true,
    },
  };
}

export async function extractDeckFeatureSnapshotFromHistoricalCardDataV15(
  decklist: string,
  pin: HistoricalCardDataArchivePinV15,
  availableAt: string,
  options: HistoricalCardDataAcquisitionOptionsV15 = {},
): Promise<ProvenancedDeckFeatureSnapshotV15> {
  const acquired = await acquirePinnedHistoricalCardDataV15(pin, availableAt, options);
  return extractProvenancedDeckFeatureSnapshotV15(decklist, acquired.cards, {
    availableAt,
    provenance: acquired.provenance,
  });
}

export function extractDeckFeatureSnapshotFromCapturedCardDataV15(
  decklist: string,
  acquired: AcquiredHistoricalCardDataV15<ContemporaneousProvenanceV15>,
  availableAt: string,
): ProvenancedDeckFeatureSnapshotV15 {
  if (acquired.provenance.method !== 'contemporaneous-capture') {
    throw new Error('A contemporaneously captured card-data acquisition is required.');
  }
  return extractProvenancedDeckFeatureSnapshotV15(decklist, acquired.cards, {
    availableAt,
    provenance: acquired.provenance,
  });
}
