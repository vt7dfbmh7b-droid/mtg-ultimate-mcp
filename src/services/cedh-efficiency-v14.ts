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
import { getCardsByIdentifiers, searchCards, type CardIdentifierInput } from './scryfall.js';
import { effectiveCardRolesV15, manaRoleTruthV15 } from './card-role-truth-v15.js';
import {
  cardCreatureTypeCoherenceScoreV15,
  deriveCreatureTypePreferencesV15,
  isPreferredCreatureTypeCardV15,
  type CreatureTypePreferenceV15,
} from './creature-type-coherence-v15.js';
import { isWinResultV14 } from './cedh-win-package-v14.js';
import { findDeckCombos } from './spellbook.js';

export interface CedhEfficiencyOptionsV14 {
  printingFamily?: string;
  allowedSets?: string[];
  includePromos?: boolean;
  includeSpecialReleases?: boolean;
  maxUsdPerCard?: number;
  maxSwaps?: number;
  protectedCards?: string[];
  excludedCards?: string[];
}

interface ExactCandidateV14 {
  card: ScryfallCard;
  finish: 'nonfoil' | 'foil' | 'etched' | null;
  priceUsd: number | null;
  qualityScore: number;
  reasons: string[];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function finishMarker(finish: DeckEntry['finish'] | ExactCandidateV14['finish']): string {
  if (finish === 'foil') return ' *F*';
  if (finish === 'etched') return ' *E*';
  if (finish === 'nonfoil') return ' *N*';
  return '';
}

function renderEntry(entry: DeckEntry): string {
  const printing = entry.set && entry.collectorNumber ? ` (${entry.set.toUpperCase()}) ${entry.collectorNumber}` : '';
  return `${entry.quantity} ${entry.name}${printing}${finishMarker(entry.finish)}`;
}

function renderDeck(parsed: ParsedDeck): string {
  return ['// COMMANDER', ...parsed.commanders.map(renderEntry), '', '// MAIN', ...parsed.main.map(renderEntry)].join('\n');
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
  const names = new Set(parsed.commanders.map((entry) => normalize(entry.name)));
  return [...new Set(cards.filter((card) => names.has(normalize(card.name))).flatMap((card) => card.color_identity))].sort();
}

function identityQuery(identity: string[]): string {
  return identity.length === 0 ? 'id:c' : `id<=${identity.join('').toLocaleLowerCase()}`;
}

function isLand(card: ScryfallCard): boolean {
  return card.type_line.toLocaleLowerCase().includes('land');
}

function isCreature(card: ScryfallCard): boolean {
  return card.type_line.toLocaleLowerCase().includes('creature');
}

function text(card: ScryfallCard): string {
  return (card.oracle_text ?? '').toLocaleLowerCase();
}

function isLandSpecificTutor(card: ScryfallCard): boolean {
  return /search your library for (?:up to )?(?:a|an|one|two)?\s*(?:basic )?land(?: card)?/.test(text(card));
}

function hasGoodEdhrecRank(card: ScryfallCard, threshold: number): boolean {
  return card.edhrec_rank !== undefined && card.edhrec_rank <= threshold;
}

export function strictCedhQualityV14(
  card: ScryfallCard,
  creatureTypePreference: CreatureTypePreferenceV15 | null,
): { eligible: boolean; score: number; reasons: string[] } {
  if (isLand(card)) return { eligible: false, score: -999, reasons: [] };
  const roles = new Set(effectiveCardRolesV15(card));
  const manaTruth = manaRoleTruthV15(card);
  const typal = cardCreatureTypeCoherenceScoreV15(card, creatureTypePreference);
  const reasons: string[] = [];
  let score = 0;

  if (roles.has('free interaction')) {
    score += 95;
    reasons.push('free interaction');
  }
  if (roles.has('fast mana') && manaTruth.reliableImmediateFastMana) {
    score += 90;
    reasons.push('reliable immediate fast mana');
  }
  if (roles.has('countermagic') && card.cmc <= 2) {
    score += 72;
    reasons.push('cheap countermagic');
  }
  if (roles.has('spot interaction') && card.cmc <= 2) {
    score += 65;
    reasons.push('cheap spot interaction');
  }
  if (roles.has('protection') && card.cmc <= 2) {
    score += 58;
    reasons.push('cheap protection');
  }
  if (roles.has('tutor') && !isLandSpecificTutor(card) && card.cmc <= 2) {
    score += 82;
    reasons.push('cheap broad tutor');
  }
  if (/can(?:not|'t) cast spells|can't cast spells|your opponents can't cast/.test(text(card)) && card.cmc <= 2) {
    score += 78;
    reasons.push('cheap stack/turn lock protection');
  }
  if ((roles.has('repeatable draw') || roles.has('card draw')) && card.cmc <= 3 && hasGoodEdhrecRank(card, 4_000)) {
    score += card.cmc <= 2 ? 60 : 42;
    reasons.push('efficient proven card advantage');
  }
  if (
    ((roles.has('mana acceleration') && manaTruth.reliableLowCostManaAcceleration) || roles.has('cost reduction'))
    && card.cmc <= 2
    && hasGoodEdhrecRank(card, 3_000)
  ) {
    score += 55;
    reasons.push('reliable efficient mana acceleration');
  }
  if (roles.has('creature sacrifice outlet') && card.cmc <= 2) {
    score += card.cmc <= 1 ? 78 : 62;
    reasons.push('cheap repeatable creature sacrifice outlet');
  }
  if (roles.has('life drain') && card.cmc <= 3) {
    score += card.cmc <= 2 ? 58 : 40;
    reasons.push('efficient death/life-loss payoff');
  }
  if (roles.has('graveyard recursion') && card.cmc <= 2 && hasGoodEdhrecRank(card, 6_000)) {
    score += 42;
    reasons.push('cheap proven graveyard recursion');
  }
  if (roles.has('sacrifice synergy') && card.cmc <= 2) {
    score += 34;
    reasons.push('cheap sacrifice-engine support');
  }
  if (roles.has('card selection') && card.cmc <= 1 && hasGoodEdhrecRank(card, 2_000)) {
    score += 38;
    reasons.push('one-mana proven card selection');
  }
  if (typal.score > 0) {
    score += typal.score;
    reasons.push(...typal.reasons);
  }

  if (reasons.length === 0) return { eligible: false, score: -999, reasons: [] };
  score += Math.max(0, 22 - card.cmc * 6);
  if (card.edhrec_rank !== undefined) score += Math.max(0, 20 - Math.log10(card.edhrec_rank + 1) * 4);
  return { eligible: true, score, reasons };
}

function hasSubstantiveOffTypeUtility(roles: Set<string>, card: ScryfallCard): boolean {
  if (roles.has('creature sacrifice outlet') || roles.has('life drain') || roles.has('tutor')) return true;
  if (roles.has('free interaction') || roles.has('countermagic') || roles.has('spot interaction')) return true;
  if (roles.has('repeatable draw') || roles.has('card draw')) return true;
  if (roles.has('fast mana') || roles.has('mana acceleration')) return true;
  if (roles.has('protection') && card.cmc <= 2) return true;
  return roles.has('graveyard recursion') && card.cmc <= 1;
}

export function cutPressureV14(
  card: ScryfallCard,
  protectedNames: Set<string>,
  roleCounts: Record<string, number>,
  creatureTypePreference: CreatureTypePreferenceV15 | null,
): number {
  if (isLand(card) || protectedNames.has(normalize(card.name))) return -999;
  const roles = new Set(effectiveCardRolesV15(card));
  const manaTruth = manaRoleTruthV15(card);
  const typal = cardCreatureTypeCoherenceScoreV15(card, creatureTypePreference);
  let pressure = Math.max(0, card.cmc - 2) * 12;

  if (card.cmc >= 5) pressure += 18;
  if (roles.has('board wipe')) pressure += 10;
  if (isLandSpecificTutor(card) && card.cmc >= 3) pressure += 25;
  if (roles.has('tutor') && !isLandSpecificTutor(card) && card.cmc >= 3) pressure += 30;
  if ((roles.has('land ramp') || roles.has('mana acceleration')) && card.cmc >= 3) pressure += 18;
  if (roles.has('mana rock') && card.cmc >= 3) pressure += 28;
  if (roles.has('fast mana') && manaTruth.reliableImmediateFastMana) pressure -= 90;
  if (roles.has('free interaction')) pressure -= 85;
  if (roles.has('countermagic') && card.cmc <= 2) pressure -= 45;
  if (roles.has('spot interaction') && card.cmc <= 2) pressure -= 40;
  if (roles.has('tutor') && !isLandSpecificTutor(card) && card.cmc <= 2) pressure -= 55;
  if (roles.has('protection')) pressure -= card.cmc <= 2 ? 35 : 10;
  if (roles.has('repeatable draw') && card.cmc <= 3) pressure -= 32;
  if (roles.has('sacrifice outlet')) pressure -= 34;
  if (roles.has('life drain')) pressure -= 22;

  const protectionCount = Number(roleCounts.protection ?? 0);
  if (roles.has('protection') && protectionCount > 4) {
    pressure += Math.min(28, (protectionCount - 4) * 7);
    if (card.cmc >= 3) pressure += 12;
  }

  const recursionCount = Number(roleCounts['graveyard recursion'] ?? 0);
  if (roles.has('graveyard recursion') && recursionCount > 12) {
    pressure += Math.min(48, (recursionCount - 12) * 4);
    if (card.cmc <= 2) pressure -= 10;
    if (card.cmc >= 3) pressure += 14;
  }

  const strongTypalPreference = creatureTypePreference !== null && creatureTypePreference.score >= 12;
  if (
    strongTypalPreference
    && isCreature(card)
    && !isPreferredCreatureTypeCardV15(card, creatureTypePreference)
    && !hasSubstantiveOffTypeUtility(roles, card)
  ) {
    pressure += 18;
  }

  if (isPreferredCreatureTypeCardV15(card, creatureTypePreference)) pressure -= 18;
  if (typal.score > 0) pressure -= Math.min(36, typal.score / 4);
  return pressure;
}

function rankedCuts(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  protectedNames: Set<string>,
  count: number,
  roleCounts: Record<string, number>,
  creatureTypePreference: CreatureTypePreferenceV15 | null,
): string[] {
  return [...new Set(parsed.main
    .map((entry) => ({ entry, card: resolveEntryCard(entry, cards) }))
    .filter((item): item is { entry: DeckEntry; card: ScryfallCard } => Boolean(item.card) && item.entry.quantity === 1)
    .map(({ card }) => ({ name: card.name, pressure: cutPressureV14(card, protectedNames, roleCounts, creatureTypePreference) }))
    .filter((entry) => entry.pressure > -500)
    .sort((a, b) => b.pressure - a.pressure || a.name.localeCompare(b.name))
    .map((entry) => entry.name))].slice(0, count);
}

function escapedTypeQuery(creatureType: string): string {
  return creatureType.replace(/"/g, '\\"');
}

async function strictCandidates(
  parsed: ParsedDeck,
  identity: string[],
  policy: ResolvedPrintingPolicyV08,
  options: CedhEfficiencyOptionsV14,
  creatureTypePreference: CreatureTypePreferenceV15 | null,
): Promise<ExactCandidateV14[]> {
  const existing = new Set([...parsed.commanders, ...parsed.main].map((entry) => normalize(entry.name)));
  const excluded = new Set((options.excludedCards ?? []).map(normalize));
  const clauses = [
    'mv<=2 -t:land',
    'o:"counter target" mv<=2 -t:land',
    'o:"search your library for" mv<=2 -t:land',
    '(o:"can\'t cast spells" OR o:"cannot cast spells") mv<=2 -t:land',
    'o:"draw" mv<=3 -t:land',
    'o:"add" mv<=2 -t:land',
    'o:"sacrifice a creature" mv<=2 -t:land',
    'o:"sacrifice another creature" mv<=2 -t:land',
    'o:"dies" mv<=3 -t:land',
    'o:"from your graveyard" mv<=2 -t:land',
    ...(creatureTypePreference ? [`t:"${escapedTypeQuery(creatureTypePreference.creatureType)}" mv<=3 -t:land`] : []),
  ];
  const map = new Map<string, { card: ScryfallCard; quality: ReturnType<typeof strictCedhQualityV14> }>();

  for (const clause of clauses) {
    const query = ['f:commander', identityQuery(identity), clause, policy.searchClause].filter(Boolean).join(' ');
    try {
      for (const card of await searchCards(query, 50)) {
        const key = normalize(card.name);
        if (existing.has(key) || excluded.has(key) || card.legalities.commander !== 'legal') continue;
        const quality = strictCedhQualityV14(card, creatureTypePreference);
        if (!quality.eligible) continue;
        const previous = map.get(key);
        if (!previous || quality.score > previous.quality.score) map.set(key, { card, quality });
      }
    } catch {
      continue;
    }
  }

  const ranked = [...map.values()].sort((a, b) => b.quality.score - a.quality.score);
  const output: ExactCandidateV14[] = [];
  for (const item of ranked) {
    if (output.length >= 24) break;
    const printing = await selectEligiblePrintingV08(item.card, policy, options.maxUsdPerCard);
    if (!printing) continue;
    output.push({
      card: printing.card,
      finish: printing.finish,
      priceUsd: printing.priceUsd,
      qualityScore: item.quality.score,
      reasons: item.quality.reasons,
    });
  }
  return output;
}

function applyPackage(parsed: ParsedDeck, cuts: string[], additions: ExactCandidateV14[]): ParsedDeck | null {
  if (cuts.length !== additions.length || additions.length === 0) return null;
  const cutSet = new Set(cuts.map(normalize));
  const main: DeckEntry[] = [];
  let removed = 0;
  for (const entry of parsed.main) {
    if (entry.quantity === 1 && cutSet.has(normalize(entry.name))) {
      removed += 1;
      continue;
    }
    main.push({ ...entry });
  }
  if (removed !== additions.length) return null;
  for (const addition of additions) {
    main.push({
      name: addition.card.name,
      quantity: 1,
      set: addition.card.set.toUpperCase(),
      collectorNumber: addition.card.collector_number,
      ...(addition.finish ? { finish: addition.finish } : {}),
    });
  }
  const totalMain = main.reduce((sum, entry) => sum + entry.quantity, 0);
  return {
    main,
    commanders: parsed.commanders.map((entry) => ({ ...entry })),
    totalMain,
    totalCommanders: parsed.totalCommanders,
    totalCards: totalMain + parsed.totalCommanders,
  };
}

function applyResolvedCards(cards: ScryfallCard[], cuts: string[], additions: ExactCandidateV14[]): ScryfallCard[] | null {
  const next = [...cards];
  for (const cut of cuts) {
    const index = next.findIndex((card) => normalize(card.name) === normalize(cut));
    if (index < 0) return null;
    next.splice(index, 1);
  }
  next.push(...additions.map((addition) => addition.card));
  return next;
}

function comboCount(value: Record<string, unknown>): number {
  return Number(record(value.counts).included ?? 0);
}

function winningCombos(value: Record<string, unknown>): Record<string, unknown>[] {
  const included = Array.isArray(value.included) ? value.included.map(record) : [];
  return included.filter((combo) => {
    const results = Array.isArray(combo.results) ? combo.results.map(String) : [];
    return isWinResultV14(results);
  });
}

function winningComboCount(value: Record<string, unknown>): number {
  return winningCombos(value).length;
}

function winningComboCardSet(combo: Record<string, unknown>, index: number): Set<string> {
  const cards = Array.isArray(combo.cards) ? combo.cards.map(record) : [];
  const names = cards
    .filter((card) => card.mustBeCommander !== true)
    .map((card) => typeof card.name === 'string' ? normalize(card.name) : '')
    .filter(Boolean);
  return new Set(names.length > 0 ? names : [`__unknown-winning-combo-${index}`]);
}

export function winningComboCoreCountV14(value: Record<string, unknown>): number {
  const combos = winningCombos(value);
  const sets = combos.map((combo, index) => winningComboCardSet(combo, index));
  if (sets.length === 0) return 0;
  const visited = new Set<number>();
  let components = 0;

  for (let start = 0; start < sets.length; start += 1) {
    if (visited.has(start)) continue;
    components += 1;
    const queue = [start];
    visited.add(start);
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) continue;
      const currentSet = sets[current] as Set<string>;
      for (let other = 0; other < sets.length; other += 1) {
        if (visited.has(other)) continue;
        const otherSet = sets[other] as Set<string>;
        if ([...currentSet].some((name) => otherSet.has(name))) {
          visited.add(other);
          queue.push(other);
        }
      }
    }
  }
  return components;
}

export function assessCedhComboPreservationV14(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): {
  acceptable: boolean;
  beforeComboCount: number;
  afterComboCount: number;
  beforeWinningComboCount: number;
  afterWinningComboCount: number;
  beforeWinningComboCoreCount: number;
  afterWinningComboCoreCount: number;
} {
  const beforeComboCount = comboCount(before);
  const afterComboCount = comboCount(after);
  const beforeWinningComboCount = winningComboCount(before);
  const afterWinningComboCount = winningComboCount(after);
  const beforeWinningComboCoreCount = winningComboCoreCountV14(before);
  const afterWinningComboCoreCount = winningComboCoreCountV14(after);
  return {
    acceptable: (beforeWinningComboCount === 0 || afterWinningComboCount > 0)
      && afterWinningComboCoreCount >= beforeWinningComboCoreCount,
    beforeComboCount,
    afterComboCount,
    beforeWinningComboCount,
    afterWinningComboCount,
    beforeWinningComboCoreCount,
    afterWinningComboCoreCount,
  };
}

export async function refineCedhEfficiencyV14(
  decklist: string,
  options: CedhEfficiencyOptionsV14 = {},
): Promise<Record<string, unknown>> {
  const maxSwaps = Math.max(1, Math.min(10, Math.trunc(options.maxSwaps ?? 3)));
  const policy = await resolvePrintingPolicyV08({
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
  });
  const resolved = await resolveDeck(decklist);
  const rules = validateCommanderDeck(resolved.parsed, resolved.cards);
  if (resolved.notFound.length > 0 || resolved.parsed.totalCards !== 100 || !rules.isLegal) {
    return { status: 'invalid-starting-deck', unresolvedCards: resolved.notFound, commanderRules: rules };
  }
  if (resolved.cards.some((card) => !printingMatchesPolicyV08(card, policy))) {
    return { status: 'starting-deck-violates-printing-policy', printingPolicy: describePrintingPolicyV08(policy) };
  }

  const protectedNames = new Set((options.protectedCards ?? []).map(normalize));
  for (const commander of resolved.parsed.commanders) protectedNames.add(normalize(commander.name));
  const identity = commanderIdentity(resolved.parsed, resolved.cards);
  const beforeMetrics = buildDeckMetrics(resolved.parsed, resolved.cards);
  const creatureTypePreference = deriveCreatureTypePreferencesV15(resolved.parsed, resolved.cards)[0] ?? null;
  const candidates = await strictCandidates(resolved.parsed, identity, policy, options, creatureTypePreference);
  if (candidates.length === 0) {
    return {
      status: 'no-strict-cedh-candidates',
      finalDecklist: renderDeck(resolved.parsed),
      creatureTypePreference,
      printingPolicy: describePrintingPolicyV08(policy),
    };
  }

  const additions = candidates.slice(0, maxSwaps);
  const cuts = rankedCuts(
    resolved.parsed,
    resolved.cards,
    protectedNames,
    additions.length,
    beforeMetrics.roleCounts,
    creatureTypePreference,
  );
  if (cuts.length !== additions.length) {
    return { status: 'no-safe-cut-package', finalDecklist: renderDeck(resolved.parsed), candidateCount: candidates.length, creatureTypePreference };
  }
  const nextParsed = applyPackage(resolved.parsed, cuts, additions);
  const nextCards = applyResolvedCards(resolved.cards, cuts, additions);
  if (!nextParsed || !nextCards || nextParsed.totalCards !== 100) {
    return { status: 'package-application-failed', finalDecklist: renderDeck(resolved.parsed), creatureTypePreference };
  }
  const nextRules = validateCommanderDeck(nextParsed, nextCards);
  if (!nextRules.isLegal || nextCards.some((card) => !printingMatchesPolicyV08(card, policy))) {
    return { status: 'candidate-package-failed-validation', finalDecklist: renderDeck(resolved.parsed), commanderRules: nextRules, creatureTypePreference };
  }

  const [beforeCombos, afterCombos] = await Promise.all([
    findDeckCombos(renderDeck(resolved.parsed), 100),
    findDeckCombos(renderDeck(nextParsed), 100),
  ]);
  const comboPreservation = assessCedhComboPreservationV14(beforeCombos, afterCombos);
  if (!comboPreservation.acceptable) {
    return {
      status: 'rejected-winning-combo-regression',
      finalDecklist: renderDeck(resolved.parsed),
      creatureTypePreference,
      ...comboPreservation,
    };
  }

  const afterMetrics = buildDeckMetrics(nextParsed, nextCards);
  const afterCreatureTypePreference = deriveCreatureTypePreferencesV15(nextParsed, nextCards)
    .find((row) => creatureTypePreference && normalize(row.creatureType) === normalize(creatureTypePreference.creatureType)) ?? null;
  const creatureTypeCoherenceImproved = creatureTypePreference !== null
    && afterCreatureTypePreference !== null
    && afterCreatureTypePreference.score >= creatureTypePreference.score + 4;
  const recursionSaturationImproved = beforeMetrics.recursionCount > 12
    && afterMetrics.recursionCount < beforeMetrics.recursionCount
    && afterMetrics.recursionCount >= 8;
  const materiallyBetter = afterMetrics.fastManaCount > beforeMetrics.fastManaCount
    || afterMetrics.cheapInteractionCount > beforeMetrics.cheapInteractionCount
    || afterMetrics.averageNonlandManaValue + 0.08 < beforeMetrics.averageNonlandManaValue
    || afterMetrics.earlyPlayCount >= beforeMetrics.earlyPlayCount + 2
    || creatureTypeCoherenceImproved
    || recursionSaturationImproved;
  if (!materiallyBetter) {
    return {
      status: 'rejected-no-material-efficiency-gain',
      finalDecklist: renderDeck(resolved.parsed),
      beforeMetrics,
      afterMetrics,
      creatureTypePreference,
      afterCreatureTypePreference,
      creatureTypeCoherenceImproved,
      recursionSaturationImproved,
      ...comboPreservation,
    };
  }

  return {
    status: 'cedh-efficiency-refined',
    swaps: additions.map((addition, index) => ({
      out: cuts[index] ?? null,
      in: addition.card.name,
      reasons: addition.reasons,
      qualityScore: Number(addition.qualityScore.toFixed(2)),
      printing: {
        set: addition.card.set.toUpperCase(),
        collectorNumber: addition.card.collector_number,
        finish: addition.finish,
        priceUsd: addition.priceUsd,
      },
    })),
    beforeMetrics,
    afterMetrics,
    creatureTypePreference,
    afterCreatureTypePreference,
    creatureTypeCoherenceImproved,
    recursionSaturationImproved,
    ...comboPreservation,
    finalDecklist: renderDeck(nextParsed),
    finalCommanderRules: nextRules,
    printingPolicy: describePrintingPolicyV08(policy),
    candidateCount: candidates.length,
    guidance: 'Strict efficiency mode now fails closed on conditional/delayed/restricted mana masquerading as fast mana, preserves independent winning-combo cores rather than incidental combo volume, discounts oversaturated recursion and protection, increases pressure on slow tutors and three-mana rocks, and prefers commander-supported creature-type engines plus cheap sacrifice/drain pieces when they provide real standalone utility. Protected cards, legality, printing policy and hard budget remain authoritative.',
  };
}
