import assert from 'node:assert/strict';
import test from 'node:test';
import {
  captureTopDeckCompletedTournamentByIdV15,
} from './topdeck-prospective-completed-capture-v15.js';
import { TopDeckProspectiveRateLimitErrorV15 } from './topdeck-prospective-capture-v15.js';

const apiBase = 'https://topdeck.gg/api';
const tournamentId = 'future-edh-1';

function jsonResponse(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function strictDeckObj(): Record<string, unknown> {
  return {
    Commanders: {
      'Test Commander': { id: 'commander-id', count: 1 },
    },
    Mainboard: {
      Wastes: { id: 'wastes-id', count: 99 },
    },
  };
}

function completedTournament(): Record<string, unknown> {
  return {
    TID: tournamentId,
    tournamentName: 'Future EDH',
    startDate: 1787220000,
    game: 'Magic: The Gathering',
    format: 'EDH',
    topCut: 1,
    standings: [
      {
        standing: 1,
        id: 'player-1',
        name: 'Player One',
        deckObj: strictDeckObj(),
        wins: 4,
        draws: 0,
        losses: 1,
      },
    ],
  };
}

function fetchSequence(responses: Response[], calls: Array<{ url: string; method: string; body: string | null }> = []): typeof fetch {
  let index = 0;
  return (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? init.body : null,
    });
    const response = responses[index];
    index += 1;
    if (!response) throw new Error('Unexpected extra fetch.');
    return response;
  }) as typeof fetch;
}

test('completed prospective capture binds exact TID response to provider event end', async () => {
  const calls: Array<{ url: string; method: string; body: string | null }> = [];
  const result = await captureTopDeckCompletedTournamentByIdV15({
    tournamentId,
    apiKey: 'test-key',
    apiBase,
    fetchFn: fetchSequence([
      jsonResponse({
        tid: tournamentId,
        game: 'Magic: The Gathering',
        format: 'EDH',
        startDate: 1787220000,
        endDate: 1787248800,
        status: 'Complete',
      }),
      jsonResponse([completedTournament()]),
    ], calls),
    now: () => new Date('2026-08-20T19:00:00.000Z'),
  });

  assert.equal(result.providerEventId, tournamentId);
  assert.equal(result.eventEndEvidence.eventStartedAt, '2026-08-20T10:00:00.000Z');
  assert.equal(result.eventEndEvidence.eventEndedAt, '2026-08-20T18:00:00.000Z');
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0]?.providerPlayerId, 'player-1');
  assert.equal(result.candidates[0]?.outcomeOccurredAt, '2026-08-20T10:00:00.000Z');
  assert.match(result.sourceContentHash, /^[a-f0-9]{64}$/);
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.url, `${apiBase}/v2/tournaments/${tournamentId}/info`);
  assert.equal(calls[0]?.method, 'GET');
  assert.equal(calls[1]?.url, `${apiBase}/v2/tournaments`);
  assert.equal(calls[1]?.method, 'POST');
  assert.match(calls[1]?.body ?? '', /"TID":"future-edh-1"/);
});

test('completed capture rejects a provider startDate that disagrees with event-end evidence', async () => {
  const mismatch = completedTournament();
  mismatch.startDate = 1787220001;
  await assert.rejects(
    captureTopDeckCompletedTournamentByIdV15({
      tournamentId,
      apiKey: 'test-key',
      apiBase,
      fetchFn: fetchSequence([
        jsonResponse({
          tid: tournamentId,
          game: 'Magic: The Gathering',
          format: 'EDH',
          startDate: 1787220000,
          endDate: 1787248800,
          status: 'Complete',
        }),
        jsonResponse([mismatch]),
      ]),
      now: () => new Date('2026-08-20T19:00:00.000Z'),
    }),
    /startDate disagrees/i,
  );
});

test('completed capture performs no automatic retry when the final TID POST is rate limited', async () => {
  let calls = 0;
  const fetchFn = (async (input: string | URL | Request) => {
    calls += 1;
    if (String(input).endsWith('/info')) {
      return jsonResponse({
        tid: tournamentId,
        game: 'Magic: The Gathering',
        format: 'EDH',
        startDate: 1787220000,
        endDate: 1787248800,
        status: 'Complete',
      });
    }
    return jsonResponse({ error: 'rate limited' }, 429, { 'retry-after': '30' });
  }) as typeof fetch;

  await assert.rejects(
    captureTopDeckCompletedTournamentByIdV15({
      tournamentId,
      apiKey: 'test-key',
      apiBase,
      fetchFn,
      now: () => new Date('2026-08-20T19:00:00.000Z'),
    }),
    (error: unknown) => error instanceof TopDeckProspectiveRateLimitErrorV15 && error.retryAfterMs === 30_000,
  );
  assert.equal(calls, 2);
});
