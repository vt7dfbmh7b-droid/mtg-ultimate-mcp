import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { assessBracketCeilingV15 } from './bracket-ceiling-v15.js';
import { deriveEfficientCommanderWinPlanV15 } from './efficient-win-plan-v15.js';

const najeelaText = [
  'Whenever a Warrior attacks, you may have its controller create a 1/1 white Warrior creature token that\'s tapped and attacking.',
  '{W}{U}{B}{R}{G}: Untap all attacking creatures. They gain trample, lifelink, and haste until end of turn. After this phase, there is an additional combat phase. Activate only during combat.',
].join('\n');

function card(name: string, cmc: number, oracleText: string): ScryfallCard {
  return {
    id: `id-${name}`,
    name,
    lang: 'en',
    cmc,
    type_line: 'Legendary Creature — Human Warrior',
    oracle_text: oracleText,
    color_identity: ['W', 'U', 'B', 'R', 'G'],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: '1',
    rarity: 'mythic',
    scryfall_uri: 'https://scryfall.com/card/tst/1/test',
  };
}

const decklist = '// COMMANDER\n1 Najeela, the Blade-Blossom\n\n// MAIN\n99 Plains';

const hardPass = {
  commanderLegal: true,
  exactCardCount: true,
  fullyResolved: true,
  printingPolicyCompliant: true,
} as const;

test('Najeela-style Oracle semantics prove an efficient commander-centric combat win plan without using the commander name as the proof', () => {
  const evidence = deriveEfficientCommanderWinPlanV15(decklist, [
    card('Najeela, the Blade-Blossom', 3, najeelaText),
  ]);

  assert.equal(evidence.supported, true);
  assert.equal(evidence.archetype, 'cheap-repeatable-commander-combat-engine');
  assert.equal(evidence.checks.createsAttackingBodiesFromAttacks, true);
  assert.equal(evidence.checks.untapsAttackers, true);
  assert.equal(evidence.checks.grantsAdditionalCombat, true);
  assert.equal(evidence.checks.combatRepeatableActivation, true);
});

test('the Najeela name alone cannot manufacture win-plan evidence when the Oracle semantics are incomplete', () => {
  const evidence = deriveEfficientCommanderWinPlanV15(decklist, [
    card('Najeela, the Blade-Blossom', 3, 'Whenever a Warrior attacks, create a 1/1 Warrior creature token tapped and attacking.'),
  ]);

  assert.equal(evidence.supported, false);
  assert.equal(evidence.checks.grantsAdditionalCombat, false);
  assert.ok(evidence.blockers.some((blocker) => /additional combat/i.test(blocker)));
});

test('an expensive lookalike with the same combat wording does not pass the narrow efficient-command-zone proof', () => {
  const lookalikeDeck = '// COMMANDER\n1 Expensive Combat Engine\n\n// MAIN\n99 Plains';
  const evidence = deriveEfficientCommanderWinPlanV15(lookalikeDeck, [
    card('Expensive Combat Engine', 6, najeelaText),
  ]);

  assert.equal(evidence.supported, false);
  assert.equal(evidence.checks.cheapCommander, false);
});

test('commander win-plan evidence still cannot promote an unoptimized shell beyond Bracket 3', () => {
  const evidence = deriveEfficientCommanderWinPlanV15(decklist, [
    card('Najeela, the Blade-Blossom', 3, najeelaText),
  ]);
  const result = assessBracketCeilingV15(5, {
    ...hardPass,
    averageNonlandManaValue: 4.2,
    earlyPlayCount: 12,
    fastManaCount: 0,
    freeInteractionCount: 0,
    cheapInteractionCount: 2,
    tutorCount: 0,
    gameChangerCount: 0,
    efficientWinConditionEvidence: evidence.supported,
    cedhIntent: false,
    competitiveMetagameEvidence: false,
  });

  assert.equal(evidence.supported, true);
  assert.equal(result.assessedBracket, 3);
  assert.equal(result.bracket5CertifiedByThisAssessment, false);
});

test('the same proven commander win plan plus an optimized surrounding shell supports Bracket 4 but never substitutes for Bracket 5 evidence', () => {
  const evidence = deriveEfficientCommanderWinPlanV15(decklist, [
    card('Najeela, the Blade-Blossom', 3, najeelaText),
  ]);
  const result = assessBracketCeilingV15(5, {
    ...hardPass,
    spellbookTag: 'P',
    verifiedWinningCombos: 0,
    ruthlessWinningCombos: 0,
    strategicallyRelevantCombos: 0,
    averageNonlandManaValue: 2.55,
    earlyPlayCount: 42,
    fastManaCount: 4,
    freeInteractionCount: 2,
    cheapInteractionCount: 10,
    tutorCount: 6,
    gameChangerCount: 0,
    efficientWinConditionEvidence: evidence.supported,
    cedhIntent: false,
    competitiveMetagameEvidence: false,
  });

  assert.equal(result.assessedBracket, 4);
  assert.equal(result.bracket5CertifiedByThisAssessment, false);
  assert.ok(result.supportingSignals.some((signal) => /efficient non-combo win condition/i.test(signal)));
});
