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

export interface PreconStructuralOptionsV15 {
  printingFamily?: string;
  allowedSets?: string[];
  includePromos?: boolean;
  includeSpecialReleases?: boolean;
  maxUsdPerCard?: number;
  targetLandCount?: number;
  maxLandToSpellSwaps?: number;
  preferredLandCuts?: string[];
  excludedCards?: string[];
}

type Candidate = {
  card: ScryfallCard;
  finish: 'nonfoil' | 'foil' | 'etched' | null;
  priceUsd: number | null;
  score: number;
  reasons: string[];
};

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function finishMarker(finish: DeckEntry['finish'] | Candidate['finish']): string {
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

function isLand(card: ScryfallCard): boolean {
  return card.type_line.toLocaleLowerCase().includes('land');
}

function cardText(card: ScryfallCard): string {
  return (card.oracle_text ?? '').toLocaleLowerCase();
}

function commanderIdentity(parsed: ParsedDeck, cards: ScryfallCard[]): string[] {
  const commanders = new Set(parsed.commanders.map((entry) => normalize(entry.name)));
  return [...new Set(cards.filter((card) => commanders.has(normalize(card.name))).flatMap((card) => card.color_identity))].sort();
}

function identityQuery(identity: string[]): string {
  return identity.length === 0 ? 'id:c' : `id<=${identity.join('').toLocaleLowerCase()}`;
}

function isLandTutor(card: ScryfallCard): boolean {
  return /search your library for (?:up to )?(?:a|an|one|two)?\s*(?:basic )?land(?: card)?/.test(cardText(card));
}

function candidateQuality(card: ScryfallCard): { eligible: boolean; score: number; reasons: string[]; free: boolean } {
  if (isLand(card)) return { eligible: false, score: -999, reasons: [], free: false };
  const roles = new Set(inferCardRoles(card));
  const reasons: string[] = [];
  let score = 0;
  const free = roles.has('free interaction');

  if (free) {
    score += 110;
    reasons.push('free interaction');
  }
  if (roles.has('fast mana')) {
    score += 100;
    reasons.push('fast mana');
  }
  if (roles.has('tutor') && !isLandTutor(card) && card.cmc <= 3) {
    score += 95;
    reasons.push('efficient tutor');
  }
  if (roles.has('protection') && card.cmc <= 2) {
    score += 88;
    reasons.push('cheap protection');
  }
  if (/can(?:not|'t) cast spells|can't cast spells|your opponents can't cast/.test(cardText(card)) && card.cmc <= 2) {
    score += 86;
    reasons.push('cheap stack/turn lock protection');
  }
  if (roles.has('countermagic') && card.cmc <= 2) {
    score += 82;
    reasons.push('cheap countermagic');
  }
  if (roles.has('spot interaction') && card.cmc <= 2) {
    score += 78;
    reasons.push('cheap spot interaction');
  }
  if ((roles.has('repeatable draw') || roles.has('card draw')) && card.cmc <= 3) {
    score += card.cmc <= 2 ? 62 : 48;
    reasons.push('efficient card advantage');
  }
  if ((roles.has('mana acceleration') || roles.has('cost reduction')) && card.cmc <= 2) {
    score += 58;
    reasons.push('efficient mana acceleration');
  }
  if (roles.has('card selection') && card.cmc <= 1) {
    score += 48;
    reasons.push('one-mana card selection');
  }

  if (reasons.length === 0) return { eligible: false, score: -999, reasons: [], free };
  score += Math.max(0, 34 - card.cmc * 10);
  if (card.game_changer === true) score += 18;
  if (free && card.cmc >= 4) score -= 32 + (card.cmc - 4) * 12;
  if (!free && card.cmc > 3) score -= 60;
  if (card.edhrec_rank !== undefined) score += Math.max(0, 18 - Math.log10(card.edhrec_rank + 1) * 4);
  return { eligible: true, score, reasons, free };
}

async function candidates(
  parsed: ParsedDeck,
  identity: string[],
  policy: ResolvedPrintingPolicyV08,
  options: PreconStructuralOptionsV15,
): Promise<Candidate[]> {
  const existing = new Set([...parsed.commanders, ...parsed.main].map((entry) => normalize(entry.name)));
  const excluded = new Set((options.excludedCards ?? []).map(normalize));
  const clauses = [
    'o:"rather than pay" -t:land',
    'mv<=1 -t:land',
    'mv<=2 -t:land',
    'o:"counter target" mv<=2 -t:land',
    'o:"search your library for" mv<=3 -t:land',
    'o:"draw" mv<=3 -t:land',
    'o:"add" mv<=2 -t:land',
  ];
  const found = new Map<string, { card: ScryfallCard; score: number; reasons: string[]; free: boolean }>();

  for (const clause of clauses) {
    const query = ['f:commander', identityQuery(identity), clause, policy.searchClause].filter(Boolean).join(' ');
    try {
      for (const card of await searchCards(query, 75)) {
        const key = normalize(card.name);
        if (existing.has(key) || excluded.has(key) || card.legalities.commander !== 'legal') continue;
        const quality = candidateQuality(card);
        if (!quality.eligible) continue;
        const previous = found.get(key);
        if (!previous || quality.score > previous.score) found.set(key, { card, ...quality });
      }
    } catch {
      continue;
    }
  }

  const ranked = [...found.values()].sort((a, b) => b.score - a.score || a.card.cmc - b.card.cmc || a.card.name.localeCompare(b.card.name));
  const output: Candidate[] = [];
  let freeCount = 0;
  for (const item of ranked) {
    if (output.length >= 20) break;
    if (item.free && freeCount >= 1) continue;
    const printing = await selectEligiblePrintingV08(item.card, policy, options.maxUsdPerCard);
    if (!printing) continue;
    output.push({
      card: printing.card,
      finish: printing.finish,
      priceUsd: printing.priceUsd,
      score: item.score,
      reasons: item.reasons,
    });
    if (item.free) freeCount += 1;
  }
  return output;
}

function landCutPressure(card: ScryfallCard, preferred: Set<string>): number {
  if (!isLand(card)) return -999;
  let pressure = preferred.has(normalize(card.name)) ? 120 : 0;
  const oracle = cardText(card);
  if (/enters (?:the battlefield )?tapped/.test(oracle)) pressure += 55;
  if (/add one mana of any color|add one mana of any type/.test(oracle)) pressure -= 40;
  if (/\{t\}: add \{c\}/.test(oracle) && !/[wubrg]/.test(oracle.replace(/\{t\}: add \{c\}/g, ''))) pressure += 28;
  if (/search your library/.test(oracle) && /tapped/.test(oracle)) pressure += 30;
  if (card.type_line.toLocaleLowerCase().includes('basic land')) pressure -= 80;
  if (card.edhrec_rank !== undefined) pressure += Math.min(20, Math.log10(card.edhrec_rank + 1) * 4);
  return pressure;
}

function rankedLandCuts(parsed: ParsedDeck, cards: ScryfallCard[], preferred: Set<string>, count: number): string[] {
  return parsed.main
    .map((entry) => ({ entry, card: resolveEntryCard(entry, cards) }))
    .filter((item): item is { entry: DeckEntry; card: ScryfallCard } => Boolean(item.card) && item.entry.quantity === 1 && isLand(item.card))
    .map(({ card }) => ({ name: card.name, pressure: landCutPressure(card, preferred) }))
    .sort((a, b) => b.pressure - a.pressure || a.name.localeCompare(b.name))
    .slice(0, count)
    .map((entry) => entry.name);
}

function apply(parsed: ParsedDeck, cuts: string[], additions: Candidate[]): ParsedDeck | null {
  if (cuts.length !== additions.length || cuts.length === 0) return null;
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

function comboCount(value: Record<string, unknown>): number {
  const counts = value.counts && typeof value.counts === 'object' && !Array.isArray(value.counts) ? value.counts as Record<string, unknown> : {};
  return Number(counts.included ?? 0);
}

export async function refinePreconStructureV15(
  decklist: string,
  options: PreconStructuralOptionsV15 = {},
): Promise<Record<string, unknown>> {
  const parsed = parseDecklist(decklist);
  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  const rules = validateCommanderDeck(parsed, resolved.cards);
  const policy = await resolvePrintingPolicyV08({
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
  });
  if (resolved.notFound.length > 0 || parsed.totalCards !== 100 || !rules.isLegal) {
    return { status: 'invalid-starting-deck', unresolvedCards: resolved.notFound, commanderRules: rules };
  }
  if (resolved.cards.some((card) => !printingMatchesPolicyV08(card, policy))) {
    return { status: 'starting-deck-violates-printing-policy', printingPolicy: describePrintingPolicyV08(policy) };
  }

  const beforeMetrics = buildDeckMetrics(parsed, resolved.cards);
  const targetLandCount = Math.max(28, Math.min(beforeMetrics.landCount, Math.trunc(options.targetLandCount ?? beforeMetrics.landCount)));
  const excess = Math.max(0, beforeMetrics.landCount - targetLandCount);
  const maxSwaps = Math.max(0, Math.min(10, Math.trunc(options.maxLandToSpellSwaps ?? excess), excess));
  if (maxSwaps === 0) {
    return { status: 'no-excess-lands', finalDecklist: renderDeck(parsed), beforeMetrics, afterMetrics: beforeMetrics };
  }

  const identity = commanderIdentity(parsed, resolved.cards);
  const rankedCandidates = await candidates(parsed, identity, policy, options);
  const additions = rankedCandidates.slice(0, maxSwaps);
  if (additions.length < maxSwaps) {
    return { status: 'insufficient-structural-candidates', candidateCount: rankedCandidates.length, finalDecklist: renderDeck(parsed) };
  }

  const preferred = new Set((options.preferredLandCuts ?? []).map(normalize));
  const cuts = rankedLandCuts(parsed, resolved.cards, preferred, additions.length);
  const nextParsed = apply(parsed, cuts, additions);
  if (!nextParsed || nextParsed.totalCards !== 100) {
    return { status: 'structural-package-application-failed', cuts, additions: additions.map((item) => item.card.name), finalDecklist: renderDeck(parsed) };
  }

  const nextResolved = await getCardsByIdentifiers(identifiers(nextParsed));
  const nextRules = validateCommanderDeck(nextParsed, nextResolved.cards);
  if (nextResolved.notFound.length > 0 || !nextRules.isLegal || nextResolved.cards.some((card) => !printingMatchesPolicyV08(card, policy))) {
    return { status: 'structural-package-failed-validation', unresolvedCards: nextResolved.notFound, commanderRules: nextRules, finalDecklist: renderDeck(parsed) };
  }

  const [beforeCombos, afterCombos] = await Promise.all([
    findDeckCombos(renderDeck(parsed), 100),
    findDeckCombos(renderDeck(nextParsed), 100),
  ]);
  const beforeComboCount = comboCount(beforeCombos);
  const afterComboCount = comboCount(afterCombos);
  if (afterComboCount < beforeComboCount) {
    return { status: 'rejected-combo-regression', beforeComboCount, afterComboCount, finalDecklist: renderDeck(parsed) };
  }

  const afterMetrics = buildDeckMetrics(nextParsed, nextResolved.cards);
  return {
    status: 'precon-structure-refined',
    targetLandCount,
    beforeLandCount: beforeMetrics.landCount,
    afterLandCount: afterMetrics.landCount,
    beforeComboCount,
    afterComboCount,
    swaps: cuts.map((out, index) => ({
      out,
      in: additions[index]?.card.name,
      reasons: additions[index]?.reasons ?? [],
      qualityScore: additions[index]?.score ?? null,
      printing: additions[index] ? {
        set: additions[index]!.card.set.toUpperCase(),
        collectorNumber: additions[index]!.card.collector_number,
        finish: additions[index]!.finish,
        priceUsd: additions[index]!.priceUsd,
      } : null,
    })),
    beforeMetrics,
    afterMetrics,
    finalDecklist: renderDeck(nextParsed),
    printingPolicy: describePrintingPolicyV08(policy),
    guidance: 'Preservation-aware structural compression only converts excess lands into strict competitive-role cards, keeps total card count and Commander legality exact, preserves existing complete combos, and leaves ordinary refinement behavior unchanged.',
  };
}
