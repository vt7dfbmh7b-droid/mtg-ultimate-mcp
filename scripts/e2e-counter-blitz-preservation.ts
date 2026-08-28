import assert from 'node:assert/strict';
import { assessCedhReadinessV14, refineCommanderForCedhV14 } from '../src/services/cedh-workflow-v14.js';
import { parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { getCardsByIdentifiers } from '../src/services/scryfall.js';

type StockEntry = { name: string; quantity?: number; commander?: boolean };

const stockSingles = `
Tidus, Yuna's Guardian
Yuna, Grand Summoner
Auron, Venerated Guardian
Chocobo Knights
Gatta and Luzzu
Lord Jyscal Guado
Protection Magic
Summon: Ixion
Summon: Yojimbo
Summoner's Sending
Blitzball Stadium
Lulu, Stern Guardian
O'aka, Traveling Merchant
Rikku, Resourceful Guardian
Summon: Valefor
Maester Seymour
Sphere Grid
Summon: Magus Sisters
Tromell, Seymour's Butler
Yuna's Decision
Yuna's Whistle
Kimahri, Valiant Guardian
Shelinda, Yevon Acolyte
Sin, Unending Cataclysm
Wakka, Devoted Guardian
Collective Effort
Damning Verdict
Farewell
Luminous Broodmoth
Promise of Loyalty
Resourceful Defense
Scholar of New Horizons
Sunscorch Regent
Together Forever
Chasm Skulker
Inexorable Tide
Pull from Tomorrow
Bane of Progress
Fight Rigging
Forgotten Ancient
Generous Patron
Gyre Sage
Hardened Scales
Incubation Druid
Path of Discovery
Rampant Rejuvenator
Tireless Tracker
Altered Ego
Endless Detour
Fathom Mage
Walking Ballista
Brushland
Canopy Vista
Exotic Orchard
Flooded Grove
Fortified Village
Glacial Fortress
Hinterland Harbor
Overflowing Basin
Port Town
Prairie Stream
Skycloud Expanse
Sungrass Prairie
Sunpetal Grove
Temple of Enlightenment
Temple of Mystery
Temple of Plenty
Vineglimmer Snarl
Destroy Evil
Grateful Apparition
Path to Exile
An Offer You Can't Refuse
Duskshell Crawler
Farseek
Inspiring Call
Three Visits
Bred for the Hunt
Arcane Signet
Everflowing Chalice
Sol Ring
Ash Barrens
Evolving Wilds
Forge of Heroes
Idyllic Beachfront
Nesting Grounds
Path of Ancestry
Radiant Grove
Seaside Citadel
Tangled Islet
Temple of the False God
Command Tower
`.trim().split('\n');

const stock: StockEntry[] = [
  ...stockSingles.map((name, index) => ({ name, ...(index === 0 ? { commander: true } : {}) })),
  { name: 'Island', quantity: 3 },
  { name: 'Forest', quantity: 3 },
  { name: 'Plains', quantity: 3 },
];

// Test-defined preservation identity: the bespoke FFX section at the front of Wizards' factory list.
// The independent 80/100 overlap gate prevents a protected core from hiding a commander rebuild.
const identityCore = stock.slice(0, 25).map((entry) => entry.name);
const MIN_RETAINED_CARDS = 80;
const ffOptions = {
  printingFamily: 'Final Fantasy',
  includePromos: true,
  includeSpecialReleases: true,
} as const;

function normalize(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function quantities(parsed: ParsedDeck): Map<string, number> {
  const result = new Map<string, number>();
  for (const entry of [...parsed.commanders, ...parsed.main]) {
    const key = normalize(entry.name);
    result.set(key, (result.get(key) ?? 0) + entry.quantity);
  }
  return result;
}

function overlapCards(a: ParsedDeck, b: ParsedDeck): number {
  const qa = quantities(a);
  const qb = quantities(b);
  let total = 0;
  for (const [name, amount] of qa) total += Math.min(amount, qb.get(name) ?? 0);
  return total;
}

function expandedNames(parsed: ParsedDeck): string[] {
  return [...parsed.commanders, ...parsed.main]
    .flatMap((entry) => Array.from({ length: entry.quantity }, () => entry.name));
}

async function exactFactoryDecklist(): Promise<string> {
  assert.equal(stock.reduce((sum, entry) => sum + (entry.quantity ?? 1), 0), 100, 'official Counter Blitz source must total 100');
  const uniqueNames = [...new Set(stock.map((entry) => entry.name))];
  const resolved = await getCardsByIdentifiers(uniqueNames.map((name) => ({ name, set: 'fic' })));
  assert.deepEqual(resolved.notFound, [], 'every factory Counter Blitz card must resolve in FIC');
  const byName = new Map(resolved.cards.map((card) => [normalize(card.name), card]));

  const commanderLines: string[] = [];
  const mainLines: string[] = [];
  for (const entry of stock) {
    const card = byName.get(normalize(entry.name));
    assert.ok(card, `factory FIC printing must resolve: ${entry.name}`);
    const line = `${entry.quantity ?? 1} ${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`;
    (entry.commander ? commanderLines : mainLines).push(line);
  }
  return ['// COMMANDER', ...commanderLines, '', '// MAIN', ...mainLines].join('\n');
}

async function main(): Promise<void> {
  console.log('COUNTER BLITZ PRESERVATION A/B: resolving Wizards factory list to exact FIC printings...');
  const stockDecklist = await exactFactoryDecklist();
  const stockParsed = parseDecklist(stockDecklist);
  assert.equal(stockParsed.totalCards, 100, 'factory baseline must be exactly 100 cards');

  const stockAssessment = await assessCedhReadinessV14(stockDecklist, ffOptions);
  assert.notEqual(stockAssessment.status, 'invalid-or-policy-noncompliant', 'factory baseline must be legal and FF-printing compliant');

  console.log('COUNTER BLITZ PRESERVATION A/B: refining existing stock deck rather than rebuilding around Tidus...');
  const refined = await refineCommanderForCedhV14(stockDecklist, {
    ...ffOptions,
    protectedCards: identityCore,
    requireVerifiedCombo: true,
    maxMissingCards: 2,
    maxCandidatesToVerify: 24,
    maxEfficiencySwaps: 10,
    maxManaBaseSwaps: 10,
  });
  const finalDecklist = typeof refined.finalDecklist === 'string' ? refined.finalDecklist : '';
  assert.ok(finalDecklist.trim(), 'preservation refiner must return a decklist');
  const finalParsed = parseDecklist(finalDecklist);
  assert.equal(finalParsed.totalCards, 100, 'preservation list must remain exactly 100 cards');

  const finalAssessment = await assessCedhReadinessV14(finalDecklist, ffOptions);
  assert.notEqual(finalAssessment.status, 'invalid-or-policy-noncompliant', 'preservation list must remain legal and FF-printing compliant');

  const retained = overlapCards(stockParsed, finalParsed);
  const changedSlots = 100 - retained;
  const finalNames = new Set(expandedNames(finalParsed).map(normalize));
  const missingCore = identityCore.filter((name) => !finalNames.has(normalize(name)));
  assert.ok(retained >= MIN_RETAINED_CARDS, `preservation requires >=${MIN_RETAINED_CARDS}/100 stock cards; observed ${retained}`);
  assert.deepEqual(missingCore, [], 'all Counter Blitz identity-core cards must survive refinement');

  const rebuildBenchmark = {
    landCount: 31,
    averageNonlandManaValue: 2.17,
    earlyPlayCount: 46,
    fastManaCount: 3,
    cheapInteractionCount: 12,
    protectionCount: 6,
    tutorCount: 4,
    freeInteractionCount: 1,
    winningCombos: 1,
    status: 'strong-competitive-construction-signals',
  };

  console.log(`STOCK RETAINED: ${retained}/100`);
  console.log(`CHANGED SLOTS: ${changedSlots}`);
  console.log(`IDENTITY CORE RETAINED: ${identityCore.length - missingCore.length}/${identityCore.length}`);
  console.log(`IDENTITY CORE MISSING: ${JSON.stringify(missingCore)}`);
  console.log(`STOCK ASSESSMENT STATUS: ${String(stockAssessment.status)}`);
  console.log(`STOCK WINNING COMBOS: ${String(stockAssessment.winningCombos ?? 0)}`);
  console.log(`STOCK METRICS: ${JSON.stringify(stockAssessment.metrics ?? {}, null, 2)}`);
  console.log(`PRESERVATION REFINEMENT STATUS: ${String(refined.status)}`);
  console.log(`PRESERVATION FINAL STATUS: ${String(finalAssessment.status)}`);
  console.log(`PRESERVATION FINAL WINNING COMBOS: ${String(finalAssessment.winningCombos ?? 0)}`);
  console.log(`PRESERVATION FINAL METRICS: ${JSON.stringify(finalAssessment.metrics ?? {}, null, 2)}`);
  console.log(`FULL REBUILD BENCHMARK: ${JSON.stringify(rebuildBenchmark, null, 2)}`);
  console.log(`REFINEMENT STAGES: ${JSON.stringify(refined.stages ?? {}, null, 2)}`);
  console.log('\nPRESERVATION FINAL DECKLIST');
  console.log(finalDecklist.trim());
}

main().catch((error) => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
