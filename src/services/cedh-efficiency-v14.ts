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
import { getCardsByIdentifiers, inferCardRoles, searchCards, type CardIdentifierInput } from './scryfall.js';
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

function text(card: ScryfallCard): string {
  return (card.oracle_text ?? '').toLocaleLowerCase();
}

function isLandSpecificTutor(card: ScryfallCard): boolean {
  return /search your library for (?:up to )?(?:a|an|one|two)?\s*(?:basic )?land(?: card)?/.test(text(card));
}

function hasGoodEdhrecRank(card: ScryfallCard, threshold: number): boolean {
  return card.edhrec_rank !== undefined && card.edhrec_rank <= threshold;
}

function strictCedhQuality(card: ScryfallCard): { eligible: boolean; score: number; reasons: string[] } {
  if (isLand(card)) return { eligible: false, score: -999, reasons: [] };
  const roles = new Set(inferCardRoles(card));
  const reasons: string[] = [];
  let score = 0;

  if (roles.has('free interaction')) {
    score += 95;
    reasons.push('free interaction');
  }
  if (roles.has('fast mana')) {
    score += 90;
    reasons.push('fast mana');
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
  if ((roles.has('mana acceleration') || roles.has('cost reduction')) && card.cmc <= 2 && hasGoodEdhrecRank(card, 3_000)) {
    score += 55;
    reasons.push('efficient proven mana acceleration');
  }
  if (roles.has('card selection') && card.cmc <= 1 && hasGoodEdhrecRank(card, 2_000)) {
    score += 38;
    reasons.push('one-mana proven card selection');
  }

  if (reasons.length === 0) return { eligible: false, score: -999, reasons: [] };
  score += Math.max(0, 22 - card.cmc * 6);
  if (card.edhrec_rank !== undefined) score += Math.max(0, 20 - Math.log10(card.edhrec_rank + 1) * 4);
  return { eligible: true, score, reasons };
}

function cutPressure(card: ScryfallCard, protectedNames: Set<string>): number {
  if (isLand(card) || protectedNames.has(normalize(card.name))) return -999;
  const roles = new Set(inferCardRoles(card));
  let pressure = Math.max(0, card.cmc - 2) * 12;
  if (card.cmc >= 5) pressure += 18;
  if (roles.has('board wipe')) pressure += 10;
  if (isLandSpecificTutor(card) && card.cmc >= 3) pressure += 25;
  if ((roles.has('land ramp') || roles.has('mana acceleration')) && card.cmc >= 3) pressure += 18;
  if (roles.has('fast mana')) pressure -= 90;
  if (roles.has('free interaction')) pressure -= 85;
  if (roles.has('countermagic') && card.cmc <= 2) pressure -= 45;
  if (roles.has('spot interaction') && card.cmc <= 2) pressure -= 40;
  if (roles.has('tutor') && !isLandSpecificTutor(card) && card.cmc <= 2) pressure -= 55;
  if (roles.has('protection')) pressure -= card.cmc <= 2 ? 35 : 10;
  if (roles.has('repeatable draw') && card.cmc <= 3) pressure -= 32;
  return pressure;
}

function rankedCuts(parsed: ParsedDeck, cards: ScryfallCard[], protectedNames: Set<string>, count: number): string[] {
  return [...new Set(parsed.main
    .map((entry) => ({ entry, card: resolveEntryCard(entry, cards) }))
    .filter((item): item is { entry: DeckEntry; card: ScryfallCard } => Boolean(item.card) && item.entry.quantity === 1)
    .map(({ card }) => ({ name: card.name, pressure: cutPressure(card, protectedNames) }))
    .filter((entry) => entry.pressure > -500)
    .sort((a, b) => b.pressure - a.pressure || a.name.localeCompare(b.name))
    .map((entry) => entry.name))].slice(0, count);
}

async function strictCandidates(
  parsed: ParsedDeck,
  identity: string[],
  policy: ResolvedPrintingPolicyV08,
  options: CedhEfficiencyOptionsV14,
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
  ];
  const map = new Map<string, { card: ScryfallCard; quality: ReturnType<typeof strictCedhQuality> }>();

  for (const clause of clauses) {
    const query = ['f:commander', identityQuery(identity), clause, policy.searchClause].filter(Boolean).join(' ');
    try {
      for (const card of await searchCards(query, 50)) {
        const key = normalize(card.name);
        if (existing.has(key) || excluded.has(key) || card.legalities.commander !== 'legal') continue;
        const quality = strictCedhQuality(card);
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
    if (output.length >= 12) break;
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

export async function refineCedhEfficiencyV14(
  decklist: string,
  options: CedhEfficiencyOptionsV14 = {},
): Promise<Record<string, unknown>> {
  const maxSwaps = Math.max(1, Math.min(5, Math.trunc(options.maxSwaps ?? 3)));
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
  const candidates = await strictCandidates(resolved.parsed, identity, policy, options);
  if (candidates.length === 0) {
    return { status: 'no-strict-cedh-candidates', finalDecklist: renderDeck(resolved.parsed), printingPolicy: describePrintingPolicyV08(policy) };
  }

  const additions = candidates.slice(0, maxSwaps);
  const cuts = rankedCuts(resolved.parsed, resolved.cards, protectedNames, additions.length);
  if (cuts.length !== additions.length) {
    return { status: 'no-safe-cut-package', finalDecklist: renderDeck(resolved.parsed), candidateCount: candidates.length };
  }
  const nextParsed = applyPackage(resolved.parsed, cuts, additions);
  const nextCards = applyResolvedCards(resolved.cards, cuts, additions);
  if (!nextParsed || !nextCards || nextParsed.totalCards !== 100) {
    return { status: 'package-application-failed', finalDecklist: renderDeck(resolved.parsed) };
  }
  const nextRules = validateCommanderDeck(nextParsed, nextCards);
  if (!nextRules.isLegal || nextCards.some((card) => !printingMatchesPolicyV08(card, policy))) {
    return { status: 'candidate-package-failed-validation', finalDecklist: renderDeck(resolved.parsed), commanderRules: nextRules };
  }

  const [beforeCombos, afterCombos] = await Promise.all([
    findDeckCombos(renderDeck(resolved.parsed), 100),
    findDeckCombos(renderDeck(nextParsed), 100),
  ]);
  const beforeComboCount = comboCount(beforeCombos);
  const afterComboCount = comboCount(afterCombos);
  if (afterComboCount < beforeComboCount) {
    return {
      status: 'rejected-combo-regression',
      finalDecklist: renderDeck(resolved.parsed),
      beforeComboCount,
      afterComboCount,
    };
  }

  const beforeMetrics = buildDeckMetrics(resolved.parsed, resolved.cards);
  const afterMetrics = buildDeckMetrics(nextParsed, nextCards);
  const materiallyBetter = afterMetrics.fastManaCount > beforeMetrics.fastManaCount
    || afterMetrics.cheapInteractionCount > beforeMetrics.cheapInteractionCount
    || afterMetrics.averageNonlandManaValue + 0.08 < beforeMetrics.averageNonlandManaValue
    || afterMetrics.earlyPlayCount >= beforeMetrics.earlyPlayCount + 2;
  if (!materiallyBetter) {
    return {
      status: 'rejected-no-material-efficiency-gain',
      finalDecklist: renderDeck(resolved.parsed),
      beforeMetrics,
      afterMetrics,
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
    beforeComboCount,
    afterComboCount,
    finalDecklist: renderDeck(nextParsed),
    finalCommanderRules: nextRules,
    printingPolicy: describePrintingPolicyV08(policy),
    candidateCount: candidates.length,
    guidance: 'Strict cEDH efficiency mode only admits candidates with an explicit high-value competitive role. Cheap mana value alone is not enough, and later tuning may not remove an already verified complete combo.',
  };
}
