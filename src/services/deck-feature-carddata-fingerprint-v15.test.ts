import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import {
  extractDeckFeatureSnapshotV15,
  fitDeckFeatureNormalizerV15,
} from './deck-feature-snapshot-v15.js';
import { materializeTopDeckLearningCandidateV15 } from './topdeck-learning-materializer-v15.js';
import type { TopDeckLearningCandidateV15 } from './topdeck-learning-adapter-v15.js';

function card(name: string, typeLine: string, cmc: number, oracleText = ''): ScryfallCard {
  return {
    id: `id-${name}`,
    oracle_id: `oracle-${name}`,
    name,
    lang: 'en',
    released_at: '2024-01-01',
    mana_cost: cmc > 0 ? `{${cmc}}` : '',
    cmc,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test Set',
    collector_number: '1',
    rarity: 'common',
    scryfall_uri: `https://scryfall.com/card/tst/1/${encodeURIComponent(name)}`,
  };
}

const decklist = [
  '// COMMANDER',
  '1 Audit Commander',
  '',
  '// MAIN',
  '34 Audit Land',
  '10 Audit Answer',
  '55 Audit Threat',
].join('\n');

function cards(answerOracle = 'Destroy target creature.'): ScryfallCard[] {
  return [
    card('Audit Commander', 'Legendary Creature — Test', 2),
    card('Audit Land', 'Land', 0, '{T}: Add {C}.'),
    card('Audit Answer', 'Instant', 1, answerOracle),
    card('Audit Threat', 'Creature — Test', 3),
  ];
}

function snapshot(inputCards: ScryfallCard[]) {
  return extractDeckFeatureSnapshotV15(decklist, inputCards, {
    availableAt: '2026-01-09T00:00:00.000Z',
    cardDataObservedAt: '2026-01-08T00:00:00.000Z',
  });
}

test('card-data fingerprint is deterministic across input order and ignores unrelated supplied cards', () => {
  const baselineCards = cards();
  const baseline = snapshot(baselineCards);
  const reordered = snapshot([...baselineCards].reverse());
  const withUnrelated = snapshot([
    card('Unused Sideboard-Like Card', 'Sorcery', 7, 'Draw three cards.'),
    ...baselineCards,
  ]);

  assert.match(baseline.cardDataSnapshotFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(reordered.cardDataSnapshotFingerprint, baseline.cardDataSnapshotFingerprint);
  assert.equal(withUnrelated.cardDataSnapshotFingerprint, baseline.cardDataSnapshotFingerprint);
  assert.deepEqual(reordered.raw, baseline.raw);
  assert.deepEqual(withUnrelated.raw, baseline.raw);
});

test('changing relevant historical Oracle input changes card-data fingerprint even when structural metrics stay the same', () => {
  const before = snapshot(cards('Destroy target creature.'));
  const after = snapshot(cards('Destroy target creature. It can’t be regenerated.'));

  assert.deepEqual(after.raw, before.raw);
  assert.notEqual(after.cardDataSnapshotFingerprint, before.cardDataSnapshotFingerprint);
});

test('changing a relevant card-data value that affects structure changes both fingerprint and raw metrics', () => {
  const baselineCards = cards();
  const changedCards = cards().map((entry) =>
    entry.name === 'Audit Threat' ? { ...entry, cmc: 6, mana_cost: '{6}' } : entry);

  const before = snapshot(baselineCards);
  const after = snapshot(changedCards);
  assert.notEqual(after.cardDataSnapshotFingerprint, before.cardDataSnapshotFingerprint);
  assert.notEqual(after.raw.averageNonlandManaValue, before.raw.averageNonlandManaValue);
});

test('TopDeck materialization persists the card-data snapshot fingerprint into corpus provenance', () => {
  const target = snapshot(cards());
  const trainingOtherCards = cards().map((entry) =>
    entry.name === 'Audit Threat' ? { ...entry, cmc: 5, mana_cost: '{5}' } : entry);
  const normalizer = fitDeckFeatureNormalizerV15([target, snapshot(trainingOtherCards)]);
  const candidate: TopDeckLearningCandidateV15 = {
    sourceId: 'topdeck',
    providerEventId: 'audit-event',
    providerPlayerId: 'audit-player',
    providerRecordId: 'audit-event:standing:audit-player',
    sourceUrl: 'https://topdeck.gg/event/audit-event',
    outcomeOccurredAt: '2026-01-10T00:00:00.000Z',
    standing: 2,
    fieldSize: 32,
    topCutSize: 8,
    decklist,
    commanderNames: ['Audit Commander'],
    metadata: {
      provider: 'topdeck-v2',
      tournamentName: 'Audit Event',
      wins: null,
      draws: null,
      losses: null,
    },
  };

  const observed = materializeTopDeckLearningCandidateV15(candidate, target, normalizer, {
    canonicalOutcomeId: 'audit:event:player',
    independenceKey: 'audit:event',
    leakageKey: 'audit:event',
    sourceObservedAt: '2026-01-11T00:00:00.000Z',
  });

  assert.equal(observed.metadata?.cardDataSnapshotFingerprint, target.cardDataSnapshotFingerprint);
});
