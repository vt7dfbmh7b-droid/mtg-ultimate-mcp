import assert from 'node:assert/strict';
import { deriveCommanderStrategyContextFromCommandersV15, cardCommanderStrategyAffinityV15 } from '../src/services/commander-strategy-affinity-v15.js';
import { inferNeutralStrategyV15 } from '../src/services/neutral-commander-selection-v15.js';
import { getCardsByNames, inferCardRoles } from '../src/services/scryfall.js';

const names = ['Tidus, Yuna\'s Guardian', 'Rikku, Resourceful Guardian', 'Key to the City', 'Yuna, Grand Summoner'];
const resolved = await getCardsByNames(names);
assert.deepEqual(resolved.notFound, [], `actual-card semantic fixtures must resolve: ${resolved.notFound.join(', ')}`);
const byName = new Map(resolved.cards.map((card) => [card.name, card] as const));
const tidus = byName.get("Tidus, Yuna's Guardian");
const rikku = byName.get('Rikku, Resourceful Guardian');
const key = byName.get('Key to the City');
const yuna = byName.get('Yuna, Grand Summoner');
assert.ok(tidus && rikku && key && yuna, 'all A9 fixtures must resolve');

const rikkuRoles = new Set(inferCardRoles(rikku));
assert.ok(rikkuRoles.has('counter payoff'), 'Rikku must be recognized as a generic counter-placement payoff');
assert.ok(rikkuRoles.has('combat access'), 'Rikku must be recognized as a combat-access/evasion engine');

const keyRoles = new Set(inferCardRoles(key));
assert.ok(keyRoles.has('combat access'), 'Key to the City must be recognized as combat access');
assert.equal(keyRoles.has('counter payoff'), false, 'generic unblockable text must not impersonate a counter payoff');

const rikkuCounters = inferNeutralStrategyV15([rikku]).find((item) => item.archetype === 'counters');
assert.ok(rikkuCounters && rikkuCounters.score >= 7, 'Rikku must provide substantive counters-strategy evidence');

const tidusContext = deriveCommanderStrategyContextFromCommandersV15([tidus]);
const affinity = cardCommanderStrategyAffinityV15(rikku, tidusContext);
assert.ok(affinity.matches.some((match) => match.archetype === 'counters' && match.overlapScore > 0), 'Rikku must bridge to Tidus counter identity');

const yunaRoles = new Set(inferCardRoles(yuna));
assert.ok(yunaRoles.has('+1/+1 counters'), 'Yuna counter identity must remain recognized');

console.log(JSON.stringify({
  status: 'pass',
  rikkuRoles: [...rikkuRoles].sort(),
  keyRoles: [...keyRoles].sort(),
  rikkuCounters,
  tidusStrategies: tidusContext.strategies,
  rikkuTidusAffinity: affinity,
  yunaRoles: [...yunaRoles].sort(),
}, null, 2));
