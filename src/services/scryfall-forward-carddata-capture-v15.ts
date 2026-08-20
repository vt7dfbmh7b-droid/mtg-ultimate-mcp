import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import type { ScryfallCard, ScryfallLegalities } from '../types/scryfall.js';
import type { HistoricalCardDataAcquisitionOptionsV15 } from './historical-carddata-acquisition-v15.js';
import {
  historicalCardDataSourceByIdV15,
  sourceCanCaptureForwardRichFeaturesV15,
  type HistoricalCardDataSourceInventoryEntryV15,
} from './historical-carddata-source-inventory-v15.js';
import {
  extractProvenancedDeckFeatureSnapshotV15,
  type HistoricalCardDataProvenanceV15,
  type ProvenancedDeckFeatureSnapshotV15,
} from './historical-carddata-provenance-v15.js';

export const SCRYFALL_FORWARD_CARD_DATA_CAPTURE_SCHEMA_V15 = 'scryfall-forward-carddata-capture-v15.2' as const;
export const SCRYFALL_DEFAULT_CARDS_SOURCE_ID_V15 = 'scryfall-default-cards' as const;
export const SCRYFALL_JSONL_GZIP_FORMAT_V15 = 'scryfall-jsonl-gzip-v1' as const;
export const DEFAULT_SCRYFALL_COMPRESSED_MAX_BYTES_V15 = 768 * 1024 * 1024;
export const DEFAULT_SCRYFALL_DECODED_MAX_BYTES_V15 = 1024 * 1024 * 1024;
export const MAX_SCRYFALL_JSONL_LINE_BYTES_V15 = 4 * 1024 * 1024;

const LEGALITY_VALUES = new Set(['legal', 'not_legal', 'restricted', 'banned']);

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type ContemporaneousProvenanceV15 = Extract<HistoricalCardDataProvenanceV15, { method: 'contemporaneous-capture' }>;

export interface ScryfallForwardCardDataCaptureOptionsV15 extends HistoricalCardDataAcquisitionOptionsV15 {
  expectedCompressedBytes?: number;
  maxDecodedBytes?: number;
}

export interface ScryfallJsonlGzipAcquisitionV15 {
  format: typeof SCRYFALL_JSONL_GZIP_FORMAT_V15;
  bytes: Uint8Array;
  byteLength: number;
  decodedByteLength: number;
  cards: ScryfallCard[];
  provenance: ContemporaneousProvenanceV15;
  integrity: {
    algorithm: 'sha256';
    expectedHash: null;
    actualHash: string;
    exactHashMatch: true;
    expectedCompressedByteLength: number | null;
    exactCompressedByteLengthMatch: boolean;
    decodedContentHash: string;
  };
}

export interface ScryfallForwardCardDataCaptureV15 {
  schemaVersion: typeof SCRYFALL_FORWARD_CARD_DATA_CAPTURE_SCHEMA_V15;
  sourcePolicy: HistoricalCardDataSourceInventoryEntryV15;
  acquisition: ScryfallJsonlGzipAcquisitionV15;
  safeguards: readonly [
    'Only current Scryfall gzip JSON Lines bytes from an HTTPS *.scryfall.io static-file origin are accepted.',
    'The observation timestamp is assigned at capture time and cannot be supplied by the source descriptor.',
    'The SHA-256 provenance hash covers the exact compressed source bytes before decompression.',
    'Compressed and decoded byte limits are enforced before parsed cards can feed rich feature extraction.',
    'This forward capture does not make Scryfall a verified retrospective historical archive.'
  ];
}

export class ScryfallForwardCardDataCaptureErrorV15 extends Error {
  readonly code:
    | 'source-request-failed'
    | 'source-too-large'
    | 'source-byte-length-mismatch'
    | 'source-transport-encoding'
    | 'source-invalid-gzip'
    | 'source-invalid-utf8'
    | 'source-invalid-jsonl'
    | 'source-invalid-card-data';

  constructor(code: ScryfallForwardCardDataCaptureErrorV15['code'], message: string) {
    super(message);
    this.name = 'ScryfallForwardCardDataCaptureErrorV15';
    this.code = code;
  }
}

function positiveLimit(name: string, value: number | undefined, fallback: number): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved <= 0) throw new Error(`${name} must be a positive safe integer.`);
  return resolved;
}

function expectedCompressedBytes(value: number | undefined): number | null {
  if (value === undefined) return null;
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('expectedCompressedBytes must be a positive safe integer.');
  return value;
}

function observedAt(value: string | undefined): string {
  if (value === undefined) return new Date().toISOString();
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error('now must be a valid timestamp.');
  return new Date(milliseconds).toISOString();
}

function approvedScryfallStaticUri(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Scryfall forward capture requires an absolute HTTPS *.scryfall.io .jsonl.gz bulk download URI.');
  }
  const hostname = parsed.hostname.toLocaleLowerCase();
  if (
    parsed.protocol !== 'https:'
    || !hostname.endsWith('.scryfall.io')
    || !parsed.pathname.toLocaleLowerCase().endsWith('.jsonl.gz')
  ) {
    throw new Error('Scryfall forward capture requires an absolute HTTPS *.scryfall.io .jsonl.gz bulk download URI.');
  }
  return parsed.toString();
}

function sourceTooLarge(total: number, limit: number): ScryfallForwardCardDataCaptureErrorV15 {
  return new ScryfallForwardCardDataCaptureErrorV15(
    'source-too-large',
    `Scryfall compressed source exceeded the ${limit}-byte safety limit (at least ${total} bytes).`,
  );
}

function sourceLengthMismatch(total: number, expected: number): ScryfallForwardCardDataCaptureErrorV15 {
  return new ScryfallForwardCardDataCaptureErrorV15(
    'source-byte-length-mismatch',
    `Scryfall compressed source returned ${total} bytes but the manifest requires ${expected}.`,
  );
}

async function readCompressedBytes(
  response: Response,
  url: string,
  limit: number,
  expected: number | null,
): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > limit) throw sourceTooLarge(bytes.byteLength, limit);
    if (expected !== null && bytes.byteLength !== expected) throw sourceLengthMismatch(bytes.byteLength, expected);
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
      if (expected !== null && total > expected) {
        await reader.cancel().catch(() => undefined);
        throw sourceLengthMismatch(total, expected);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof ScryfallForwardCardDataCaptureErrorV15) throw error;
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    throw new ScryfallForwardCardDataCaptureErrorV15(
      'source-request-failed',
      `Scryfall compressed source stream failed for ${url}: ${detail}`,
    );
  }

  if (expected !== null && total !== expected) throw sourceLengthMismatch(total, expected);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function downloadCompressedBytes(
  url: string,
  options: ScryfallForwardCardDataCaptureOptionsV15,
): Promise<Uint8Array> {
  const fetchImpl: FetchLike = options.fetchImpl ?? fetch;
  const limit = positiveLimit('maxBytes', options.maxBytes, DEFAULT_SCRYFALL_COMPRESSED_MAX_BYTES_V15);
  const expected = expectedCompressedBytes(options.expectedCompressedBytes);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/gzip,application/octet-stream;q=0.9,*/*;q=0.8' },
    });
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    throw new ScryfallForwardCardDataCaptureErrorV15(
      'source-request-failed',
      `Scryfall compressed source request failed for ${url}: ${detail}`,
    );
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new ScryfallForwardCardDataCaptureErrorV15(
      'source-request-failed',
      `Scryfall compressed source returned HTTP ${response.status} ${response.statusText} for ${url}.`,
    );
  }

  const transportEncoding = response.headers.get('content-encoding')?.trim().toLocaleLowerCase();
  if (transportEncoding && transportEncoding !== 'identity') {
    await response.body?.cancel().catch(() => undefined);
    throw new ScryfallForwardCardDataCaptureErrorV15(
      'source-transport-encoding',
      `Scryfall compressed source used HTTP Content-Encoding ${transportEncoding}; exact provider file bytes cannot be proven through an auto-decoding fetch transport.`,
    );
  }

  const contentLengthText = response.headers.get('content-length');
  if (contentLengthText !== null) {
    const contentLength = Number(contentLengthText);
    if (Number.isFinite(contentLength) && contentLength > limit) {
      await response.body?.cancel().catch(() => undefined);
      throw sourceTooLarge(contentLength, limit);
    }
    if (expected !== null && Number.isFinite(contentLength) && contentLength !== expected) {
      await response.body?.cancel().catch(() => undefined);
      throw sourceLengthMismatch(contentLength, expected);
    }
  }

  return readCompressedBytes(response, url, limit, expected);
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

function decodeJsonlLine(bytes: Uint8Array, lineNumber: number): ScryfallCard | null {
  let lineBytes = bytes;
  if (lineBytes.byteLength > 0 && lineBytes[lineBytes.byteLength - 1] === 0x0d) {
    lineBytes = lineBytes.subarray(0, lineBytes.byteLength - 1);
  }
  if (lineBytes.byteLength === 0) return null;
  if (lineBytes.byteLength > MAX_SCRYFALL_JSONL_LINE_BYTES_V15) {
    throw new ScryfallForwardCardDataCaptureErrorV15(
      'source-invalid-jsonl',
      `Scryfall JSON Lines record ${lineNumber} exceeds the ${MAX_SCRYFALL_JSONL_LINE_BYTES_V15}-byte per-record safety limit.`,
    );
  }

  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(lineBytes);
  } catch {
    throw new ScryfallForwardCardDataCaptureErrorV15(
      'source-invalid-utf8',
      `Scryfall JSON Lines record ${lineNumber} is not valid UTF-8.`,
    );
  }
  if (!text.trim()) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new ScryfallForwardCardDataCaptureErrorV15(
      'source-invalid-jsonl',
      `Scryfall JSON Lines record ${lineNumber} is not valid JSON.`,
    );
  }
  if (!scryfallCard(parsed)) {
    throw new ScryfallForwardCardDataCaptureErrorV15(
      'source-invalid-card-data',
      `Scryfall JSON Lines record ${lineNumber} is not a valid Scryfall card object.`,
    );
  }
  return parsed;
}

function parseScryfallJsonl(decoded: Uint8Array): ScryfallCard[] {
  const cards: ScryfallCard[] = [];
  let lineStart = 0;
  let lineNumber = 0;
  for (let index = 0; index <= decoded.byteLength; index += 1) {
    const atEnd = index === decoded.byteLength;
    if (!atEnd && decoded[index] !== 0x0a) continue;
    lineNumber += 1;
    const card = decodeJsonlLine(decoded.subarray(lineStart, index), lineNumber);
    if (card) cards.push(card);
    lineStart = index + 1;
  }
  if (cards.length === 0) {
    throw new ScryfallForwardCardDataCaptureErrorV15(
      'source-invalid-card-data',
      'Scryfall JSON Lines source did not contain any valid card records.',
    );
  }
  return cards;
}

function decompressJsonl(
  compressedBytes: Uint8Array,
  maxDecodedBytes: number,
): Uint8Array {
  try {
    return gunzipSync(compressedBytes, { maxOutputLength: maxDecodedBytes });
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    throw new ScryfallForwardCardDataCaptureErrorV15(
      'source-invalid-gzip',
      `Scryfall gzip JSON Lines source could not be decoded within the ${maxDecodedBytes}-byte output safety limit: ${detail}`,
    );
  }
}

/**
 * Capture the current Scryfall default-card bulk file for future predictor use.
 * The provenance hash covers the exact compressed .jsonl.gz bytes received from
 * the static provider. Decompression is bounded separately and provider metadata
 * can never move the observation timestamp backwards.
 */
export async function captureScryfallDefaultCardsForwardV15(
  sourceUri: string,
  options: ScryfallForwardCardDataCaptureOptionsV15 = {},
): Promise<ScryfallForwardCardDataCaptureV15> {
  const sourcePolicy = historicalCardDataSourceByIdV15(SCRYFALL_DEFAULT_CARDS_SOURCE_ID_V15);
  if (!sourcePolicy) throw new Error('Missing Scryfall default-cards source policy.');
  if (!sourceCanCaptureForwardRichFeaturesV15(sourcePolicy.sourceId)) {
    throw new Error('Scryfall default-cards source policy does not permit forward contemporaneous capture.');
  }
  if (sourcePolicy.nativeFormat !== 'scryfall-jsonl-gzip') {
    throw new Error(`Scryfall default-cards source policy has unsupported native format ${sourcePolicy.nativeFormat}.`);
  }

  const sourceUriNormalized = approvedScryfallStaticUri(sourceUri);
  const captureTime = observedAt(options.now);
  const compressedBytes = await downloadCompressedBytes(sourceUriNormalized, options);
  const sourceContentHash = contentHash(compressedBytes);
  const decodedBytes = decompressJsonl(
    compressedBytes,
    positiveLimit('maxDecodedBytes', options.maxDecodedBytes, DEFAULT_SCRYFALL_DECODED_MAX_BYTES_V15),
  );
  const cards = parseScryfallJsonl(decodedBytes);
  const expectedLength = expectedCompressedBytes(options.expectedCompressedBytes);
  const provenance: ContemporaneousProvenanceV15 = {
    method: 'contemporaneous-capture',
    sourceId: sourcePolicy.sourceId,
    sourceUri: sourceUriNormalized,
    sourceContentHash,
    observedAt: captureTime,
    retrievedAt: captureTime,
  };

  return {
    schemaVersion: SCRYFALL_FORWARD_CARD_DATA_CAPTURE_SCHEMA_V15,
    sourcePolicy,
    acquisition: {
      format: SCRYFALL_JSONL_GZIP_FORMAT_V15,
      bytes: compressedBytes,
      byteLength: compressedBytes.byteLength,
      decodedByteLength: decodedBytes.byteLength,
      cards,
      provenance,
      integrity: {
        algorithm: 'sha256',
        expectedHash: null,
        actualHash: sourceContentHash,
        exactHashMatch: true,
        expectedCompressedByteLength: expectedLength,
        exactCompressedByteLengthMatch: expectedLength === null || expectedLength === compressedBytes.byteLength,
        decodedContentHash: contentHash(decodedBytes),
      },
    },
    safeguards: [
      'Only current Scryfall gzip JSON Lines bytes from an HTTPS *.scryfall.io static-file origin are accepted.',
      'The observation timestamp is assigned at capture time and cannot be supplied by the source descriptor.',
      'The SHA-256 provenance hash covers the exact compressed source bytes before decompression.',
      'Compressed and decoded byte limits are enforced before parsed cards can feed rich feature extraction.',
      'This forward capture does not make Scryfall a verified retrospective historical archive.',
    ],
  };
}

export function extractDeckFeatureSnapshotFromScryfallForwardCaptureV15(
  decklist: string,
  capture: ScryfallForwardCardDataCaptureV15,
  availableAt: string,
): ProvenancedDeckFeatureSnapshotV15 {
  return extractProvenancedDeckFeatureSnapshotV15(decklist, capture.acquisition.cards, {
    availableAt,
    provenance: capture.acquisition.provenance,
  });
}
