import assert from 'node:assert/strict';
import { getCardsByIdentifiers, inferCardRoles } from '../src/services/scryfall.js';

const identifiers = [
  { name: "Conqueror's Flail", set: 'FIC', collectorNumber: '340' },
  { name: 'Silence', set: 'SLD', collectorNumber: '7003' },
  { name: 'Kinnan, Bonder Prodigy', set: 'FCA', collectorNumber: '55' },
  { name: 'Birds of Paradise', set: 'FIC', collectorNumber: '483' },
  { name: 'Buster Sword', set: 'FIN', collectorNumber: '255' },
];

const resolved = await getCardsByIdentifiers(identifiers);
assert.deepEqual(resolved.notFound, [], `A5 strategic-role fixtures must resolve: ${resolved.notFound.join(', ')}`);

const byName = new Map(resolved.cards.map((card) => [card.name, new Set(inferCardRoles(card))] as const));
const roles = (name: string) => {
  const found = byName.get(name);
  assert.ok(found, `${name} must resolve`);
  return found;
};

assert.ok(roles("Conqueror's Flail").has('stax/control'));
assert.ok(roles("Conqueror's Flail").has('combo protection'), 'Flail must retain proactive combo-protection truth');
assert.ok(roles('Silence').has('stax/control'));
assert.ok(roles('Silence').has('combo protection'), 'Silence must retain proactive spell-lock protection truth');
assert.ok(roles('Kinnan, Bonder Prodigy').has('mana acceleration'));
assert.ok(roles('Kinnan, Bonder Prodigy').has('mana multiplier'), 'Kinnan must be recognized as a nonland mana multiplier');
assert.ok(roles('Birds of Paradise').has('fast mana'));
assert.ok(roles('Birds of Paradise').has('early acceleration'), 'one-mana Birds must retain early acceleration truth');
assert.ok(roles('Buster Sword').has('repeatable draw'));
assert.ok(roles('Buster Sword').has('free-cast engine'), 'Buster Sword combat trigger must retain free-cast engine truth');
assert.ok(roles('Buster Sword').has('combat value engine'));

console.log(JSON.stringify({
  status: 'pass',
  roles: Object.fromEntries([...byName.entries()].map(([name, set]) => [name, [...set].sort()])),
}, null, 2));
