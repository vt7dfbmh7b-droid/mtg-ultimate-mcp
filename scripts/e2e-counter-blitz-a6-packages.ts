import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import {
  auditUpgradeDeckStrategyRetentionV15,
  cardCommanderStrategyAffinityV15,
  deriveUpgradeStrategyContextV15,
} from '../src/services/commander-strategy-affinity-v15.js';
import { buildDeckMetrics, parseDecklist, type DeckEntry, type ParsedDeck } from '../src/services/deck.js';
import { discoverEligiblePoolV15 } from '../src/services/neutral-deck-builder-v15.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardOracleText, getCardsByIdentifiers, inferCardRoles, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06 } from '../src/services/simulation-v06.js';
import {
  BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15,
  BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15,
  minimumPersistentColoredManaSourcesV15,
} from '../src/services/upgrade.js';

const COMBO_CARDS = new Set(['gatta and luzzu', 'hardened scales', 'walking ballista', 'the earth crystal']);
const COMBOS = [
  ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista'],
  ['Gatta and Luzzu', 'The Earth Crystal', 'Walking Ballista'],
];
const CURATED_CHALLENGERS = [
  'Yuna, Grand Summoner',
  'Incubation Druid',
  'Rikku, Resourceful Guardian',
  'The Destined Thief',
  'Professor Hojo',
  'Shelinda, Yevon Acolyte',
  'Resourceful Defense',
  'Together Forever',
  'Forgotten Ancient',
  'Path of Discovery',
  'Urza, Lord High Artificer',
  'Summon: Fenrir',
];
const CRITICAL_ROLES = ['combo protection', 'mana multiplier', 'free interaction', 'free-cast engine', 'early acceleration'] as const;
const VALIDATION_SEEDS = [20260829, 20260901, 20260917, 20261003, 20261111];

function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function n(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
function norm(value: string): string { return value.trim().toLocaleLowerCase(); }
function roles(card: ScryfallCard): Set<string> { return new Set(inferCardRoles(card)); }

function extractA2Deck(markdown: string): string {
  const match = markdown.match(/## Final corrected decklist[\s\S]*?```text\n([\s\S]*?)\n```/);
  assert.ok(match?.[1], 'could not extract Version A decklist');
  return match[1].trim().replace('1 Archmage Emeritus (FIC) 261', '1 The Earth Crystal (FIN) 184');
}

function identifiers(parsed: ParsedDeck): CardIdentifierInput[] {
  return [...parsed.commanders, ...parsed.main].map((entry) => ({ name: entry.name, ...(entry.set ? { set: entry.set } : {}), ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}) }));
}
async function resolveDeck(decklist: string) {
  const parsed = parseDecklist(decklist);
  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  return { parsed, cards: resolved.cards, notFound: resolved.notFound };
}
function commanderIdentity(parsed: ParsedDeck, cards: ScryfallCard[]): string[] {
  const names = new Set(parsed.commanders.map((entry) => norm(entry.name)));
  return [...new Set(cards.filter((card) => names.has(norm(card.name))).flatMap((card) => card.color_identity))].sort();
}
function line(entry: DeckEntry): string {
  const printing = entry.set && entry.collectorNumber ? ` (${entry.set.toUpperCase()}) ${entry.collectorNumber}` : '';
  const finish = entry.finish === 'foil' ? ' *F*' : entry.finish === 'etched' ? ' *E*' : entry.finish === 'nonfoil' ? ' *N*' : '';
  return `${entry.quantity} ${entry.name}${printing}${finish}`;
}
function renderPackage(parsed: ParsedDeck, cuts: string[], adds: ScryfallCard[]): string {
  const cutSet = new Set(cuts.map(norm));
  const main = parsed.main.filter((entry) => !(entry.quantity === 1 && cutSet.has(norm(entry.name)))).map(line);
  assert.equal(parsed.main.length - main.length, cuts.length, 'package cuts must each exist once');
  main.push(...adds.map((card) => `1 ${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`));
  return ['// COMMANDER', ...parsed.commanders.map(line), '', '// MAIN', ...main].join('\n');
}
function replaceResolvedCards(cards: ScryfallCard[], cuts: string[], adds: ScryfallCard[]): ScryfallCard[] {
  const next = [...cards];
  for (const cut of cuts) {
    const index = next.findIndex((card) => norm(card.name) === norm(cut));
    assert.ok(index >= 0, `resolved cut ${cut} must exist`);
    next.splice(index, 1);
  }
  next.push(...adds);
  return next;
}

function roleCounts(cards: ScryfallCard[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const card of cards) for (const role of inferCardRoles(card)) counts[role] = (counts[role] ?? 0) + 1;
  return counts;
}
function criticalRolePreserved(beforeCards: ScryfallCard[], afterCards: ScryfallCard[]): { passed: boolean; deltas: Record<string, number> } {
  const before = roleCounts(beforeCards);
  const after = roleCounts(afterCards);
  const deltas = Object.fromEntries(CRITICAL_ROLES.map((role) => [role, (after[role] ?? 0) - (before[role] ?? 0)]));
  return { passed: Object.values(deltas).every((value) => value >= 0), deltas };
}
function constructionFloor(metrics: ReturnType<typeof buildDeckMetrics>, colors: number) {
  const failures: string[] = [];
  if (metrics.averageNonlandManaValue > BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15) failures.push('average-nonland-mv');
  if (metrics.earlyPlayCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.earlyPlays) failures.push('early-plays');
  if (metrics.cheapInteractionCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.cheapInteraction) failures.push('cheap-interaction');
  if (metrics.fastManaCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.fastMana) failures.push('fast-mana');
  if (Number(metrics.roleCounts['free interaction'] ?? 0) < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.freeInteraction) failures.push('free-interaction');
  if (metrics.tutorCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.tutors) failures.push('tutors');
  if (metrics.persistentColoredManaSourceCount < minimumPersistentColoredManaSourcesV15(colors)) failures.push('persistent-colored-mana');
  return { passed: failures.length === 0, failures };
}

function quality(card: ScryfallCard, strategyContext: ReturnType<typeof deriveUpgradeStrategyContextV15>): number {
  const r = roles(card);
  const affinity = cardCommanderStrategyAffinityV15(card, strategyContext).score;
  let score = affinity * 4 - card.cmc * 1.6;
  if (r.has('combo protection')) score += 30;
  if (r.has('free interaction')) score += 28;
  if (r.has('mana multiplier')) score += 24;
  if (r.has('early acceleration')) score += 22;
  else if (r.has('fast mana')) score += 18;
  if (r.has('tutor')) score += 18;
  if (r.has('countermagic')) score += card.cmc <= 2 ? 14 : 8;
  if (r.has('spot interaction')) score += card.cmc <= 2 ? 13 : 7;
  if (r.has('protection') || r.has('board protection')) score += card.cmc <= 2 ? 12 : 8;
  if (r.has('free-cast engine')) score += 14;
  if (r.has('combat value engine')) score += 10;
  if (r.has('repeatable draw')) score += 9;
  if (r.has('card draw') || r.has('card selection')) score += 5;
  if (r.has('+1/+1 counters')) score += 8;
  if (r.has('mana acceleration') || r.has('mana dork') || r.has('cost reduction')) score += 7;
  if (card.game_changer === true) score += 10;
  return Number(score.toFixed(3));
}
function pairSynergy(left: ScryfallCard, right: ScryfallCard): number {
  const lr = roles(left); const rr = roles(right);
  const lt = getCardOracleText(left).toLocaleLowerCase(); const rt = getCardOracleText(right).toLocaleLowerCase();
  let score = 0;
  if (lr.has('+1/+1 counters') && rr.has('+1/+1 counters')) score += 8;
  if ((lr.has('+1/+1 counters') && rr.has('mana dork')) || (rr.has('+1/+1 counters') && lr.has('mana dork'))) score += 7;
  if ((lr.has('combat value engine') && /can't be blocked|unblockable/.test(rt)) || (rr.has('combat value engine') && /can't be blocked|unblockable/.test(lt))) score += 6;
  if ((/counter/.test(lt) && /counter/.test(rt))) score += 4;
  if ((lr.has('mana acceleration') && rr.has('repeatable draw')) || (rr.has('mana acceleration') && lr.has('repeatable draw'))) score += 2;
  return score;
}

function simulate(parsed: ParsedDeck, cards: ScryfallCard[], seed: number, iterations: number): Record<string, unknown> {
  return simulateDeckGameplayV06(parsed, cards, { iterations, advancedIterations: iterations, turns: 7, seed, pressure: 'cedh', comboPieces: COMBOS });
}
function signals(result: Record<string, unknown>): Record<string, number> {
  const baseline = record(result.baseline); const opening = record(baseline.openingHands); const tutors = record(baseline.tutors);
  const advanced = record(result.advanced); const commander = record(advanced.commanderPressure); const interaction = record(advanced.interactionPressure); const flow = record(advanced.cardFlow);
  const combos = Array.isArray(advanced.combos) ? advanced.combos.map(record) : [];
  const ready = combos.map((combo) => n(record(combo.allNamedPiecesInHandOrBattlefieldByTurn).turn7));
  const seen = combos.map((combo) => n(record(combo.allNamedPiecesSeenByTurn).turn7));
  return {
    functionalKeepRate: n(opening.functionalKeepRate), commanderUptimePercent: n(commander.battlefieldUptimePercent), protectionWinRate: n(interaction.protectionWinRateWhenChallenged),
    averageSpellsCast: n(flow.averageSpellsCast), averageCardsDrawn: n(flow.averageCardsDrawnByEffects), tutorHitRate: n(tutors.hitRateByTurn7 ?? tutors.hitRate ?? 0),
    bestComboReadyTurn7: ready.length ? Math.max(...ready) : 0, bestComboSeenTurn7: seen.length ? Math.max(...seen) : 0,
  };
}
function delta(before: Record<string, number>, after: Record<string, number>): Record<string, number> { return Object.fromEntries(Object.keys(before).map((key) => [key, Number((n(after[key]) - n(before[key])).toFixed(3))])); }
function simulationScore(beforeMetrics: ReturnType<typeof buildDeckMetrics>, afterMetrics: ReturnType<typeof buildDeckMetrics>, d: Record<string, number>): number {
  let score = n(d.functionalKeepRate) * 0.45 + n(d.commanderUptimePercent) * 0.18 + n(d.protectionWinRate) * 0.2 + n(d.averageSpellsCast) * 4.2 + n(d.averageCardsDrawn) * 2.1 + n(d.tutorHitRate) * 0.15 + n(d.bestComboReadyTurn7) * 0.6 + n(d.bestComboSeenTurn7) * 0.35;
  score += (afterMetrics.cheapInteractionCount - beforeMetrics.cheapInteractionCount) * 0.6 + (afterMetrics.tutorCount - beforeMetrics.tutorCount) * 0.9 + (afterMetrics.protectionCount - beforeMetrics.protectionCount) * 0.5 + (afterMetrics.fastManaCount - beforeMetrics.fastManaCount) * 0.75 + (beforeMetrics.averageNonlandManaValue - afterMetrics.averageNonlandManaValue) * 0.8;
  return Number(score.toFixed(3));
}
function regression(d: Record<string, number>): boolean { return n(d.functionalKeepRate) <= -4 || n(d.commanderUptimePercent) <= -6 || n(d.averageSpellsCast) <= -0.35 || n(d.bestComboReadyTurn7) <= -4 || n(d.protectionWinRate) <= -10; }

async function main(): Promise<void> {
  console.log('COUNTER BLITZ A6 TWO-CARD PACKAGE OPTIMIZER');
  const source = await readFile('test-results/exploratory/counter-blitz-ff-tidus-2026-08-29.md', 'utf8');
  const baselineDeck = extractA2Deck(source);
  const baseline = await resolveDeck(baselineDeck);
  assert.equal(baseline.notFound.length, 0); assert.equal(validateCommanderDeck(baseline.parsed, baseline.cards).isLegal, true);
  const policy = await resolvePrintingPolicyV08({ printingFamily: 'Final Fantasy', includePromos: true, includeSpecialReleases: true });
  const identity = commanderIdentity(baseline.parsed, baseline.cards); const strategyContext = deriveUpgradeStrategyContextV15(baseline.parsed, baseline.cards);
  const pool = await discoverEligiblePoolV15(identity, policy, undefined); const currentNames = new Set([...baseline.parsed.commanders, ...baseline.parsed.main].map((entry) => norm(entry.name)));
  const poolByName = new Map(pool.map((card) => [norm(card.name), card] as const));
  const curated = CURATED_CHALLENGERS.map((name) => poolByName.get(norm(name))).filter((card): card is ScryfallCard => Boolean(card) && !currentNames.has(norm(card.name)));
  const extras = pool.filter((card) => !card.type_line.toLocaleLowerCase().includes('land') && !currentNames.has(norm(card.name)) && card.cmc <= 4).map((card) => ({ card, q: quality(card, strategyContext) })).sort((a, b) => b.q - a.q).slice(0, 12).map((item) => item.card);
  const challengers = [...new Map([...curated, ...extras].map((card) => [norm(card.name), card] as const)).values()].slice(0, 20);

  const cutPool = baseline.parsed.main.map((entry) => ({ entry, card: baseline.cards.find((card) => norm(card.name) === norm(entry.name)) }))
    .filter((item): item is { entry: DeckEntry; card: ScryfallCard } => Boolean(item.card) && !item.card.type_line.toLocaleLowerCase().includes('land') && !COMBO_CARDS.has(norm(item.entry.name)))
    .map((item) => ({ ...item, q: quality(item.card, strategyContext) })).sort((a, b) => a.q - b.q).slice(0, 32);

  const beforeMetrics = buildDeckMetrics(baseline.parsed, baseline.cards); assert.equal(constructionFloor(beforeMetrics, identity.length).passed, true);
  console.log(`challengers=${challengers.length}: ${challengers.map((card) => card.name).join(', ')}`);
  console.log(`cutPool=${cutPool.length}: ${cutPool.map((item) => item.card.name).join(', ')}`);

  const structural: Array<Record<string, unknown>> = [];
  for (let ai = 0; ai < challengers.length; ai++) for (let aj = ai + 1; aj < challengers.length; aj++) {
    const adds = [challengers[ai]!, challengers[aj]!]; const addQuality = quality(adds[0], strategyContext) + quality(adds[1], strategyContext) + pairSynergy(adds[0], adds[1]);
    for (let ci = 0; ci < cutPool.length; ci++) for (let cj = ci + 1; cj < cutPool.length; cj++) {
      const cuts = [cutPool[ci]!, cutPool[cj]!];
      const cards = replaceResolvedCards(baseline.cards, cuts.map((item) => item.entry.name), adds);
      const roleGuard = criticalRolePreserved(baseline.cards, cards); if (!roleGuard.passed) continue;
      const decklist = renderPackage(baseline.parsed, cuts.map((item) => item.entry.name), adds); const parsed = parseDecklist(decklist);
      const rules = validateCommanderDeck(parsed, cards); if (!rules.isLegal || parsed.totalCards !== 100 || !cards.every((card) => printingMatchesPolicyV08(card, policy))) continue;
      const retention = auditUpgradeDeckStrategyRetentionV15(baseline.parsed, baseline.cards, parsed, cards); if (!retention.preserved) continue;
      const metrics = buildDeckMetrics(parsed, cards); const floor = constructionFloor(metrics, identity.length); if (!floor.passed) continue;
      const cutQuality = cuts[0].q + cuts[1].q; const heuristic = Number((addQuality - cutQuality + (beforeMetrics.averageNonlandManaValue - metrics.averageNonlandManaValue) * 3).toFixed(3));
      structural.push({ cuts: cuts.map((item) => item.entry.name), adds: adds.map((card) => card.name), printings: adds.map((card) => ({ name: card.name, set: card.set.toUpperCase(), collectorNumber: card.collector_number })), heuristic, roleDeltas: roleGuard.deltas, metricDelta: { averageNonlandManaValue: Number((metrics.averageNonlandManaValue - beforeMetrics.averageNonlandManaValue).toFixed(3)), earlyPlayCount: metrics.earlyPlayCount - beforeMetrics.earlyPlayCount, cheapInteractionCount: metrics.cheapInteractionCount - beforeMetrics.cheapInteractionCount, fastManaCount: metrics.fastManaCount - beforeMetrics.fastManaCount, tutorCount: metrics.tutorCount - beforeMetrics.tutorCount, protectionCount: metrics.protectionCount - beforeMetrics.protectionCount }, decklist });
    }
  }
  structural.sort((a, b) => n(b.heuristic) - n(a.heuristic));
  const prefiltered = structural.slice(0, 120);
  console.log(`structural survivors=${structural.length}; simulating top=${prefiltered.length}`);

  const beforePrimary = signals(simulate(baseline.parsed, baseline.cards, 20260829, 250));
  const firstPass: Array<Record<string, unknown>> = [];
  for (const pkg of prefiltered) {
    const resolved = await resolveDeck(String(pkg.decklist)); const metrics = buildDeckMetrics(resolved.parsed, resolved.cards);
    const after = signals(simulate(resolved.parsed, resolved.cards, 20260829, 250)); const d = delta(beforePrimary, after); if (regression(d)) continue;
    firstPass.push({ ...pkg, primaryDelta: d, primaryScore: simulationScore(beforeMetrics, metrics, d) + n(pkg.heuristic) * 0.025 });
  }
  firstPass.sort((a, b) => n(b.primaryScore) - n(a.primaryScore)); const finalists = firstPass.slice(0, 14);
  console.log(`firstPass survivors=${firstPass.length}; finalists=${finalists.map((item) => `[${(item.cuts as string[]).join(' + ')}] -> [${(item.adds as string[]).join(' + ')}] ${String(item.primaryScore)}`).join(' | ')}`);

  const baselineBySeed = new Map<number, Record<string, number>>(); for (const seed of VALIDATION_SEEDS) baselineBySeed.set(seed, signals(simulate(baseline.parsed, baseline.cards, seed, 1500)));
  const validation: Array<Record<string, unknown>> = [];
  for (const finalist of finalists) {
    const resolved = await resolveDeck(String(finalist.decklist)); const metrics = buildDeckMetrics(resolved.parsed, resolved.cards); const runs: Array<Record<string, unknown>> = [];
    for (const seed of VALIDATION_SEEDS) { const d = delta(baselineBySeed.get(seed)!, signals(simulate(resolved.parsed, resolved.cards, seed, 1500))); runs.push({ seed, delta: d, score: simulationScore(beforeMetrics, metrics, d), significantRegression: regression(d) }); }
    const scores = runs.map((run) => n(run.score)); const mean = scores.reduce((a, b) => a + b, 0) / scores.length; const min = Math.min(...scores); const positiveSeeds = scores.filter((value) => value > 0).length;
    const robust = runs.every((run) => run.significantRegression !== true) && positiveSeeds >= 4 && mean > 0.3 && min > -0.2;
    validation.push({ cuts: finalist.cuts, adds: finalist.adds, printings: finalist.printings, heuristic: finalist.heuristic, meanScore: Number(mean.toFixed(3)), minScore: Number(min.toFixed(3)), positiveSeeds, robust, runs, metricDelta: finalist.metricDelta, roleDeltas: finalist.roleDeltas, decklist: finalist.decklist });
    console.log(`[${(finalist.cuts as string[]).join(' + ')}] -> [${(finalist.adds as string[]).join(' + ')}] mean=${mean.toFixed(3)} min=${min.toFixed(3)} positive=${positiveSeeds}/5 robust=${robust}`);
  }
  validation.sort((a, b) => n(b.meanScore) - n(a.meanScore)); const champion = validation.find((item) => item.robust === true) ?? null; const finalDecklist = champion ? String(champion.decklist) : baselineDeck;
  const result = { schema: 'counter-blitz-a6-packages-v1', objective: 'Find semantically safe two-card FF-only packages that outperform A2 when one-for-one optimization plateaus.', challengers: challengers.map((card) => ({ name: card.name, set: card.set.toUpperCase(), collectorNumber: card.collector_number, roles: [...roles(card)].sort(), quality: quality(card, strategyContext) })), structuralSurvivors: structural.length, firstPassTop: firstPass.slice(0, 40).map(({ decklist: _d, ...rest }) => rest), validation: validation.map(({ decklist: _d, ...rest }) => rest), champion: champion ? { ...champion, decklist: undefined } : null, finalDecklist, conclusion: champion ? `A6 found a robust two-card package: ${(champion.cuts as string[]).join(' + ')} -> ${(champion.adds as string[]).join(' + ')}. Manual strategic audit remains required.` : 'A6 found no semantically safe robust two-card package strong enough to displace A2.', note: 'Exploratory isolated branch only. No stable/current promotion and no PR #29 merge.' };
  await writeFile('counter-blitz-a6-packages-result.json', `${JSON.stringify(result, null, 2)}\n`, 'utf8'); await writeFile('counter-blitz-a6-packages-deck.txt', `${finalDecklist.trim()}\n`, 'utf8'); console.log(`A6 CONCLUSION: ${result.conclusion}`);
}

main().catch(async (error) => { const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error); console.error(message); await writeFile('counter-blitz-a6-packages-failure.txt', `${message}\n`, 'utf8').catch(() => undefined); process.exitCode = 1; });
