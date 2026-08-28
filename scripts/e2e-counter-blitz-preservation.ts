import assert from 'node:assert/strict';
import { assessCedhReadinessV14, refineCommanderForCedhV14 } from '../src/services/cedh-workflow-v14.js';
import { parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { resolvePrintingPolicyV08, selectEligiblePrintingV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByNames } from '../src/services/scryfall.js';

type StockEntry = { name: string; quantity?: number; commander?: boolean };

const stock: StockEntry[] = [
  { name: "Tidus, Yuna's Guardian", commander: true },
  { name: 'Yuna, Grand Summoner' },
  { name: 'Auron, Venerated Guardian' },
  { name: 'Chocobo Knights' },
  { name: 'Gatta and Luzzu' },
  { name: 'Lord Jyscal Guado' },
  { name: 'Protection Magic' },
  { name: 'Summon: Ixion' },
  { name: 'Summon: Yojimbo' },
  { name: "Summoner's Sending" },
  { name: 'Blitzball Stadium' },
  { name: 'Lulu, Stern Guardian' },
  { name: "O'aka, Traveling Merchant" },
  { name: 'Rikku, Resourceful Guardian' },
  { name: 'Summon: Valefor' },
  { name: 'Maester Seymour' },
  { name: 'Sphere Grid' },
  { name: 'Summon: Magus Sisters' },
  { name: "Tromell, Seymour's Butler" },
  { name: "Yuna's Decision" },
  { name: "Yuna's Whistle" },
  { name: 'Kimahri, Valiant Guardian' },
  { name: 'Shelinda, Yevon Acolyte' },
  { name: 'Sin, Unending Cataclysm' },
  { name: 'Wakka, Devoted Guardian' },
  { name: 'Collective Effort' },
  { name: 'Damning Verdict' },
  { name: 'Farewell' },
  { name: 'Luminous Broodmoth' },
  { name: 'Promise of Loyalty' },
  { name: 'Resourceful Defense' },
  { name: 'Scholar of New Horizons' },
  { name: 'Sunscorch Regent' },
  { name: 'Together Forever' },
  { name: 'Chasm Skulker' },
  { name: 'Inexorable Tide' },
  { name: 'Pull from Tomorrow' },
  { name: 'Bane of Progress' },
  { name: 'Fight Rigging' },
  { name: 'Forgotten Ancient' },
  { name: 'Generous Patron' },
  { name: 'Gyre Sage' },
  { name: 'Hardened Scales' },
  { name: 'Incubation Druid' },
  { name: 'Path of Discovery' },
  { name: 'Rampant Rejuvenator' },
  { name: 'Tireless Tracker' },
  { name: 'Altered Ego' },
  { name: 'Endless Detour' },
  { name: 'Fathom Mage' },
  { name: 'Walking Ballista' },
  { name: 'Brushland' },
  { name: 'Canopy Vista' },
  { name: 'Exotic Orchard' },
  { name: 'Flooded Grove' },
  { name: 'Fortified Village' },
  { name: 'Glacial Fortress' },
  { name: 'Hinterland Harbor' },
  { name: 'Overflowing Basin' },
  { name: 'Port Town' },
  { name: 'Prairie Stream' },
  { name: 'Skycloud Expanse' },
  { name: 'Sungrass Prairie' },
  { name: 'Sunpetal Grove' },
  { name: 'Temple of Enlightenment' },
  { name: 'Temple of Mystery' },
  { name: 'Temple of Plenty' },
  { name: 'Vineglimmer Snarl' },
  { name: 'Destroy Evil' },
  { name: 'Grateful Apparition' },
  { name: 'Path to Exile' },
  { name: "An Offer You Can't Refuse" },
  { name: 'Duskshell Crawler' },
  { name: 'Farseek' },
  { name: 'Inspiring Call' },
  { name: 'Three Visits' },
  { name: 'Bred for the Hunt' },
  { name: 'Arcane Signet' },
  { name: 'Everflowing Chalice' },
  { name: 'Sol Ring' },
  { name: 'Ash Barrens' },
  { name: 'Evolving Wilds' },
  { name: 'Forge of Heroes' },
  { name: 'Idyllic Beachfront' },
  { name: 'Nesting Grounds' },
  { name: 'Path of Ancestry' },
  { name: 'Radiant Grove' },
  { name: 'Seaside Citadel' },
  { name: 'Tangled Islet' },
  { name: 'Temple of the False God' },
  { name: 'Command Tower' },
  { name: 'Island', quantity: 3 },
  { name: 'Forest', quantity: 3 },
  { name: 'Plains', quantity: 3 },
];

// Test-defined preservation core: the bespoke FFX/Counter Blitz section of the factory list.
// The 80-card overlap gate below separately prevents a nominally protected core from hiding a rebuild.
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

function namesExpanded(parsed: ParsedDeck): string[] {
  return [...parsed.commanders, ...parsed.main].flatMap((entry) => Array.from({ length: entry.quantity }, () => entry.name));
}

async function exactFfStockDecklist(): Promise<string> {
  assert.equal(stock.reduce((sum, entry) => sum + (entry.quantity ?? 1), 0), 100, 'official Counter Blitz source must total 100');
  const uniqueNames = [...new Set(stock.map((entry) => entry.name))];
  const resolved = await getCardsByNames(uniqueNames);
  assert.deepEqual(resolved.notFound, [], 'all official stock names must resolve');
  const oracle = new Map(resolved.cards.map((card) => [normalize(card.name), card]));
  const policy = await resolvePrintingPolicyV08(ffOptions);

  const commanderLines: string[] = [];
  const mainLines: string[] = [];
  for (const entry of stock) {
    const card = oracle.get(normalize(entry.name));
    assert.ok(card, `stock Oracle card must resolve: ${entry.name}`);
    const selected = await selectEligiblePrintingV08(card, policy);
    assert.ok(selected, `stock card must have an eligible FF printing: ${entry.name}`);
    const line = `${entry.quantity ?? 1} ${selected.card.name} (${selected.card.set.toUpperCase()}) ${selected.card.collector_number}`;
    (entry.commander ? commanderLines : mainLines).push(line);
  }
  return ['// COMMANDER', ...commanderLines, '', '// MAIN', ...mainLines].join('\n');
}

async function main(): Promise<void> {
  console.log('COUNTER BLITZ PRESERVATION A/B: constructing exact FF-printing factory baseline...');
  const stockDecklist = await exactFfStockDecklist();
  const stockParsed = parseDecklist(stockDecklist);
  assert.equal(stockParsed.totalCards, 100, 'factory baseline must be exactly 100 cards');

  const stockAssessment = await assessCedhReadinessV14(stockDecklist, ffOptions);
  assert.notEqual(stockAssessment.status, 'invalid-or-policy-noncompliant', 'factory baseline must be legal and FF-printing compliant');

  console.log('COUNTER BLITZ PRESERVATION A/B: refining existing stock list rather than rebuilding from commander...');
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
  assert.equal(finalParsed.totalCards, 100, 'refined preservation list must remain exactly 100');

  const finalAssessment = await assessCedhReadinessV14(finalDecklist, ffOptions);
  assert.notEqual(finalAssessment.status, 'invalid-or-policy-noncompliant', 'refined preservation list must remain legal and FF-printing compliant');

  const retained = overlapCards(stockParsed, finalParsed);
  const changedSlots = 100 - retained;
  const finalNames = new Set(namesExpanded(finalParsed).map(normalize));
  const missingCore = identityCore.filter((name) => !finalNames.has(normalize(name)));
  assert.ok(retained >= MIN_RETAINED_CARDS, `precon preservation requires at least ${MIN_RETAINED_CARDS}/100 stock cards retained; observed ${retained}`);
  assert.deepEqual(missingCore, [], 'all Counter Blitz identity-core cards must survive preservation refinement');

  const initialMetrics = stockAssessment.metrics ?? {};
  const finalMetrics = finalAssessment.metrics ?? {};
  const stages = (refined.stages && typeof refined.stages === 'object') ? refined.stages : {};

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
  console.log(`STOCK METRICS: ${JSON.stringify(initialMetrics, null, 2)}`);
  console.log(`PRESERVATION REFINEMENT STATUS: ${String(refined.status)}`);
  console.log(`PRESERVATION FINAL STATUS: ${String(finalAssessment.status)}`);
  console.log(`PRESERVATION FINAL WINNING COMBOS: ${String(finalAssessment.winningCombos ?? 0)}`);
  console.log(`PRESERVATION FINAL METRICS: ${JSON.stringify(finalMetrics, null, 2)}`);
  console.log(`FULL REBUILD BENCHMARK: ${JSON.stringify(rebuildBenchmark, null, 2)}`);
  console.log(`REFINEMENT STAGES: ${JSON.stringify(stages, null, 2)}`);
  console.log('\nPRESERVATION FINAL DECKLIST');
  console.log(finalDecklist.trim());
}

main().catch((error) => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
