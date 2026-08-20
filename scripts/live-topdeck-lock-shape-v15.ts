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
  'deckdeadline',
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
  'eventdata',
  'metadata',
]);

type BulkContext = 'tournament' | 'tournament-nested' | 'standing' | 'standing-nested' | 'team-player';

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

function foundFields(...countSets: Array<Record<string, number>>): string[] {
  return [...new Set(countSets.flatMap((counts) => Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([field]) => field)))].sort();
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    Accept: 'application/json',
    Authorization: apiKey,
    'Content-Type': 'application/json',
    'User-Agent': config.userAgent,
  };
}

async function boundedArrayResponse(
  response: Response,
  context: string,
  maximumItems: number,
): Promise<unknown[]> {
  if (response.status === 429) {
    const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`${context} was rate limited${retryAfterMs === null ? '' : `; retry after ${retryAfterMs} ms`}.`);
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`${context} failed with HTTP ${response.status}.`);
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error(`${context} response must be an array.`);
  if (payload.length > maximumItems) throw new Error(`${context} exceeded the bounded ${maximumItems}-item limit.`);
  return payload;
}

async function main(): Promise<void> {
  const apiKey = config.topDeckApiKey.trim();
  if (!apiKey) throw new Error('TOPDECK_API_KEY is not configured.');
  const apiBase = config.topDeckApiBase.trim().replace(/\/$/, '');

  const bulkResponse = await fetch(`${apiBase}/v2/tournaments`, {
    method: 'POST',
    headers: authHeaders(apiKey),
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
  const bulkPayload = await boundedArrayResponse(bulkResponse, 'TopDeck bulk lock-shape probe', 1_000);

  const bulkCounts: Record<BulkContext, Record<string, number>> = {
    tournament: emptyCounts(),
    'tournament-nested': emptyCounts(),
    standing: emptyCounts(),
    'standing-nested': emptyCounts(),
    'team-player': emptyCounts(),
  };
  let standingsRows = 0;
  let teamPlayerRows = 0;

  for (const rawTournament of bulkPayload) {
    inspectKeys(rawTournament, bulkCounts.tournament);
    inspectKnownNestedContainers(rawTournament, bulkCounts['tournament-nested']);
    if (!rawTournament || typeof rawTournament !== 'object' || Array.isArray(rawTournament)) continue;
    const standings = (rawTournament as Record<string, unknown>).standings;
    if (!Array.isArray(standings)) continue;
    for (const rawStanding of standings) {
      standingsRows += 1;
      inspectKeys(rawStanding, bulkCounts.standing);
      inspectKnownNestedContainers(rawStanding, bulkCounts['standing-nested']);
      if (!rawStanding || typeof rawStanding !== 'object' || Array.isArray(rawStanding)) continue;
      const players = (rawStanding as Record<string, unknown>).players;
      if (!Array.isArray(players)) continue;
      for (const player of players) {
        teamPlayerRows += 1;
        inspectKeys(player, bulkCounts['team-player']);
      }
    }
  }

  const bulkDetected = Object.fromEntries(
    (Object.entries(bulkCounts) as Array<[BulkContext, Record<string, number>]>).map(([context, values]) => [context, nonZero(values)]),
  );
  const bulkFound = foundFields(...Object.values(bulkCounts));

  const accountRootCounts = emptyCounts();
  const accountNestedCounts = emptyCounts();
  let ownedTournamentsReturned: number | null = null;
  let accountEndpointStatus: number;
  const accountResponse = await fetch(`${apiBase}/v2/me/tournaments?filter=all`, {
    method: 'GET',
    headers: authHeaders(apiKey),
    signal: AbortSignal.timeout(20_000),
  });
  accountEndpointStatus = accountResponse.status;
  if (accountResponse.ok) {
    const accountPayload: unknown = await accountResponse.json();
    if (!Array.isArray(accountPayload)) throw new Error('TopDeck account tournament response must be an array.');
    if (accountPayload.length > 1_000) throw new Error('TopDeck account tournament response exceeded the bounded 1,000-item limit.');
    ownedTournamentsReturned = accountPayload.length;
    for (const tournament of accountPayload) {
      inspectKeys(tournament, accountRootCounts);
      inspectKnownNestedContainers(tournament, accountNestedCounts);
    }
  } else {
    await accountResponse.body?.cancel().catch(() => undefined);
  }
  const accountDetected = {
    tournament: nonZero(accountRootCounts),
    'tournament-nested': nonZero(accountNestedCounts),
  };
  const accountFound = foundFields(accountRootCounts, accountNestedCounts);

  const audit = {
    schemaVersion: 'topdeck-lock-shape-live-v15.2',
    checkedAt: new Date().toISOString(),
    requests: {
      documentedCompletedBulk: {
        endpoint: '/v2/tournaments',
        game: 'Magic: The Gathering',
        format: 'EDH',
        lastDays: 30,
        participantMin: 16,
        requestCount: 1,
        automaticRetries: 0,
      },
      accountOwnedTournaments: {
        endpoint: '/v2/me/tournaments?filter=all',
        requestCount: 1,
        automaticRetries: 0,
        httpStatus: accountEndpointStatus,
      },
      totalRequestCount: 2,
    },
    completedBulk: {
      tournamentsReturned: bulkPayload.length,
      standingsRows,
      teamPlayerRows,
      candidateFieldCounts: bulkDetected,
      foundCandidateFields: bulkFound,
    },
    accountOwned: {
      tournamentsReturned: ownedTournamentsReturned,
      candidateFieldCounts: accountDetected,
      foundCandidateFields: accountFound,
    },
    interpretation: {
      completedBulk: bulkFound.length > 0
        ? 'Candidate historical deck-lock/deadline/history field names were present in the documented completed-tournament response; values were not persisted.'
        : 'No candidate deck-lock/deadline/history field names were present in the documented completed-tournament response.',
      accountOwned: accountEndpointStatus !== 200
        ? `Account-scoped tournament metadata was not readable by this API key (HTTP ${accountEndpointStatus}); no response values were retained.`
        : accountFound.length > 0
          ? 'Candidate deck-lock/deadline/history field names were present in account-owned tournament metadata; values were not persisted.'
          : 'No candidate deck-lock/deadline/history field names were present in account-owned tournament metadata.',
    },
    privacy: {
      apiKeyPersisted: false,
      rawResponsesPersisted: false,
      tournamentIdentifiersPersisted: false,
      tournamentNamesPersisted: false,
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
