import type { ScryfallCard } from '../types/scryfall.js';
import { validateCommanderDeck } from './commander-rules.js';
import { buildDeckMetrics, parseDecklist, resolveEntryCard, type DeckEntry, type ParsedDeck } from './deck.js';
import {
  describePrintingPolicyV08,
  printingMatchesPolicyV08,
  resolvePrintingPolicyV08,
  selectEligiblePrintingV08,
  type ResolvedPrintingPolicyV08,
} from './printing-policy-v08.js';
import {
  getCardsByIdentifiers,
  inferCardRoles,
  lookupCard,
  searchCards,
  type CardIdentifierInput,
} from './scryfall.js';
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
  parsed: ParsedDeck;
  resolvedCards: ScryfallCard[];
  decklist: string;
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

interface CompetitiveEvidenceV14 {
  bracketTag: string | null;
  includedCombos: number;
  almostIncludedCombos: number;
  ruthlessCombos: number;
  strategicallyRelevantCombos: number;
  averageNonlandManaValue: number;
  earlyPlays: number;
  fastMana: number;
  cheapInteraction: number;
}

interface NearComboPlanV14 {
  label: string;
  missingNames: string[];
  desirability: number;
  bracketTag: string | null;
  commanderCentric: boolean;
  results: string[];
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

async function resolveStartingDeck(decklist: string): Promise<{ parsed: ParsedDeck; cards: ScryfallCard[]; notFound: string[] }> {
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
  if (card.cmc <= 1) score += 42;
  else if (card.cmc <= 2) score += 28;
  else if (card.cmc <= 3) score += 8;
  else score -= (card.cmc - 3) * 14;
  if (roles.has('fast mana')) score += 60;
  if (roles.has('free interaction')) score += 55;
  if (roles.has('tutor')) score += 46;
  if (roles.has('countermagic')) score += 36;
  if (roles.has('spot interaction')) score += 28;
  if (roles.has('protection')) score += 26;
  if (roles.has('repeatable draw')) score += 32;
  else if (roles.has('card draw') || roles.has('card selection')) score += 18;
  if (roles.has('mana acceleration') && card.cmc <= 2) score += 27;
  if (roles.has('land ramp') && card.cmc <= 2) score += 12;
  if (roles.has('board wipe')) score -= 10;
  if (card.edhrec_rank !== undefined) score += Math.max(0, 30 - Math.log10(card.edhrec_rank + 1) * 6);
  return score;
}

function cutPressure(card: ScryfallCard, protectedNames: Set<string>): number {
  if (isLand(card) || protectedNames.has(normalize(card.name))) return -999;
  const roles = highValueRoles(card);
  let pressure = Math.max(0, card.cmc - 2) * 12;
  if (card.cmc >= 5) pressure += 18;
  if (roles.has('board wipe')) pressure += 10;
  if ((roles.has('mana acceleration') || roles.has('land ramp')) && card.cmc >= 3) pressure += 17;
  if (roles.size <= 2) pressure += 8;
  if (roles.has('fast mana')) pressure -= 80;
  if (roles.has('free interaction')) pressure -= 75;
  if (roles.has('tutor')) pressure -= 52;
  if (roles.has('countermagic') && card.cmc <= 2) pressure -= 42;
  if (roles.has('spot interaction') && card.cmc <= 2) pressure -= 36;
  if (roles.has('protection') && card.cmc <= 2) pressure -= 30;
  if (roles.has('repeatable draw') && card.cmc <= 3) pressure -= 34;
  if ((roles.has('mana acceleration') || roles.has('land ramp')) && card.cmc <= 2) pressure -= 28;
  return pressure;
}

function rankedCuts(parsed: ParsedDeck, cards: ScryfallCard[], protectedNames: Set<string>, limit = 24): string[] {
  return [...new Set(parsed.main
    .map((entry) => ({ entry, card: resolveEntryCard(entry, cards) }))
    .filter((item): item is { entry: DeckEntry; card: ScryfallCard } => Boolean(item.card))
    .filter(({ card }) => !isLand(card))
    .map(({ card }) => ({ name: card.name, pressure: cutPressure(card, protectedNames) }))
    .filter((item) => item.pressure > -500)
    .sort((a, b) => b.pressure - a.pressure || a.name.localeCompare(b.name))
    .map((item) => item.name))].slice(0, limit);
}

function deckNameCounts(parsed: ParsedDeck): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of [...parsed.commanders, ...parsed.main]) {
    counts.set(normalize(entry.name), (counts.get(normalize(entry.name)) ?? 0) + entry.quantity);
  }
  return counts;
}

async function exactEligibleAddition(
  name: string,
  identity: string[],
  policy: ResolvedPrintingPolicyV08,
  maxUsdPerCard: number | undefined,
  reason: string,
): Promise<ExactAdditionV14 | null> {
  let card: ScryfallCard;
  try {
    card = await lookupCard(name, true);
  } catch {
    return null;
  }
  if (card.legalities.commander !== 'legal' || card.color_identity.some((color) => !identity.includes(color))) return null;
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

function applyPackage(parsed: ParsedDeck, cuts: string[], additions: ExactAdditionV14[]): ParsedDeck | null {
  if (cuts.length !== additions.length || additions.length === 0) return null;
  const remainingCuts = new Map<string, number>();
  for (const cut of cuts) remainingCuts.set(normalize(cut), (remainingCuts.get(normalize(cut)) ?? 0) + 1);
  const nextMain: DeckEntry[] = [];
  let removed = 0;

  for (const entry of parsed.main) {
    const key = normalize(entry.name);
    const wanted = remainingCuts.get(key) ?? 0;
    if (wanted > 0 && entry.quantity === 1) {
      remainingCuts.set(key, wanted - 1);
      removed += 1;
      continue;
    }
    nextMain.push({ ...entry });
  }
  if (removed !== additions.length) return null;

  for (const addition of additions) {
    nextMain.push({
      name: addition.name,
      quantity: 1,
      set: addition.card.set.toUpperCase(),
      collectorNumber: addition.card.collector_number,
      ...(addition.finish ? { finish: addition.finish } : {}),
    });
  }

  const totalMain = nextMain.reduce((sum, entry) => sum + entry.quantity, 0);
  return {
    main: nextMain,
    commanders: parsed.commanders.map((entry) => ({ ...entry })),
    totalMain,
    totalCommanders: parsed.totalCommanders,
    totalCards: totalMain + parsed.totalCommanders,
  };
}

function applyResolvedCards(cards: ScryfallCard[], cuts: string[], additions: ExactAdditionV14[]): ScryfallCard[] | null {
  const next = [...cards];
  for (const cut of cuts) {
    const index = next.findIndex((card) => normalize(card.name) === normalize(cut));
    if (index < 0) return null;
    next.splice(index, 1);
  }
  for (const addition of additions) next.push(addition.card);
  return next;
}

function comboTagScore(tag: string | null): number {
  if (tag === 'R') return 95;
  if (tag === 'S') return 60;
  if (tag === 'P') return 45;
  if (tag === 'O') return 30;
  if (tag === 'C') return 20;
  if (tag === 'E') return 10;
  return 0;
}

function countRuthlessVariants(combos: Record<string, unknown>): number {
  const included = Array.isArray(combos.included) ? combos.included.map(asRecord) : [];
  return included.filter((variant) => String(variant.bracketTag ?? '') === 'R').length;
}

function resultLooksCompetitive(results: string[]): boolean {
  const text = results.join(' ').toLocaleLowerCase();
  return /infinite combat|infinite damage|infinite mana|each opponent loses|win the game|infinite mill|draw your library|infinite treasure/.test(text);
}

function rawNearComboPlans(parsed: ParsedDeck, comboData: Record<string, unknown>): NearComboPlanV14[] {
  const near = Array.isArray(comboData.almostIncluded) ? comboData.almostIncluded.map(asRecord) : [];
  const counts = deckNameCounts(parsed);
  const commanderNames = new Set(parsed.commanders.map((entry) => normalize(entry.name)));
  const plans: NearComboPlanV14[] = [];
  const seen = new Set<string>();

  for (const variant of near) {
    const requirements = Array.isArray(variant.requirements) ? variant.requirements : [];
    if (requirements.length > 0) continue;
    const uses = Array.isArray(variant.cards) ? variant.cards.map(asRecord) : [];
    const missingNames: string[] = [];
    const comboNames: string[] = [];
    for (const use of uses) {
      const name = typeof use.name === 'string' ? use.name.trim() : '';
      if (!name || name === 'Unknown card') continue;
      comboNames.push(name);
      const quantity = typeof use.quantity === 'number' ? Math.max(1, Math.trunc(use.quantity)) : 1;
      const owned = counts.get(normalize(name)) ?? 0;
      for (let index = owned; index < quantity; index += 1) missingNames.push(name);
    }
    const uniqueMissing = [...new Set(missingNames)];
    if (uniqueMissing.length < 1 || uniqueMissing.length > 2) continue;
    const key = uniqueMissing.map(normalize).sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);

    const bracketTag = typeof variant.bracketTag === 'string' ? variant.bracketTag : null;
    const results = Array.isArray(variant.results) ? variant.results.map(String) : [];
    const commanderCentric = comboNames.some((name) => commanderNames.has(normalize(name)));
    let desirability = uniqueMissing.length === 1 ? 70 : 35;
    if (commanderCentric) desirability += 80;
    desirability += comboTagScore(bracketTag);
    if (resultLooksCompetitive(results)) desirability += 45;

    plans.push({
      label: `Complete ${commanderCentric ? 'commander-centric ' : ''}combo with ${uniqueMissing.join(' + ')}`,
      missingNames: uniqueMissing,
      desirability,
      bracketTag,
      commanderCentric,
      results,
    });
  }

  return plans.sort((a, b) => b.desirability - a.desirability || a.missingNames.length - b.missingNames.length);
}

async function comboCompletionPackages(
  parsed: ParsedDeck,
  identity: string[],
  policy: ResolvedPrintingPolicyV08,
  options: CedhRefinementOptionsV14,
): Promise<Array<{ label: string; additions: ExactAdditionV14[]; desirability: number }>> {
  const comboData = await findDeckCombos(renderDeck(parsed), 100);
  const rawPlans = rawNearComboPlans(parsed, comboData);
  const resolveLimit = Math.max(6, Math.min(18, (options.candidatePackagesPerRound ?? 8) * 2));
  const output: Array<{ label: string; additions: ExactAdditionV14[]; desirability: number }> = [];

  for (const plan of rawPlans.slice(0, resolveLimit)) {
    const additions: ExactAdditionV14[] = [];
    for (const name of plan.missingNames) {
      const addition = await exactEligibleAddition(
        name,
        identity,
        policy,
        options.maxUsdPerCard,
        `Completes a ${plan.commanderCentric ? 'commander-centric ' : ''}Commander Spellbook near-combo${plan.bracketTag ? ` tagged ${plan.bracketTag}` : ''}: ${plan.results.join(', ')}.`,
      );
      if (!addition) break;
      additions.push(addition);
    }
    if (additions.length !== plan.missingNames.length) continue;
    const totalMissingManaValue = additions.reduce((sum, addition) => sum + addition.card.cmc, 0);
    output.push({
      label: plan.label,
      additions,
      desirability: plan.desirability - totalMissingManaValue * 3,
    });
  }

  return output
    .sort((a, b) => b.desirability - a.desirability)
    .slice(0, Math.max(3, Math.min(10, options.candidatePackagesPerRound ?? 8)));
}

async function efficiencyCandidates(
  parsed: ParsedDeck,
  identity: string[],
  policy: ResolvedPrintingPolicyV08,
  options: CedhRefinementOptionsV14,
  excludedNames: Set<string>,
): Promise<ExactAdditionV14[]> {
  const existing = new Set([...parsed.commanders, ...parsed.main].map((entry) => normalize(entry.name)));
  const queryClauses = [
    'mv<=2 -t:land',
    'o:"search your library for" -t:land',
    '(o:"counter target" OR o:"rather than pay") -t:land',
    '(o:"draw" OR o:"look at the top" OR o:"surveil") mv<=3 -t:land',
  ];
  const candidateMap = new Map<string, ScryfallCard>();
  for (const clause of queryClauses) {
    const query = ['f:commander', identityQuery(identity), clause, policy.searchClause].filter(Boolean).join(' ');
    try {
      for (const card of await searchCards(query, 50)) {
        const key = normalize(card.name);
        if (!existing.has(key) && !excludedNames.has(key) && !isLand(card) && card.legalities.commander === 'legal') {
          if (!candidateMap.has(key) || efficiencyScore(card) > efficiencyScore(candidateMap.get(key) as ScryfallCard)) candidateMap.set(key, card);
        }
      }
    } catch {
      continue;
    }
  }

  const ranked = [...candidateMap.values()].sort((a, b) => efficiencyScore(b) - efficiencyScore(a));
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

async function evidenceForDeck(parsed: ParsedDeck, cards: ScryfallCard[]): Promise<CompetitiveEvidenceV14> {
  const decklist = renderDeck(parsed);
  const [bracket, combos] = await Promise.all([
    estimateCommanderBracket(decklist),
    findDeckCombos(decklist, 80),
  ]);
  const metrics = buildDeckMetrics(parsed, cards);
  const counts = asRecord(combos.counts);
  return {
    bracketTag: typeof bracket.bracketTag === 'string' ? bracket.bracketTag : null,
    includedCombos: Number(counts.included ?? 0),
    almostIncludedCombos: Number(counts.almostIncluded ?? 0),
    ruthlessCombos: countRuthlessVariants(combos),
    strategicallyRelevantCombos: Array.isArray(bracket.strategicallyRelevantCombos) ? bracket.strategicallyRelevantCombos.length : 0,
    averageNonlandManaValue: metrics.averageNonlandManaValue,
    earlyPlays: metrics.earlyPlayCount,
    fastMana: metrics.fastManaCount,
    cheapInteraction: metrics.cheapInteractionCount,
  };
}

function packageScore(evidence: CompetitiveEvidenceV14): number {
  return comboTagScore(evidence.bracketTag)
    + evidence.includedCombos * 24
    + evidence.ruthlessCombos * 38
    + evidence.strategicallyRelevantCombos * 22
    + evidence.fastMana * 3
    + evidence.cheapInteraction * 2
    + evidence.earlyPlays * 0.8
    - evidence.averageNonlandManaValue * 9;
}

async function evaluatePackage(
  kind: PackageEvaluationV14['kind'],
  label: string,
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  cuts: string[],
  additions: ExactAdditionV14[],
  policy: ResolvedPrintingPolicyV08,
): Promise<PackageEvaluationV14 | null> {
  const nextParsed = applyPackage(parsed, cuts, additions);
  const nextCards = applyResolvedCards(cards, cuts, additions);
  if (!nextParsed || !nextCards || nextParsed.totalCards !== 100) return null;
  const rules = validateCommanderDeck(nextParsed, nextCards);
  if (!rules.isLegal || nextCards.some((card) => !printingMatchesPolicyV08(card, policy))) return null;

  const evidence = await evidenceForDeck(nextParsed, nextCards);
  return {
    kind,
    label,
    additions,
    cuts,
    parsed: nextParsed,
    resolvedCards: nextCards,
    decklist: renderDeck(nextParsed),
    bracketTag: evidence.bracketTag,
    includedCombos: evidence.includedCombos,
    ruthlessCombos: evidence.ruthlessCombos,
    strategicallyRelevantCombos: evidence.strategicallyRelevantCombos,
    averageManaValue: evidence.averageNonlandManaValue,
    earlyPlays: evidence.earlyPlays,
    fastMana: evidence.fastMana,
    cheapInteraction: evidence.cheapInteraction,
    score: Number(packageScore(evidence).toFixed(2)),
  };
}

function materiallyBetter(before: CompetitiveEvidenceV14, candidate: PackageEvaluationV14): boolean {
  if (candidate.ruthlessCombos > before.ruthlessCombos) return true;
  if (candidate.includedCombos > before.includedCombos) return true;
  if (candidate.strategicallyRelevantCombos > before.strategicallyRelevantCombos) return true;
  if (candidate.bracketTag === 'R' && before.bracketTag !== 'R') return true;
  if (candidate.averageManaValue + 0.12 < before.averageNonlandManaValue && candidate.earlyPlays >= before.earlyPlays) return true;
  if (candidate.fastMana > before.fastMana && candidate.averageManaValue <= before.averageNonlandManaValue + 0.05) return true;
  if (candidate.cheapInteraction > before.cheapInteraction && candidate.averageManaValue <= before.averageNonlandManaValue + 0.05) return true;
  return false;
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
      priceUsd: addition.priceUsd,
      reason: addition.reason,
    })),
    cuts: candidate.cuts,
    bracketTag: candidate.bracketTag,
    includedCombos: candidate.includedCombos,
    ruthlessCombos: candidate.ruthlessCombos,
    strategicallyRelevantCombos: candidate.strategicallyRelevantCombos,
    averageManaValue: candidate.averageManaValue,
    earlyPlays: candidate.earlyPlays,
    fastMana: candidate.fastMana,
    cheapInteraction: candidate.cheapInteraction,
    score: candidate.score,
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

  const start = await resolveStartingDeck(decklist);
  const startRules = validateCommanderDeck(start.parsed, start.cards);
  if (start.notFound.length > 0 || !startRules.isLegal || start.parsed.totalCards !== 100) {
    return { status: 'invalid-starting-deck', unresolvedCards: start.notFound, commanderRules: startRules };
  }
  if (start.cards.some((card) => !printingMatchesPolicyV08(card, policy))) {
    return { status: 'starting-deck-violates-printing-policy', printingPolicy: describePrintingPolicyV08(policy) };
  }

  let currentParsed = start.parsed;
  let currentCards = start.cards;
  let currentDecklist = renderDeck(start.parsed);
  const identity = commanderIdentity(currentParsed, currentCards);
  const protectedNames = new Set((options.protectedCards ?? []).map(normalize));
  for (const commander of currentParsed.commanders) protectedNames.add(normalize(commander.name));
  const excludedNames = new Set((options.excludedCards ?? []).map(normalize));
  const baseline = await evidenceForDeck(currentParsed, currentCards);
  const acceptedSwaps: Array<Record<string, unknown>> = [];
  const rounds: Array<Record<string, unknown>> = [];

  for (let round = 1; round <= maxRounds && acceptedSwaps.length < maxSwaps; round += 1) {
    const before = await evidenceForDeck(currentParsed, currentCards);
    const candidates: PackageEvaluationV14[] = [];
    const cutList = rankedCuts(currentParsed, currentCards, protectedNames, 24);

    const comboPackages = await comboCompletionPackages(currentParsed, identity, policy, options);
    for (const comboPackage of comboPackages) {
      if (acceptedSwaps.length + comboPackage.additions.length > maxSwaps) continue;
      const cuts = cutList
        .filter((name) => !comboPackage.additions.some((addition) => normalize(addition.name) === normalize(name)))
        .slice(0, comboPackage.additions.length);
      if (cuts.length !== comboPackage.additions.length) continue;
      const evaluated = await evaluatePackage(
        'combo-completion',
        comboPackage.label,
        currentParsed,
        currentCards,
        cuts,
        comboPackage.additions,
        policy,
      );
      if (evaluated) candidates.push(evaluated);
    }

    const efficiency = await efficiencyCandidates(currentParsed, identity, policy, options, excludedNames);
    for (const size of [3, 5, 7]) {
      if (acceptedSwaps.length + size > maxSwaps) continue;
      const additions = efficiency.slice(0, size);
      const cuts = cutList.slice(0, size);
      if (additions.length !== size || cuts.length !== size) continue;
      const evaluated = await evaluatePackage(
        'efficiency',
        `Replace ${size} slow slots with high-efficiency cEDH-role cards`,
        currentParsed,
        currentCards,
        cuts,
        additions,
        policy,
      );
      if (evaluated) candidates.push(evaluated);
    }

    candidates.sort((a, b) => b.score - a.score || b.ruthlessCombos - a.ruthlessCombos || b.includedCombos - a.includedCombos || a.averageManaValue - b.averageManaValue);
    const winner = candidates.find((candidate) => materiallyBetter(before, candidate));
    if (!winner) {
      rounds.push({
        round,
        accepted: false,
        reason: candidates.length === 0 ? 'no-legal-policy-compliant-candidate-package' : 'no-candidate-improved-competitive-evidence',
        before,
        bestCandidate: candidates[0] ? summarizePackage(candidates[0]) : null,
        candidateCount: candidates.length,
      });
      break;
    }

    currentParsed = winner.parsed;
    currentCards = winner.resolvedCards;
    currentDecklist = winner.decklist;
    for (const addition of winner.additions) protectedNames.add(normalize(addition.name));
    for (const cut of winner.cuts) excludedNames.add(normalize(cut));
    const roundSwaps = winner.additions.map((addition, index) => ({
      out: winner.cuts[index] ?? null,
      in: addition.name,
      reason: addition.reason,
      printing: {
        set: addition.card.set.toUpperCase(),
        collectorNumber: addition.card.collector_number,
        finish: addition.finish,
        priceUsd: addition.priceUsd,
      },
    }));
    acceptedSwaps.push(...roundSwaps);
    rounds.push({
      round,
      accepted: true,
      before,
      winner: summarizePackage(winner),
      candidateCount: candidates.length,
    });
  }

  const finalEvidence = await evidenceForDeck(currentParsed, currentCards);
  const finalRules = validateCommanderDeck(currentParsed, currentCards);
  const competitiveEvidence = {
    hasCompleteCombo: finalEvidence.includedCombos > 0,
    hasRuthlessCombo: finalEvidence.ruthlessCombos > 0,
    hasStrategicallyRelevantCombo: finalEvidence.strategicallyRelevantCombos > 0,
    spellbookBracketTag: finalEvidence.bracketTag,
    lowAverageManaValue: finalEvidence.averageNonlandManaValue <= 2.6,
    improvedFromBaseline: packageScore(finalEvidence) > packageScore(baseline),
    cEDHReadiness: finalEvidence.ruthlessCombos > 0 && finalEvidence.includedCombos > 0
      ? 'strong-competitive-construction-signals'
      : finalEvidence.includedCombos > 0 || packageScore(finalEvidence) > packageScore(baseline)
        ? 'improved-but-not-proof-of-bracket-5'
        : 'insufficient-competitive-construction-signals',
    note: 'Official Bracket 5 is a cEDH intent/metagame category, so card composition alone cannot prove Bracket 5. These signals measure whether construction moved materially closer to a competitive shell.',
  };

  return {
    status: acceptedSwaps.length > 0 ? 'cedh-refined' : 'no-supported-cedh-improvement',
    baseline,
    finalEvidence,
    competitiveEvidence,
    totalSwaps: acceptedSwaps.length,
    swaps: acceptedSwaps,
    rounds,
    finalDecklist: currentDecklist,
    finalCommanderRules: finalRules,
    printingPolicy: describePrintingPolicyV08(policy),
    guidance: 'For target Bracket 5, prioritize completed compact commander-centric win packages, Ruthless/competitive combo evidence, low-cost interaction and acceleration, and tournament/meta evidence when available. Do not call a deck cEDH solely because targetBracket=5 was requested.',
  };
}
