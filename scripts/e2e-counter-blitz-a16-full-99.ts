import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { auditCardPurposeV15 } from '../src/services/card-purpose-v15.js';
import { boundedComboSelectionAccessV15 } from '../src/services/combo-selection-v15.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type DeckEntry, type ParsedDeck } from '../src/services/deck.js';
import { expandResolvedDeckSlotsV15 } from '../src/services/deck-slots-v15.js';
import { auditFullDeckV15, type FullDeckAuditV15 } from '../src/services/full-deck-audit-v15.js';
import { discoverEligiblePoolV15 } from '../src/services/neutral-deck-builder-v15.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, inferCardRoles, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06 } from '../src/services/simulation-v06.js';
import { BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15, BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15, minimumPersistentColoredManaSourcesV15 } from '../src/services/upgrade.js';

const COMBO_NAMES = ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista', 'The Earth Crystal'] as const;
const COMBO_SET = new Set(COMBO_NAMES.map((name) => name.toLocaleLowerCase()));
const COMBOS = [
  ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista'],
  ['Gatta and Luzzu', 'The Earth Crystal', 'Walking Ballista'],
];
const PROTECTED_NAMES = [
  'Counterspell',
  "An Offer You Can't Refuse",
  'Force of Negation',
  'Silence',
  "Nature's Claim",
  "Conqueror's Flail",
  'Ranger-Captain of Eos',
  'Cyclonic Rift',
  'Swords to Plowshares',
  'Path to Exile',
  'Heroic Intervention',
  'Arcane Signet',
  'Everflowing Chalice',
  'Incubation Druid',
  'Endurance',
] as const;
const CRITICAL_ROLES = ['combo protection', 'mana multiplier', 'free interaction', 'free-cast engine', 'early acceleration'] as const;
const SEEDS = [20260829, 20260901, 20260917, 20261003, 20261111];
const STATUS_WEIGHT = { challenge: 0, review: 1, supported: 2, locked: 99 } as const;

function norm(value: string): string { return value.trim().toLocaleLowerCase(); }
function rec(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function num(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
function extractA2(markdown: string): string {
  const match = markdown.match(/## Final corrected decklist[\s\S]*?```text\n([\s\S]*?)\n```/);
  assert.ok(match?.[1], 'could not extract A2 deck');
  return match[1].trim().replace('1 Archmage Emeritus (FIC) 261', '1 The Earth Crystal (FIN) 184');
}
function identifiers(parsed: ParsedDeck): CardIdentifierInput[] {
  return [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
}
async function resolveDeck(decklist: string) {
  const parsed = parseDecklist(decklist);
  const result = await getCardsByIdentifiers(identifiers(parsed));
  return { parsed, cards: result.cards, notFound: result.notFound };
}
function line(entry: DeckEntry): string {
  const printing = entry.set && entry.collectorNumber ? ` (${entry.set.toUpperCase()}) ${entry.collectorNumber}` : '';
  return `${entry.quantity} ${entry.name}${printing}`;
}
function renderChanges(parsed: ParsedDeck, cuts: readonly string[], adds: readonly ScryfallCard[]): string {
  const cutSet = new Set(cuts.map(norm));
  const main = parsed.main.filter((entry) => !(entry.quantity === 1 && cutSet.has(norm(entry.name)))).map(line);
  assert.equal(parsed.main.length - main.length, cuts.length, `missing cut(s): ${cuts.join(' + ')}`);
  main.push(...adds.map((card) => `1 ${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`));
  return ['// COMMANDER', ...parsed.commanders.map(line), '', '// MAIN', ...main].join('\n');
}
function replaceCards(cards: readonly ScryfallCard[], cuts: readonly string[], adds: readonly ScryfallCard[]): ScryfallCard[] {
  const next = [...cards];
  for (const cut of cuts) {
    const index = next.findIndex((card) => norm(card.name) === norm(cut));
    assert.ok(index >= 0, `missing resolved cut ${cut}`);
    next.splice(index, 1);
  }
  next.push(...adds);
  return next;
}
function commanderNames(parsed: ParsedDeck): Set<string> { return new Set(parsed.commanders.map((entry) => norm(entry.name))); }
function commanderCard(parsed: ParsedDeck, cards: readonly ScryfallCard[]): ScryfallCard {
  const names = commanderNames(parsed);
  const card = cards.find((candidate) => names.has(norm(candidate.name)));
  assert.ok(card, 'commander not resolved');
  return card;
}
function identity(parsed: ParsedDeck, cards: readonly ScryfallCard[]): string[] {
  const names = commanderNames(parsed);
  return [...new Set(cards.filter((card) => names.has(norm(card.name))).flatMap((card) => card.color_identity))].sort();
}
function roleCounts(cards: readonly ScryfallCard[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const card of cards) for (const role of inferCardRoles(card)) out[role] = (out[role] ?? 0) + 1;
  return out;
}
function criticalPreserved(before: readonly ScryfallCard[], after: readonly ScryfallCard[]): boolean {
  const beforeRoles = roleCounts(before);
  const afterRoles = roleCounts(after);
  return CRITICAL_ROLES.every((role) => (afterRoles[role] ?? 0) >= (beforeRoles[role] ?? 0));
}
function floor(metrics: ReturnType<typeof buildDeckMetrics>, colors: number): string[] {
  const failures: string[] = [];
  if (metrics.averageNonlandManaValue > BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15) failures.push('average-nonland-mv');
  if (metrics.earlyPlayCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.earlyPlays) failures.push('early-plays');
  if (metrics.cheapInteractionCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.cheapInteraction) failures.push('cheap-interaction');
  if (metrics.fastManaCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.fastMana) failures.push('fast-mana');
  if (Number(metrics.roleCounts['free interaction'] ?? 0) < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.freeInteraction) failures.push('free-interaction');
  if (metrics.tutorCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.tutors) failures.push('tutors');
  if (metrics.persistentColoredManaSourceCount < minimumPersistentColoredManaSourcesV15(colors)) failures.push('persistent-colored-mana');
  return failures;
}
function simulate(parsed: ParsedDeck, cards: ScryfallCard[], seed: number, iterations = 1400): Record<string, unknown> {
  return simulateDeckGameplayV06(parsed, cards, { iterations, advancedIterations: iterations, turns: 7, seed, pressure: 'cedh', comboPieces: COMBOS });
}
function signals(result: Record<string, unknown>): Record<string, number> {
  const baseline = rec(result.baseline);
  const opening = rec(baseline.openingHands);
  const tutors = rec(baseline.tutors);
  const advanced = rec(result.advanced);
  const commander = rec(advanced.commanderPressure);
  const interaction = rec(advanced.interactionPressure);
  const flow = rec(advanced.cardFlow);
  const combos = Array.isArray(advanced.combos) ? advanced.combos.map(rec) : [];
  const ready = combos.map((combo) => num(rec(combo.allNamedPiecesInHandOrBattlefieldByTurn).turn7));
  const seen = combos.map((combo) => num(rec(combo.allNamedPiecesSeenByTurn).turn7));
  return {
    keep: num(opening.functionalKeepRate),
    uptime: num(commander.battlefieldUptimePercent),
    protection: num(interaction.protectionWinRateWhenChallenged),
    spells: num(flow.averageSpellsCast),
    draws: num(flow.averageCardsDrawnByEffects),
    tutorHit: num(tutors.hitRateByTurn7 ?? tutors.hitRate ?? 0),
    comboReady: ready.length ? Math.max(...ready) : 0,
    comboSeen: seen.length ? Math.max(...seen) : 0,
  };
}
function delta(before: Record<string, number>, after: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.keys(before).map((key) => [key, Number((num(after[key]) - num(before[key])).toFixed(3))]));
}
function regression(change: Record<string, number>): boolean {
  return num(change.keep) <= -4 || num(change.uptime) <= -6 || num(change.spells) <= -0.35 || num(change.comboReady) <= -4 || num(change.protection) <= -10;
}
function simulationScore(before: ReturnType<typeof buildDeckMetrics>, after: ReturnType<typeof buildDeckMetrics>, change: Record<string, number>): number {
  let score = num(change.keep) * 0.45 + num(change.uptime) * 0.18 + num(change.protection) * 0.22 + num(change.spells) * 4.5 + num(change.draws) * 2 + num(change.tutorHit) * 0.2 + num(change.comboReady) * 0.7 + num(change.comboSeen) * 0.35;
  score += (after.cheapInteractionCount - before.cheapInteractionCount) * 0.65
    + (Number(after.roleCounts['free interaction'] ?? 0) - Number(before.roleCounts['free interaction'] ?? 0)) * 1.4
    + (after.rampCount - before.rampCount) * 0.35
    + (after.persistentColoredManaSourceCount - before.persistentColoredManaSourceCount) * 0.4
    + (before.averageNonlandManaValue - after.averageNonlandManaValue) * 0.9;
  return Number(score.toFixed(3));
}
function auditMarkdown(audit: FullDeckAuditV15): string {
  const lines = [
    '# Counter Blitz A16 — Full Physical 99 Audit',
    '',
    `Physical slots audited: ${audit.physicalSlots}`,
    `Locked: ${audit.counts.locked} | Supported: ${audit.counts.supported} | Review: ${audit.counts.review} | Challenge: ${audit.counts.challenge}`,
    '',
    '| Slot | Card | Printing | Status | Score | Purpose | Warnings | Removal consequence |',
    '|---:|---|---|---|---:|---|---|---|',
  ];
  for (const slot of audit.slots) {
    const purpose = slot.purposes.join('; ') || 'none identified';
    const warnings = slot.warnings.join('; ') || 'none';
    const safe = (value: string) => value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    lines.push(`| ${slot.slot} | ${safe(slot.cardName)}${slot.copy > 1 ? ` (copy ${slot.copy})` : ''} | ${slot.set} ${slot.collectorNumber} | ${slot.status} | ${slot.score} | ${safe(purpose)} | ${safe(warnings)} | ${safe(slot.removalConsequence)} |`);
  }
  lines.push('', audit.note, '');
  return lines.join('\n');
}

async function main(): Promise<void> {
  console.log('COUNTER BLITZ A16 FULL PHYSICAL 99 + OPEN SELECTOR SCAN');
  const source = await readFile('test-results/exploratory/counter-blitz-ff-tidus-2026-08-29.md', 'utf8');
  const a2 = await resolveDeck(extractA2(source));
  assert.equal(a2.notFound.length, 0, `A2 unresolved: ${a2.notFound.join(', ')}`);

  const policy = await resolvePrintingPolicyV08({ printingFamily: 'Final Fantasy', includePromos: true, includeSpecialReleases: true });
  const colors = identity(a2.parsed, a2.cards);
  const pool = await discoverEligiblePoolV15(colors, policy, undefined);
  const byName = new Map(pool.map((card) => [norm(card.name), card] as const));
  const need = (name: string): ScryfallCard => { const found = byName.get(norm(name)); assert.ok(found, `missing FF candidate ${name}`); return found; };

  const baseA5 = await resolveDeck(renderChanges(a2.parsed, ['Conformer Shuriken'], [need('Incubation Druid')]));
  const baseA12 = await resolveDeck(renderChanges(baseA5.parsed, ['Retrieve the Esper'], [need('Everflowing Chalice')]));
  const baseline = await resolveDeck(renderChanges(baseA12.parsed, ['Garnet, Princess of Alexandria', "Sazh's Chocobo"], [need('Arcane Signet'), need('Endurance')]));
  assert.equal(baseline.notFound.length, 0, `A14 unresolved: ${baseline.notFound.join(', ')}`);
  assert.equal(baseline.parsed.totalCards, 100);

  const commander = commanderCard(baseline.parsed, baseline.cards);
  const expanded = expandResolvedDeckSlotsV15(baseline.parsed, baseline.cards);
  assert.equal(expanded.unresolved.length, 0, `unresolved physical entries: ${expanded.unresolved.map((entry) => entry.entry.name).join(', ')}`);
  assert.equal(expanded.commanders.length, 1);
  assert.equal(expanded.main.length, 99, `expected physical 99, got ${expanded.main.length}`);
  const physicalMain = expanded.main.map((slot) => slot.card);
  const comboPieces = COMBO_NAMES.map((name) => baseline.cards.find((card) => norm(card.name) === norm(name))).filter((card): card is ScryfallCard => Boolean(card));
  assert.equal(comboPieces.length, COMBO_NAMES.length);

  const fullAudit = auditFullDeckV15(expanded.main, { commander, comboPieces, protectedCardNames: PROTECTED_NAMES });
  assert.equal(fullAudit.physicalSlots, 99);
  await writeFile('counter-blitz-a16-full-99-audit.json', `${JSON.stringify(fullAudit, null, 2)}\n`, 'utf8');
  await writeFile('counter-blitz-a16-full-99-audit.md', auditMarkdown(fullAudit), 'utf8');
  console.log('Full 99 audit counts:', fullAudit.counts);
  console.log('Challenge:', fullAudit.challengeSlots.join(' | ') || 'none');
  console.log('Review:', fullAudit.reviewSlots.join(' | ') || 'none');

  const existingNames = new Set([...baseline.parsed.commanders, ...baseline.parsed.main].map((entry) => norm(entry.name)));
  const selectorEvidence = pool.map((selector) => {
    const access = comboPieces.map((piece) => boundedComboSelectionAccessV15(selector, piece));
    const hits = access.filter((entry) => entry.matched);
    return {
      selector,
      hits: hits.map((entry) => entry.pieceName),
      depth: Math.max(0, ...hits.map((entry) => entry.depth ?? 0)),
      access,
    };
  }).filter((entry) => entry.hits.length > 0 && !existingNames.has(norm(entry.selector.name)));
  selectorEvidence.sort((a, b) => b.hits.length - a.hits.length || b.depth - a.depth || a.selector.cmc - b.selector.cmc || a.selector.name.localeCompare(b.selector.name));
  assert.ok(selectorEvidence.length > 0, 'no FF-legal bounded combo selectors found');
  console.log('Open-pool selectors:', selectorEvidence.map((entry) => `${entry.selector.name}[${entry.hits.length}/4 top-${entry.depth}]`).join(' | '));

  const protectedSet = new Set(PROTECTED_NAMES.map(norm));
  const pressureByName = new Map<string, FullDeckAuditV15['slots'][number]>();
  for (const finding of fullAudit.slots) {
    if (finding.land) continue;
    if (finding.status === 'locked') continue;
    if (protectedSet.has(norm(finding.cardName)) || COMBO_SET.has(norm(finding.cardName))) continue;
    const current = pressureByName.get(norm(finding.cardName));
    if (!current || STATUS_WEIGHT[finding.status] < STATUS_WEIGHT[current.status] || finding.score < current.score) pressureByName.set(norm(finding.cardName), finding);
  }
  const pressureCuts = [...pressureByName.values()]
    .sort((a, b) => STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status] || a.score - b.score || a.cardName.localeCompare(b.cardName))
    .slice(0, 20);
  console.log('Purpose-pressure cuts:', pressureCuts.map((finding) => `${finding.status}:${finding.score}:${finding.cardName}`).join(' | '));

  const baselineMetrics = buildDeckMetrics(baseline.parsed, baseline.cards);
  assert.equal(floor(baselineMetrics, colors.length).length, 0, `A14 floor failures: ${floor(baselineMetrics, colors.length).join(', ')}`);
  const baselineSignals = new Map<number, Record<string, number>>();
  for (const seed of SEEDS) baselineSignals.set(seed, signals(simulate(baseline.parsed, baseline.cards, seed)));

  const structural: Array<Record<string, unknown>> = [];
  for (const cutFinding of pressureCuts) {
    const cutCard = physicalMain.find((card) => norm(card.name) === norm(cutFinding.cardName));
    assert.ok(cutCard);
    for (const selector of selectorEvidence) {
      const decklist = renderChanges(baseline.parsed, [cutCard.name], [selector.selector]);
      const parsed = parseDecklist(decklist);
      const cards = replaceCards(baseline.cards, [cutCard.name], [selector.selector]);
      const candidateExpanded = expandResolvedDeckSlotsV15(parsed, cards);
      if (candidateExpanded.unresolved.length > 0 || candidateExpanded.main.length !== 99) continue;
      const names = new Set([...parsed.commanders, ...parsed.main].map((entry) => norm(entry.name)));
      const metrics = buildDeckMetrics(parsed, cards);
      const hardFailures = floor(metrics, colors.length);
      const hard = parsed.totalCards === 100
        && validateCommanderDeck(parsed, cards).isLegal
        && cards.every((card) => printingMatchesPolicyV08(card, policy))
        && [...COMBO_SET].every((name) => names.has(name))
        && criticalPreserved(baseline.cards, cards)
        && hardFailures.length === 0;
      if (!hard) continue;

      const nextPhysicalMain = candidateExpanded.main.map((slot) => slot.card);
      const addPurpose = auditCardPurposeV15(selector.selector, { deck: nextPhysicalMain, commander, comboPieces, protectedCardNames: PROTECTED_NAMES });
      const purposeDelta = addPurpose.score - cutFinding.score;
      const accessValue = selector.hits.length * 2 + selector.depth * 0.2;
      const preScore = Number((purposeDelta + accessValue).toFixed(3));
      structural.push({
        cut: cutCard.name,
        add: selector.selector.name,
        cutStatus: cutFinding.status,
        cutPurposeScore: cutFinding.score,
        cutPurposes: cutFinding.purposes,
        cutWarnings: cutFinding.warnings,
        cutRemovalConsequence: cutFinding.removalConsequence,
        addPurposeScore: addPurpose.score,
        addPurposes: addPurpose.purposes,
        comboHits: selector.hits,
        selectionDepth: selector.depth,
        purposeDelta,
        accessValue: Number(accessValue.toFixed(3)),
        preScore,
        metrics,
        decklist,
        parsed,
        cards,
      });
    }
  }

  structural.sort((a, b) => num(b.preScore) - num(a.preScore));
  const finalists = structural.slice(0, 16);
  const evaluated: Array<Record<string, unknown>> = [];
  for (const candidate of finalists) {
    const parsed = candidate.parsed as ParsedDeck;
    const cards = candidate.cards as ScryfallCard[];
    const metrics = candidate.metrics as ReturnType<typeof buildDeckMetrics>;
    const runs = SEEDS.map((seed) => {
      const change = delta(baselineSignals.get(seed)!, signals(simulate(parsed, cards, seed)));
      return { seed, delta: change, score: simulationScore(baselineMetrics, metrics, change), regression: regression(change) };
    });
    const scores = runs.map((run) => run.score);
    const mean = scores.reduce((sum, value) => sum + value, 0) / scores.length;
    const minimum = Math.min(...scores);
    const positiveSeeds = scores.filter((value) => value > 0).length;
    const safe = runs.every((run) => !run.regression);
    const reviewEligible = safe && mean > -0.1 && num(candidate.purposeDelta) > 0 && num(candidate.accessValue) > 0;
    evaluated.push({
      cut: candidate.cut,
      add: candidate.add,
      cutStatus: candidate.cutStatus,
      cutPurposeScore: candidate.cutPurposeScore,
      cutPurposes: candidate.cutPurposes,
      cutWarnings: candidate.cutWarnings,
      cutRemovalConsequence: candidate.cutRemovalConsequence,
      addPurposeScore: candidate.addPurposeScore,
      addPurposes: candidate.addPurposes,
      comboHits: candidate.comboHits,
      selectionDepth: candidate.selectionDepth,
      purposeDelta: candidate.purposeDelta,
      accessValue: candidate.accessValue,
      preScore: candidate.preScore,
      simulationMean: Number(mean.toFixed(3)),
      simulationMin: Number(minimum.toFixed(3)),
      positiveSeeds,
      safe,
      reviewEligible,
      metrics: {
        averageNonlandManaValue: metrics.averageNonlandManaValue,
        ramp: metrics.rampCount,
        cheapInteraction: metrics.cheapInteractionCount,
        freeInteraction: Number(metrics.roleCounts['free interaction'] ?? 0),
        tutors: metrics.tutorCount,
        persistentColoredManaSources: metrics.persistentColoredManaSourceCount,
      },
      runs,
      decklist: candidate.decklist,
      parsed,
      cards,
    });
    console.log(`${candidate.cut} -> ${candidate.add}: purpose=${candidate.purposeDelta} access=${candidate.accessValue} sim=${mean.toFixed(3)} min=${minimum.toFixed(3)} positive=${positiveSeeds}/5 safe=${safe} review=${reviewEligible}`);
  }

  evaluated.sort((a, b) => Number(b.reviewEligible) - Number(a.reviewEligible) || num(b.purposeDelta) - num(a.purposeDelta) || num(b.accessValue) - num(a.accessValue) || num(b.simulationMean) - num(a.simulationMean));
  const leader = evaluated.find((candidate) => candidate.reviewEligible === true) ?? null;
  let leaderAudit: FullDeckAuditV15 | null = null;
  if (leader) {
    const parsed = leader.parsed as ParsedDeck;
    const cards = leader.cards as ScryfallCard[];
    const leaderExpanded = expandResolvedDeckSlotsV15(parsed, cards);
    assert.equal(leaderExpanded.unresolved.length, 0);
    assert.equal(leaderExpanded.main.length, 99);
    leaderAudit = auditFullDeckV15(leaderExpanded.main, { commander, comboPieces, protectedCardNames: PROTECTED_NAMES });
    await writeFile('counter-blitz-a16-leader.txt', `${String(leader.decklist)}\n`, 'utf8');
    await writeFile('counter-blitz-a16-leader-99-audit.json', `${JSON.stringify(leaderAudit, null, 2)}\n`, 'utf8');
    await writeFile('counter-blitz-a16-leader-99-audit.md', auditMarkdown(leaderAudit), 'utf8');
  }

  const output = {
    schema: 'counter-blitz-a16-full-99-open-selection-v2',
    baseline: 'A14 champion',
    baselineChangesFromA2: [
      'Conformer Shuriken -> Incubation Druid',
      'Retrieve the Esper -> Everflowing Chalice',
      'Garnet, Princess of Alexandria -> Arcane Signet',
      "Sazh's Chocobo -> Endurance",
    ],
    physicalAudit: {
      slots: fullAudit.physicalSlots,
      counts: fullAudit.counts,
      challengeCards: fullAudit.challengeSlots,
      reviewCards: fullAudit.reviewSlots,
    },
    selectorEvidence: selectorEvidence.map((entry) => ({
      name: entry.selector.name,
      set: entry.selector.set.toUpperCase(),
      collectorNumber: entry.selector.collector_number,
      manaValue: entry.selector.cmc,
      comboHits: entry.hits,
      depth: entry.depth,
    })),
    purposePressureCuts: pressureCuts.map((finding) => ({
      card: finding.cardName,
      status: finding.status,
      score: finding.score,
      purposes: finding.purposes,
      warnings: finding.warnings,
      removalConsequence: finding.removalConsequence,
    })),
    structuralCandidates: structural.length,
    simulatedFinalists: evaluated.length,
    reviewLeader: leader ? {
      cut: leader.cut,
      add: leader.add,
      purposeDelta: leader.purposeDelta,
      comboHits: leader.comboHits,
      selectionDepth: leader.selectionDepth,
      simulationMean: leader.simulationMean,
      simulationMin: leader.simulationMin,
      positiveSeeds: leader.positiveSeeds,
      metrics: leader.metrics,
      leaderAuditCounts: leaderAudit?.counts ?? null,
    } : null,
    evaluated: evaluated.map(({ decklist: _decklist, parsed: _parsed, cards: _cards, ...candidate }) => candidate),
    note: 'Exploratory only. Every physical slot in the A14 99 is audited before selector pressure is applied. Selector discovery scans the full FF-legal pool. A review leader is not automatically accepted; manual Oracle/strategic review remains required. No stable/current promotion and no PR #29 merge.',
  };
  await writeFile('counter-blitz-a16-result.json', `${JSON.stringify(output, null, 2)}\n`, 'utf8');
}

try {
  await main();
} catch (error) {
  const diagnostic = {
    schema: 'counter-blitz-a16-diagnostic-v1',
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack ?? null : null,
    note: 'A16 failed before completion. Diagnostic is emitted so CI failures remain inspectable.',
  };
  await writeFile('counter-blitz-a16-diagnostic.json', `${JSON.stringify(diagnostic, null, 2)}\n`, 'utf8');
  console.error(error);
  process.exitCode = 1;
}
