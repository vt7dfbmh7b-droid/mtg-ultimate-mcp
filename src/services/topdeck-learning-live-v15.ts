import { config } from '../config.js';
import { HttpError, parseRetryAfterMs } from '../lib/http.js';
import {
  adaptTopDeckV2TournamentForLearningV15,
  TOPDECK_V2_ATTRIBUTION_V15,
  type TopDeckLearningAdapterRejectionV15,
  type TopDeckLearningCandidateV15,
  type TopDeckV2BulkTournamentV15,
} from './topdeck-learning-adapter-v15.js';

export const MAX_TOPDECK_LEARNING_LAST_DAYS_V15 = 365;
export const MAX_TOPDECK_LEARNING_PARTICIPANTS_V15 = 5_000;
export const MAX_TOPDECK_LEARNING_BULK_TOURNAMENTS_V15 = 1_000;

export interface TopDeckLearningFetchQueryV15 {
  lastDays: number;
  participantMin: number;
}

export type TopDeckStructuredValueShapeV15 =
  | 'number'
  | 'object-with-quantity'
  | 'object-without-quantity'
  | 'string'
  | 'other';

export interface TopDeckProviderShapeAuditV15 {
  tournaments: number;
  standingsRows: number;
  decklistStringRows: number;
  multilineDecklistRows: number;
  singleLineDecklistRows: number;
  urlLikeDecklistRows: number;
  deckObjRows: number;
  deckObjWithCommandersSection: number;
  deckObjWithMainboardSection: number;
  commanderSectionEntryCountDistribution: Record<string, number>;
  commanderSectionValueShapes: Record<TopDeckStructuredValueShapeV15, number>;
  mainboardSectionValueShapes: Record<TopDeckStructuredValueShapeV15, number>;
}

export interface TopDeckLearningFetchResultV15 {
  source: 'topdeck-v2';
  fetchedAt: string;
  requestUrl: string;
  query: TopDeckLearningFetchQueryV15;
  tournamentsReturned: number;
  providerShapeAudit: TopDeckProviderShapeAuditV15;
  candidates: TopDeckLearningCandidateV15[];
  rejected: TopDeckLearningAdapterRejectionV15[];
  attribution: typeof TOPDECK_V2_ATTRIBUTION_V15;
  rateLimitPolicy: 'single-request-no-automatic-retry';
}

export class TopDeckRateLimitErrorV15 extends Error {
  readonly retryAfterMs: number | null;
  readonly status = 429;

  constructor(retryAfterMs: number | null) {
    super(
      retryAfterMs === null
        ? 'TopDeck.gg rate limit exceeded. No automatic retry was attempted.'
        : `TopDeck.gg rate limit exceeded. Retry after at least ${retryAfterMs} ms; no automatic retry was attempted.`,
    );
    this.name = 'TopDeckRateLimitErrorV15';
    this.retryAfterMs = retryAfterMs;
  }
}

function requireInteger(name: string, value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(value)) throw new Error(`${name} must be a finite integer.`);
  if (value < minimum) throw new Error(`${name} must be at least ${minimum}.`);
  if (value > maximum) throw new Error(`${name} must be at most ${maximum}.`);
  return value;
}

function normalizeApiBase(value: string): string {
  const trimmed = value.trim().replace(/\/$/, '');
  if (!trimmed) throw new Error('TopDeck API base must be non-empty.');
  const parsed = new URL(trimmed);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('TopDeck API base must use http or https.');
  }
  return trimmed;
}

function normalizeApiKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('TOPDECK_API_KEY is not configured. A TopDeck.gg API key is required for live learning refreshes.');
  }
  if (trimmed.length > 2_000) throw new Error('TOPDECK_API_KEY exceeds the supported length.');
  return trimmed;
}

function parsePayload(value: unknown): TopDeckV2BulkTournamentV15[] {
  if (!Array.isArray(value)) throw new Error('TopDeck V2 tournament search response must be an array.');
  if (value.length > MAX_TOPDECK_LEARNING_BULK_TOURNAMENTS_V15) {
    throw new Error(
      `TopDeck V2 tournament search returned ${value.length} tournaments, exceeding the ${MAX_TOPDECK_LEARNING_BULK_TOURNAMENTS_V15} bounded refresh limit. Narrow the date or participant filters.`,
    );
  }
  return value as TopDeckV2BulkTournamentV15[];
}

function emptyShapeCounts(): Record<TopDeckStructuredValueShapeV15, number> {
  return {
    number: 0,
    'object-with-quantity': 0,
    'object-without-quantity': 0,
    string: 0,
    other: 0,
  };
}

function structuredValueShape(value: unknown): TopDeckStructuredValueShapeV15 {
  if (typeof value === 'number' && Number.isFinite(value)) return 'number';
  if (typeof value === 'string') return 'string';
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const quantity = (value as Record<string, unknown>).quantity;
    return typeof quantity === 'number' && Number.isFinite(quantity)
      ? 'object-with-quantity'
      : 'object-without-quantity';
  }
  return 'other';
}

function sectionObject(deckObj: Record<string, unknown>, wanted: 'commanders' | 'mainboard'): Record<string, unknown> | null {
  const match = Object.entries(deckObj).find(([key]) => key.trim().toLocaleLowerCase() === wanted);
  const value = match?.[1];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function increment(target: Record<string, number>, key: string): void {
  target[key] = (target[key] ?? 0) + 1;
}

function looksUrlLikeDecklist(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || /\r|\n/.test(trimmed)) return false;
  return /^(?:https?:\/\/|www\.)/i.test(trimmed)
    || /^[a-z0-9.-]+\.[a-z]{2,}(?:\/|$)/i.test(trimmed);
}

function auditProviderShape(payload: TopDeckV2BulkTournamentV15[]): TopDeckProviderShapeAuditV15 {
  const commanderSectionValueShapes = emptyShapeCounts();
  const mainboardSectionValueShapes = emptyShapeCounts();
  const commanderSectionEntryCountDistribution: Record<string, number> = {};
  const audit: TopDeckProviderShapeAuditV15 = {
    tournaments: payload.length,
    standingsRows: 0,
    decklistStringRows: 0,
    multilineDecklistRows: 0,
    singleLineDecklistRows: 0,
    urlLikeDecklistRows: 0,
    deckObjRows: 0,
    deckObjWithCommandersSection: 0,
    deckObjWithMainboardSection: 0,
    commanderSectionEntryCountDistribution,
    commanderSectionValueShapes,
    mainboardSectionValueShapes,
  };

  for (const tournament of payload) {
    if (!Array.isArray(tournament.standings)) continue;
    for (const raw of tournament.standings) {
      audit.standingsRows += 1;
      if (!raw || typeof raw !== 'object') continue;
      const standing = raw as Record<string, unknown>;
      const decklist = standing.decklist;
      if (typeof decklist === 'string' && decklist.trim()) {
        audit.decklistStringRows += 1;
        if (/\r|\n/.test(decklist)) audit.multilineDecklistRows += 1;
        else audit.singleLineDecklistRows += 1;
        if (looksUrlLikeDecklist(decklist)) audit.urlLikeDecklistRows += 1;
      }

      const deckObjValue = standing.deckObj;
      if (!deckObjValue || typeof deckObjValue !== 'object' || Array.isArray(deckObjValue)) continue;
      audit.deckObjRows += 1;
      const deckObj = deckObjValue as Record<string, unknown>;
      const commanders = sectionObject(deckObj, 'commanders');
      const mainboard = sectionObject(deckObj, 'mainboard');
      if (commanders) {
        audit.deckObjWithCommandersSection += 1;
        increment(commanderSectionEntryCountDistribution, String(Object.keys(commanders).length));
        for (const value of Object.values(commanders)) {
          const shape = structuredValueShape(value);
          commanderSectionValueShapes[shape] += 1;
        }
      }
      if (mainboard) {
        audit.deckObjWithMainboardSection += 1;
        for (const value of Object.values(mainboard)) {
          const shape = structuredValueShape(value);
          mainboardSectionValueShapes[shape] += 1;
        }
      }
    }
  }

  return audit;
}

/**
 * Fetch a bounded batch of completed EDH tournament data for later learning
 * ingestion. This performs exactly one TopDeck bulk-search request per call.
 *
 * TopDeck documents its bulk tournament query as POST and returns HTTP 429 when
 * the source rate limit is exceeded. To avoid accidentally amplifying a heavy
 * request, this function does not automatically retry POSTs. A 429 becomes a
 * typed error exposing the server's Retry-After delay when present.
 *
 * This network layer only produces deterministic source candidates plus a
 * content-free aggregate shape audit. It does not assign cross-source
 * independence/leakage keys, extract learning features, create training labels,
 * or persist provider deck/player content.
 */
export async function fetchTopDeckLearningCandidatesV15(options: {
  lastDays?: number;
  participantMin?: number;
  apiKey?: string;
  apiBase?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  now?: () => Date;
} = {}): Promise<TopDeckLearningFetchResultV15> {
  const lastDays = requireInteger('lastDays', options.lastDays ?? 30, 1, MAX_TOPDECK_LEARNING_LAST_DAYS_V15);
  const participantMin = requireInteger(
    'participantMin',
    options.participantMin ?? 16,
    1,
    MAX_TOPDECK_LEARNING_PARTICIPANTS_V15,
  );
  const apiKey = normalizeApiKey(options.apiKey ?? config.topDeckApiKey);
  const apiBase = normalizeApiBase(options.apiBase ?? config.topDeckApiBase);
  const timeoutMs = requireInteger('timeoutMs', options.timeoutMs ?? config.httpTimeoutMs, 100, 120_000);
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? (() => new Date());
  const requestUrl = `${apiBase}/v2/tournaments`;
  const query = { lastDays, participantMin };
  const body = {
    game: 'Magic: The Gathering',
    format: 'EDH',
    last: lastDays,
    participantMin,
    columns: ['name', 'id', 'decklist', 'wins', 'draws', 'losses'],
    rounds: false,
  };

  const response = await fetchFn(requestUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: apiKey,
      'Content-Type': 'application/json',
      'User-Agent': config.userAgent,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (response.status === 429) {
    const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
    await response.body?.cancel().catch(() => undefined);
    throw new TopDeckRateLimitErrorV15(retryAfterMs);
  }
  if (!response.ok) {
    const errorBody = (await response.text()).slice(0, 4_000);
    throw new HttpError(
      `HTTP ${response.status} ${response.statusText} from ${requestUrl}`,
      response.status,
      requestUrl,
      errorBody,
    );
  }

  const payload = parsePayload(await response.json());
  const providerShapeAudit = auditProviderShape(payload);
  const candidates: TopDeckLearningCandidateV15[] = [];
  const rejected: TopDeckLearningAdapterRejectionV15[] = [];
  for (const tournament of payload) {
    const adapted = adaptTopDeckV2TournamentForLearningV15(tournament);
    candidates.push(...adapted.candidates);
    rejected.push(...adapted.rejected);
  }

  const fetchedAt = now();
  if (!(fetchedAt instanceof Date) || !Number.isFinite(fetchedAt.getTime())) {
    throw new Error('now() must return a valid Date.');
  }

  return {
    source: 'topdeck-v2',
    fetchedAt: fetchedAt.toISOString(),
    requestUrl,
    query,
    tournamentsReturned: payload.length,
    providerShapeAudit,
    candidates,
    rejected,
    attribution: TOPDECK_V2_ATTRIBUTION_V15,
    rateLimitPolicy: 'single-request-no-automatic-retry',
  };
}
