import { createHash } from 'node:crypto';
import { config } from '../config.js';
import { HttpError, parseRetryAfterMs } from '../lib/http.js';
import {
  materializeTopDeckDeckObjectV15,
  TOPDECK_V2_ATTRIBUTION_V15,
} from './topdeck-learning-adapter-v15.js';
import { fingerprintExactDeckV15 } from './learning-corpus-v15.js';
import {
  TOPDECK_PROMOTION_GRADE_DECKLIST_SCHEMA_V15,
  TOPDECK_PROMOTION_GRADE_OUTCOME_TIMING_SCHEMA_V15,
  type TopDeckEventEndEvidenceV15,
  type TopDeckPreEventDecklistEvidenceV15,
} from './topdeck-promotion-grade-evidence-v15.js';

export const TOPDECK_PROSPECTIVE_PRE_EVENT_CAPTURE_SCHEMA_V15 = 'topdeck-prospective-pre-event-capture-v15.1' as const;
export const TOPDECK_PROSPECTIVE_EVENT_END_CAPTURE_SCHEMA_V15 = 'topdeck-prospective-event-end-capture-v15.1' as const;
export const MAX_TOPDECK_PROSPECTIVE_STANDINGS_V15 = 5_000;

export interface TopDeckProspectiveCapturedDeckV15 {
  providerEventId: string;
  providerPlayerId: string;
  providerRecordId: string;
  decklist: string;
  commanderNames: string[];
  deckFingerprint: string;
  evidence: TopDeckPreEventDecklistEvidenceV15;
}

export type TopDeckProspectivePreEventCaptureResultV15 =
  | {
      schemaVersion: typeof TOPDECK_PROSPECTIVE_PRE_EVENT_CAPTURE_SCHEMA_V15;
      status: 'captured';
      source: 'topdeck-v2';
      attribution: typeof TOPDECK_V2_ATTRIBUTION_V15;
      providerEventId: string;
      eventStartAt: string;
      capturedAt: string;
      providerStatus: 'Not Started';
      infoSourceUri: string;
      infoSourceContentHash: string;
      standingsSourceUri: string;
      standingsSourceContentHash: string;
      decks: TopDeckProspectiveCapturedDeckV15[];
      rejectedStandingRows: number;
      safeguards: readonly [
        'Tournament status must still be Not Started when the capture is observed.',
        'Capture observation time must be no later than provider startDate.',
        'Only strict TopDeck deckObj Commander lists are retained; external deck URLs are never followed.',
        'Exact deck fingerprints and provider response hashes are preserved for replay/audit.',
        'No automatic HTTP retries are performed.'
      ];
    }
  | {
      schemaVersion: typeof TOPDECK_PROSPECTIVE_PRE_EVENT_CAPTURE_SCHEMA_V15;
      status: 'unavailable';
      source: 'topdeck-v2';
      attribution: typeof TOPDECK_V2_ATTRIBUTION_V15;
      providerEventId: string;
      eventStartAt: string;
      capturedAt: string;
      providerStatus: 'Not Started';
      reason: 'no-visible-strict-decklists-before-start';
      rejectedStandingRows: number;
    };

export interface TopDeckProspectiveEventEndCaptureResultV15 {
  schemaVersion: typeof TOPDECK_PROSPECTIVE_EVENT_END_CAPTURE_SCHEMA_V15;
  source: 'topdeck-v2';
  attribution: typeof TOPDECK_V2_ATTRIBUTION_V15;
  evidence: TopDeckEventEndEvidenceV15;
}

export class TopDeckProspectiveRateLimitErrorV15 extends Error {
  readonly retryAfterMs: number | null;
  readonly status = 429;

  constructor(retryAfterMs: number | null) {
    super(
      retryAfterMs === null
        ? 'TopDeck.gg rate limit exceeded during prospective capture. No automatic retry was attempted.'
        : `TopDeck.gg rate limit exceeded during prospective capture. Retry after at least ${retryAfterMs} ms; no automatic retry was attempted.`,
    );
    this.name = 'TopDeckProspectiveRateLimitErrorV15';
    this.retryAfterMs = retryAfterMs;
  }
}

interface CapturedJsonV15 {
  sourceUri: string;
  bytes: Uint8Array;
  contentHash: string;
  json: unknown;
}

function required(name: string, value: unknown, max = 500): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  const text = value.trim();
  if (text.length > max) throw new Error(`${name} exceeds ${max} characters.`);
  return text;
}

function normalizeApiBase(value: string): string {
  const text = required('TopDeck API base', value, 2_000).replace(/\/$/, '');
  const parsed = new URL(text);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('TopDeck API base must use http or https.');
  return text;
}

function normalizeApiKey(value: string): string {
  const text = required('TOPDECK_API_KEY', value, 2_000);
  return text;
}

function positiveInteger(name: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer.`);
  return value;
}

function unixSeconds(name: string, value: unknown): { iso: string; ms: number } {
  const seconds = positiveInteger(name, value);
  const ms = seconds * 1_000;
  const date = new Date(ms);
  if (!Number.isFinite(date.getTime())) throw new Error(`${name} is outside the supported date range.`);
  return { iso: date.toISOString(), ms };
}

function observedNow(now: () => Date): { iso: string; ms: number } {
  const value = now();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new Error('now() must return a valid Date.');
  return { iso: value.toISOString(), ms: value.getTime() };
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function parseJsonBytes(sourceUri: string, bytes: Uint8Array): unknown {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`TopDeck response from ${sourceUri} is not valid UTF-8.`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`TopDeck response from ${sourceUri} is not valid JSON.`);
  }
}

async function fetchJsonOnce(
  sourceUri: string,
  apiKey: string,
  fetchFn: typeof fetch,
  timeoutMs: number,
): Promise<CapturedJsonV15> {
  const response = await fetchFn(sourceUri, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: apiKey,
      'User-Agent': config.userAgent,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.status === 429) {
    const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
    await response.body?.cancel().catch(() => undefined);
    throw new TopDeckProspectiveRateLimitErrorV15(retryAfterMs);
  }
  if (!response.ok) {
    const errorBody = (await response.text()).slice(0, 4_000);
    throw new HttpError(`HTTP ${response.status} ${response.statusText} from ${sourceUri}`, response.status, sourceUri, errorBody);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    sourceUri,
    bytes,
    contentHash: sha256(bytes),
    json: parseJsonBytes(sourceUri, bytes),
  };
}

function topDeckInfo(value: unknown): {
  tid: string;
  game: string;
  format: string;
  startDate: number;
  endDate: number | null;
  status: 'Complete' | 'Ongoing' | 'Not Started';
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('TopDeck tournament info response must be an object.');
  const object = value as Record<string, unknown>;
  const status = object.status;
  if (status !== 'Complete' && status !== 'Ongoing' && status !== 'Not Started') throw new Error('TopDeck tournament info returned an unsupported status.');
  const endDate = object.endDate === null || object.endDate === undefined ? null : positiveInteger('info.endDate', object.endDate);
  return {
    tid: required('info.tid', object.tid),
    game: required('info.game', object.game),
    format: required('info.format', object.format),
    startDate: positiveInteger('info.startDate', object.startDate),
    endDate,
    status,
  };
}

function standingsArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('TopDeck standings response must be an array.');
  if (value.length > MAX_TOPDECK_PROSPECTIVE_STANDINGS_V15) {
    throw new Error(`TopDeck standings exceeds the ${MAX_TOPDECK_PROSPECTIVE_STANDINGS_V15}-row prospective capture limit.`);
  }
  return value;
}

function sameEvent(expected: string, actual: string): void {
  if (expected.trim().toLocaleLowerCase() !== actual.trim().toLocaleLowerCase()) {
    throw new Error(`TopDeck tournament info identity ${actual} does not match requested event ${expected}.`);
  }
}

/**
 * Captures exact Commander decklists for one known tournament before it starts.
 * A decklist appearing in the REST standings response before start is direct
 * evidence that the provider exposed that exact list by the capture time. This
 * function does not guess organizer visibility settings and never follows
 * third-party deck URLs.
 */
export async function captureTopDeckPreEventDecklistsV15(options: {
  tournamentId: string;
  apiKey?: string;
  apiBase?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  now?: () => Date;
}): Promise<TopDeckProspectivePreEventCaptureResultV15> {
  const tournamentId = required('tournamentId', options.tournamentId, 300);
  const apiKey = normalizeApiKey(options.apiKey ?? config.topDeckApiKey);
  const apiBase = normalizeApiBase(options.apiBase ?? config.topDeckApiBase);
  const timeoutMs = Math.max(100, Math.min(120_000, Math.trunc(options.timeoutMs ?? config.httpTimeoutMs)));
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? (() => new Date());
  const encodedTid = encodeURIComponent(tournamentId);
  const infoUri = `${apiBase}/v2/tournaments/${encodedTid}/info`;
  const standingsUri = `${apiBase}/v2/tournaments/${encodedTid}/standings`;

  const infoResponse = await fetchJsonOnce(infoUri, apiKey, fetchFn, timeoutMs);
  const info = topDeckInfo(infoResponse.json);
  sameEvent(tournamentId, info.tid);
  if (info.game !== 'Magic: The Gathering' || info.format !== 'EDH') throw new Error(`Expected Magic: The Gathering / EDH; received ${info.game} / ${info.format}.`);
  if (info.status !== 'Not Started') throw new Error(`Pre-event capture requires provider status Not Started; received ${info.status}.`);
  const eventStart = unixSeconds('info.startDate', info.startDate);

  const standingsResponse = await fetchJsonOnce(standingsUri, apiKey, fetchFn, timeoutMs);
  const capturedAt = observedNow(now);
  if (capturedAt.ms > eventStart.ms) {
    throw new Error('TopDeck pre-event capture completed after tournament start; captured decklists cannot be admitted as pre-event predictor evidence.');
  }

  const rows = standingsArray(standingsResponse.json);
  const decks: TopDeckProspectiveCapturedDeckV15[] = [];
  let rejectedStandingRows = 0;
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      rejectedStandingRows += 1;
      continue;
    }
    const standing = row as Record<string, unknown>;
    let playerId: string;
    try {
      playerId = required('standing.id', standing.id, 300);
    } catch {
      rejectedStandingRows += 1;
      continue;
    }
    if (!standing.deckObj || typeof standing.deckObj !== 'object' || Array.isArray(standing.deckObj)) {
      rejectedStandingRows += 1;
      continue;
    }
    try {
      const materialized = materializeTopDeckDeckObjectV15(standing.deckObj);
      const providerRecordId = `${tournamentId}:standing:${playerId}`;
      const deckFingerprint = fingerprintExactDeckV15(materialized.decklist);
      decks.push({
        providerEventId: tournamentId,
        providerPlayerId: playerId,
        providerRecordId,
        decklist: materialized.decklist,
        commanderNames: materialized.commanderNames,
        deckFingerprint,
        evidence: {
          schemaVersion: TOPDECK_PROMOTION_GRADE_DECKLIST_SCHEMA_V15,
          sourceId: 'topdeck',
          providerEventId: tournamentId,
          providerPlayerId: playerId,
          providerRecordId,
          sourceUri: standingsUri,
          sourceContentHash: standingsResponse.contentHash,
          deckFingerprint,
          observedAt: capturedAt.iso,
          retrievedAt: capturedAt.iso,
          method: 'contemporaneous-rest-decklist-capture',
        },
      });
    } catch {
      rejectedStandingRows += 1;
    }
  }

  if (decks.length === 0) {
    return {
      schemaVersion: TOPDECK_PROSPECTIVE_PRE_EVENT_CAPTURE_SCHEMA_V15,
      status: 'unavailable',
      source: 'topdeck-v2',
      attribution: TOPDECK_V2_ATTRIBUTION_V15,
      providerEventId: tournamentId,
      eventStartAt: eventStart.iso,
      capturedAt: capturedAt.iso,
      providerStatus: 'Not Started',
      reason: 'no-visible-strict-decklists-before-start',
      rejectedStandingRows,
    };
  }

  return {
    schemaVersion: TOPDECK_PROSPECTIVE_PRE_EVENT_CAPTURE_SCHEMA_V15,
    status: 'captured',
    source: 'topdeck-v2',
    attribution: TOPDECK_V2_ATTRIBUTION_V15,
    providerEventId: tournamentId,
    eventStartAt: eventStart.iso,
    capturedAt: capturedAt.iso,
    providerStatus: 'Not Started',
    infoSourceUri: infoUri,
    infoSourceContentHash: infoResponse.contentHash,
    standingsSourceUri: standingsUri,
    standingsSourceContentHash: standingsResponse.contentHash,
    decks,
    rejectedStandingRows,
    safeguards: [
      'Tournament status must still be Not Started when the capture is observed.',
      'Capture observation time must be no later than provider startDate.',
      'Only strict TopDeck deckObj Commander lists are retained; external deck URLs are never followed.',
      'Exact deck fingerprints and provider response hashes are preserved for replay/audit.',
      'No automatic HTTP retries are performed.',
    ],
  };
}

/** Captures provider-verified event end timing after the tournament is complete. */
export async function captureTopDeckEventEndEvidenceV15(options: {
  tournamentId: string;
  apiKey?: string;
  apiBase?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  now?: () => Date;
}): Promise<TopDeckProspectiveEventEndCaptureResultV15> {
  const tournamentId = required('tournamentId', options.tournamentId, 300);
  const apiKey = normalizeApiKey(options.apiKey ?? config.topDeckApiKey);
  const apiBase = normalizeApiBase(options.apiBase ?? config.topDeckApiBase);
  const timeoutMs = Math.max(100, Math.min(120_000, Math.trunc(options.timeoutMs ?? config.httpTimeoutMs)));
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? (() => new Date());
  const infoUri = `${apiBase}/v2/tournaments/${encodeURIComponent(tournamentId)}/info`;
  const response = await fetchJsonOnce(infoUri, apiKey, fetchFn, timeoutMs);
  const info = topDeckInfo(response.json);
  sameEvent(tournamentId, info.tid);
  if (info.game !== 'Magic: The Gathering' || info.format !== 'EDH') throw new Error(`Expected Magic: The Gathering / EDH; received ${info.game} / ${info.format}.`);
  if (info.status !== 'Complete' || info.endDate === null) throw new Error('Event-end capture requires provider status Complete and a non-null endDate.');
  const start = unixSeconds('info.startDate', info.startDate);
  const end = unixSeconds('info.endDate', info.endDate);
  if (end.ms < start.ms) throw new Error('TopDeck provider endDate cannot occur before startDate.');
  const observed = observedNow(now);
  if (observed.ms < end.ms) throw new Error('Event-end evidence cannot be observed before provider endDate.');

  return {
    schemaVersion: TOPDECK_PROSPECTIVE_EVENT_END_CAPTURE_SCHEMA_V15,
    source: 'topdeck-v2',
    attribution: TOPDECK_V2_ATTRIBUTION_V15,
    evidence: {
      schemaVersion: TOPDECK_PROMOTION_GRADE_OUTCOME_TIMING_SCHEMA_V15,
      sourceId: 'topdeck',
      providerEventId: tournamentId,
      sourceUri: infoUri,
      sourceContentHash: response.contentHash,
      eventStartedAt: start.iso,
      eventEndedAt: end.iso,
      observedAt: observed.iso,
      retrievedAt: observed.iso,
      providerStatus: 'Complete',
      method: 'provider-info-end-date-capture',
    },
  };
}
