import assert from 'node:assert/strict';
import test from 'node:test';
import { detectMetagameDriftV15 } from './metagame-drift-v15.js';
import type { LearningOutcomeRecordV15 } from './learning-corpus-v15.js';

const fingerprint = 'a'.repeat(64);

function corpus(
  size: number,
  recentTransform?: (index: number, record: LearningOutcomeRecordV15) => LearningOutcomeRecordV15,
): LearningOutcomeRecordV15[] {
  const start = Date.UTC(2025, 0, 1);
  return Array.from({ length: size }, (_, index) => {
    const positive = index % 2 === 0;
    const record: LearningOutcomeRecordV15 = {
      outcomeId: `outcome-${index}`,
      observedAt: new Date(start + index * 86_400_000).toISOString(),
      sourceId: index % 2 === 0 ? 'topdeck' : 'playgroup',
      evidenceClass: index % 2 === 0 ? 'observed-results' : 'recorded-games',
      independentGroup: `event-${index}`,
      leakageGroup: `event-${index}`,
      deckFingerprint: fingerprint,
      commanderNames: [index % 4 < 2 ? 'Kinnan, Bonder Prodigy' : 'Tymna the Weaver'],
      features: {
        tournamentSupport: positive ? 0.6 : -0.4,
        comboVerification: positive ? 0.7 : -0.3,
        manaEfficiency: 0.4,
      },
      label: positive ? 1 : 0,
    };
    const recentStart = Math.floor(size * 0.75);
    return index >= recentStart && recentTransform ? recentTransform(index, record) : record;
  });
}

test('stable temporal corpus does not invent metagame drift', () => {
  const report = detectMetagameDriftV15(corpus(240), { minimumWindowRecords: 40 });
  assert.equal(report.severity, 'stable');
  assert.equal(report.recommendation, 'continue-monitoring');
  assert.ok((report.positiveRateShift ?? 1) < 0.05);
  assert.ok((report.maximumFeatureShift ?? 1) < 0.05);
});

test('large recent outcome, feature and commander shifts block model promotion', () => {
  const report = detectMetagameDriftV15(corpus(240, (index, record) => ({
    ...record,
    commanderNames: ['Najeela, the Blade-Blossom'],
    evidenceClass: 'observed-results',
    label: index % 10 === 0 ? 0 : 1,
    features: {
      tournamentSupport: 1,
      comboVerification: 1,
      manaEfficiency: 1,
      interactionEfficiency: 0.9,
    },
  })), { minimumWindowRecords: 40 });

  assert.equal(report.severity, 'severe');
  assert.equal(report.recommendation, 'block-promotion-and-retrain');
  assert.ok((report.positiveRateShift ?? 0) >= 0.25);
  assert.ok((report.maximumFeatureShift ?? 0) >= 0.5);
  assert.ok((report.commanderDistributionShift ?? 0) >= 0.35);
});

test('small corpora are marked insufficient rather than falsely stable', () => {
  const report = detectMetagameDriftV15(corpus(60), { minimumWindowRecords: 20 });
  assert.equal(report.severity, 'insufficient');
  assert.equal(report.recommendation, 'gather-more-data');
  assert.ok(report.reasons.some((reason) => reason.includes('Need at least')));
});
