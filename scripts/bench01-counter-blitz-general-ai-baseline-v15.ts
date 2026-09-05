import assert from 'node:assert/strict';
import { unlink, writeFile } from 'node:fs/promises';
import { evaluateCommanderBuildV15 } from '../src/services/commander-build-evaluation-v15.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { deriveCommanderStrategyContextV15 } from '../src/services/commander-strategy-affinity-v15.js';
import { parseDecklist, type DeckEntry, type ParsedDeck } from '../src/services/deck.js';
import { fetchPreconDeckV10 } from '../src/services/precons-v10.js';
import {
  printingMatchesPolicyV08,
  resolvePrintingPolicyV08,
  selectEligiblePrintingV08,
} from '../src/services/printing-policy-v08.js';
import { findDeckCombosEvidence } from '../src/services/spellbook.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';

const PRECON_REFERENCE = 'CounterBlitzFinalFantasyX_FIC';
const COMMANDER = "Tidus, Yuna's Guardian";
const TARGET_BRACKET = 5;

const LOCKED_ADDITIONS = [
  'The Destined White Mage',
  'Ranger-Captain of Eos',
  'Delivery Moogle',
  'Search for Dagger',
  'Counterspell',
  "Dovin's Veto",
  'Force of Negation',
  'Arcane Denial',
  'Syncopate',
  "Louisoix's Sacrifice",
  'Hypnotic Sprite',
  'Rhystic Study',
  'The Earth Crystal',
  'Clever Concealment',
  "Akroma's Will",
  "Nature's Lore",
  "Conqueror's Flail",
  'Lightning Greaves',
] as const;

const LOCKED_CUTS = [
  'Temple of the False God',
  'Rampant Rejuvenator',
  'Collective Effort',
  'Promise of Loyalty',
  'Luminous Broodmoth',
  'Sunscorch Regent',
  'Together Forever',
  'Pull from Tomorrow',
  'Bane of Progress',
  'Altered Ego',
  'Lord Jyscal Guado',
  "Tromell, Seymour's Butler",
  'Shelinda, Yevon Acolyte',
  "Summoner's Sending",
  'Farewell',
  'Summon: Valefor',
  'Sin, Unending Cataclysm',
  'Generous Patron',
] as const;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function lower(value: unknown): string {
  return typeof value === 'string' ? value.toLocaleLowerCase() : '';
}

function identifiers(parsed: ParsedDeck): CardIdentifierInput[] {
  return [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
}

function formatEntry(entry: DeckEntry): string {
  const printing = entry.set && entry.collectorNumber
    ? ` (${entry.set.toUpperCase()}) ${entry.collectorNumber}`
    : '';
  const finish = entry.finish === 'foil' ? ' *F*' : entry.finish === 'etched' ? ' *E*' : entry.finish === 'nonfoil' ? ' *N*' : '';
  return `${entry.quantity} ${entry.name}${printing}${finish}`;
}

function formatDeck(parsed: ParsedDeck): string {
  return [
    'Commander',
    ...parsed.commanders.map(formatEntry),
    '',
    'Mainboard',
    ...parsed.main.map(formatEntry),
  ].join('\n');
}

async function buildLockedBaseline(): Promise<{
  stockDecklist: string;
  baselineDecklist: string;
  selectedAdditions: Array<Record<string, unknown>>;
}> {
  const stock = await fetchPreconDeckV10(PRECON_REFERENCE);
  assert.equal(stock.entry.fileName, PRECON_REFERENCE);
  assert.equal(stock.entry.name, 'Counter Blitz (FINAL FANTASY X)');

  const parsed = parseDecklist(stock.decklist);
  assert.equal(parsed.totalCards, 100, 'exact stock baseline must contain 100 cards');
  assert.equal(parsed.commanders.length, 1);
  assert.equal(parsed.commanders[0]?.name, COMMANDER);

  const stockNames = new Set(parsed.main.map((entry) => entry.name.toLocaleLowerCase()));
  for (const cut of LOCKED_CUTS) {
    assert.equal(stockNames.has(cut.toLocaleLowerCase()), true, `locked general-AI cut must exist in exact stock list: ${cut}`);
  }
  for (const addition of LOCKED_ADDITIONS) {
    assert.equal(stockNames.has(addition.toLocaleLowerCase()), false, `locked general-AI addition must not already be in exact stock list: ${addition}`);
  }

  const policy = await resolvePrintingPolicyV08({
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
  });

  const additions: DeckEntry[] = [];
  const selectedAdditions: Array<Record<string, unknown>> = [];
  for (const name of LOCKED_ADDITIONS) {
    const initial = await getCardsByIdentifiers([{ name }]);
    assert.equal(initial.notFound.length, 0, `general-AI addition must resolve by Oracle name: ${name}`);
    const canonical = initial.cards[0];
    assert.ok(canonical, `general-AI addition must have a canonical card: ${name}`);
    const selected = await selectEligiblePrintingV08(canonical, policy);
    assert.ok(selected, `general-AI addition must have an eligible released FINAL FANTASY-family physical printing: ${name}`);
    assert.equal(printingMatchesPolicyV08(selected.card, policy), true, `selected baseline printing must satisfy FINAL FANTASY policy: ${name}`);
    additions.push({
      name: selected.card.name,
      quantity: 1,
      set: selected.card.set.toUpperCase(),
      collectorNumber: selected.card.collector_number,
    });
    selectedAdditions.push({
      oracleName: selected.card.name,
      set: selected.card.set.toUpperCase(),
      collectorNumber: selected.card.collector_number,
      releasedAt: selected.card.released_at,
      matchedBy: selected.matchedBy,
      selectedFinish: selected.finish,
      observedUsd: selected.priceUsd,
    });
  }

  const cutSet = new Set(LOCKED_CUTS.map((name) => name.toLocaleLowerCase()));
  const retained = parsed.main.filter((entry) => !cutSet.has(entry.name.toLocaleLowerCase()));
  const baseline: ParsedDeck = {
    commanders: parsed.commanders.map((entry) => ({ ...entry })),
    main: [...retained.map((entry) => ({ ...entry })), ...additions],
    totalMain: retained.reduce((sum, entry) => sum + entry.quantity, 0) + additions.length,
    totalCommanders: parsed.totalCommanders,
    totalCards: retained.reduce((sum, entry) => sum + entry.quantity, 0) + additions.length + parsed.totalCommanders,
  };
  assert.equal(baseline.totalCards, 100, 'locked general-AI swap plan must preserve exactly 100 cards');

  return {
    stockDecklist: stock.decklist,
    baselineDecklist: formatDeck(baseline),
    selectedAdditions,
  };
}

async function auditDeck(decklist: string): Promise<Record<string, unknown>> {
  const parsed = parseDecklist(decklist);
  assert.equal(parsed.totalCards, 100, 'general-AI baseline must contain exactly 100 cards');
  assert.equal(parsed.commanders.length, 1);
  assert.equal(parsed.commanders[0]?.name, COMMANDER);

  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  assert.deepEqual(resolved.notFound, [], 'all exact general-AI baseline deck entries must resolve');
  const legality = validateCommanderDeck(parsed, resolved.cards);
  assert.equal(legality.isLegal, true, 'general-AI baseline must be Commander legal');

  const policy = await resolvePrintingPolicyV08({
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
  });
  const offPolicy = resolved.cards.filter((card) => !printingMatchesPolicyV08(card, policy));
  assert.deepEqual(
    offPolicy.map((card) => `${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`),
    [],
    'general-AI baseline must use only eligible FINAL FANTASY-family physical printings',
  );

  const strategyContext = deriveCommanderStrategyContextV15(parsed, resolved.cards);
  const evaluation = await evaluateCommanderBuildV15(decklist, {
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
    optimizedPlanEvidence: false,
    competitiveMetagameEvidence: false,
    constraintDescriptions: [
      'Independent strong general-purpose-AI baseline locked before specialist result review.',
      'Exact Counter Blitz stock lineage with 18 fixed swaps.',
      'FINAL FANTASY physical printings only.',
      'Tidus remains the commander.',
      'Preserve counters/proliferate and meaningful combat while adding dense countermagic and compact combo access.',
      'Target Bracket 5 remains an assessed target rather than a declared result.',
    ],
  });

  let comboEvidence: Record<string, unknown> = {};
  let comboError: string | null = null;
  try {
    comboEvidence = record(await findDeckCombosEvidence(decklist, 200));
  } catch (error) {
    comboError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }

  const byName = new Map(resolved.cards.map((card) => [card.name.toLocaleLowerCase(), card] as const));
  let counterEngineCount = 0;
  let proliferateCount = 0;
  let counterspellCount = 0;
  let combatReferenceCount = 0;
  let creatureCount = 0;

  for (const entry of parsed.main) {
    const card = byName.get(entry.name.toLocaleLowerCase());
    if (!card) continue;
    const oracle = lower(card.oracle_text);
    const typeLine = lower(card.type_line);
    if (typeLine.includes('creature')) creatureCount += entry.quantity;
    if (/\+1\/\+1 counter|\bproliferate\b|move (?:a|any number of) counter|counter(?:s)? on (?:it|them|a|target|another|each)/i.test(oracle)) {
      counterEngineCount += entry.quantity;
    }
    if (/\bproliferate\b/i.test(oracle)) proliferateCount += entry.quantity;
    if (/\bcounter target [^.\n]{0,90}\bspell\b/i.test(oracle) || /\bcounter [^.\n]{0,60}\bspell unless\b/i.test(oracle)) {
      counterspellCount += entry.quantity;
    }
    if (/\battack(?:s|ing|ed)?\b|\bcombat damage\b|\badditional combat\b|\bdouble strike\b|\btrample\b/i.test(oracle)) {
      combatReferenceCount += entry.quantity;
    }
  }

  return {
    exactCardCount: parsed.totalCards,
    commanderLegal: legality.isLegal,
    printingPolicySatisfied: offPolicy.length === 0,
    commanderStrategies: strategyContext.strategies,
    assessedBracket: evaluation.actualBracket.assessedBracket,
    assessedBand: evaluation.actualBracket.assessedBand,
    bracketEvidence: evaluation.actualBracket,
    metrics: evaluation.metrics,
    measuredIdentity: {
      counterEngineCount,
      proliferateCount,
      counterspellCount,
      combatReferenceCount,
      creatureCount,
    },
    comboEvidence: {
      sourceStatus: comboEvidence.sourceStatus ?? 'unknown',
      verificationComplete: comboEvidence.verificationComplete ?? false,
      included: Array.isArray(comboEvidence.included) ? comboEvidence.included : [],
      excluded: Array.isArray(comboEvidence.excluded) ? comboEvidence.excluded : [],
      error: comboError,
    },
  };
}

async function main(): Promise<void> {
  await Promise.all([
    unlink('bench01-counter-general-ai-baseline-result.json').catch(() => undefined),
    unlink('bench01-counter-general-ai-baseline-deck.txt').catch(() => undefined),
    unlink('bench01-counter-general-ai-baseline-failure.txt').catch(() => undefined),
  ]);

  const built = await buildLockedBaseline();
  await writeFile('bench01-counter-general-ai-baseline-deck.txt', `${built.baselineDecklist.trim()}\n`);
  const audit = await auditDeck(built.baselineDecklist);

  const result = {
    schema: 'bench01-counter-general-ai-baseline-v1',
    fixture: 'BENCH-01 Batch A / Counter Blitz independent general-AI comparison',
    lockDocument: 'docs/BENCH-01-BATCH-A-BASELINE-LOCK-2026-09-05.md',
    antiLeak: true,
    sourceProduct: PRECON_REFERENCE,
    commander: COMMANDER,
    targetBracket: TARGET_BRACKET,
    lockedAdditions: LOCKED_ADDITIONS,
    lockedCuts: LOCKED_CUTS,
    selectedAdditions: built.selectedAdditions,
    audit,
  };

  await writeFile('bench01-counter-general-ai-baseline-result.json', `${JSON.stringify(result, null, 2)}\n`);
  console.log('BENCH-01 COUNTER GENERAL-AI BASELINE — VERIFIED');
  console.log(`EXACT CARDS: ${String(audit.exactCardCount)}`);
  console.log(`ASSESSED BRACKET: ${String(audit.assessedBracket)}`);
  console.log(`IDENTITY: ${JSON.stringify(audit.measuredIdentity)}`);

  assert.equal(audit.exactCardCount, 100);
  assert.equal(audit.commanderLegal, true);
  assert.equal(audit.printingPolicySatisfied, true);
  assert.equal(finite(record(audit.measuredIdentity).counterspellCount) >= 8, true, 'locked baseline must actually deliver dense countermagic');
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  await writeFile('bench01-counter-general-ai-baseline-failure.txt', `${message}\n`).catch(() => undefined);
  console.error('BENCH-01 COUNTER GENERAL-AI BASELINE — HARD FAILURE');
  console.error(message);
  process.exitCode = 1;
});
