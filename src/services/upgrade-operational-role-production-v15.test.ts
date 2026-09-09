import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import { buildSimulationBackedUpgradePlanV07 } from './deck-builder-v07.js';
import { effectiveCardRolesV15, tutorRoleTruthV15 } from './card-role-truth-v15.js';

function card(name: string, oracle: string, cmc: number, type = 'Artifact', extra: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    id: name, oracle_id: name, name, lang: 'en', set: 'tst', set_name: 'Operational Role Test',
    collector_number: name.replace(/\W/g, ''), released_at: '2026-01-01', type_line: type,
    oracle_text: oracle, mana_cost: `{${cmc}}`, cmc, colors: [], color_identity: [], keywords: [],
    legalities: { commander: 'legal' }, rarity: 'rare', prices: { usd: '1.00' }, finishes: ['nonfoil'],
    foil: false, nonfoil: true, promo: false, digital: false, full_art: false,
    scryfall_uri: 'https://scryfall.com', ...extra,
  } as ScryfallCard;
}

const commander = card('Anonymous Archive Keeper', 'Whenever you draw your second card each turn, put a +1/+1 counter on this creature.', 3, 'Legendary Creature — Wizard', { color_identity: ['U'], power: '2', toughness: '3' });
const land = card('Island', '({T}: Add {U}.)', 0, 'Basic Land — Island', { produced_mana: ['U'] });
const engine = card('Anonymous Persistent Study', 'At the beginning of your upkeep, draw two cards.', 7, 'Enchantment');
const filler = Array.from({ length: 59 }, (_, i) => card(`Anonymous Surplus Body ${i}`, '', 4, 'Creature — Wizard', { power: '3', toughness: '3' }));
const baseline = [commander, land, engine, ...filler];
const parsed = parseDecklist(['// COMMANDER', `1 ${commander.name}`, '// MAIN', '39 Island', `1 ${engine.name}`, ...filler.map(c => `1 ${c.name}`)].join('\n'));
const consumableDraw = card('Anonymous Consumable Study', '{1}, Sacrifice this artifact: Draw a card.', 1);
const counterTutor = card('Anonymous Accumulation Device', '{T}: Put a charge counter on this artifact.\n{T}, Remove one hundred charge counters from this artifact: Search your library for an artifact card, put it onto the battlefield, then shuffle.', 3);
const loyaltyTutor = card('Anonymous Ultimate Searcher', '+1: You gain 1 life.\n−8: Search your library for an artifact card, put it onto the battlefield, then shuffle.', 4, 'Legendary Planeswalker — Tester', { loyalty: '4' });
const directTutor = card('Anonymous Immediate Search', 'Search your library for an artifact card, reveal it, put it into your hand, then shuffle.', 2, 'Sorcery');
const candidates = [consumableDraw, counterTutor, loyaltyTutor, directTutor];
const tutorSupport = [
  ...Array.from({ length: 10 }, (_, i) => card(`Anonymous Mana Support ${i}`, '{T}: Add {U}.', 2, 'Artifact', { produced_mana: ['U'] })),
  ...Array.from({ length: 10 }, (_, i) => card(`Anonymous Draw Support ${i}`, 'Draw two cards.', 2, 'Sorcery')),
  ...Array.from({ length: 10 }, (_, i) => card(`Anonymous Answer ${i}`, 'Counter target spell.', 2, 'Instant')),
  ...Array.from({ length: 4 }, (_, i) => card(`Anonymous Shield ${i}`, 'Permanents you control gain hexproof until end of turn.', 2, 'Instant')),
  ...Array.from({ length: 2 }, (_, i) => card(`Anonymous Reset ${i}`, 'Destroy all creatures.', 4, 'Sorcery')),
];
const tutorBaseline = [commander, land, engine, ...tutorSupport, ...filler.slice(0, 23)];
const tutorParsed = parseDecklist(['// COMMANDER', `1 ${commander.name}`, '// MAIN', '39 Island', `1 ${engine.name}`, ...tutorSupport.map(c => `1 ${c.name}`), ...filler.slice(0, 23).map(c => `1 ${c.name}`)].join('\n'));
const all = [...baseline, ...tutorSupport, ...candidates];

async function planWith(allowed: ScryfallCard[], tutorFocused = false) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    let data: ScryfallCard[];
    if (url.pathname.endsWith('/cards/collection')) {
      const identifiers = JSON.parse(String(init?.body)).identifiers as Array<{ name?: string; set?: string; collector_number?: string }>;
      data = identifiers.flatMap(id => all.filter(c => id.name ? c.name === id.name : c.set === id.set && c.collector_number === id.collector_number));
    } else if (url.pathname.endsWith('/cards/search')) {
      const query = url.searchParams.get('q') ?? '';
      const name = /^!"([^"]+)"$/.exec(query)?.[1];
      data = name ? all.filter(c => c.name === name) : candidates;
    } else throw new Error(`Unexpected provider request: ${url.pathname}`);
    return Response.json({ object: 'list', data, has_more: false, not_found: [] });
  };
  try {
    return await buildSimulationBackedUpgradePlanV07(tutorFocused ? tutorParsed : parsed, tutorFocused ? tutorBaseline : baseline, ['U'], {
      targetBracket: 3, maxSwaps: 1, maxUsdPerCard: 5, simulationIterations: 100,
      excludedCards: candidates.filter(c => !allowed.includes(c)).map(c => c.name),
    });
  } finally { globalThis.fetch = original; }
}

test('public production planner keeps a recurring draw engine when adding a consumable draw effect', async () => {
  const plan = await planWith([consumableDraw]);
  const swaps = plan.swaps as Array<{ in: string; out: string }>;
  assert.equal(swaps.length, 1, 'ordinary surplus still permits a useful swap');
  assert.equal(swaps[0]?.in, consumableDraw.name);
  assert.notEqual(swaps[0]?.out, engine.name, 'one use must not compensate for a recurring engine');
  assert.equal((plan.upgradedCommanderRules as { isLegal: boolean }).isLegal, true);
});

test('public production planner does not fill tutor deficits with unsupported counter or loyalty accumulation', async () => {
  const plan = await planWith([counterTutor, loyaltyTutor], true);
  assert.deepEqual(plan.swaps, [], 'an unready ultimate is not available tutor access');
});

test('public production planner still finds immediate tutor access and a safe surplus cut', async () => {
  const plan = await planWith([directTutor, counterTutor, loyaltyTutor], true);
  const swaps = plan.swaps as Array<{ in: string; out: string }>;
  assert.equal(swaps.length, 1);
  assert.equal(swaps[0]?.in, directTutor.name);
  assert.notEqual(swaps[0]?.out, engine.name);
  assert.equal((plan.upgradedCommanderRules as { isLegal: boolean }).isLegal, true);
});

test('operational role truth distinguishes consumable draw from repeatable draw without losing the card draw role', () => {
  assert.ok(effectiveCardRolesV15(consumableDraw).includes('card draw'));
  assert.ok(!effectiveCardRolesV15(consumableDraw).includes('repeatable draw'));
  assert.ok(effectiveCardRolesV15(engine).includes('repeatable draw'));
});

test('a separate repeatable draw ability survives a consumable mode, while reminder text and another mode cannot provide repeatability', () => {
  const mixed = card('Anonymous Dual Study', '{2}, {T}: Draw a card.\nSacrifice Anonymous Dual Study: Draw two cards.', 3);
  const consumable = card('Anonymous Named Study', '{T}: Add {C}.\n{1}, Sacrifice Anonymous Named Study: Draw a card.', 1);
  const reminder = card('Anonymous Investigating Body', 'When this creature enters, investigate. (Create a Clue token with "{2}, Sacrifice this artifact: Draw a card.")', 2, 'Creature — Wizard');
  assert.ok(effectiveCardRolesV15(mixed).includes('repeatable draw'));
  assert.ok(!effectiveCardRolesV15(consumable).includes('repeatable draw'));
  assert.ok(!effectiveCardRolesV15(reminder).includes('repeatable draw'));
  const resourceOutlet = card('Anonymous Resource Outlet', 'Sacrifice another artifact: Draw a card.', 2);
  assert.ok(effectiveCardRolesV15(resourceOutlet).includes('repeatable draw'));
});

test('counter and loyalty tutor access distinguish accumulation from resources present on entry and independent search modes', () => {
  for (const delayed of [counterTutor, loyaltyTutor]) {
    assert.equal(tutorRoleTruthV15(delayed).setupGated, true);
    assert.ok(effectiveCardRolesV15(delayed).includes('conditional tutor'));
    assert.ok(!effectiveCardRolesV15(delayed).includes('tutor'));
  }
  const prepaid = card('Anonymous Prepaid Search', 'This artifact enters with three charge counters on it.\n{T}, Remove one charge counter from this artifact: Search your library for an artifact card, put it into your hand, then shuffle.', 2);
  const affordableLoyalty = { ...loyaltyTutor, name: 'Anonymous Immediate Loyalty Search', loyalty: '8' };
  const independentMode = { ...loyaltyTutor, name: 'Anonymous Modal Search', oracle_text: `${loyaltyTutor.oracle_text}\nWhen this planeswalker enters, search your library for an artifact card, put it into your hand, then shuffle.` };
  for (const available of [prepaid, affordableLoyalty, independentMode, directTutor]) {
    assert.equal(tutorRoleTruthV15(available).reliableStructuralTutor, true, available.name);
  }
});
