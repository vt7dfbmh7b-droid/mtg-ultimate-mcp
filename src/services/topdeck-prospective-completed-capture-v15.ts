import { createHash } from 'node:crypto';
import { config } from '../config.js';
import { HttpError, parseRetryAfterMs } from '../lib/http.js';
import {
  adaptTopDeckV2TournamentForLearningV15,
  TOPDECK_V2_ATTRIBUTION_V15,
  type TopDeckLearningAdapterRejectionV15,
  type TopDeckLearningCandidateV15,
  type TopDeckV2BulkTournamentV15,
} from './topdeck-learning-adapter-v15.js';
import {
  captureTopDeckEventEndEvidenceV15,
  TopDeckProspectiveRateLimitErrorV15,
} from './topdeck-prospective-capture-v15.js';
import type { TopDeckEventEndEvidenceV15 } from './topdeck-promotion-grade-evidence-v15.js';

export const TOPDECK_PROSPECTIVE_COMPLETED_CAPTURE_SCHEMA_V15 = 'topdeck-prospective-completed-capture-v15.1' as const;

export interface TopDeckProspectiveCompletedCaptureV15 {
  schemaVersion: typeof TOPDECK_PROSPECTIVE_COMPLETED_CAPTURE_SCHEMA_V15;
  source: 'topdeck-v2';
  attribution: typeof TOPDECK_V2_ATTRIBUTION_V15;
  providerEventId: string;
  capturedAt: string;
  sourceUri: string;
  sourceContentHash: string;
  eventEndEvidence: TopDeckEventEndEvidenceV15;
  candidates: TopDeckLearningCandidateV15[];
  rejected: TopDeckLearningAdapterRejectionV15[];
  safeguards: readonly [
    'Provider status must be Complete and endDate must be independently captured before final standings are admitted.',
    'The completed tournament response is fetched by exact TID and hashed over the exact response bytes.',
    'Every adapted candidate must bind the requested event identity and the provider startDate captured by event-end evidence.',
    'No automatic HTTP retries are performed.'
  ];
}

function required(name: string, value: unknown, maximum = 500): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  const text = value.trim();
  if (text.length > maximum) throw new Error(`${name} exceeds ${maximum} characters.`);
  return text;
}

function normalizeApiBase(value: string): string {
  const text = required('TopDeck API base', value, 2_000).replace(/\/$/, '');
  const parsed = new URL(text);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('TopDeck API base must use http or https.');
  return text;
}

function normalizeApiKey(value: string): string {
  return required('TOPDECK_API_KEY', value, 2_000);
}

function observedNow(now: () => Date): string {
  const value = now();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new Error('now() must return a valid Date.');
  return value.toISOString();
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

function eventIdentity(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function unixSecondsIso(name: string, value: unknown): string {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative unix-seconds integer.`);
  const date = new Date(value * 1_000);
  if (!Number.isFinite(date.getTime())) throw new Error(`${name} is outside the supported date range.`);
  return date.toISOString();
}

async function fetchCompletedTournamentBytesOnce(options: {
  sourceUri: string;
  apiKey: string;
  tournamentId: string;
  timeoutMs: number;
  fetchFn: typeof fetch;
}): Promise<{ bytes: Uint8Array; json: unknown; contentHash: string }> {
  const body = {
    TID: options.tournamentId,
    columns: ['name', 'id', 'decklist', 'wins', 'draws', 'losses'],
    rounds: false,
  };
  const response = await options.fetchFn(options.sourceUri, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: options.apiKey,
      'Content-Type': 'application/json',
      'User-Agent': config.userAgent,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeoutMs),
  });
  if (response.status === 429) {
    const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
    await response.body?.cancel().catch(() => undefined);
    throw new TopDeckProspectiveRateLimitErrorV15(retryAfterMs);
  }
  if (!response.ok) {
    const errorBody = (await response.text()).slice(0, 4_000);
    throw new HttpError(
      `HTTP ${response.status} ${response.statusText} from ${options.sourceUri}`,
      response.status,
      options.sourceUri,
      errorBody,
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    bytes,
    json: parseJsonBytes(options.sourceUri, bytes),
    contentHash: sha256(bytes),
  };
}

function exactlyOneTournament(value: unknown): TopDeckV2BulkTournamentV15 {
  if (!Array.isArray(value)) throw new Error('TopDeck completed TID response must be an array.');
  if (value.length !== 1) throw new Error(`TopDeck completed TID response must contain exactly one tournament; received ${value.length}.`);
  const tournament = value[0];
  if (!tournament || typeof tournament !== 'object' || Array.isArray(tournament)) {
    throw new Error('TopDeck completed TID response did not contain a tournament object.');
  }
  return tournament as TopDeckV2BulkTournamentV15;
}

/**
 * Captures one completed TopDeck tournament by exact TID after provider endDate
 * has been independently observed. This creates replayable final-response evidence
 * without reusing the completed-bulk adapter's legacy startDate as target timing.
 */
export async function captureTopDeckCompletedTournamentByIdV15(options: {
  tournamentId: string;
  apiKey?: string;
  apiBase?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  now?: () => Date;
}): Promise<TopDeckProspectiveCompletedCaptureV15> {
  const tournamentId = required('tournamentId', options.tournamentId, 300);
  const apiKey = normalizeApiKey(options.apiKey ?? config.topDeckApiKey);
  const apiBase = normalizeApiBase(options.apiBase ?? config.topDeckApiBase);
  const timeoutMs = Math.max(100, Math.min(120_000, Math.trunc(options.timeoutMs ?? config.httpTimeoutMs)));
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? (() => new Date());

  const endCapture = await captureTopDeckEventEndEvidenceV15({
    tournamentId,
    apiKey,
    apiBase,
    timeoutMs,
    fetchFn,
    now,
  });
  const sourceUri = `${apiBase}/v2/tournaments`;
  const response = await fetchCompletedTournamentBytesOnce({ sourceUri, apiKey, tournamentId, timeoutMs, fetchFn });
  const capturedAt = observedNow(now);
  if (Date.parse(capturedAt) < Date.parse(endCapture.evidence.eventEndedAt)) {
    throw new Error('Completed tournament response cannot be observed before provider event end.');
  }

  const tournament = exactlyOneTournament(response.json);
  const adapted = adaptTopDeckV2TournamentForLearningV15(tournament);
  const candidateEventIds = new Set(adapted.candidates.map((candidate) => eventIdentity(candidate.providerEventId)));
  if (candidateEventIds.size > 1 || (candidateEventIds.size === 1 && !candidateEventIds.has(eventIdentity(tournamentId)))) {
    throw new Error('Completed TopDeck candidates do not bind the requested tournament identity.');
  }
  const rawTid = typeof tournament.TID === 'string' ? tournament.TID.trim() : '';
  if (!rawTid || eventIdentity(rawTid) !== eventIdentity(tournamentId)) {
    throw new Error('Completed TopDeck response tournament identity does not match the requested TID.');
  }
  const startIso = unixSecondsIso('completed.startDate', tournament.startDate);
  if (startIso !== endCapture.evidence.eventStartedAt) {
    throw new Error('Completed TopDeck response startDate disagrees with provider event-end evidence.');
  }
  for (const candidate of adapted.candidates) {
    if (candidate.outcomeOccurredAt !== startIso) {
      throw new Error(`Completed TopDeck candidate ${candidate.providerRecordId} does not preserve provider startDate before promotion-grade retiming.`);
    }
  }

  return {
    schemaVersion: TOPDECK_PROSPECTIVE_COMPLETED_CAPTURE_SCHEMA_V15,
    source: 'topdeck-v2',
    attribution: TOPDECK_V2_ATTRIBUTION_V15,
    providerEventId: tournamentId,
    capturedAt,
    sourceUri,
    sourceContentHash: response.contentHash,
    eventEndEvidence: endCapture.evidence,
    candidates: adapted.candidates,
    rejected: adapted.rejected,
    safeguards: [
      'Provider status must be Complete and endDate must be independently captured before final standings are admitted.',
      'The completed tournament response is fetched by exact TID and hashed over the exact response bytes.',
      'Every adapted candidate must bind the requested event identity and the provider startDate captured by event-end evidence.',
      'No automatic HTTP retries are performed.',
    ],
  };
}
