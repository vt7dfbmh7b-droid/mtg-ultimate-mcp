import assert from 'node:assert/strict';
import { unlink, writeFile } from 'node:fs/promises';
import { assessBracketCeilingV15 } from '../src/services/bracket-ceiling-v15.js';
import { assessCedhReadinessV14 } from '../src/services/cedh-workflow-v14.js';
import {
  deriveCommanderStrategyContextV15,
  measureUpgradeDeckStrategySupportV15,
  SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15,
} from '../src/services/commander-strategy-affinity-v15.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { getUsdNzdRateV13, nzdToUsdV13, usdToNzdV13 } from '../src/services/currency-v13.js';
import { parseDecklist, type DeckEntry, type ParsedDeck } from '../src/services/deck.js';
import { resolvePrintingPolicyV08, selectEligiblePrintingV08 } from '../src/services/printing-policy-v08.js';
import { estimateCommanderBracket, findDeckCombos } from '../src/services/spellbook.js';
import { getCardsByIdentifiers, getCardsByNames, type CardIdentifierInput } from '../src/services/scryfall.js';

const COMMANDER_LOOKUP = 'Liliana, Heretical Healer';
const COMMANDER = 'Liliana, Heretical Healer // Liliana, Defiant Necromancer';
const MAX_DECK_NZD = 500;
const TARGET_BRACKET = 5;

const LOCKED_COUNTS: Array<[number, string]> = [
  [1, COMMANDER],
  [1, 'Accursed Marauder'],
  [1, 'Ayara, First of Locthwain'],
  [1, 'Blood Artist'],
  [1, 'Bloodghast'],
  [1, 'Braids, Arisen Nightmare'],
  [1, 'Carrion Feeder'],
  [1, 'Crypt Ghast'],
  [1, 'Dauthi Voidwalker'],
  [1, 'Forsaken Miner'],
  [1, "Geralf's Messenger"],
  [1, 'Gravecrawler'],
  [1, 'Jadar, Ghoulcaller of Nephalia'],
  [1, 'Mikaeus, the Unhallowed'],
  [1, 'Morbid Opportunist'],
  [1, 'Nested Shambler'],
  [1, 'Ophiomancer'],
  [1, 'Pawn of Ulamog'],
  [1, 'Pitiless Plunderer'],
  [1, 'Plaguecrafter'],
  [1, 'Priest of Forgotten Gods'],
  [1, 'Putrid Goblin'],
  [1, 'Reassembling Skeleton'],
  [1, 'Syr Konrad, the Grim'],
  [1, 'Triskelion'],
  [1, 'Viscera Seer'],
  [1, 'Warren Soultrader'],
  [1, 'Yawgmoth, Thran Physician'],
  [1, 'Zulaport Cutthroat'],
  [1, 'Sol Ring'],
  [1, 'Arcane Signet'],
  [1, 'Jet Medallion'],
  [1, 'Skullclamp'],
  [1, "Ashnod's Altar"],
  [1, 'Phyrexian Altar'],
  [1, 'Altar of Dementia'],
  [1, "Bolas's Citadel"],
  [1, "Sensei's Divining Top"],
  [1, 'Aetherflux Reservoir'],
  [1, 'Mind Stone'],
  [1, 'Animate Dead'],
  [1, 'Bastion of Remembrance'],
  [1, 'Necropotence'],
  [1, 'Phyrexian Arena'],
  [1, 'Grave Pact'],
  [1, 'Dance of the Dead'],
  [1, 'Necromancy'],
  [1, 'Dark Ritual'],
  [1, 'Cabal Ritual'],
  [1, 'Culling the Weak'],
  [1, 'Deadly Dispute'],
  [1, 'Village Rites'],
  [1, 'Corrupted Conviction'],
  [1, 'Entomb'],
  [1, 'Buried Alive'],
  [1, 'Reanimate'],
  [1, 'Victimize'],
  [1, 'Living Death'],
  [1, 'Diabolic Intent'],
  [1, 'Beseech the Mirror'],
  [1, 'Wishclaw Talisman'],
  [1, 'Feed the Swarm'],
  [1, 'Bitter Triumph'],
  [1, 'Snuff Out'],
  [1, 'Toxic Deluge'],
  [1, "Black Sun's Zenith"],
  [1, 'Malakir Rebirth // Malakir Mire'],
  [1, 'Unearth'],
  [1, 'Bone Shards'],
  [1, 'Eaten Alive'],
  [19, 'Swamp'],
  [1, 'Bojuka Bog'],
  [1, 'Takenuma, Abandoned Mire'],
  [1, 'Castle Locthwain'],
  [1, 'War Room'],
  [1, 'High Market'],
  [1, 'Cabal Coffers'],
  [1, 'Myriad Landscape'],
  [1, 'Demolition Field'],
  [1, "Witch's Cottage"],
  [1, 'Mortuary Mire'],
];

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
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

function formatDeck(commanders: DeckEntry[], main: DeckEntry[]): string {
  return ['Commander', ...commanders.map(formatEntry), '', 'Mainboard', ...main.map(formatEntry)].join('\n');
}

async function main(): Promise<void> {
  await Promise.all([
    unlink('bench01-liliana-general-ai-result.json').catch(() => undefined),
    unlink('bench01-liliana-general-ai-deck.txt').catch(() => undefined),
    unlink('bench01-liliana-general-ai-failure.txt').catch(() => undefined),
  ]);

  assert.equal(LOCKED_COUNTS.reduce((sum, [quantity]) => sum + quantity, 0), 100, 'locked Liliana baseline must contain exactly 100 cards');

  const rate = await getUsdNzdRateV13();
  const maxDeckUsdReference = nzdToUsdV13(MAX_DECK_NZD, rate.rate);
  const policy = await resolvePrintingPolicyV08({});
  const oracleNames = LOCKED_COUNTS.map(([, name]) => name === COMMANDER ? COMMANDER_LOOKUP : name);
  const canonical = await getCardsByNames(oracleNames);
  assert.deepEqual(canonical.notFound, [], 'every locked Liliana Oracle card must resolve');
  const byName = new Map<string, (typeof canonical.cards)[number]>();
  for (const card of canonical.cards) {
    byName.set(card.name.toLocaleLowerCase(), card);
    if (card.name === COMMANDER) byName.set(COMMANDER_LOOKUP.toLocaleLowerCase(), card);
  }

  const commanderEntries: DeckEntry[] = [];
  const mainEntries: DeckEntry[] = [];
  const selectedPrintings: Array<Record<string, unknown>> = [];
  let totalUsd = 0;

  for (const [quantity, requestedName] of LOCKED_COUNTS) {
    const lookupName = requestedName === COMMANDER ? COMMANDER_LOOKUP : requestedName;
    const card = byName.get(lookupName.toLocaleLowerCase()) ?? byName.get(requestedName.toLocaleLowerCase());
    assert.ok(card, `canonical card missing after collection resolve: ${requestedName}`);
    const selected = await selectEligiblePrintingV08(card, policy);
    assert.ok(selected, `no released physical priced printing available for ${requestedName}`);
    assert.notEqual(selected.priceUsd, null, `selected printing must have an observed USD price: ${requestedName}`);
    const priceUsd = selected.priceUsd as number;
    totalUsd += priceUsd * quantity;
    const entry: DeckEntry = {
      name: selected.card.name,
      quantity,
      set: selected.card.set.toUpperCase(),
      collectorNumber: selected.card.collector_number,
      ...(selected.finish ? { finish: selected.finish } : {}),
    };
    if (requestedName === COMMANDER) commanderEntries.push(entry);
    else mainEntries.push(entry);
    selectedPrintings.push({
      requestedName,
      oracleName: selected.card.name,
      quantity,
      set: selected.card.set.toUpperCase(),
      collectorNumber: selected.card.collector_number,
      finish: selected.finish,
      unitUsd: priceUsd,
      extendedUsd: Number((priceUsd * quantity).toFixed(2)),
      releasedAt: selected.card.released_at,
      matchedBy: selected.matchedBy,
    });
  }

  const decklist = formatDeck(commanderEntries, mainEntries);
  await writeFile('bench01-liliana-general-ai-deck.txt', `${decklist.trim()}\n`);
  const parsed = parseDecklist(decklist);
  assert.equal(parsed.totalCards, 100);
  assert.equal(parsed.commanders.length, 1);
  assert.equal(parsed.commanders[0]?.name, COMMANDER);

  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  assert.deepEqual(resolved.notFound, [], 'all exact selected Liliana baseline printings must resolve');
  const legality = validateCommanderDeck(parsed, resolved.cards);
  assert.equal(legality.isLegal, true, 'locked Liliana general-AI baseline must be Commander legal');

  const auditedTotalUsd = Number(totalUsd.toFixed(2));
  const auditedTotalNzd = Number(usdToNzdV13(auditedTotalUsd, rate.rate).toFixed(2));
  const withinBudget = auditedTotalNzd <= MAX_DECK_NZD + 1e-9;

  const strategyContext = deriveCommanderStrategyContextV15(parsed, resolved.cards);
  assert.ok(strategyContext.strategies.some((strategy) => strategy.score >= SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15));
  const strategySupport = measureUpgradeDeckStrategySupportV15(parsed, resolved.cards, strategyContext);
  assert.equal(strategySupport.evidenceComplete, true);

  const [spellbookBracket, combos, readiness] = await Promise.all([
    estimateCommanderBracket(decklist),
    findDeckCombos(decklist, 200),
    assessCedhReadinessV14(decklist, { creatureTypeOptimization: false }),
  ]);
  assert.notEqual(readiness.status, 'invalid-or-policy-noncompliant');
  const metrics = record(readiness.metrics);
  const comboCounts = record(combos.counts);
  const completeCombos = finite(comboCounts.included);
  const included = Array.isArray(combos.included) ? combos.included.map(record) : [];
  const ruthlessCombos = included.filter((combo) => String(combo.bracketTag ?? '') === 'R').length;
  const strategicallyRelevant = Array.isArray(spellbookBracket.strategicallyRelevantCombos)
    ? spellbookBracket.strategicallyRelevantCombos.length
    : 0;
  const winningCombos = finite(readiness.winningCombos);
  const gameChangerNames = resolved.cards.filter((card) => card.game_changer === true).map((card) => card.name).sort();

  const ceiling = assessBracketCeilingV15(TARGET_BRACKET, {
    commanderLegal: legality.isLegal,
    exactCardCount: parsed.totalCards === 100,
    fullyResolved: true,
    printingPolicyCompliant: true,
    spellbookTag: typeof spellbookBracket.bracketTag === 'string' ? spellbookBracket.bracketTag : null,
    verifiedWinningCombos: winningCombos,
    ruthlessWinningCombos: ruthlessCombos,
    strategicallyRelevantCombos: strategicallyRelevant,
    averageNonlandManaValue: finite(metrics.averageNonlandManaValue, 99),
    earlyPlayCount: finite(metrics.earlyPlayCount),
    fastManaCount: finite(metrics.fastManaCount),
    freeInteractionCount: finite(metrics.freeInteractionCount),
    cheapInteractionCount: finite(metrics.cheapInteractionCount),
    tutorCount: finite(metrics.tutorCount),
    gameChangerCount: gameChangerNames.length,
    efficientWinConditionEvidence: false,
    optimizedPlanEvidence: readiness.status === 'strong-competitive-construction-signals',
    cedhIntent: true,
    competitiveMetagameEvidence: false,
  }, [
    'Independent general-purpose-AI baseline locked before specialist result review.',
    `NZ$${MAX_DECK_NZD} hard whole-deck budget.`,
    `Fixed commander: ${COMMANDER}.`,
    'Creature-type/tribal optimization receives no credit.',
    'Primary identity: sacrifice/aristocrats plus graveyard recursion/reanimation.',
  ]);

  const result = {
    schema: 'bench01-liliana-general-ai-baseline-v1',
    fixture: 'BENCH-01 Batch A / Liliana independent general-AI comparison',
    lockDocument: 'docs/BENCH-01-BATCH-A-LILIANA-BASELINE-LOCK-2026-09-05.md',
    antiLeak: true,
    commander: COMMANDER,
    targetBracket: TARGET_BRACKET,
    maxDeckNzd: MAX_DECK_NZD,
    maxDeckUsdReference,
    currencyPolicy: {
      primaryCurrency: 'NZD',
      usdToNzdRate: rate.rate,
      rateDate: rate.rateDate,
      rateSource: rate.source,
    },
    budgetAudit: {
      auditedTotalUsd,
      auditedTotalNzd,
      withinBudget,
      headroomNzd: Number((MAX_DECK_NZD - auditedTotalNzd).toFixed(2)),
      selectedPrintings,
    },
    legality,
    strategyContext,
    strategySupport,
    spellbookBracket,
    comboSummary: {
      completeCombos,
      winningCombos,
      ruthlessCombos,
      strategicallyRelevant,
    },
    readiness,
    gameChangerNames,
    ceiling,
  };

  await writeFile('bench01-liliana-general-ai-result.json', `${JSON.stringify(result, null, 2)}\n`);
  console.log('BENCH-01 LILIANA GENERAL-AI BASELINE — VERIFICATION COMPLETE');
  console.log(`BUDGET: NZ$${auditedTotalNzd.toFixed(2)} / NZ$${MAX_DECK_NZD.toFixed(2)}; within=${String(withinBudget)}`);
  console.log(`COMBOS: complete=${completeCombos}; winning=${winningCombos}; ruthless=${ruthlessCombos}`);
  console.log(`READINESS: ${String(readiness.status)}`);
  console.log(`ASSESSED BRACKET: ${String(ceiling.assessedBracket ?? 'unassessable')} (${String(ceiling.assessedBand)})`);

  // Keep the locked baseline immutable. Over-budget is a benchmark loss for the
  // independent general-AI deck, not a reason to silently change cards here.
  assert.equal(withinBudget, true, `locked general-AI baseline exceeds NZ$${MAX_DECK_NZD}; record this baseline as a comparison loss rather than mutating it`);
  assert.equal(ceiling.hardGatesPassed, true);
  assert.ok(winningCombos > 0, 'locked general-AI baseline must retain at least one verified winning route');
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  await writeFile('bench01-liliana-general-ai-failure.txt', `${message}\n`).catch(() => undefined);
  console.error('BENCH-01 LILIANA GENERAL-AI BASELINE — HARD FAILURE');
  console.error(message);
  process.exitCode = 1;
});
