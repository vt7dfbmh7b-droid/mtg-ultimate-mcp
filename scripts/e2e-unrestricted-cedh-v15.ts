import assert from 'node:assert/strict';
import { buildCommanderForCedhV14, assessCedhReadinessV14 } from '../src/services/cedh-workflow-v14.js';
import { countWinningCombosV14 } from '../src/services/cedh-win-package-v14.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';
import { findDeckCombos } from '../src/services/spellbook.js';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function identifiers(parsed: ParsedDeck): CardIdentifierInput[] {
  return [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
}

async function main(): Promise<void> {
  console.log('UNRESTRICTED cEDH CONTROL: building Kinnan from scratch with no theme or price ceiling...');
  const result = await buildCommanderForCedhV14(['Kinnan, Bonder Prodigy'], {
    maxMissingCards: 3,
    maxCandidatesToVerify: 12,
    maxEfficiencySwaps: 2,
    maxManaBaseSwaps: 3,
    requireVerifiedCombo: true,
    landCount: 30,
  });

  console.log(`BUILD STATUS: ${String(result.status)}`);
  console.log(`SEED: ${JSON.stringify(result.seedDiscovery ?? {}, null, 2)}`);
  console.log(`DRAFT: ${JSON.stringify(result.draft ?? {}, null, 2)}`);
  console.log(`REFINEMENT STATUS: ${String(record(result.refinement).status ?? 'missing')}`);
  console.log(`FINAL ASSESSMENT: ${JSON.stringify(record(record(result.refinement).finalAssessment), null, 2)}`);

  const seed = record(result.seedDiscovery);
  assert.equal(seed.status, 'eligible-winning-seed-package-found', 'unrestricted control must find a real legal Ruthless winning seed');
  assert.equal(seed.bracketTag, 'R');
  const seedNames = Array.isArray(seed.seedNames) ? seed.seedNames.map(String) : [];
  assert.ok(seedNames.length >= 1);
  assert.equal(seedNames.some((name) => name.toLocaleLowerCase() === 'leveler'), false, 'practical cEDH seed ranking must not fall back to the clunky Leveler line for Kinnan');

  assert.equal(typeof result.finalDecklist, 'string', 'from-scratch cEDH workflow must return a complete final decklist');
  const finalDecklist = String(result.finalDecklist);
  const parsed = parseDecklist(finalDecklist);
  assert.equal(parsed.totalCards, 100, 'unrestricted cEDH control must finish at exactly 100 cards');
  assert.equal(parsed.commanders.length, 1);
  assert.equal(parsed.commanders[0]?.name, 'Kinnan, Bonder Prodigy');

  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  assert.deepEqual(resolved.notFound, [], 'every exact final card/printing identifier must resolve');
  const legality = validateCommanderDeck(parsed, resolved.cards);
  assert.equal(legality.isLegal, true, 'final unrestricted control must be Commander legal');

  const combos = await findDeckCombos(finalDecklist, 100);
  const winningCombos = countWinningCombosV14(combos);
  assert.ok(winningCombos >= 1, 'finished deck must independently reproduce at least one deterministic winning Commander Spellbook combo');

  const independentAssessment = await assessCedhReadinessV14(finalDecklist, {});
  console.log(`INDEPENDENT ASSESSMENT: ${JSON.stringify(independentAssessment, null, 2)}`);
  const signals = record(independentAssessment.constructionSignals);
  assert.equal(signals.verifiedWinningCombo, true, 'independent readiness assessment must see the verified win line');
  assert.equal(signals.lowAverageNonlandManaValue, true, 'unrestricted cEDH control should build a genuinely low curve');
  assert.equal(signals.freeInteractionPresent, true, 'unrestricted cEDH control should include free interaction rather than only a combo');
  assert.equal(signals.fastManaPresent, true, 'unrestricted cEDH control should include fast mana');
  assert.equal(independentAssessment.status, 'strong-competitive-construction-signals', 'with no artificial restrictions, the builder must satisfy its own strong cEDH construction gate');
  assert.equal(result.status, 'built-with-strong-competitive-signals', 'top-level from-scratch cEDH workflow must only pass when the independent final assessment is strong');

  console.log(`FINAL: 100 cards, legal, ${winningCombos} verified winning combo(s), strong competitive construction signals.`);
  console.log('UNRESTRICTED cEDH CONTROL: PASS');
}

main().catch((error) => {
  console.error('UNRESTRICTED cEDH CONTROL: FAIL');
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
