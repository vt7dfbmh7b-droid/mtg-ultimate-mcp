import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import { expandResolvedDeckSlotsV15 } from './deck-slots-v15.js';
import { auditFullDeckV15 } from './full-deck-audit-v15.js';

function card(input: Partial<ScryfallCard> & Pick<ScryfallCard, 'name' | 'type_line' | 'set' | 'collector_number'>): ScryfallCard {
  return {
    id: `${input.set}-${input.collector_number}-${input.name}`,
    name: input.name,
    lang: 'en',
    cmc: input.cmc ?? 0,
    type_line: input.type_line,
    color_identity: input.color_identity ?? [],
    keywords: input.keywords ?? [],
    legalities: input.legalities ?? { commander: 'legal' },
    set: input.set,
    set_name: input.set_name ?? input.set,
    collector_number: input.collector_number,
    rarity: input.rarity ?? 'common',
    scryfall_uri: input.scryfall_uri ?? `https://scryfall.com/card/${input.set}/${input.collector_number}`,
    ...(input.oracle_text !== undefined ? { oracle_text: input.oracle_text } : {}),
    ...(input.produced_mana !== undefined ? { produced_mana: input.produced_mana } : {}),
  };
}

const commander = card({
  name: 'Counter Commander',
  type_line: 'Legendary Creature',
  set: 'tst',
  collector_number: '1',
  cmc: 3,
  color_identity: ['G', 'U', 'W'],
  oracle_text: 'Whenever you put one or more counters on a permanent, draw a card.',
});

const forest = card({
  name: 'Forest',
  type_line: 'Basic Land — Forest',
  set: 'tst',
  collector_number: '2',
  color_identity: ['G'],
  produced_mana: ['G'],
});

const tappedLand = card({
  name: 'Slow Garden',
  type_line: 'Land',
  set: 'tst',
  collector_number: '3',
  color_identity: ['G', 'U'],
  produced_mana: ['G', 'U'],
  oracle_text: 'Slow Garden enters tapped. {T}: Add {G} or {U}.',
});

test('full deck audit counts every repeated basic as a physical supported slot', () => {
  const parsed = parseDecklist(`
// COMMANDER
1 Counter Commander (TST) 1
// MAIN
7 Forest (TST) 2
`);
  const expanded = expandResolvedDeckSlotsV15(parsed, [commander, forest]);
  const audit = auditFullDeckV15(expanded.main, { commander });

  assert.equal(audit.physicalSlots, 7);
  assert.equal(audit.counts.supported, 7);
  assert.equal(audit.slots.every((slot) => slot.land?.basic === true), true);
  assert.equal(audit.slots.every((slot) => slot.status === 'supported'), true);
});

test('full deck audit pressures a nonbasic tapped land without deleting its mana-base purpose', () => {
  const parsed = parseDecklist(`
// COMMANDER
1 Counter Commander (TST) 1
// MAIN
1 Slow Garden (TST) 3
2 Forest (TST) 2
`);
  const expanded = expandResolvedDeckSlotsV15(parsed, [commander, tappedLand, forest]);
  const audit = auditFullDeckV15(expanded.main, { commander });
  const slow = audit.slots.find((slot) => slot.cardName === 'Slow Garden');

  assert.ok(slow);
  assert.equal(slow.status, 'review');
  assert.equal(slow.land?.entersTapped, true);
  assert.ok(slow.purposes.includes('mana-base slot'));
  assert.ok(slow.warnings.some((warning) => warning.includes('enters tapped')));
});
