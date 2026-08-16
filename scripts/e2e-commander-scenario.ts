import assert from 'node:assert/strict';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { parseDecklist, type DeckEntry, type ParsedDeck } from '../src/services/deck.js';
import { getPreconStockV10, searchCommanderPreconsV10 } from '../src/services/precons-v10.js';
import { refinePreconIterativelyV12 } from '../src/services/refinement-workflows-v12.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';

const MAX_TOTAL_USD = 100;
const MAX_USD_PER_CARD = 20;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function entries(parsed: ParsedDeck): DeckEntry[] {
  return [...parsed.commanders, ...parsed.main];
}

function identifiers(parsed: ParsedDeck): CardIdentifierInput[] {
  return entries(parsed).map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
}

function nameCounts(parsed: ParsedDeck): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries(parsed)) {
    const key = entry.name.toLocaleLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + entry.quantity);
  }
  return counts;
}

function printingSnapshot(parsed: ParsedDeck): Map<string, string[]> {
  const snapshot = new Map<string, string[]>();
  for (const entry of entries(parsed)) {
    const key = entry.name.toLocaleLowerCase();
    const signature = [
      entry.quantity,
      entry.set?.toUpperCase() ?? '',
      entry.collectorNumber ?? '',
      entry.finish ?? '',
    ].join('|');
    const current = snapshot.get(key) ?? [];
    current.push(signature);
    current.sort();
    snapshot.set(key, current);
  }
  return snapshot;
}

function deltaEntries(before: ParsedDeck, after: ParsedDeck): Array<[string, number]> {
  const left = nameCounts(before);
  const right = nameCounts(after);
  const keys = new Set([...left.keys(), ...right.keys()]);
  return [...keys]
    .map((key): [string, number] => [key, (right.get(key) ?? 0) - (left.get(key) ?? 0)])
    .filter(([, delta]) => delta !== 0)
    .sort(([a], [b]) => a.localeCompare(b));
}

function expectedSwapDeltas(swaps: Array<Record<string, unknown>>): Array<[string, number]> {
  const deltas = new Map<string, number>();
  for (const swap of swaps) {
    assert.equal(typeof swap.out, 'string', 'every accepted swap must name the outgoing card');
    assert.equal(typeof swap.in, 'string', 'every accepted swap must name the incoming card');
    const outgoing = String(swap.out).toLocaleLowerCase();
    const incoming = String(swap.in).toLocaleLowerCase();
    deltas.set(outgoing, (deltas.get(outgoing) ?? 0) - 1);
    deltas.set(incoming, (deltas.get(incoming) ?? 0) + 1);
  }
  return [...deltas.entries()]
    .filter(([, delta]) => delta !== 0)
    .sort(([a], [b]) => a.localeCompare(b));
}

function numericPrice(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function assertResolvedLegalDeck(parsed: ParsedDeck, label: string): Promise<void> {
  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  assert.deepEqual(resolved.notFound, [], `${label} must resolve every exact card/printing identifier`);
  const rules = validateCommanderDeck(parsed, resolved.cards);
  assert.equal(rules.isLegal, true, `${label} must pass hard Commander legality`);
}

async function main(): Promise<void> {
  console.log('COMMANDER E2E: finding real Limit Break stock precon...');
  const catalog = await searchCommanderPreconsV10({
    query: 'Limit Break',
    limit: 20,
    forceRefresh: true,
  });
  const precons = Array.isArray(catalog.precons) ? catalog.precons.map(asRecord) : [];
  const selected = precons.find((entry) => entry.productVariant === 'standard') ?? precons[0];
  assert.ok(selected, 'MTGJSON should expose a Limit Break Commander precon');
  const reference = typeof selected.fileName === 'string'
    ? selected.fileName
    : typeof selected.name === 'string'
      ? selected.name
      : '';
  assert.ok(reference, 'selected precon must have a usable MTGJSON reference');

  const stock = await getPreconStockV10(reference);
  assert.equal(stock.cardCount, 100, 'stock precon must contain exactly 100 cards');
  assert.equal(typeof stock.stockDecklist, 'string', 'stock precon must expose a complete decklist');
  const stockDecklist = String(stock.stockDecklist);
  const stockParsed = parseDecklist(stockDecklist);
  assert.equal(stockParsed.totalCards, 100, 'parsed stock deck must contain exactly 100 cards');
  await assertResolvedLegalDeck(stockParsed, 'stock deck');

  console.log(`COMMANDER E2E: refining ${String(asRecord(stock.precon).name ?? reference)} with $${MAX_TOTAL_USD} total / $${MAX_USD_PER_CARD} per-card caps...`);
  const result = await refinePreconIterativelyV12({
    reference,
    targetBracket: 4,
    maxUsdPerCard: MAX_USD_PER_CARD,
    maxTotalUsd: MAX_TOTAL_USD,
    maxSwaps: 4,
    maxRounds: 2,
    swapsPerRound: 2,
    candidatePackagesPerRound: 2,
    minimumImprovementScore: -10,
    simulationIterations: 150,
    simulationTurns: 6,
    seed: 20_260_816,
    detailLevel: 'detailed',
  });

  const refinement = asRecord(result.refinement);
  assert.equal(refinement.status, 'refined', 'the live scenario should exercise at least one accepted optimizer package');
  assert.equal(typeof refinement.finalDecklist, 'string', 'optimizer must return the complete final decklist');
  const finalDecklist = String(refinement.finalDecklist);
  const finalParsed = parseDecklist(finalDecklist);

  assert.equal(finalParsed.totalCards, 100, 'refined deck must still contain exactly 100 cards');
  await assertResolvedLegalDeck(finalParsed, 'refined deck');

  const stockCommanders = stockParsed.commanders.map((entry) => entry.name.toLocaleLowerCase()).sort();
  const finalCommanders = finalParsed.commanders.map((entry) => entry.name.toLocaleLowerCase()).sort();
  assert.deepEqual(finalCommanders, stockCommanders, 'refinement must preserve the stock commander slot(s)');

  const swaps = Array.isArray(refinement.swaps) ? refinement.swaps.map(asRecord) : [];
  assert.ok(swaps.length > 0, 'scenario must include accepted swaps so swap-integrity assertions are exercised');
  assert.equal(refinement.totalSwaps, swaps.length, 'reported totalSwaps must equal the accepted swap list length');
  assert.deepEqual(
    deltaEntries(stockParsed, finalParsed),
    expectedSwapDeltas(swaps),
    'reported OUT -> IN swaps must exactly explain the stock-to-final card-count delta',
  );

  const estimatedSpend = numericPrice(refinement.estimatedUpgradeSpendUsd);
  assert.notEqual(estimatedSpend, null, 'optimizer must report a numeric total upgrade spend');
  assert.ok((estimatedSpend ?? Infinity) <= MAX_TOTAL_USD + 0.0001, 'accepted upgrades must remain within the $100 total budget');
  assert.equal(refinement.maxTotalUsd, MAX_TOTAL_USD, 'optimizer output must preserve the requested total budget');

  const touchedNames = new Set<string>();
  for (const swap of swaps) {
    const outgoing = String(swap.out).toLocaleLowerCase();
    const incoming = String(swap.in).toLocaleLowerCase();
    touchedNames.add(outgoing);
    touchedNames.add(incoming);

    const printing = asRecord(swap.recommendedPrinting);
    assert.equal(typeof printing.set, 'string', `${String(swap.in)} must include a recommended set code`);
    assert.equal(typeof printing.collectorNumber, 'string', `${String(swap.in)} must include a collector number`);
    const price = numericPrice(printing.priceUsd);
    assert.notEqual(price, null, `${String(swap.in)} must have a verifiable selected-printing price under a total budget`);
    assert.ok((price ?? Infinity) <= MAX_USD_PER_CARD + 0.0001, `${String(swap.in)} must stay within the $20 per-card cap`);

    const finalEntry = entries(finalParsed).find((entry) => entry.name.toLocaleLowerCase() === incoming);
    assert.ok(finalEntry, `${String(swap.in)} must exist in the final deck`);
    assert.equal(finalEntry.set?.toUpperCase(), String(printing.set).toUpperCase(), `${String(swap.in)} final set must match the priced recommendation`);
    assert.equal(finalEntry.collectorNumber, String(printing.collectorNumber), `${String(swap.in)} collector number must match the priced recommendation`);
    if (typeof printing.finish === 'string') {
      assert.equal(finalEntry.finish, printing.finish, `${String(swap.in)} finish must match the priced recommendation`);
    }
  }

  const stockPrintings = printingSnapshot(stockParsed);
  const finalPrintings = printingSnapshot(finalParsed);
  for (const [name, signatures] of stockPrintings) {
    if (touchedNames.has(name)) continue;
    assert.deepEqual(finalPrintings.get(name), signatures, `untouched card ${name} must retain its exact stock printing identity`);
  }

  const rounds = Array.isArray(refinement.detailedRounds) ? refinement.detailedRounds.map(asRecord) : [];
  assert.ok(rounds.length > 0, 'detailed optimizer output must expose round-level evidence');
  for (const round of rounds.filter((entry) => entry.accepted === true)) {
    assert.ok(Number(round.candidatePackagesGenerated ?? 0) >= 1, 'accepted rounds must actually compare candidate packages');
    assert.ok(Number(round.candidatePackagesEligible ?? 0) >= 1, 'accepted rounds must have at least one eligible package');
    assert.ok(Number(round.winningCandidate ?? 0) >= 1, 'accepted rounds must identify a winning package');
  }

  console.log('\nACCEPTED SWAPS');
  for (const swap of swaps) {
    const printing = asRecord(swap.recommendedPrinting);
    console.log(`- ${String(swap.out)} -> ${String(swap.in)} (${String(printing.set)} ${String(printing.collectorNumber)}) $${String(printing.priceUsd)}`);
  }
  console.log(`\nFINAL: 100 cards, Commander legal, ${swaps.length} swap(s), estimated spend $${estimatedSpend?.toFixed(2)}.`);
  console.log('COMMANDER E2E RESULT: PASS');
}

main().catch((error) => {
  console.error('\nCOMMANDER E2E RESULT: FAIL');
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
