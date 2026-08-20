import assert from 'node:assert/strict';
import test from 'node:test';
import { assessBracketFromResearchV15 } from './bracket-research-assessment-v15.js';

const cedhSignals = {
  commanderLegal: true,
  exactCardCount: true,
  fullyResolved: true,
  printingPolicyCompliant: true,
  spellbookTag: 'R',
  verifiedWinningCombos: 2,
  ruthlessWinningCombos: 1,
  strategicallyRelevantCombos: 1,
  averageNonlandManaValue: 2.1,
  earlyPlayCount: 44,
  fastManaCount: 7,
  freeInteractionCount: 4,
  cheapInteractionCount: 13,
  tutorCount: 8,
  gameChangerCount: 5,
  optimizedPlanEvidence: true,
  cedhIntent: true,
} as const;

const freshEvidence = [
  {
    sourceId: 'topdeck',
    focus: 'competitive' as const,
    subject: 'Kinnan, Bonder Prodigy',
    claim: 'Recent tournament results support the archetype as competitively viable.',
    polarity: 'support' as const,
    ageDays: 5,
    independentGroup: 'tournament-results-a',
    sampleSize: 160,
    outcomeStrength: 1,
    structured: true,
  },
  {
    sourceId: 'cedh-ddb',
    focus: 'competitive' as const,
    subject: 'Kinnan, Bonder Prodigy',
    claim: 'Independent curated cEDH strategy evidence supports the archetype.',
    polarity: 'support' as const,
    ageDays: 8,
    independentGroup: 'ddb-review-a',
    sampleSize: 40,
    outcomeStrength: 0.95,
  },
];

test('research-grounded assessment can reach Bracket 5 when construction, intent and fresh independent evidence all pass', () => {
  const result = assessBracketFromResearchV15(5, cedhSignals, freshEvidence);
  assert.equal(result.competitiveEvidence.verdict, 'supported');
  assert.equal(result.assessment.assessedBracket, 5);
  assert.equal(result.assessment.bracket5CertifiedByThisAssessment, true);
});

test('the same cEDH-quality construction stays high Bracket 4 when research evidence is stale', () => {
  const stale = freshEvidence.map((observation) => ({ ...observation, ageDays: 365 }));
  const result = assessBracketFromResearchV15(5, cedhSignals, stale);
  assert.equal(result.competitiveEvidence.competitiveMetagameEvidence, false);
  assert.equal(result.assessment.assessedBracket, 4);
  assert.equal(result.assessment.assessedBand, 'high-bracket-4-cedh-construction-candidate');
});

test('caller cannot smuggle a true competitiveMetagameEvidence flag past research provenance checks', () => {
  const maliciousSignals = {
    ...cedhSignals,
    competitiveMetagameEvidence: true,
  } as unknown as Parameters<typeof assessBracketFromResearchV15>[1];
  const result = assessBracketFromResearchV15(5, maliciousSignals, []);
  assert.equal(result.competitiveEvidence.verdict, 'insufficient');
  assert.equal(result.assessment.assessedBracket, 4);
  assert.equal(result.assessment.bracket5CertifiedByThisAssessment, false);
});

test('fresh contradictory evidence blocks Bracket 5 even with a perfect-looking static construction shell', () => {
  const contradictory = [
    ...freshEvidence,
    {
      sourceId: 'playgroup',
      focus: 'recorded-games' as const,
      subject: 'Kinnan, Bonder Prodigy',
      claim: 'A large recent tracked sample materially opposes the claimed competitive performance.',
      polarity: 'oppose' as const,
      ageDays: 2,
      independentGroup: 'tracked-games-c',
      sampleSize: 250,
      outcomeStrength: 1,
      structured: true,
    },
  ];
  const result = assessBracketFromResearchV15(5, cedhSignals, contradictory);
  assert.equal(result.competitiveEvidence.verdict, 'disputed');
  assert.equal(result.assessment.assessedBracket, 4);
  assert.equal(result.assessment.bracket5CertifiedByThisAssessment, false);
});
