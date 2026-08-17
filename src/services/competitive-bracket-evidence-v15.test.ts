import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateCompetitiveBracketEvidenceV15 } from './competitive-bracket-evidence-v15.js';

const freshTopDeck = {
  sourceId: 'topdeck',
  focus: 'competitive' as const,
  subject: 'Kinnan, Bonder Prodigy',
  claim: 'The archetype is producing competitive tournament results.',
  polarity: 'support' as const,
  ageDays: 7,
  independentGroup: 'event-series-a',
  sampleSize: 120,
  outcomeStrength: 0.95,
  structured: true,
};

const freshDdb = {
  sourceId: 'cedh-ddb',
  focus: 'competitive' as const,
  subject: 'Kinnan, Bonder Prodigy',
  claim: 'The archetype has a maintained cEDH strategy reference.',
  polarity: 'support' as const,
  ageDays: 10,
  independentGroup: 'cedh-ddb-review',
  sampleSize: 30,
  outcomeStrength: 0.9,
  structured: false,
};

test('fresh independent observed results plus curated cEDH evidence can support the metagame gate', () => {
  const result = evaluateCompetitiveBracketEvidenceV15([freshTopDeck, freshDdb]);
  assert.equal(result.verdict, 'supported');
  assert.equal(result.competitiveMetagameEvidence, true);
  assert.equal(result.supportIndependentGroups, 2);
  assert.equal(result.observedResultsSupportGroups, 1);
});

test('two mirrors of the same tournament evidence do not count as independent corroboration', () => {
  const result = evaluateCompetitiveBracketEvidenceV15([
    freshTopDeck,
    {
      sourceId: 'edhtop16',
      focus: 'competitive',
      subject: 'Kinnan, Bonder Prodigy',
      claim: 'The same tournament result appears in a second public index.',
      polarity: 'support',
      ageDays: 7,
      independentGroup: 'event-series-a',
      sampleSize: 120,
      outcomeStrength: 0.95,
    },
  ]);
  assert.equal(result.verdict, 'insufficient');
  assert.equal(result.competitiveMetagameEvidence, false);
  assert.equal(result.supportIndependentGroups, 1);
});

test('stale competitive references decay out instead of certifying Bracket 5 forever', () => {
  const result = evaluateCompetitiveBracketEvidenceV15([
    { ...freshTopDeck, ageDays: 365, independentGroup: 'old-event' },
    { ...freshDdb, ageDays: 365, independentGroup: 'old-review' },
  ]);
  assert.equal(result.verdict, 'insufficient');
  assert.equal(result.competitiveMetagameEvidence, false);
  assert.ok(result.ignoredObservations >= 1);
});

test('fresh contradictory independent evidence blocks a confident Bracket 5 claim', () => {
  const result = evaluateCompetitiveBracketEvidenceV15([
    freshTopDeck,
    freshDdb,
    {
      sourceId: 'playgroup',
      focus: 'recorded-games',
      subject: 'Kinnan, Bonder Prodigy',
      claim: 'Recent tracked games materially underperform the claimed competitive level.',
      polarity: 'oppose',
      ageDays: 3,
      independentGroup: 'recorded-games-b',
      sampleSize: 200,
      outcomeStrength: 1,
      structured: true,
    },
  ]);
  assert.equal(result.verdict, 'disputed');
  assert.equal(result.competitiveMetagameEvidence, false);
});

test('opposite reports inside one underlying evidence group are neutralized rather than averaged into false confidence', () => {
  const result = evaluateCompetitiveBracketEvidenceV15([
    freshTopDeck,
    { ...freshTopDeck, polarity: 'oppose', claim: 'A conflicting interpretation of the same event data.' },
    freshDdb,
  ]);
  assert.equal(result.competitiveMetagameEvidence, false);
  assert.ok(result.conflictedIndependentGroups.includes('event-series-a'));
  assert.equal(result.verdict, 'disputed');
});

test('community popularity and decklists alone cannot become competitive metagame evidence', () => {
  const result = evaluateCompetitiveBracketEvidenceV15([
    {
      sourceId: 'edhrec',
      focus: 'community',
      subject: 'Kinnan, Bonder Prodigy',
      claim: 'Popular commander with high card adoption.',
      polarity: 'support',
      ageDays: 1,
      independentGroup: 'edhrec-community',
      sampleSize: 5000,
      outcomeStrength: 1,
    },
    {
      sourceId: 'moxfield',
      focus: 'decklists',
      subject: 'Kinnan, Bonder Prodigy',
      claim: 'Many public decklists exist.',
      polarity: 'support',
      ageDays: 1,
      independentGroup: 'moxfield-lists',
      sampleSize: 500,
      outcomeStrength: 1,
    },
  ]);
  assert.equal(result.verdict, 'insufficient');
  assert.equal(result.competitiveMetagameEvidence, false);
  assert.equal(result.usableObservations, 0);
});
