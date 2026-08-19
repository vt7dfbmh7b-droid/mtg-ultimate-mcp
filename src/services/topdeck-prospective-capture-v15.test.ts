import assert from 'node:assert/strict';
import test from 'node:test';
import {
  captureTopDeckEventEndEvidenceV15,
  captureTopDeckPreEventDecklistsV15,
  TopDeckProspectiveRateLimitErrorV15,
} from './topdeck-prospective-capture-v15.js';

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

function fetchSequence(responses: Response[], requests: string[] = []): typeof fetch {
  let index = 0;
  return (async (input: string | URL | Request) => {
    requests.push(String(input));
    const response = responses[index];
    index += 1;
    if (!response) throw new Error('Unexpected extra fetch.');
    return response;
  }) as typeof fetch;
}

test('known TopDeck event captures exact strict decklists before provider startDate', async () => {
  const requests: string[] = [];
  const result = await captureTopDeckPreEventDecklistsV15({
    tournamentId,
    apiKey: 'test-key',
    apiBase,
    fetchFn: fetchSequence([
      jsonResponse({
        tid: tournamentId,
        game: 'Magic: The Gathering',
        format: 'EDH',
        startDate: 1787220000,
        endDate: null,
        status: 'Not Started',
      }),
      jsonResponse([
        { id: 'player-1', deckObj: strictDeckObj() },
      ]),
    ], requests),
    now: () => new Date('2026-08-20T08:30:00.000Z'),
  });

  assert.equal(result.status, 'captured');
  if (result.status !== 'captured') return;
  assert.equal(result.decks.length, 1);
  assert.equal(result.decks[0]?.providerPlayerId, 'player-1');
  assert.equal(result.decks[0]?.evidence.method, 'contemporaneous-rest-decklist-capture');
  assert.equal(result.decks[0]?.evidence.observedAt, '2026-08-20T08:30:00.000Z');
  assert.match(result.decks[0]?.deckFingerprint ?? '', /^[a-f0-9]{64}$/);
  assert.equal(requests.length, 2);
  assert.equal(requests[0], `${apiBase}/v2/tournaments/${tournamentId}/info`);
  assert.equal(requests[1], `${apiBase}/v2/tournaments/${tournamentId}/standings`);
});

test('pre-event capture reports unavailable when provider exposes no strict deckObj before start', async () => {
  const result = await captureTopDeckPreEventDecklistsV15({
    tournamentId,
    apiKey: 'test-key',
    apiBase,
    fetchFn: fetchSequence([
      jsonResponse({
        tid: tournamentId,
        game: 'Magic: The Gathering',
        format: 'EDH',
        startDate: 1787220000,
        endDate: null,
        status: 'Not Started',
      }),
      jsonResponse([{ id: 'player-1', decklist: 'https://example.test/deck' }]),
    ]),
    now: () => new Date('2026-08-20T08:30:00.000Z'),
  });

  assert.equal(result.status, 'unavailable');
  if (result.status !== 'unavailable') return;
  assert.equal(result.reason, 'no-visible-strict-decklists-before-start');
  assert.equal(result.rejectedStandingRows, 1);
});

test('pre-event capture fails closed if network work finishes after tournament start', async () => {
  await assert.rejects(
    captureTopDeckPreEventDecklistsV15({
      tournamentId,
      apiKey: 'test-key',
      apiBase,
      fetchFn: fetchSequence([
        jsonResponse({
          tid: tournamentId,
          game: 'Magic: The Gathering',
          format: 'EDH',
          startDate: 1787220000,
          endDate: null,
          status: 'Not Started',
        }),
        jsonResponse([{ id: 'player-1', deckObj: strictDeckObj() }]),
      ]),
      now: () => new Date('2026-08-20T11:00:01.000Z'),
    }),
    /completed after tournament start/i,
  );
});

test('event-end capture records provider Complete/endDate as later target timing evidence', async () => {
  const result = await captureTopDeckEventEndEvidenceV15({
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
    ]),
    now: () => new Date('2026-08-20T19:00:00.000Z'),
  });

  assert.equal(result.evidence.providerStatus, 'Complete');
  assert.equal(result.evidence.method, 'provider-info-end-date-capture');
  assert.equal(result.evidence.eventStartedAt, '2026-08-20T10:00:00.000Z');
  assert.equal(result.evidence.eventEndedAt, '2026-08-20T18:00:00.000Z');
  assert.match(result.evidence.sourceContentHash, /^[a-f0-9]{64}$/);
});

test('event-end capture rejects events that are not complete', async () => {
  await assert.rejects(
    captureTopDeckEventEndEvidenceV15({
      tournamentId,
      apiKey: 'test-key',
      apiBase,
      fetchFn: fetchSequence([
        jsonResponse({
          tid: tournamentId,
          game: 'Magic: The Gathering',
          format: 'EDH',
          startDate: 1787220000,
          endDate: null,
          status: 'Ongoing',
        }),
      ]),
      now: () => new Date('2026-08-20T19:00:00.000Z'),
    }),
    /requires provider status Complete/i,
  );
});

test('TopDeck prospective capture does not automatically retry a 429', async () => {
  let requests = 0;
  const fetchFn = (async () => {
    requests += 1;
    return jsonResponse({ error: 'rate limited' }, 429, { 'retry-after': '30' });
  }) as typeof fetch;

  await assert.rejects(
    captureTopDeckPreEventDecklistsV15({
      tournamentId,
      apiKey: 'test-key',
      apiBase,
      fetchFn,
      now: () => new Date('2026-08-20T08:30:00.000Z'),
    }),
    (error: unknown) => error instanceof TopDeckProspectiveRateLimitErrorV15 && error.retryAfterMs === 30_000,
  );
  assert.equal(requests, 1);
});
