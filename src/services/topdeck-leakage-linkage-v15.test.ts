import assert from 'node:assert/strict';
import test from 'node:test';
import type { TopDeckLearningCandidateV15 } from './topdeck-learning-adapter-v15.js';
import { planTopDeckLeakageLinkagesV15 } from './topdeck-leakage-linkage-v15.js';

function candidate(options: {
  record: string;
  event: string;
  pilot: string;
  deck: string;
  outcomeAt?: string;
}): TopDeckLearningCandidateV15 {
  return {
    sourceId: 'topdeck',
    providerEventId: options.event,
    providerPlayerId: options.pilot,
    providerRecordId: options.record,
    sourceUrl: `https://topdeck.gg/event/${encodeURIComponent(options.event)}`,
    outcomeOccurredAt: options.outcomeAt ?? '2026-08-01T00:00:00.000Z',
    standing: 1,
    fieldSize: 32,
    topCutSize: 8,
    decklist: options.deck,
    commanderNames: ['Test Commander'],
    metadata: {
      provider: 'topdeck-v2',
      tournamentName: options.event,
      wins: null,
      draws: null,
      losses: null,
      standingSource: 'provider-field',
      deckSource: 'inline-text',
    },
  };
}

function linkageMap(plan: ReturnType<typeof planTopDeckLeakageLinkagesV15>) {
  return Object.fromEntries(Object.entries(plan.linkagesByProviderRecordId)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([recordId, linkage]) => [recordId, {
      canonicalOutcomeId: linkage.canonicalOutcomeId,
      independenceKey: linkage.independenceKey,
      leakageKey: linkage.leakageKey,
    }]));
}

test('leakage planner takes transitive closure across event, pilot, and exact deck reuse before splitting', () => {
  const candidates = [
    candidate({ record: 'a', event: 'event-1', pilot: 'pilot-1', deck: 'deck-X' }),
    candidate({ record: 'b', event: 'event-1', pilot: 'pilot-2', deck: 'deck-Y' }),
    candidate({ record: 'c', event: 'event-2', pilot: 'pilot-1', deck: 'deck-Z' }),
    candidate({ record: 'd', event: 'event-3', pilot: 'pilot-3', deck: 'deck-X' }),
    candidate({ record: 'e', event: 'event-4', pilot: 'pilot-4', deck: 'deck-Q' }),
  ];
  const plan = planTopDeckLeakageLinkagesV15(candidates, {
    sourceObservedAt: '2026-08-19T00:00:00.000Z',
    sourceRetrievedAt: '2026-08-19T00:01:00.000Z',
  });
  assert.equal(plan.candidates, 5);
  assert.equal(plan.components, 2);
  assert.equal(plan.repeatedEvents, 1);
  assert.equal(plan.repeatedPilots, 1);
  assert.equal(plan.repeatedExactDecks, 1);
  assert.equal(plan.maximumComponentSize, 4);
  const a = plan.linkagesByProviderRecordId.a;
  const b = plan.linkagesByProviderRecordId.b;
  const c = plan.linkagesByProviderRecordId.c;
  const d = plan.linkagesByProviderRecordId.d;
  const e = plan.linkagesByProviderRecordId.e;
  assert.ok(a && b && c && d && e);
  assert.equal(a.independenceKey, b.independenceKey);
  assert.notEqual(a.independenceKey, c.independenceKey);
  assert.equal(a.leakageKey, b.leakageKey);
  assert.equal(a.leakageKey, c.leakageKey);
  assert.equal(a.leakageKey, d.leakageKey);
  assert.notEqual(a.leakageKey, e.leakageKey);
  assert.equal(new Set(Object.values(plan.linkagesByProviderRecordId).map((linkage) => linkage.canonicalOutcomeId)).size, 5);
});

test('leakage planning is input-order invariant for the same candidate batch', () => {
  const candidates = [
    candidate({ record: 'a', event: 'event-1', pilot: 'pilot-1', deck: 'deck-X' }),
    candidate({ record: 'b', event: 'event-1', pilot: 'pilot-2', deck: 'deck-Y' }),
    candidate({ record: 'c', event: 'event-2', pilot: 'pilot-1', deck: 'deck-Z' }),
    candidate({ record: 'd', event: 'event-3', pilot: 'pilot-3', deck: 'deck-X' }),
  ];
  const options = { sourceObservedAt: '2026-08-19T00:00:00.000Z', sourceRetrievedAt: '2026-08-19T00:01:00.000Z' };
  const forward = planTopDeckLeakageLinkagesV15(candidates, options);
  const reversed = planTopDeckLeakageLinkagesV15([...candidates].reverse(), options);
  assert.deepEqual(linkageMap(forward), linkageMap(reversed));
});

test('leakage planner rejects duplicate provider rows and impossible observation timing', () => {
  const duplicate = candidate({ record: 'same', event: 'event-1', pilot: 'pilot-1', deck: 'deck-X' });
  assert.throws(
    () => planTopDeckLeakageLinkagesV15([duplicate, { ...duplicate }], {
      sourceObservedAt: '2026-08-19T00:00:00.000Z', sourceRetrievedAt: '2026-08-19T00:01:00.000Z',
    }),
    /duplicate.*providerRecordId/i,
  );
  assert.throws(
    () => planTopDeckLeakageLinkagesV15([
      candidate({ record: 'future', event: 'event-future', pilot: 'pilot-future', deck: 'deck-future', outcomeAt: '2026-08-20T00:00:00.000Z' }),
    ], { sourceObservedAt: '2026-08-19T00:00:00.000Z', sourceRetrievedAt: '2026-08-19T00:01:00.000Z' }),
    /outcome occurs after source observation/i,
  );
});
