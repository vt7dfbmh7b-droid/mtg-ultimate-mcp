import type { ScryfallCard } from '../types/scryfall.js';
import { validateCommanderDeck } from './commander-rules.js';
import { buildDeckMetrics, parseDecklist, resolveEntryCard, type DeckEntry, type ParsedDeck } from './deck.js';
import {
  describePrintingPolicyV08,
  resolvePrintingPolicyV08,
  selectEligiblePrintingV08,
  type ResolvedPrintingPolicyV08,
} from './printing-policy-v08.js';
import { getCardsByIdentifiers, getCardsByNames, inferCardRoles, searchCards, type CardIdentifierInput } from './scryfall.js';
import { estimateCommanderBracket, findDeckCombos } from './spellbook.js';

export interface CedhRefinementOptionsV14 {
  printingFamily?: string;
  allowedSets?: string[];
  includePromos?: boolean;
  includeSpecialReleases?: boolean;
  maxUsdPerCard?: number;
  maxRounds?: number;
  maxSwaps?: number;
  protectedCards?: string[];
  excludedCards?: string[];
  candidatePackagesPerRound?: number;
}

interface ExactAdditionV14 {
  name: string;
  card: ScryfallCard;
  finish: 'nonfoil' | 'foil' | 'etched' | null;
  priceUsd: number | null;
  reason: string;
}

interface PackageEvaluationV14 {
  kind: 'combo-completion' | 'efficiency';
  label: string;
  additions: ExactAdditionV14[];
  cuts: string[];
  decklist: string;
  legal: boolean;
  offPolicy: string[];
  bracketTag: string | null;
  includedCombos: number;
  ruthlessCombos: number;
  strategicallyRelevantCombos: number;
  averageManaValue: number;
  earlyPlays: number;
  fastMana: number;
  cheapInteraction: number;
  score: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalize(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function entryFinishMarker(finish: DeckEntry['finish'] | ExactAdditionV14['finish']): string {
  if (finish === 'foil') return ' *F*';
  if (finish === 'etched') return ' *E*';
  if (finish === 'nonfoil') return ' *N*';
  return '';
}

function renderEntry(entry: DeckEntry): string {
  const printing = entry.set && entry.collectorNumber ? ` (${entry.set.toUpperCase()}) ${entry.collectorNumber}` : '';
  return `${entry.quantity} ${entry.name}${printing}${entryFinishMarker(entry.finish)}`;
}

function renderDeck(parsed: ParsedDeck): string {
  return [
    '// COMMANDER',
    ...parsed.commanders.map(renderEntry),
    '',
    '// MAIN',
    ...parsed.main.map(renderEntry),
  ].join('\n');
}

function identifiers(parsed: ParsedDeck): CardIdentifierInput[] {
  return [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
}

async function resolveDeck(decklist: string): Promise<{ parsed: ParsedDeck; cards: ScryfallCard[]; notFound: string[] }> {
  const parsed = parseDecklist(decklist);
  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  return { parsed, cards: resolved.cards, notFound: resolved.notFound };
}

function commanderIdentity(parsed: ParsedDeck, cards: ScryfallCard[]): string[] {
  const commanderNames = new Set(parsed.commanders.map((entry) => normalize(entry.name)));
  return [...new Set(cards.filter((card) => commanderNames.has(normalize(card.name))).flatMap((card) => card.color_identity))].sort();
}

function identityQuery(identity: string[]): string {
  return identity.length === 0 ? 'id:c' : `id<=${identity.join('').toLocaleLowerCase()}`;
}

function isLand(card: ScryfallCard): boolean {
  return card.type_line.toLocaleLowerCase().includes('land');
}

function highValueRoles(card: ScryfallCard): Set<string> {
  return new Set(inferCardRoles(card));
}

function efficiencyScore(card: ScryfallCard): number {
  if (isLand(card)) return -999;
  const roles = highValueRoles(card);
  let score = 0;
  if (card.cmc <= 1) score += 38;
  else if (card.cmc <= 2) score += 25;
  else if (card.cmc <= 3) score += 8;
  else score -= (card.cmc - 3) * 12;
  if (roles.has('fast mana')) score += 55;
  if (roles.has('free interaction')) score += 50;
  if (roles.has('tutor')) score += 42;
  if (roles.has('countermagic')) score += 34;
  if (roles.has('spot interaction')) score += 26;
  if (roles.has('protection')) score += 24;
  if (roles.has('repeatable draw')) score += 28;
  else if (roles.has('card draw') || roles.has('card selection')) score += 18;
  if (roles.has('mana acceleration') && card.cmc <= 2) score += 24;
  if (roles.has('land ramp') && card.cmc <= 2) score += 12;
  if (roles.has('board wipe')) score -= 8;
  if (card.edhrec_rank !== undefined) score += Math.max(0, 28 - Math.log10(card.edhrec_rank + 1) * 6);
  return score;
}

function cutPressure(card: ScryfallCard, protectedNames: Set<string>): number {
  if (isLand(card) || protectedNames.has(normalize(card.name))) return -999;
  const roles = highValueRoles(card);
  let pressure = Math.max(0, card.cmc - 2) * 10;
  if (card.cmc >= 5) pressure += 15;
  if (roles.has('board wipe')) pressure += 9;
  if ((roles.has('mana acceleration') || roles.has('land ramp')) && card.cmc >= 3) pressure += 14;
  if (roles.size <= 2) pressure += 8;
  if (roles.has('fast mana')) pressure -= 70;
  if (roles.has('free interaction')) pressure -= 65;
  if (roles.has('tutor')) pressure -= 45;
  if (roles.has('countermagic') && card.cmc <= 2) pressure -= 38;
  if (roles.has('spot interaction') && card.cmc <= 2) pressure -= 32;
  if (roles.has('protection') && card.cmc <= 2) pressure -= 25;
  if (roles.has('repeatable draw') && card.cmc <= 3) pressure -= 30;
  if ((roles.has('mana acceleration') || roles.has('land ramp')) && card.cmc <= 2) pressure -= 24;
  return pressure;
}

function rankedCuts(parsed: ParsedDeck, cards: ScryfallCard[], protectedNames: Set<string>, limit = 20): string[] {
  const candidates = parsed.main
    .map((entry) => ({ entry, card: resolveEntryCard(entry, cards) }))
    .filter((item): item is { entry: DeckEntry; card: ScryfallCard } => Boolean(item.card))
    .filter(({ card }) => !isLand(card))
    .map(({ card }) => ({ name: card.name, pressure: cutPressure(card, protectedNames) }))
    .filter((item) => item.pressure > -500)
    .sort((a, b) => b.pressure - a.pressure || a.name.localeCompare(b.name));
  return [...new Set(candidates.map((item) => item.name))].slice(0, limit);
}

function deckNameCounts(parsed: ParsedDeck): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of [...parsed.commanders, ...parsed.main]) counts.set(normalize(entry.name), (counts.get(normalize(entry.name)) ?? 0) + entry.quantity);
  return counts;
}

async function exactEligibleAddition(
  name: string,
  identity: string[],
  policy: ResolvedPrintingPolicyV08,
  maxUsdPerCard: number | undefined,
  reason: string,
): Promise<ExactAdditionV14 | null> {
  const resolved = await getCardsByNames([name]);
  const card = resolved.cards[0];
  if (!card || card.legalities.commander !== 'legal' || card.color_identity.some((color) => !identity.includes(color))) return null;
  const printing = await selectEligiblePrintingV08(card, policy, maxUsdPerCard);
  if (!printing) return null;
  return {
    name: card.name,
    card: printing.card,
    finish: printing.finish,
    priceUsd: printing.priceUsd,
    reason,
  };
}

function applyPackage(parsed: ParsedDeck, cuts: string[], additions: ExactAdditionV14[]): string | null {
  const cutSet = new Set(cuts.map(normalize));
  const nextMain: DeckEntry[] = [];
  let removed = 0;
  for (const entry of parsed.main) {
    if (cutSet.has(normalize(entry.name)) && removed < cuts.length && entry.quantity === 1) {
      removed += 1;
      continue;
    }
    nextMain.push({ ...entry });
  }
  if (removed !== additions.length || cuts.length !== additions.length) return null;
  for (const addition of additions) {
    nextMain.push({
      name: addition.name,
      quantity: 1,
      set: addition.card.set.toUpperCase(),
      collectorNumber: addition.card.collector_number,
      ...(addition.finish ? { finish: addition.finish } : {}),
    });
  }
  return renderDeck({
    main: nextMain,
    commanders: parsed.commanders.map((entry) => ({ ...entry })),
    totalMain: nextMain.reduce((sum, entry) => sum + entry.quantity, 0),
    totalCommanders: parsed.totalCommanders,
    totalCards: nextMain.reduce((sum, entry) => sum + entry.quantity, 0) + parsed.totalCommanders,
  });
}

function comboTagScore(tag: string | null): number {
  if (tag === 'R') return 80;
  if (tag === 'S') return 55;
  if (tag === 'P') return 45;
  if (tag === 'O') return 30;
  if (tag === 'C') return 20;
  if (tag === 'E') return 10;
  return 0;
}

function countRuthlessVariants(combos: Record<string, unknown>): number {
  const included = Array.isArray(combos.included) ? combos.included.map(asRecord) : [];
  return included.filter((variant) => String(variant.status ?? '').toLocaleLowerCase().includes('ruthless') || String(variant.bracket ?? '') === 'R').length;
}

async function evaluatePackage(
  kind: PackageEvaluationV14['kind'],
  label: string,
  parsed: ParsedDeck,
  cuts: string[],
  additions: ExactAdditionV14[],
  policy: ResolvedPrintingPolicyV08,
): Promise<PackageEvaluationV14 | null> {
  if (cuts.length !== additions.length || additions.length === 0) return null;
  const decklist = applyPackage(parsed, cuts, additions);
  if (!decklist) return null;
  const resolved = await resolveDeck(decklist);
  if (resolved.notFound.length > 0 || resolved.parsed.totalCards !== 100) return null;
  const rules = validateCommanderDeck(resolved.parsed, resolved.cards);
  const offPolicy = resolved.cards.filter((card) => {
    if (card.digital) return true;
    if (!policy.includePromos && card.promo) return true;
    const set = card.set.toLocaleLowerCase();
    if (policy.allowedSetCodes.includes(set)) return false;
    if (!policy.includeSpecialReleases) return true;
    const normalizedCollector = card.collector_number.replace(/^0+/, '') || '0';
    return !policy.exactSpecialPrintings.some((entry) => entry.set.toLocaleLowerCase() === set && (entry.collectorNumber.replace(/^0+/, '') || '0') === normalizedCollector);
  }).map((card) => `${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`);
  if (!rules.isLegal || offPolicy.length > 0) return null;

  const [bracket, combos] = await Promise.all([
    estimateCommanderBracket(decklist),
    findDeckCombos(decklist, 60),
  ]);
  const metrics = buildDeckMetrics(resolved.parsed, resolved.cards);
  const counts = asRecord(combos.counts);
  const includedCombos = Number(counts.included ?? 0);
  const strategicallyRelevantCombos = Array.isArray(bracket.strategicallyRelevantCombos) ? bracket.strategicallyRelevantCombos.length : 0;
  const bracketTag = typeof bracket.bracketTag === 'string' ? bracket.bracketTag : null;
  const ruthlessCombos = countRuthlessVariants(combos);
  const score = comboTagScore(bracketTag)
    + includedCombos * 22
    + strategicallyRelevantCombos * 18
    + ruthlessCombos * 25
    + metrics.fastManaCount * 2.5
    + metrics.cheapInteractionCount * 1.8
    + metrics.earlyPlayCount * 0.8
    - metrics.averageNonlandManaValue * 8;

  return {
    kind,
    label,
    additions,
    cuts,
    decklist,
    legal: rules.isLegal,
    offPolicy,
    bracketTag,
    includedCombos,
    ruthlessCombos,
    strategicallyRelevantCombos,
    averageManaValue: metrics.averageNonlandManaValue,
    earlyPlays: metrics.earlyPlayCount,
    fastMana: metrics.fastManaCount,
    cheapInteraction: metrics.cheapInteractionCount,
    score: Number(score.toFixed(2)),
  };
}

async function comboCompletionPackages(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  identity: string[],
  policy: ResolvedPrintingPolicyV08,
  options: CedhRefinementOptionsV14,
  protectedNames: Set<string>,
): Promise<Array<{ label: string; additions: ExactAdditionV14[] }>> {
  const comboData = await findDeckCombos(renderDeck(parsed), 80);
  const near = Array.isArray(comboData.almostIncluded) ? comboData.almostIncluded.map(asRecord) : [];
  const counts = deckNameCounts(parsed);
  const packages: Array<{ label: string; additions: ExactAdditionV14[]; desirability: number }> = [];
  const seen = new Set<string>();

  for (const variant of near) {
    const uses = Array.isArray(variant.cards) ? variant.cards.map(asRecord) : [];
    const missingNames: string[] = [];
    for (const use of uses) {
      const name = typeof use.name === 'string' ? use.name.trim() : '';
      const quantity = typeof use.quantity === 'number' ? Math.max(1, Math.trunc(use.quantity)) : 1;
      if (!name || name === 'Unknown card') continue;
      const owned = counts.get(normalize(name)) ?? 0;
      for (let i = owned; i < quantity; i += 1) missingNames.push(name);
    }
    const uniqueMissing = [...new Set(missingNames)];
    if (uniqueMissing.length < 1 || uniqueMissing.length > 2) continue;
    const key = uniqueMissing.map(normalize).sort().join('|');
    if (seen.has(key)) continue;

    const additions: ExactAdditionV14[] = [];
    for (const name of uniqueMissing) {
      const addition = await exactEligibleAddition(name, identity, policy, options.maxUsdPerCard, 'Completes a Commander Spellbook near-combo already mostly present in the deck.');
      if (!addition) break;
      additions.push(addition);
    }
    if (additions.length !== uniqueMissing.length) continue;
    const results = Array.isArray(variant.results) ? variant.results.map(String) : [];
    const text = `${String(variant.description ?? '')} ${results.join(' ')}`.toLocaleLowerCase();
    const desirability = (uniqueMissing.length === 1 ? 60 : 35)
      + (/infinite|win the game|damage|mill|draw your library|extra turn/.test(text) ? 35 : 0)
      - additions.reduce((sum, addition) => sum + addition.card.cmc, 0) * 2;
    for (const addition of additions) protectedNames.add(normalize(addition.name));
    packages.push({ label: `Complete combo with ${uniqueMissing.join(' + ')}`, additions, desirability });
    seen.add(key);
  }

  return packages.sort((a, b) => b.desirability - a.desirability).slice(0, Math.max(4, Math.min(12, options.candidatePackagesPerRound ?? 8)));
}

async function efficiencyCandidates(
  parsed: ParsedDeck,
  identity: string[],
  policy: ResolvedPrintingPolicyV08,
  options: CedhRefinementOptionsV14,
): Promise<ExactAdditionV14[]> {
  const existing = new Set([...parsed.commanders, ...parsed.main].map((entry) => normalize(entry.name)));
  const excluded = new Set((options.excludedCards ?? []).map(normalize));
  const query = ['f:commander', identityQuery(identity), '-t:land', policy.searchClause].filter(Boolean).join(' ');
  let results: ScryfallCard[] = [];
  try {
    results = await searchCards(query, 50);
  } catch {
    return [];
  }
  const ranked = results
    .filter((card) => card.legalities.commander === 'legal' && !isLand(card))
    .filter((card) => !existing.has(normalize(card.name)) && !excluded.has(normalize(card.name)))
    .sort((a, b) => efficiencyScore(b) - efficiencyScore(a));

  const output: ExactAdditionV14[] = [];
  for (const card of ranked) {
    if (output.length >= 18) break;
    const printing = await selectEligiblePrintingV08(card, policy, options.maxUsdPerCard);
    if (!printing) continue;
    output.push({
      name: card.name,
      card: printing.card,
      finish: printing.finish,
      priceUsd: printing.priceUsd,
      reason: 'Higher cEDH efficiency score: low mana value plus fast mana, tutor, cheap interaction, protection, or card-advantage roles.',
    });
  }
  return output;
}

async function baselineEvaluation(decklist: string): Promise<Record<string, unknown>> {
  const resolved = await resolveDeck(decklist);
  const [bracket, combos] = await Promise.all([estimateCommanderBracket(decklist), findDeckCombos(decklist, 60)]);
  const metrics = buildDeckMetrics(resolved.parsed, resolved.cards);
  const counts = asRecord(combos.counts);
  return {
    bracketTag: bracket.bracketTag ?? null,
    includedCombos: Number(counts.included ?? 0),
    almostIncludedCombos: Number(counts.almostIncluded ?? 0),
    strategicallyRelevantCombos: Array.isArray(bracket.strategicallyRelevantCombos) ? bracket.strategicallyRelevantCombos.length : 0,
    averageNonlandManaValue: metrics.averageNonlandManaValue,
    earlyPlays: metrics.earlyPlayCount,
    fastMana: metrics.fastManaCount,
    cheapInteraction: metrics.cheapInteractionCount,
  };
}

export async function refineForCedhV14(decklist: string, options: CedhRefinementOptionsV14 = {}): Promise<Record<string, unknown>> {
  const maxRounds = Math.max(1, Math.min(4, Math.trunc(options.maxRounds ?? 3)));
  const maxSwaps = Math.max(1, Math.min(24, Math.trunc(options.maxSwaps ?? 12)));
  const policy = await resolvePrintingPolicyV08({
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
  });
  const start = await resolveDeck(decklist);
  if (start.notFound.length > 0 || !validateCommanderDeck(start.parsed, start.cards).isLegal) {
    return { status: 'invalid-starting-deck', unresolvedCards: start.notFound };
  }

  let currentDecklist = decklist;
  let current = start;
  const identity = commanderIdentity(current.parsed, current.cards);
  const protectedNames = new Set((options.protectedCards ?? []).map(normalize));
  const excludedNames = new Set((options.excludedCards ?? []).map(normalize));
  const baseline = await baselineEvaluation(currentDecklist);
  const accepted: Array<Record<string, unknown>> = [];
  const rounds: Array<Record<string, unknown>> = [];

  for (let round = 1; round <= maxRounds && accepted.length < maxSwaps; round += 1) {
    const candidates: PackageEvaluationV14[] = [];
    const comboPackages = await comboCompletionPackages(current.parsed, current.cards, identity, policy, options, protectedNames);
    const cutList = rankedCuts(current.parsed, current.cards, protectedNames, 24);

    for (const comboPackage of comboPackages) {
      if (accepted.length + comboPackage.additions.length > maxSwaps) continue;
      const cuts = cutList.filter((name) => !comboPackage.additions.some((addition) => normalize(addition.name) === normalize(name))).slice(0, comboPackage.additions.length);
      const evaluated = await evaluatePackage('combo-completion', comboPackage.label, current.parsed, cuts, comboPackage.additions, policy);
      if (evaluated) candidates.push(evaluated);
    }

    const efficiency = await efficiencyCandidates(current.parsed, identity, policy, { ...options, excludedCards: [...excludedNames] });
    for (const size of [3, 5, 7]) {
      if (accepted.length + size > maxSwaps) continue;
      const additions = efficiency.slice(0, size);
      const cuts = cutList.slice(0, additions.length);
      if (additions.length !== size || cuts.length !== size) continue;
      const evaluated = await evaluatePackage('efficiency', `Replace ${size} slow slots with high-efficiency cEDH-role cards`, current.parsed, cuts, additions, policy);
      if (evaluated) candidates.push(evaluated);
    }

    const before = await baselineEvaluation(currentDecklist);
    const winner = candidates.sort((a, b) => b.score - a.score || b.includedCombos - a.includedCombos || a.averageManaValue - b.averageManaValue)[0];
    if (!winner) {
      rounds.push({ round, accepted: false, reason: 'no-legal-policy-compliant-candidate-package', before });
      break;
    }

    const beforeComboCount = Number(before.includedCombos ?? 0);
    const beforeStrategic = Number(before.strategicallyRelevantCombos ?? 0);
    const beforeMana = Number(before.averageNonlandManaValue ?? 99);
    const materiallyBetter = winner.includedCombos > beforeComboCount
      || winner.strategicallyRelevantCombos > beforeStrategic
      || winner.bracketTag === 'R'
      || (winner.averageManaValue + 0.15 < beforeMana && winner.earlyPlays >= Number(before.earlyPlays ?? 0));
    if (!materiallyBetter) {
      rounds.push({
        round,
        accepted: false,
        reason: 'best-package-did-not-improve-combo-or-competitive-efficiency-evidence',
        before,
        bestCandidate: summarizePackage(winner),
      });
      break;
    }

    currentDecklist = winner.decklist;
    current = await resolveDeck(currentDecklist);
    for (const addition of winner.additions) protectedNames.add(normalize(addition.name));
    for (const cut of winner.cuts) excludedNames.add(normalize(cut));
    accepted.push(...winner.additions.map((addition, index) => ({
      out: winner.cuts[index] ?? null,
      in: addition.name,
      reason: addition.reason,
      printing: {
        set: addition.card.set.toUpperCase(),
        collectorNumber: addition.card.collector_number,
        finish: addition.finish,
        priceUsdReference: addition.priceUsd,
      },
    })));
    rounds.push({ round, accepted: true, before, winner: summarizePackage(winner), candidateCount: candidates.length });
  }

  const finalEvidence = await baselineEvaluation(currentDecklist);
  const finalRules = validateCommanderDeck(current.parsed, current.cards);
  const competitiveEvidence = {
    hasCompleteCombo: Number(finalEvidence.includedCombos ?? 0) > 0,
    hasStrategicallyRelevantCombo: Number(finalEvidence.strategicallyRelevantCombos ?? 0) > 0,
    hasRuthlessSpellbookTag: String(finalEvidence.bracketTag ?? '') === 'R',
    lowAverageManaValue: Number(finalEvidence.averageNonlandManaValue ?? 99) <= 2.6,
    note: 'Bracket 5 is a cEDH intent/metagame category, so card composition alone cannot prove Bracket 5. These signals measure whether the construction looks materially closer to a competitive shell.',
  };

  return {
    status: accepted.length > 0 ? 'cedh-refined' : 'no-supported-cedh-improvement',
    baseline,
    finalEvidence,
    competitiveEvidence,
    totalSwaps: accepted.length,
    swaps: accepted,
    rounds,
    finalDecklist: currentDecklist,
    finalCommanderRules: finalRules,
    printingPolicy: describePrintingPolicyV08(policy),
    guidance: 'For target Bracket 5, prefer completed compact win packages, low-cost interaction/acceleration, tournament/meta evidence when available, and repeated independent bracket/combo checks. Do not call a deck cEDH solely because targetBracket=5 was requested.',
  };
}

function summarizePackage(candidate: PackageEvaluationV14): Record<string, unknown> {
  return {
    kind: candidate.kind,
    label: candidate.label,
    additions: candidate.additions.map((addition) => ({
      name: addition.name,
      set: addition.card.set.toUpperCase(),
      collectorNumber: addition.card.collector_number,
      finish: addition.finish,
      priceUsdReference: addition.priceUsd,
      reason: addition.reason,
    })),
    cuts: candidate.cuts,
    bracketTag: candidate.bracketTag,
    includedCombos: candidate.includedCombos,
    strategicallyRelevantCombos: candidate.strategicallyRelevantCombos,
    ruthlessCombos: candidate.ruthlessCombos,
    averageManaValue: candidate.averageManaValue,
    earlyPlays: candidate.earlyPlays,
    fastMana: candidate.fastMana,
    cheapInteraction: candidate.cheapInteraction,
    score: candidate.score,
  };
}
