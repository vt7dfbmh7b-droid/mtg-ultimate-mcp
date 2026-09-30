import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { hasTargetedSpellCounterV15, landSearchRecognitionV15 } from './oracle-recognition-v15.js';
import { effectiveCardRolesV15, interactionRoleTruthV15 } from './card-role-truth-v15.js';
import { effectiveDeckRoleCountsV15 } from './deck-role-metrics-v15.js';
import { parseDecklist } from './deck.js';
import { analyzeManaBaseV04 } from './mana-v04.js';
import { buildSimulationBackedUpgradePlanV07 } from './deck-builder-v07.js';
import { installRetainedScryfallCardDataV15, clearRetainedScryfallCardDataV15 } from './scryfall.js';

function card(name: string, oracle: string, cmc = 2, type = 'Sorcery', extra: Partial<ScryfallCard> = {}): ScryfallCard {
  return { id: name, oracle_id: name, name, lang: 'en', set: 'tst', set_name: 'Anonymous Recognition',
    collector_number: name.replace(/\W/g, ''), released_at: '2026-01-01', type_line: type,
    oracle_text: oracle, mana_cost: `{${cmc}}`, cmc, colors: [], color_identity: [], keywords: [],
    legalities: { commander: 'legal' }, rarity: 'uncommon', prices: { usd: '1.00' },
    finishes: ['nonfoil'], foil: false, nonfoil: true, promo: false, digital: false,
    full_art: false, scryfall_uri: 'https://scryfall.com', ...extra } as ScryfallCard;
}

test('qualified spell counters share direct interaction and metric truth without counter-word false positives', () => {
  for (const oracle of ['Counter target spell.', 'Counter target noncreature spell.', 'Counter target creature spell.',
    'Counter target artifact or enchantment spell.', 'Counter target spell unless its controller pays {3}.']) {
    const c = card('Anonymous Denial', oracle, 2, 'Instant');
    assert.equal(hasTargetedSpellCounterV15(oracle), true, oracle);
    assert.ok(effectiveCardRolesV15(c).includes('countermagic'), oracle);
    assert.equal(interactionRoleTruthV15(c).genericDirectInteraction, true, oracle);
    assert.equal(effectiveDeckRoleCountsV15(parseDecklist(`1 ${c.name}`), [c]).countermagic, 1);
  }
  for (const oracle of ['Counter target activated ability.', 'Counter target triggered ability.',
    'Put a +1/+1 counter on target creature.', 'This spell cannot be countered.',
    'Whenever you counter a spell, draw a card.', 'Choose target creature. Counter the next spell.']) {
    assert.equal(hasTargetedSpellCounterV15(oracle), false, oracle);
    assert.ok(!effectiveCardRolesV15(card('Anonymous Control', oracle)).includes('countermagic'), oracle);
  }
});

test('land-type search associates its destination and preserves replacement truth', () => {
  for (const target of ['a land card', 'a basic land card', 'a Forest card', 'a Plains, Island, Swamp, or Mountain card']) {
    const c = card('Anonymous Search', `Search your library for ${target}, put it onto the battlefield tapped, then shuffle.`);
    assert.ok(effectiveCardRolesV15(c).includes('land ramp'), target);
    assert.ok(effectiveCardRolesV15(c).includes('land tutor'), target);
    if (target !== 'a land card') assert.ok(!effectiveCardRolesV15(c).includes('tutor'), target);
  }
  for (const oracle of ['Search your library for a Forest card, reveal it, put it into your hand, then shuffle.',
    'Search your library for a Forest card, put it into your hand. Put a creature onto the battlefield.',
    'Search your library for a creature card, put it onto the battlefield. You may play an additional land.']) {
    assert.equal(landSearchRecognitionV15(oracle).putsSearchedLandOntoBattlefield, false, oracle);
    assert.ok(!effectiveCardRolesV15(card('Anonymous Hand Search', oracle)).includes('land ramp'), oracle);
  }
  const replacement = card('Anonymous Replacement', 'As an additional cost to cast this spell, sacrifice a land. Search your library for a Forest card, put it onto the battlefield, then shuffle.');
  assert.ok(effectiveCardRolesV15(replacement).includes('land replacement'));
  assert.ok(!effectiveCardRolesV15(replacement).includes('land ramp'));
  assert.ok(!effectiveCardRolesV15(replacement).includes('persistent colored mana source'));
});

test('a land-type search does not invent missing commander-color mana access', () => {
  const search = card('Anonymous Forest Search', 'Search your library for a Forest card, put it onto the battlefield, then shuffle.');
  const parsed = parseDecklist('// COMMANDER\n1 Anonymous Role Auditor\n// MAIN\n39 Forest\n1 Anonymous Forest Search');
  const result = analyzeManaBaseV04(parsed, [commander, land, search]);
  const counts = result.colorSourceCounts as Record<string, number>;
  assert.equal(counts.U, 0, 'Forest-search recognition must not manufacture blue sources');
  assert.equal(counts.G, 39, 'the search spell is not itself a mana-producing land');
});

test('multi-sentence land searches retain their searched object without crossing destination or ability boundaries', () => {
  for (const oracle of [
    'Search your library for a Forest card and reveal it. Put that card onto the battlefield tapped, then shuffle.',
    'Search your library for up to X basic land cards, where X is the greatest power among creatures you control. Put those cards onto the battlefield tapped, then shuffle.',
    '{T}, Remove a counter from a permanent you control: Search your library for a Plains card and reveal it. If an opponent controls more lands than you, you may put that card onto the battlefield tapped. If you do not, put that card into your hand. Then shuffle.',
    'Search your library for a creature or land card and reveal it. Put it onto the battlefield tapped if it is a land card. Otherwise, put it into your hand. Then shuffle.',
  ]) {
    assert.equal(landSearchRecognitionV15(oracle).putsSearchedLandOntoBattlefield, true, oracle);
  }
  for (const oracle of [
    'Search your library for a Forest card, put it into your hand. Put it onto the battlefield.',
    'Search your library for a Forest card and reveal it. Then shuffle. Put target creature onto the battlefield.',
    'Search your library for a Forest card and reveal it.\nWhen this creature dies, put it onto the battlefield.',
    'Search your library for a Forest card and reveal it. When this creature dies, put it onto the battlefield.',
    'Search your library for a Forest card and reveal it. Exile target creature, then put it onto the battlefield.',
    'Search your library for a Forest card, exile it. Put it onto the battlefield at the beginning of your next upkeep.',
  ]) assert.equal(landSearchRecognitionV15(oracle).putsSearchedLandOntoBattlefield, false, oracle);
});

const commander = card('Anonymous Role Auditor', '', 3, 'Legendary Creature — Wizard', { color_identity: ['U', 'G'], power: '2', toughness: '3' });
const land = card('Forest', '({T}: Add {G}.)', 0, 'Basic Land — Forest', { produced_mana: ['G'] });
const repeated = (n: number, label: string, oracle: string, type = 'Sorcery', extra: Partial<ScryfallCard> = {}) =>
  Array.from({ length: n }, (_, i) => card(`${label} ${i}`, oracle, 2, type, extra));

for (const [label, oracle, role, eligible] of [
  ['Denial', 'Counter target noncreature spell.', 'countermagic', true],
  ['Subtype Search', 'Search your library for a Forest card, put it onto the battlefield, then shuffle.', 'land ramp', true],
  ['Multi Sentence Search', 'Search your library for a Forest card and reveal it. Put that card onto the battlefield tapped, then shuffle.', 'land ramp', true],
  ['Counter Placement', 'Put a +1/+1 counter on target creature.', 'countermagic', false],
  ['Uncounterability', 'This spell cannot be countered.', 'countermagic', false],
  ['Hand Search', 'Search your library for a Forest card, put it into your hand, then shuffle.', 'land ramp', false],
] as const) {
  test(`public planner classifies anonymous ${label} through query-aware retained provider`, async () => {
    const desired = card(`Anonymous ${label}`, oracle, 2, role === 'countermagic' ? 'Instant' : 'Sorcery');
    const support = [
      ...repeated(10, 'Draw', 'Draw two cards.'),
      ...repeated(3, 'Tutor', 'Search your library for a card, put that card into your hand, then shuffle.'),
      ...repeated(4, 'Protection', 'Permanents you control gain hexproof until end of turn.', 'Instant'),
      ...repeated(3, 'Recursion', 'Return target creature card from your graveyard to your hand.'),
      ...repeated(2, 'Wipe', 'Destroy all creatures.'),
      ...repeated(role === 'countermagic' ? 10 : 9, 'Mana', '{T}: Add {G}.', 'Artifact', { produced_mana: ['G'] }),
      ...repeated(role === 'countermagic' ? 7 : 10, 'Interaction', 'Counter target spell.', 'Instant'),
    ];
    const incumbent = card(`Anonymous Incumbent ${label}`, eligible ? oracle : role === 'countermagic'
      ? 'Counter target noncreature spell.'
      : 'Search your library for a Forest card, put it onto the battlefield, then shuffle.', 2, desired.type_line);
    const replaced = support.findIndex(c => c.name.startsWith(role === 'countermagic' ? 'Interaction ' : 'Mana '));
    support[replaced] = incumbent;
    const filler = Array.from({ length: 60 - support.length }, (_, i) => card(`Anonymous Filler ${i}`, 'You gain 1 life.', 5));
    const baseline = [commander, land, ...support, ...filler];
    const parsed = parseDecklist(['// COMMANDER', `1 ${commander.name}`, '// MAIN', '39 Forest', ...support.map(c => `1 ${c.name}`), ...filler.map(c => `1 ${c.name}`)].join('\n'));
    installRetainedScryfallCardDataV15([...baseline, desired]);
    try {
      const plan = await buildSimulationBackedUpgradePlanV07(parsed, baseline, ['U', 'G'], {
        targetBracket: 3, maxSwaps: 1, maxUsdPerCard: 5, simulationIterations: 100,
        excludedCards: support.map(c => c.name),
      });
      const swaps = plan.swaps as Array<{ in: string; out: string; why: string; structuralPairing: { addressedRole: string } }>;
      if (!eligible) {
        assert.deepEqual(swaps, [], 'word overlap does not fill a missing structural role');
        return;
      }
      assert.equal(swaps.length, 1);
      assert.equal(swaps[0]?.in, desired.name);
      assert.ok(filler.some(c => c.name === swaps[0]?.out), 'cut surplus, not structural support');
      assert.notEqual(swaps[0]?.out, incumbent.name, 'incumbent wording receives the same structural loss accounting');
      assert.equal(swaps[0]?.structuralPairing.addressedRole, role === 'countermagic' ? 'interaction' : 'ramp');
      assert.match(swaps[0]?.why ?? '', role === 'countermagic' ? /interaction/i : /ramp/i);
      const before = plan.beforeMetrics as { roleCounts: Record<string, number> };
      const after = plan.afterMetrics as { roleCounts: Record<string, number> };
      assert.equal(before.roleCounts[role], role === 'countermagic' ? 7 : 1);
      assert.equal(after.roleCounts[role], (before.roleCounts[role] ?? 0) + 1);
      assert.equal((plan.upgradedCommanderRules as { isLegal: boolean }).isLegal, true);
    } finally { clearRetainedScryfallCardDataV15(); }
  });
}
