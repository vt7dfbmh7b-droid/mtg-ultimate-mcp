import assert from 'node:assert/strict';
import { getCardsByIdentifiers, inferCardRoles } from '../src/services/scryfall.js';

const identifiers = [
  { name: "Conqueror's Flail", set: 'FIC', collectorNumber: '340' },
  { name: 'Silence', set: 'SLD', collectorNumber: '7003' },
  { name: 'Ranger-Captain of Eos', set: 'FCA', collectorNumber: '2' },
  { name: 'Kinnan, Bonder Prodigy', set: 'FCA', collectorNumber: '55' },
  { name: 'Birds of Paradise', set: 'FIC', collectorNumber: '483' },
  { name: 'Buster Sword', set: 'FIN', collectorNumber: '255' },
];

const resolved = await getCardsByIdentifiers(identifiers);
assert.deepEqual(resolved.notFound, [], `A5 v3 strategic-role fixtures must resolve: ${resolved.notFound.join(', ')}`);
const byName = new Map(resolved.cards.map((card) => [card.name, new Set(inferCardRoles(card))] as const));
const roles = (name: string) => {
  const found = byName.get(name);
  assert.ok(found, `${name} must resolve`);
  return found;
};

for (const name of ["Conqueror's Flail", 'Silence', 'Ranger-Captain of Eos']) {
  assert.ok(roles(name).has('stax/control'), `${name} must be recognized as stax/control`);
  assert.ok(roles(name).has('combo protection'), `${name} must be recognized as proactive combo protection`);
}
assert.ok(roles('Ranger-Captain of Eos').has('tutor'), 'Ranger-Captain must retain its tutor role');
assert.ok(roles('Ranger-Captain of Eos').has('creature tutor'), 'Ranger-Captain must retain creature tutor role');
assert.ok(roles('Kinnan, Bonder Prodigy').has('mana multiplier'));
assert.ok(roles('Birds of Paradise').has('early acceleration'));
assert.ok(roles('Buster Sword').has('free-cast engine'));
assert.ok(roles('Buster Sword').has('combat value engine'));

console.log(JSON.stringify({
  status: 'pass',
  roles: Object.fromEntries([...byName.entries()].map(([name, set]) => [name, [...set].sort()])),
}, null, 2));
