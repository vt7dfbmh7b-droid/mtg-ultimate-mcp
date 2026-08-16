import type { ScryfallCard } from '../types/scryfall.js';
import { validateCommanderDeck } from './commander-rules.js';
import { parseDecklist, resolveEntryCard, type DeckEntry, type ParsedDeck } from './deck.js';
import {
  describePrintingPolicyV08,
  printingMatchesPolicyV08,
  resolvePrintingPolicyV08,
  selectEligiblePrintingV08,
  type ResolvedPrintingPolicyV08,
} from './printing-policy-v08.js';
import { getCardsByIdentifiers, searchCards, type CardIdentifierInput } from './scryfall.js';
import { findDeckCombos } from './spellbook.js';

export interface CedhManaBaseOptionsV14 {
  printingFamily?: string;
  allowedSets?: string[];
  includePromos?: boolean;
  includeSpecialReleases?: boolean;
  maxUsdPerCard?: number;
  maxSwaps?: number;
  protectedLands?: string[];
  minImprovement?: number;
}

interface ExactLandCandidateV14 {
  card: ScryfallCard;
  finish: 'nonfoil' | 'foil' | 'etched' | null;
  priceUsd: number | null;
  score: number;
  reasons: string[];
}

interface ExistingLandV14 {
  entry: DeckEntry;
  card: ScryfallCard;
  score: number;
  reasons: string[];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function finishMarker(finish: DeckEntry['finish'] | ExactLandCandidateV14['finish']): string {
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
  const commanderNames = new Set(parsed.commanders.map((entry) => normalize(entry.name)));
  return [...new Set(cards
    .filter((card) => commanderNames.has(normalize(card.name)))
    .flatMap((card) => card.color_identity))].sort();
}

function isLand(card: ScryfallCard): boolean {
  return card.type_line.toLocaleLowerCase().includes('land');
}

function isBasic(card: ScryfallCard): boolean {
  return card.type_line.toLocaleLowerCase().includes('basic land');
}

function legalIdentity(card: ScryfallCard, identity: string[]): boolean {
  const allowed = new Set(identity);
  return card.legalities.commander === 'legal' && card.color_identity.every((color) => allowed.has(color));
}

function oracle(card: ScryfallCard): string {
  return (card.oracle_text ?? '').toLocaleLowerCase();
}

function colorCoverage(card: ScryfallCard, identity: string[]): number {
  const produced = new Set((card.produced_mana ?? []).map((value) => value.toUpperCase()));
  return identity.filter((color) => produced.has(color)).length;
}

function unconditionallyTapped(card: ScryfallCard): boolean {
  const value = oracle(card);
  if (!/enters (?:the battlefield )?tapped/.test(value)) return false;
  return !/enters (?:the battlefield )?tapped (?:unless|if)/.test(value);
}

function conditionallyTapped(card: ScryfallCard): boolean {
  return /enters (?:the battlefield )?tapped (?:unless|if)/.test(oracle(card));
}

function scoreLand(card: ScryfallCard, identity: string[]): { score: number; reasons: string[] } {
  const colors = colorCoverage(card, identity);
  const value = oracle(card);
  const reasons: string[] = [];
  let score = colors * 20;

  if (identity.length >= 4 && colors >= Math.min(5, identity.length)) {
    score += 50;
    reasons.push('five-color coverage');
  } else if (colors >= 2) {
    reasons.push(`${colors}-color coverage`);
  }
  if (/add one mana of any color|add one mana of any type/.test(value)) {
    score += 35;
    reasons.push('any-color fixing');
  }
  if (/pay 1 life/.test(value)) {
    score += 8;
    reasons.push('efficient pain-style fixing');
  }
  if (/search your library/.test(value)) {
    score += 18;
    reasons.push('fetch/search utility');
  }
  if (unconditionallyTapped(card)) {
    score -= 70;
    reasons.push('unconditionally enters tapped');
  } else if (conditionallyTapped(card)) {
    score -= 18;
    reasons.push('conditionally enters tapped');
  } else {
    score += 20;
    reasons.push('normally untapped');
  }
  if (card.edhrec_rank !== undefined) score += Math.max(0, 14 - Math.log10(card.edhrec_rank + 1) * 3);
  return { score, reasons };
}

function existingNonbasicLands(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  identity: string[],
  protectedNames: Set<string>,
): ExistingLandV14[] {
  const rows: ExistingLandV14[] = [];
  for (const entry of parsed.main) {
    const card = resolveEntryCard(entry, cards);
    if (!card || !isLand(card) || isBasic(card) || entry.quantity !== 1 || protectedNames.has(normalize(card.name))) continue;
    const quality = scoreLand(card, identity);
    rows.push({ entry, card, score: quality.score, reasons: quality.reasons });
  }
  return rows.sort((a, b) => a.score - b.score || a.card.name.localeCompare(b.card.name));
}

async function betterLandCandidates(
  parsed: ParsedDeck,
  identity: string[],
  policy: ResolvedPrintingPolicyV08,
  options: CedhManaBaseOptionsV14,
): Promise<ExactLandCandidateV14[]> {
  const existing = new Set([...parsed.commanders, ...parsed.main].map((entry) => normalize(entry.name)));
  const query = [
    'f:commander',
    't:land',
    '-t:basic',
    identity.length > 0 ? `id<=${identity.join('').toLocaleLowerCase()}` : 'id:c',
    policy.searchClause,
  ].filter(Boolean).join(' ');

  let results: ScryfallCard[] = [];
  try {
    results = await searchCards(query, 100);
  } catch {
    return [];
  }

  const ranked = results
    .filter((card) => isLand(card) && !isBasic(card) && legalIdentity(card, identity) && !existing.has(normalize(card.name)))
    .map((card) => ({ card, quality: scoreLand(card, identity) }))
    .sort((a, b) => b.quality.score - a.quality.score || a.card.name.localeCompare(b.card.name));

  const output: ExactLandCandidateV14[] = [];
  for (const item of ranked) {
    if (output.length >= 20) break;
    const printing = await selectEligiblePrintingV08(item.card, policy, options.maxUsdPerCard);
    if (!printing) continue;
    const exact = scoreLand(printing.card, identity);
    output.push({
      card: printing.card,
      finish: printing.finish,
      priceUsd: printing.priceUsd,
      score: exact.score,
      reasons: exact.reasons,
    });
  }
  return output;
}

function applySwaps(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  swaps: Array<{ out: ExistingLandV14; in: ExactLandCandidateV14 }>,
): { parsed: ParsedDeck; cards: ScryfallCard[] } | null {
  const main = parsed.main.map((entry) => ({ ...entry }));
  const nextCards = [...cards];

  for (const swap of swaps) {
    const entryIndex = main.findIndex((entry) => normalize(entry.name) === normalize(swap.out.entry.name) && entry.quantity === 1);
    const cardIndex = nextCards.findIndex((card) => normalize(card.name) === normalize(swap.out.card.name));
    if (entryIndex < 0 || cardIndex < 0) return null;
    main[entryIndex] = {
      name: swap.in.card.name,
      quantity: 1,
      set: swap.in.card.set.toUpperCase(),
      collectorNumber: swap.in.card.collector_number,
      ...(swap.in.finish ? { finish: swap.in.finish } : {}),
    };
    nextCards.splice(cardIndex, 1, swap.in.card);
  }

  const totalMain = main.reduce((sum, entry) => sum + entry.quantity, 0);
  return {
    parsed: {
      main,
      commanders: parsed.commanders.map((entry) => ({ ...entry })),
      totalMain,
      totalCommanders: parsed.totalCommanders,
      totalCards: totalMain + parsed.totalCommanders,
    },
    cards: nextCards,
  };
}

function comboCount(value: Record<string, unknown>): number {
  return Number(record(value.counts).included ?? 0);
}

function landCount(parsed: ParsedDeck, cards: ScryfallCard[]): number {
  let total = 0;
  for (const entry of parsed.main) {
    const card = resolveEntryCard(entry, cards);
    if (card && isLand(card)) total += entry.quantity;
  }
  return total;
}

export async function optimizeCedhManaBaseV14(
  decklist: string,
  options: CedhManaBaseOptionsV14 = {},
): Promise<Record<string, unknown>> {
  const maxSwaps = Math.max(1, Math.min(8, Math.trunc(options.maxSwaps ?? 5)));
  const minImprovement = options.minImprovement ?? 18;
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

  const identity = commanderIdentity(resolved.parsed, resolved.cards);
  const protectedNames = new Set((options.protectedLands ?? []).map(normalize));
  const cuts = existingNonbasicLands(resolved.parsed, resolved.cards, identity, protectedNames);
  const candidates = await betterLandCandidates(resolved.parsed, identity, policy, options);
  const beforeLandCount = landCount(resolved.parsed, resolved.cards);
  const selected: Array<{ out: ExistingLandV14; in: ExactLandCandidateV14; improvement: number }> = [];
  const usedCandidateNames = new Set<string>();

  for (const cut of cuts) {
    if (selected.length >= maxSwaps) break;
    const candidate = candidates.find((item) => {
      if (usedCandidateNames.has(normalize(item.card.name))) return false;
      return item.score - cut.score >= minImprovement;
    });
    if (!candidate) continue;
    selected.push({ out: cut, in: candidate, improvement: Number((candidate.score - cut.score).toFixed(2)) });
    usedCandidateNames.add(normalize(candidate.card.name));
  }

  if (selected.length === 0) {
    return {
      status: 'no-supported-mana-base-improvement',
      finalDecklist: renderDeck(resolved.parsed),
      landCount: beforeLandCount,
      candidateCount: candidates.length,
      printingPolicy: describePrintingPolicyV08(policy),
    };
  }

  const applied = applySwaps(resolved.parsed, resolved.cards, selected);
  if (!applied) return { status: 'package-application-failed', finalDecklist: renderDeck(resolved.parsed) };
  const nextRules = validateCommanderDeck(applied.parsed, applied.cards);
  const afterLandCount = landCount(applied.parsed, applied.cards);
  if (
    !nextRules.isLegal
    || applied.parsed.totalCards !== 100
    || afterLandCount !== beforeLandCount
    || applied.cards.some((card) => !printingMatchesPolicyV08(card, policy))
  ) {
    return {
      status: 'candidate-mana-base-failed-validation',
      finalDecklist: renderDeck(resolved.parsed),
      beforeLandCount,
      afterLandCount,
      commanderRules: nextRules,
    };
  }

  const beforeDecklist = renderDeck(resolved.parsed);
  const afterDecklist = renderDeck(applied.parsed);
  const [beforeCombos, afterCombos] = await Promise.all([
    findDeckCombos(beforeDecklist, 100),
    findDeckCombos(afterDecklist, 100),
  ]);
  if (comboCount(afterCombos) < comboCount(beforeCombos)) {
    return {
      status: 'rejected-combo-regression',
      finalDecklist: beforeDecklist,
      beforeComboCount: comboCount(beforeCombos),
      afterComboCount: comboCount(afterCombos),
    };
  }

  return {
    status: 'cedh-mana-base-refined',
    swaps: selected.map((swap) => ({
      out: swap.out.card.name,
      in: swap.in.card.name,
      improvementScore: swap.improvement,
      outLandScore: Number(swap.out.score.toFixed(2)),
      inLandScore: Number(swap.in.score.toFixed(2)),
      outReasons: swap.out.reasons,
      inReasons: swap.in.reasons,
      printing: {
        set: swap.in.card.set.toUpperCase(),
        collectorNumber: swap.in.card.collector_number,
        finish: swap.in.finish,
        priceUsd: swap.in.priceUsd,
      },
    })),
    beforeLandCount,
    afterLandCount,
    beforeComboCount: comboCount(beforeCombos),
    afterComboCount: comboCount(afterCombos),
    finalDecklist: afterDecklist,
    finalCommanderRules: nextRules,
    printingPolicy: describePrintingPolicyV08(policy),
    guidance: 'This lane is strictly nonbasic-land-for-nonbasic-land. It rewards color coverage and normally untapped access, heavily penalizes unconditional tapped lands, preserves total land count, and cannot remove a previously verified combo.',
  };
}
