import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { refineCommanderDeckIterativelyV12 } from './optimizer-v12.js';
import { installRetainedScryfallCardDataV15, clearRetainedScryfallCardDataV15 } from './scryfall.js';

function card(name: string, oracle: string, type = 'Creature', cmc = 2): ScryfallCard {
  return {
    id: name, oracle_id: name, name, lang: 'en', set: 'tst', set_name: 'Anonymous Progress',
    collector_number: name.replace(/\W/g, ''), released_at: '2020-01-01',
    type_line: type, oracle_text: oracle, mana_cost: `{${cmc}}`, cmc,
    colors: [], color_identity: [], keywords: [], legalities: { commander: 'legal' },
    rarity: 'rare', prices: { usd: '1.00' }, finishes: ['nonfoil'], games: ['paper'],
    foil: false, nonfoil: true, promo: false, digital: false,
    scryfall_uri: 'https://scryfall.com', power: '2', toughness: '2',
  } as ScryfallCard;
}

test('public refinement accepts deficient component progress when aggregate theme coverage is unchanged', async () => {
  const commander = { ...card('Anonymous Leader', 'Whenever you put a counter on a permanent you control, draw a card.', 'Legendary Creature'), color_identity: ['U'] };
  const land = { ...card('Island', '({T}: Add {U}.)', 'Basic Land — Island', 0), produced_mana: ['U'] };
  const outgoing = card('Anonymous Surplus Counter Body', 'This creature enters with a +1/+1 counter on it.');
  const incoming = card('Anonymous Stack Response', 'Counter target spell. Draw a card.', 'Instant');
  const counters = Array.from({length: 19}, (_, i) => card(`Counter Body ${i}`, 'This creature enters with a +1/+1 counter on it.'));
  const interaction = Array.from({length: 18}, (_, i) => card(`Interaction ${i}`, i < 4 ? 'Counter target spell.' : 'Destroy target artifact.', 'Instant'));
  const ramp = Array.from({length: 14}, (_, i) => card(`Mana Body ${i}`, '{T}: Add {U}.'));
  const draw = Array.from({length: 15}, (_, i) => card(`Draw Body ${i}`, 'When this creature enters, draw a card.'));
  const main = [outgoing, ...counters, ...interaction, ...ramp, ...draw];
  assert.equal(main.length, 67);
  const deck = ['// COMMANDER', `1 ${commander.name}`, '// MAIN', '32 Island', ...main.map(c => `1 ${c.name}`)].join('\n');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    assert.ok(url.hostname.includes('commanderspellbook'), `Unexpected live provider ${url}`);
    return Response.json({ count: 0, results: [], next: null });
  };
  installRetainedScryfallCardDataV15([commander, land, ...main, incoming]);
  try {
    const result = await refineCommanderDeckIterativelyV12(deck, {
      targetBracket: 5, maxRounds: 1, maxSwaps: 1, swapsPerRound: 1,
      candidatePackagesPerRound: 1, simulationIterations: 2000, seed: 17,
      allowedSets: ['tst'], themeQuery: '+1/+1 counters countermagic',
      protectedCards: main.filter(c => c !== outgoing).map(c => c.name),
      detailLevel: 'detailed',
    });
    const rounds = result.detailedRounds as Array<{
      themeAuditBefore: { matchedMainCards: number };
      candidateComparisons: Array<{ zeroTargetProgressWhileFailedGatesRemain: boolean; themeAudit: { matchedMainCards: number } }>;
    }>;
    assert.equal(result.totalSwaps, 1, JSON.stringify(rounds?.[0]?.candidateComparisons));
    const comparison = rounds[0]?.candidateComparisons[0];
    assert.equal(comparison?.zeroTargetProgressWhileFailedGatesRemain, true,
      'acceptance must come from requested-component progress, not incidental bracket progress');
    assert.equal(comparison?.themeAudit.matchedMainCards, rounds[0]?.themeAuditBefore.matchedMainCards,
      'rebalancing one theme card into another does not increase aggregate coverage');
    assert.match(result.finalDecklist as string, /Anonymous Stack Response/);
    assert.doesNotMatch(result.finalDecklist as string, /Anonymous Surplus Counter Body/);
  } finally {
    clearRetainedScryfallCardDataV15();
    globalThis.fetch = originalFetch;
  }
});
