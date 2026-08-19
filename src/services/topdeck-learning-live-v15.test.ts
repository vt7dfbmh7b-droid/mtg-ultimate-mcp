import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../lib/http.js';
import {
  fetchTopDeckLearningCandidatesV15,
  MAX_TOPDECK_LEARNING_BULK_TOURNAMENTS_V15,
  TopDeckRateLimitErrorV15,
} from './topdeck-learning-live-v15.js';

const decklist = `~~Commanders~~
1 Kinnan, Bonder Prodigy (IKO) 192
~~Mainboard~~
99 Forest (M21) 272`;

function tournament() {
  return {
    TID: 'event-1',
    tournamentName: 'Fixture EDH',
    startDate: 1_767_225_600,
    game: 'Magic: The Gathering',
    format: 'EDH',
    topCut: 1,
    standings: [
      {
        standing: 1,
        id: 'player-1',
        name: 'Player One',
        decklist,
        wins: 4,
        draws: 1,
        losses: 0,
      },
    ],
  };
}

test('live fetcher makes exactly one documented bounded EDH POST and adapts the response', async () => {
  let calls = 0;
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  const fetchFn: typeof fetch = async (url, init) => {
    calls += 1;
    capturedUrl = String(url);
    capturedInit = init;
    return new Response(JSON.stringify([tournament()]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await fetchTopDeckLearningCandidatesV15({
    apiKey: 'fixture-key',
    apiBase: 'https://topdeck.gg/api/',
    lastDays: 14,
    participantMin: 24,
    fetchFn,
    now: () => new Date('2026-08-17T10:00:00.000Z'),
  });

  assert.equal(calls, 1);
  assert.equal(capturedUrl, 'https://topdeck.gg/api/v2/tournaments');
  assert.equal(capturedInit?.method, 'POST');
  const headers = new Headers(capturedInit?.headers);
  assert.equal(headers.get('authorization'), 'fixture-key');
  assert.equal(headers.get('content-type'), 'application/json');
  const body = JSON.parse(String(capturedInit?.body));
  assert.deepEqual(body, {
    game: 'Magic: The Gathering',
    format: 'EDH',
    last: 14,
    participantMin: 24,
    columns: ['name', 'id', 'decklist', 'wins', 'draws', 'losses'],
    rounds: false,
  });
  assert.equal(result.tournamentsReturned, 1);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.fetchedAt, '2026-08-17T10:00:00.000Z');
  assert.equal(result.rateLimitPolicy, 'single-request-no-automatic-retry');
  assert.equal(result.attribution, 'Data provided by TopDeck.gg');
  assert.deepEqual(result.providerShapeAudit, {
    tournaments: 1,
    standingsRows: 1,
    decklistStringRows: 1,
    multilineDecklistRows: 1,
    singleLineDecklistRows: 0,
    urlLikeDecklistRows: 0,
    deckObjRows: 0,
    deckObjWithCommandersSection: 0,
    deckObjWithMainboardSection: 0,
    commanderSectionEntryCountDistribution: {},
    commanderSectionValueShapes: {
      number: 0,
      'object-with-quantity': 0,
      'object-without-quantity': 0,
      string: 0,
      other: 0,
    },
    mainboardSectionValueShapes: {
      number: 0,
      'object-with-quantity': 0,
      'object-without-quantity': 0,
      string: 0,
      other: 0,
    },
  });
});

test('provider shape audit detects URL-like deck references and structured deck sections without retaining card names', async () => {
  const payload = tournament();
  payload.standings[0] = {
    id: 'player-1',
    name: 'Player One',
    decklist: 'moxfield.com/decks/example',
    deckObj: {
      Commanders: {
        'Commander Name': { quantity: 1, id: 'card-a' },
      },
      Mainboard: {
        'Main Card': { quantity: 99, id: 'card-b' },
      },
    },
    wins: 4,
    draws: 1,
    losses: 0,
  };
  const fetchFn: typeof fetch = async () => new Response(JSON.stringify([payload]), { status: 200 });
  const result = await fetchTopDeckLearningCandidatesV15({ apiKey: 'fixture-key', fetchFn });

  assert.equal(result.providerShapeAudit.singleLineDecklistRows, 1);
  assert.equal(result.providerShapeAudit.urlLikeDecklistRows, 1);
  assert.equal(result.providerShapeAudit.deckObjRows, 1);
  assert.equal(result.providerShapeAudit.deckObjWithCommandersSection, 1);
  assert.equal(result.providerShapeAudit.deckObjWithMainboardSection, 1);
  assert.deepEqual(result.providerShapeAudit.commanderSectionEntryCountDistribution, { '1': 1 });
  assert.equal(result.providerShapeAudit.commanderSectionValueShapes['object-with-quantity'], 1);
  assert.equal(result.providerShapeAudit.mainboardSectionValueShapes['object-with-quantity'], 1);
});

test('HTTP 429 is surfaced as a typed rate-limit error with Retry-After and no automatic retry', async () => {
  let calls = 0;
  const fetchFn: typeof fetch = async () => {
    calls += 1;
    return new Response('rate limited', {
      status: 429,
      headers: { 'retry-after': '2.5' },
    });
  };

  await assert.rejects(
    () => fetchTopDeckLearningCandidatesV15({ apiKey: 'fixture-key', fetchFn }),
    (error: unknown) => {
      assert.equal(error instanceof TopDeckRateLimitErrorV15, true);
      if (!(error instanceof TopDeckRateLimitErrorV15)) return false;
      assert.equal(error.retryAfterMs, 2_500);
      return true;
    },
  );
  assert.equal(calls, 1);
});

test('non-rate-limit HTTP errors preserve bounded response body through HttpError', async () => {
  const fetchFn: typeof fetch = async () => new Response('bad request details', {
    status: 400,
    statusText: 'Bad Request',
  });

  await assert.rejects(
    () => fetchTopDeckLearningCandidatesV15({ apiKey: 'fixture-key', fetchFn }),
    (error: unknown) => {
      assert.equal(error instanceof HttpError, true);
      if (!(error instanceof HttpError)) return false;
      assert.equal(error.status, 400);
      assert.equal(error.body, 'bad request details');
      return true;
    },
  );
});

test('mixed provider rows are adapted quarantine-first instead of failing the whole live refresh', async () => {
  const payload = tournament();
  payload.standings.push({
    standing: 2,
    id: 'player-2',
    name: 'No Deck',
    decklist: '',
    wins: 3,
    draws: 0,
    losses: 2,
  });
  payload.topCut = 1;
  const fetchFn: typeof fetch = async () => new Response(JSON.stringify([payload]), { status: 200 });

  const result = await fetchTopDeckLearningCandidatesV15({ apiKey: 'fixture-key', fetchFn });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0]?.code, 'missing-decklist-text');
});

test('oversized bulk responses fail closed and require a narrower refresh query', async () => {
  const payload = Array.from({ length: MAX_TOPDECK_LEARNING_BULK_TOURNAMENTS_V15 + 1 }, () => tournament());
  const fetchFn: typeof fetch = async () => new Response(JSON.stringify(payload), { status: 200 });

  await assert.rejects(
    () => fetchTopDeckLearningCandidatesV15({ apiKey: 'fixture-key', fetchFn }),
    /bounded refresh limit/,
  );
});

test('missing API key and malformed bounds fail before any network request', async () => {
  let calls = 0;
  const fetchFn: typeof fetch = async () => {
    calls += 1;
    return new Response('[]', { status: 200 });
  };

  await assert.rejects(
    () => fetchTopDeckLearningCandidatesV15({ apiKey: ' ', fetchFn }),
    /TOPDECK_API_KEY is not configured/,
  );
  await assert.rejects(
    () => fetchTopDeckLearningCandidatesV15({ apiKey: 'key', lastDays: 0, fetchFn }),
    /lastDays must be at least 1/,
  );
  await assert.rejects(
    () => fetchTopDeckLearningCandidatesV15({ apiKey: 'key', participantMin: 0, fetchFn }),
    /participantMin must be at least 1/,
  );
  assert.equal(calls, 0);
});

test('invalid JSON shape and invalid deterministic clock fail closed', async () => {
  const objectFetch: typeof fetch = async () => new Response(JSON.stringify({ tournaments: [] }), { status: 200 });
  await assert.rejects(
    () => fetchTopDeckLearningCandidatesV15({ apiKey: 'key', fetchFn: objectFetch }),
    /response must be an array/,
  );

  const arrayFetch: typeof fetch = async () => new Response('[]', { status: 200 });
  await assert.rejects(
    () => fetchTopDeckLearningCandidatesV15({
      apiKey: 'key',
      fetchFn: arrayFetch,
      now: () => new Date(Number.NaN),
    }),
    /now\(\) must return a valid Date/,
  );
});
