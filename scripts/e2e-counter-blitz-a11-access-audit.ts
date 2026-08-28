import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { cardCommanderStrategyAffinityV15, deriveUpgradeStrategyContextV15, substantiveCommanderStrategyAffinityScoreV15 } from '../src/services/commander-strategy-affinity-v15.js';
import { parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { discoverEligiblePoolV15 } from '../src/services/neutral-deck-builder-v15.js';
import { resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, getCardOracleText, inferCardRoles, type CardIdentifierInput } from '../src/services/scryfall.js';

function norm(v: string): string { return v.trim().toLocaleLowerCase(); }
function extractA2(markdown: string): string {
  const m = markdown.match(/## Final corrected decklist[\s\S]*?```text\n([\s\S]*?)\n```/);
  assert.ok(m?.[1], 'could not extract A2 deck');
  return m[1].trim().replace('1 Archmage Emeritus (FIC) 261', '1 The Earth Crystal (FIN) 184');
}
function ids(parsed: ParsedDeck): CardIdentifierInput[] {
  return [...parsed.commanders, ...parsed.main].map((e) => ({ name: e.name, ...(e.set ? { set: e.set } : {}), ...(e.collectorNumber ? { collectorNumber: e.collectorNumber } : {}) }));
}
async function resolveDeck(decklist: string) {
  const parsed = parseDecklist(decklist);
  const r = await getCardsByIdentifiers(ids(parsed));
  return { parsed, cards: r.cards, notFound: r.notFound };
}
function replaceShurikenWithDruid(decklist: string): string {
  return decklist.replace('1 Conformer Shuriken (FIC) 98', '1 Incubation Druid (FIC) 309');
}

const source = await readFile('test-results/exploratory/counter-blitz-ff-tidus-2026-08-29.md', 'utf8');
const a5 = await resolveDeck(replaceShurikenWithDruid(extractA2(source)));
assert.equal(a5.notFound.length, 0);
const commander = a5.cards.find((card) => norm(card.name) === norm("Tidus, Yuna's Guardian"));
assert.ok(commander);
const colors = [...new Set(commander.color_identity)].sort();
const policy = await resolvePrintingPolicyV08({ printingFamily: 'Final Fantasy', includePromos: true, includeSpecialReleases: true });
const pool = await discoverEligiblePoolV15(colors, policy, undefined);
const current = new Set(a5.cards.map((card) => norm(card.name)));
const context = deriveUpgradeStrategyContextV15(a5.parsed, a5.cards);

const describe = (card: typeof pool[number]) => {
  const roles = inferCardRoles(card).sort();
  const text = getCardOracleText(card).replace(/\s+/g, ' ').trim();
  return {
    name: card.name,
    set: card.set.toUpperCase(),
    collectorNumber: card.collector_number,
    manaValue: card.cmc,
    typeLine: card.type_line,
    roles,
    commanderAffinity: substantiveCommanderStrategyAffinityScoreV15(cardCommanderStrategyAffinityV15(card, context)),
    oracleText: text,
    current: current.has(norm(card.name)),
  };
};

const eligible = pool.filter((card) => card.legalities.commander === 'legal');
const tutors = eligible.filter((card) => inferCardRoles(card).includes('tutor')).map(describe)
  .sort((a, b) => Number(b.current) - Number(a.current) || a.manaValue - b.manaValue || b.commanderAffinity - a.commanderAffinity || a.name.localeCompare(b.name));
const cheapSelection = eligible.filter((card) => card.cmc <= 2 && inferCardRoles(card).some((r) => ['card selection', 'tutor', 'creature tutor'].includes(r))).map(describe)
  .sort((a, b) => Number(b.current) - Number(a.current) || b.commanderAffinity - a.commanderAffinity || a.manaValue - b.manaValue || a.name.localeCompare(b.name));
const accessAndProtection = eligible.filter((card) => inferCardRoles(card).some((r) => ['combo protection', 'free interaction', 'combat access', 'counter payoff'].includes(r))).map(describe)
  .sort((a, b) => Number(b.current) - Number(a.current) || b.commanderAffinity - a.commanderAffinity || a.manaValue - b.manaValue || a.name.localeCompare(b.name));
const cheapAcceleration = eligible.filter((card) => card.cmc <= 2 && inferCardRoles(card).some((r) => ['mana acceleration', 'mana dork', 'fast mana', 'mana multiplier'].includes(r))).map(describe)
  .sort((a, b) => Number(b.current) - Number(a.current) || a.manaValue - b.manaValue || b.commanderAffinity - a.commanderAffinity || a.name.localeCompare(b.name));

const result = {
  schema: 'counter-blitz-a11-access-audit-v1',
  eligiblePoolSize: eligible.length,
  commanderStrategies: context.strategies,
  currentTutorNames: tutors.filter((x) => x.current).map((x) => x.name),
  missingTutorCandidates: tutors.filter((x) => !x.current),
  tutors,
  missingCheapSelection: cheapSelection.filter((x) => !x.current),
  missingAccessProtection: accessAndProtection.filter((x) => !x.current),
  missingCheapAcceleration: cheapAcceleration.filter((x) => !x.current),
  note: 'Role inference is a discovery aid only. Each candidate requires Oracle-text/manual legality and strategic audit before deck acceptance.',
};
await writeFile('counter-blitz-a11-access-audit.json', `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  eligiblePoolSize: result.eligiblePoolSize,
  currentTutorNames: result.currentTutorNames,
  missingTutors: result.missingTutorCandidates.map((x) => ({ name: x.name, manaValue: x.manaValue, affinity: x.commanderAffinity, roles: x.roles, oracleText: x.oracleText })),
  missingCheapSelection: result.missingCheapSelection.slice(0, 20).map((x) => ({ name: x.name, manaValue: x.manaValue, affinity: x.commanderAffinity, oracleText: x.oracleText })),
  missingAccessProtection: result.missingAccessProtection.slice(0, 25).map((x) => ({ name: x.name, manaValue: x.manaValue, affinity: x.commanderAffinity, roles: x.roles, oracleText: x.oracleText })),
  missingCheapAcceleration: result.missingCheapAcceleration.slice(0, 20).map((x) => ({ name: x.name, manaValue: x.manaValue, affinity: x.commanderAffinity, oracleText: x.oracleText })),
}, null, 2));
