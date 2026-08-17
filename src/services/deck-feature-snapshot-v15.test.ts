import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import {
  DECK_FEATURE_EXTRACTOR_ID_V15,
  extractDeckFeatureSnapshotV15,
  fitDeckFeatureNormalizerV15,
  prepareTemporalDeckFeaturesV15,
  projectDeckFeatureSnapshotV15,
  type DeckFeatureSnapshotV15,
} from './deck-feature-snapshot-v15.js';

function card(
  name: string,
  typeLine: string,
  cmc: number,
  oracleText = '',
  releasedAt = '2024-01-01',
): ScryfallCard {
  return {
    id: `id-${name}`,
    oracle_id: `oracle-${name}`,
    name,
    lang: 'en',
    released_at: releasedAt,
    mana_cost: cmc > 0 ? `{${cmc}}` : '',
    cmc,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test Set',
    collector_number: name.replace(/\D/g, '') || '1',
    rarity: 'common',
    scryfall_uri: `https://scryfall.com/card/tst/${encodeURIComponent(name)}`,
  };
}

function fixtureDeck(options: {
  prefix: string;
  cheapInteraction: number;
  nonlandManaValue: number;
  releasedAt?: string;
}): { decklist: string; cards: ScryfallCard[] } {
  const commanderName = `${options.prefix} Commander`;
  const cards: ScryfallCard[] = [card(commanderName, 'Legendary Creature — Test', 2, '', options.releasedAt)];
  const lines = ['// COMMANDER', `1 ${commanderName}`, '', '// MAIN'];

  for (let index = 0; index < 99; index += 1) {
    const name = `${options.prefix} Card ${index + 1}`;
    if (index < 34) {
      cards.push(card(name, 'Land', 0, '{T}: Add {C}.', options.releasedAt));
    } else if (index < 34 + options.cheapInteraction) {
      cards.push(card(name, 'Instant', 1, 'Destroy target creature.', options.releasedAt));
    } else {
      cards.push(card(name, 'Creature — Test', options.nonlandManaValue, '', options.releasedAt));
    }
    lines.push(`1 ${name}`);
  }

  return { decklist: lines.join('\n'), cards };
}

function extractFixture(
  fixture: ReturnType<typeof fixtureDeck>,
  availableAt = '2025-06-01T00:00:00.000Z',
): DeckFeatureSnapshotV15 {
  return extractDeckFeatureSnapshotV15(fixture.decklist, fixture.cards, {
    availableAt,
    cardDataObservedAt: '2024-12-31T00:00:00.000Z',
  });
}

test('deck-intrinsic predictors are invariant when the same TopDeck deck has a different result', () => {
  const fixture = fixtureDeck({ prefix: 'Invariant', cheapInteraction: 12, nonlandManaValue: 3 });
  const topCutCandidate = { standing: 1, decklist: fixture.decklist };
  const missedCutCandidate = { standing: 37, decklist: fixture.decklist };

  const topCutSnapshot = extractDeckFeatureSnapshotV15(topCutCandidate.decklist, fixture.cards, {
    availableAt: '2025-06-01T00:00:00.000Z',
    cardDataObservedAt: '2025-05-31T00:00:00.000Z',
  });
  const missedCutSnapshot = extractDeckFeatureSnapshotV15(missedCutCandidate.decklist, fixture.cards, {
    availableAt: '2025-06-01T00:00:00.000Z',
    cardDataObservedAt: '2025-05-31T00:00:00.000Z',
  });

  assert.equal(topCutCandidate.standing === missedCutCandidate.standing, false);
  assert.equal(topCutSnapshot.extractorId, DECK_FEATURE_EXTRACTOR_ID_V15);
  assert.deepEqual(topCutSnapshot, missedCutSnapshot);
});

test('feature extraction fails closed when any physical deck entry is unresolved', () => {
  const fixture = fixtureDeck({ prefix: 'Missing', cheapInteraction: 8, nonlandManaValue: 3 });
  fixture.cards.pop();

  assert.throws(
    () => extractFixture(fixture),
    /unresolved|resolve/i,
  );
});

test('feature extraction refuses card data observed after the feature snapshot and future printings', () => {
  const fixture = fixtureDeck({ prefix: 'Future', cheapInteraction: 8, nonlandManaValue: 3 });
  assert.throws(
    () => extractDeckFeatureSnapshotV15(fixture.decklist, fixture.cards, {
      availableAt: '2025-06-01T00:00:00.000Z',
      cardDataObservedAt: '2025-06-02T00:00:00.000Z',
    }),
    /cardDataObservedAt.*after|after.*availableAt/i,
  );

  const futurePrinting = fixtureDeck({
    prefix: 'FuturePrint',
    cheapInteraction: 8,
    nonlandManaValue: 3,
    releasedAt: '2026-01-01',
  });
  assert.throws(
    () => extractFixture(futurePrinting),
    /released after|future printing/i,
  );
});

test('raw structural features remain auditable and projected model features stay bounded', () => {
  const fixture = fixtureDeck({ prefix: 'Audit', cheapInteraction: 14, nonlandManaValue: 4 });
  const snapshot = extractFixture(fixture);
  assert.equal(snapshot.raw.totalCards, 100);
  assert.equal(snapshot.raw.landCount, 34);
  assert.equal(snapshot.raw.cheapInteractionCount, 14);
  assert.ok(snapshot.raw.averageNonlandManaValue > 0);

  const normalizer = fitDeckFeatureNormalizerV15([snapshot]);
  const projected = projectDeckFeatureSnapshotV15(snapshot, normalizer);
  assert.deepEqual(projected, { manaEfficiency: 0, interactionEfficiency: 0 });
});

test('temporal preparation fits normalization on training only so future holdout outliers cannot change earlier features', () => {
  const trainingA = extractFixture(fixtureDeck({ prefix: 'TrainA', cheapInteraction: 4, nonlandManaValue: 2 }), '2025-01-01T00:00:00.000Z');
  const trainingB = extractFixture(fixtureDeck({ prefix: 'TrainB', cheapInteraction: 12, nonlandManaValue: 5 }), '2025-02-01T00:00:00.000Z');
  const ordinaryHoldout = extractFixture(fixtureDeck({ prefix: 'Holdout', cheapInteraction: 10, nonlandManaValue: 3 }), '2025-03-01T00:00:00.000Z');
  const extremeFutureHoldout = extractFixture(fixtureDeck({ prefix: 'FutureOutlier', cheapInteraction: 40, nonlandManaValue: 7 }), '2025-04-01T00:00:00.000Z');

  const baseline = prepareTemporalDeckFeaturesV15([trainingA, trainingB], [ordinaryHoldout]);
  const withFutureOutlier = prepareTemporalDeckFeaturesV15(
    [trainingA, trainingB],
    [ordinaryHoldout, extremeFutureHoldout],
  );

  assert.deepEqual(withFutureOutlier.normalizer, baseline.normalizer);
  assert.deepEqual(withFutureOutlier.training, baseline.training);
  assert.deepEqual(withFutureOutlier.holdout[0], baseline.holdout[0]);
  assert.ok(withFutureOutlier.holdout.every((entry) =>
    Object.values(entry.features).every((value) => typeof value === 'number' && value >= -1 && value <= 1)));
});

test('normalizer rejects mixed extractor versions instead of silently combining incompatible feature contracts', () => {
  const snapshot = extractFixture(fixtureDeck({ prefix: 'Version', cheapInteraction: 8, nonlandManaValue: 3 }));
  const incompatible = {
    ...snapshot,
    extractorId: 'deck-structural-v15.future',
  } as unknown as DeckFeatureSnapshotV15;

  assert.throws(
    () => fitDeckFeatureNormalizerV15([snapshot, incompatible]),
    /extractor|version|contract/i,
  );
});