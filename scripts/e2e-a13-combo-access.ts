import assert from 'node:assert/strict';
import { auditComboTutorAccessV15, deterministicTutorAccessV15 } from '../src/services/combo-access-v15.js';
import { getCardsByNames } from '../src/services/scryfall.js';

const names = [
  'From Father to Son',
  'Sidequest: Raise a Chocobo',
  'Cloud, Midgar Mercenary',
  'Ranger-Captain of Eos',
  'Search for Dagger',
  'Walking Ballista',
  'Gatta and Luzzu',
  'Hardened Scales',
  'The Earth Crystal',
];
const resolved = await getCardsByNames(names);
assert.deepEqual(resolved.notFound, [], `A13 fixtures must resolve: ${resolved.notFound.join(', ')}`);
const byName = new Map(resolved.cards.map((card) => [card.name, card] as const));
const card = (name: string) => {
  const value = byName.get(name);
  assert.ok(value, `missing fixture ${name}`);
  return value;
};
const tutors = ['From Father to Son', 'Sidequest: Raise a Chocobo', 'Cloud, Midgar Mercenary', 'Ranger-Captain of Eos', 'Search for Dagger'].map(card);
const pieces = ['Walking Ballista', 'Gatta and Luzzu', 'Hardened Scales', 'The Earth Crystal'].map(card);

assert.equal(deterministicTutorAccessV15(card('Ranger-Captain of Eos'), card('Walking Ballista')).deterministic, true, 'Ranger-Captain must find Walking Ballista because X has mana value 0 in the library');
for (const narrow of ['From Father to Son', 'Cloud, Midgar Mercenary', 'Sidequest: Raise a Chocobo']) {
  for (const piece of pieces) assert.equal(deterministicTutorAccessV15(card(narrow), piece).deterministic, false, `${narrow} must not inflate deterministic combo access`);
}
for (const piece of pieces) assert.equal(deterministicTutorAccessV15(card('Search for Dagger'), piece).deterministic, false, 'top-six selection is not deterministic library-search access');

const audit = auditComboTutorAccessV15(tutors, pieces) as Record<string, unknown>;
assert.equal(audit.deterministicComboTutorCount, 1, 'current Counter Blitz access package should have one deterministic combo tutor among these fixtures');
assert.deepEqual(audit.deterministicComboTutors, ['Ranger-Captain of Eos']);
console.log(JSON.stringify({ status: 'pass', audit }, null, 2));
