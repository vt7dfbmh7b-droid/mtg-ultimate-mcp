import { writeFile } from 'node:fs/promises';
import { config } from '../src/config.js';
import { parseRetryAfterMs } from '../src/lib/http.js';

const RESULT_PATH = 'topdeck-lock-shape-live-result.json';
const FAILURE_PATH = 'topdeck-lock-shape-live-failure.txt';

const CANDIDATE_FIELDS = new Set([
  'decklock',
  'decklocked',
  'decklockedat',
  'decklockat',
  'decklistdeadline',
  'decksubmissiondeadline',
  'decksubmission',
  'decksubmittedat',
  'deckupdatedat',
  'deckversion',
  'deckhistory',
  'submissiondeadline',
  'submissionhistory',
  'validationhistory',
]);

const NESTED_CONTAINERS = new Set([
  'config',
  'configuration',
  'settings',
  'event',
  'metadata',
]);

type Context = 'tournament' | 'tournament-nested' | 'standing' | 'standing-nested' | 'team-player';

function normalizeField(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
}

function emptyCounts(): Record<string, number> {
  return Object.fromEntries([...CANDIDATE_FIELDS].sort().map((field) => [field, 0]));
}

function inspectKeys(value: unknown, counts: Record<string, number>): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  for (const rawKey of Object.keys(value as Record<string, unknown>)) {
    const key = normalizeField(rawKey);
    if (CANDIDATE_FIELDS.has(key)) counts[key] = (counts[key] ?? 0) + 1;
  }
}

function inspectKnownNestedContainers(value: unknown, counts: Record<string, number>): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  for (const [rawKey, nested] of Object.entries(value as Record<string, unknown>)) {
    if (!NESTED_CONTAINERS.has(normalizeField(rawKey))) continue;
    inspectKeys(nested, counts);
  }
}

function nonZero(counts: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(counts).filter(([, count]) => count > 0));
}

async function main(): Promise<void> {
  const apiKey = config.topDeckApiKey.trim();
  if (!apiKey) throw new Error('TOPDECK_API_KEY is not configured.');
  const apiBase = config.topDeckApiBase.trim().replace(/\/$/, '');
  const requestUrl = `${apiBase}/v2/tournaments`;
  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: apiKey,
      'Content-Type': 'application/json',
      'User-Agent': config.userAgent,
    },
    body: JSON.stringify({
      game: 'Magic: The Gathering',
      format: 'EDH',
      last: 30,
      participantMin: 16,
      columns: ['name', 'id', 'decklist', 'wins', 'draws', 'losses'],
      rounds: false,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (response.status === 429) {
    const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`TopDeck lock-shape probe was rate limited${retryAfterMs === null ? '' : `; retry after ${retryAfterMs} ms`}.`);
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`TopDeck lock-shape probe failed with HTTP ${response.status}.`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error('TopDeck lock-shape response must be an array.');
  if (payload.length > 1_000) throw new Error('TopDeck lock-shape response exceeded the bounded 1,000-tournament limit.');

  const counts: Record<Context, Record<string, number>> = {
    tournament: emptyCounts(),
    'tournament-nested': emptyCounts(),
    standing: emptyCounts(),
    'standing-nested': emptyCounts(),
    'team-player': emptyCounts(),
  };
  let standingsRows = 0;
  let teamPlayerRows = 0;

  for (const rawTournament of payload) {
    inspectKeys(rawTournament, counts.tournament);
    inspectKnownNestedContainers(rawTournament, counts['tournament-nested']);
    if (!rawTournament || typeof rawTournament !== 'object' || Array.isArray(rawTournament)) continue;
    const standings = (rawTournament as Record<string, unknown>).standings;
    if (!Array.isArray(standings)) continue;
    for (const rawStanding of standings) {
      standingsRows += 1;
      inspectKeys(rawStanding, counts.standing);
      inspectKnownNestedContainers(rawStanding, counts['standing-nested']);
      if (!rawStanding || typeof rawStanding !== 'object' || Array.isArray(rawStanding)) continue;
      const players = (rawStanding as Record<string, unknown>).players;
      if (!Array.isArray(players)) continue;
      for (const player of players) {
        teamPlayerRows += 1;
        inspectKeys(player, counts['team-player']);
      }
    }
  }

  const detected = Object.fromEntries(
    (Object.entries(counts) as Array<[Context, Record<string, number>]>).map(([context, values]) => [context, nonZero(values)]),
  );
  const foundCandidateFields = [...new Set(
    Object.values(detected).flatMap((values) => Object.keys(values as Record<string, number>)),
  )].sort();

  const audit = {
    schemaVersion: 'topdeck-lock-shape-live-v15.1',
    checkedAt: new Date().toISOString(),
    request: {
      endpoint: '/v2/tournaments',
      game: 'Magic: The Gathering',
      format: 'EDH',
      lastDays: 30,
      participantMin: 16,
      requestCount: 1,
      automaticRetries: 0,
    },
    tournamentsReturned: payload.length,
    standingsRows,
    teamPlayerRows,
    candidateFieldCounts: detected,
    foundCandidateFields,
    interpretation: foundCandidateFields.length > 0
      ? 'Candidate historical deck-lock/deadline/history field names were present in the documented bulk response shape; values were not persisted.'
      : 'No candidate deck-lock/deadline/history field names were present in the inspected documented bulk response shape.',
    privacy: {
      apiKeyPersisted: false,
      rawResponsePersisted: false,
      playerIdentifiersPersisted: false,
      decklistsPersisted: false,
      cardNamesPersisted: false,
      fieldValuesPersisted: false,
      hardcodedCandidateFieldNamesAndAggregateCountsOnly: true,
    },
  } as const;

  await writeFile(RESULT_PATH, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(audit, null, 2));
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  await writeFile(
    FAILURE_PATH,
    `${JSON.stringify({ schemaVersion: 'topdeck-lock-shape-live-failure-v15.1', message }, null, 2)}\n`,
    'utf8',
  ).catch(() => undefined);
  console.error(`[TopDeck lock shape live] ${message}`);
  process.exitCode = 1;
});
