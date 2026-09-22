import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { buildSimulationBackedUpgradePlanV07 } from './deck-builder-v07.js';
import { parseDecklist } from './deck.js';
import { clearRetainedScryfallCardDataV15, installRetainedScryfallCardDataV15 } from './scryfall.js';

// Anonymous provider substitutes exercise the public planner. These are not deck-quality evidence.
function card(name: string, oracle: string, type: string, cmc: number): ScryfallCard {
  return {
    id: name, oracle_id: name, name, lang: 'en', set: 'tst', set_name: 'Production Control',
    collector_number: name.replace(/\W/g, ''), released_at: '2020-01-01',
    type_line: type, oracle_text: oracle, mana_cost: `{${cmc}}`, cmc,
    colors: [], color_identity: [], keywords: [], legalities: { commander: 'legal' },
    rarity: 'rare', prices: { usd: '1.00' }, finishes: ['nonfoil'], games: ['paper'],
    foil: false, nonfoil: true, promo: false, digital: false,
    scryfall_uri: 'https://scryfall.com', power: '2', toughness: '2',
  } as ScryfallCard;
}

test('public restricted planner discovers and retains a mechanism using modern Oracle self references', async () => {
  const commander = { ...card('Anonymous Leader', 'Whenever you gain life, draw a card.', 'Legendary Creature — Human', 3), color_identity: ['W'] };
  const land = { ...card('Plains', '({T}: Add {W}.)', 'Basic Land — Plains', 0), produced_mana: ['W'] };
  const outlet = card('Anonymous Outlet', 'This creature enters with two +1/+1 counters on it.\nRemove a +1/+1 counter from this creature: It deals 1 damage to any target.', 'Artifact Creature', 2);
  const support = card('Anonymous Support', '{W}, {T}: Another target creature you control gains lifelink until end of turn.\nWhenever you gain life, put a +1/+1 counter on target creature you control.', 'Creature — Cleric', 2);
  const filler = Array.from({ length: 59 }, (_, i) => card(`Expendable Body ${i}`, '', 'Creature', 6));
  const originals = [commander, land, outlet, ...filler];
  const parsed = parseDecklist(['// COMMANDER', `1 ${commander.name}`, '// MAIN', '39 Plains', `1 ${outlet.name}`, ...filler.map(c => `1 ${c.name}`)].join('\n'));
  assert.equal(parsed.totalCards, 100);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Unexpected live network request'); };
  installRetainedScryfallCardDataV15([...originals, support]);
  try {
    const options = { targetBracket: 3, maxSwaps: 1, allowedSets: ['tst'], simulationIterations: 100, seed: 17 };
    const plan = await buildSimulationBackedUpgradePlanV07(parsed, originals, ['W'], options);
    const swaps = plan.swaps as Array<{ in: string; out: string }>;
    assert.equal(swaps.length, 1);
    assert.equal(swaps[0]?.in, support.name);
    assert.notEqual(swaps[0]?.out, outlet.name);
    const nextParsed = parseDecklist(plan.upgradedDecklist as string);
    const nextCards = [...originals.filter(c => c.name !== swaps[0]?.out), support];
    const nextPlan = await buildSimulationBackedUpgradePlanV07(nextParsed, nextCards, ['W'], options);
    const pressure = nextPlan.v15TargetPressure as { protectedExistingOracleMechanismNames: string[] };
    assert.deepEqual(pressure.protectedExistingOracleMechanismNames, ['anonymous outlet', 'anonymous support']);
    assert.equal((nextPlan.swaps as Array<{ out: string }>).some(s => [outlet.name, support.name].includes(s.out)), false);
  } finally {
    clearRetainedScryfallCardDataV15();
    globalThis.fetch = originalFetch;
  }
});
