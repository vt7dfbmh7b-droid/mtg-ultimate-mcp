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

function identityLegal(card: ScryfallCard, identity: string[]): boolean {
  const allowed = new Set(identity);
  return card.legalities.commander === 'legal' && card.color_identity.every((color) => allowed.has(color));
}

function oracle(card: ScryfallCard): string {
  return (card.oracle_text ?? '').toLocaleLowerCase();
}

function producedColors(card: ScryfallCard, identity: string[]): number {
  const produced = new Set((card.produced_mana ?? []).map((value) => value.toUpperCase()));
  return identity.filter((color) => produced.has(color)).length;
}

function unconditionalTapped(card: ScryfallCard): boolean {
  const value = oracle(card);
  return /(?:this land|~|[a-z' -]+) enters (?:the battlefield )?tapped\./.test(value)
    || /^.*enters tapped\./m.test(value);
}

function conditionalTapped(card: ScryfallCard): boolean {
  const value = oracle(card);
  return /enters (?:the battlefield )?tapped unless|enters tapped unless|enters tapped if/.test(value);
}

function landQuality(card: ScryfallCard, identity: string[]): { score: number; reasons: string[] } {
  const colors = producedColors(card, identity);
  const value = oracle(card);
  const reasons: string[] = [];
  let score = colors * 20;

  if (colors >= Math.min(5, identity.length) && identity.length >= 4) {
    score += 45;
    reasons.push('five-color coverage');
  } else if (colors >= 2) {
    reasons.push(`${colors}-color coverage`);
  }

  if (/add one mana of any color|add one mana of any type/.test(value)) {
    score += 38;
    reasons.push('any-color mana');
  }
  if (/pay 1 life/.test(value)) {
    score += 8;
    reasons.push('untapped pain-land style fixing');
  }
  if (/search your library/.test(value)) {
    score += 18;
    reasons.push('land-search/fetch utility');
  }
  if (/add \{c\}/.test(value) && colors === 0) score -= 8;
  if (unconditionalTapped(card)) {
    score -= 65;
    reasons.push('unconditionally enters tapped');
  } else if (conditionalTapped(card)) {
    score -= 16;
    reasons.push('conditionally enters tapped');
  } else {
    score += 18;
    reasons.push('normally untapped');
  }
  if (isBasic(card)) score += 3;
  if (card.edhrec_rank !== undefined) score += Math.max(0, 14 - Math.log10(card.edhrec_rank + 1) * 3);
  return { score, reasons };
}

function currentLandRows(parsed: ParsedDeck, cards: ScryfallCard[], identity: string[], protectedNames: Set<string>) {
  return parsed.main
    .map((entry) => ({ entry, card: resolveEntryCard(entry, cards) }))
    .filter((item): item is { entry: DeckEntry; card: ScryfallCard } => Boolean(item.card) && isLand(item.card))
    .map(({ entry, card }) => ({
      entry,
      card,
      quality: landQuality(card, identity),
      protected: protectedNames.has(normalize(card.name)),
    }));
}

async function candidateLands(
  parsed: ParsedDeck,
  identity: string[],
  policy: ResolvedPrintingPolicyV08,
  options: CedhManaBaseOptionsV14,
): Promise<ExactLandCandidateV14[]> {
  const existing = new Set([...parsed.commanders, ...parsed.main].map((entry) => normalize(entry.name)));
  const query = ['f:commander', 't:land', '-t:basic', identity.length ? `id<=${identity.join('').toLocaleLowerCase()}` : 'id:c', policy.searchClause]
    .filter(Boolean)
    .join(' ');
  let results: ScryfallCard[] = [];
  try {
    results = await searchCards(query, 80);
  } catch {
    return [];
  }

  const ranked = results
    .filter((card) => isLand(card) && identityLegal(card, identity) && !existing.has(normalize(card.name)))
    .map((card) => ({ card, quality: landQuality(card, identity) }))
    .filter(({ quality }) => quality.score > 20)
    .sort((a, b) => b.quality.score - a.quality.score || a.card.name.localeCompare(b.card.name));

  const output: ExactLandCandidateV14[] = [];
  for (const item of ranked) {
    if (output.length >= 16) break;
    const printing = await selectEligiblePrintingV08(item.card, policy, options.maxUsdPerCard);
    if (!printing) continue;
    const exactQuality = landQuality(printing.card, identity);
    output.push({
      card: printing.card,
      finish: printing.finish,
      priceUsd: printing.priceUsd,
      score: exactQuality.score,
      reasons: exactQuality.reasons,
    });
  }
  return output;
}

function applyLandSwaps(
  parsed: ParsedDeck,
  swaps: Array<{ out: DeckEntry; in: ExactLandCandidateV14 }>,
): ParsedDeck | null {
  if (swaps.length === 0) return null;
  const main = parsed.main.map((entry) => ({ ...entry }));
  for (const swap of swaps) {
    const index = main.findIndex((entry) => normalize(entry.name) === normalize(swap.out.name) && entry.quantity === swap.out.quantity);
    if (index < 0) return null;
    if (swap.out.quantity > 1) {
      main[index] = { ...swap.out, quantity: swap.out.quantity - 1 };
      main.push({
        name: swap.in.card.name,
        quantity: 1,
        set: swap.in.card.set.toUpperCase(),
        collectorNumber: swap.in.card.collector_number,
        ...(swap.in.finish ? { finish: swap.in.finish } : {}),
      });
    } else {
      main[index] = {
        name: swap.in.card.name,
        quantity: 1,
        set: swap.in.card.set.toUpperCase(),
        collectorNumber: swap.in.card.collector_number,
        ...(swap.in.finish ? { finish: swap.in.finish } : {}),
      };
    }
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

function applyResolvedLandSwaps(
  cards: ScryfallCard[],
  swaps: Array<{ out: DeckEntry; in: ExactLandCandidateV14 }>,
): ScryfallCard[] | null {
  const next = [...cards];
  for (const swap of swaps) {
    const index = next.findIndex((card) => normalize(card.name) === normalize(swap.out.name));
    if (index < 0) return null;
    next.splice(index, 1);
    next.push(swap.in.card);
  }
  return next;
}

function comboCount(combos: Record<string, unknown>): number {
  return Number(record(combos.counts).included ?? 0);
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
  const current = currentLandRows(resolved.parsed, resolved.cards, identity, protectedNames);
  const beforeLandCount = current.reduce((sum, row) => sum + row.entry.quantity, 0);
  const candidates = await candidateLands(resolved.parsed, identity, policy, options);
  const cutUnits: Array<{ entry: DeckEntry; score: number; reasons: string[] }> = [];
  for (const row of current) {
    if (row.protected) continue;
    const copies = isBasic(row.card) ? Math.min(row.entry.quantity, 2) : row.entry.quantity;
    for (let index = 0; index < copies; index += 1) {
      cutUnits.push({ entry: { ...row.entry, quantity: 1 }, score: row.quality.score, reasons: row.quality.reasons });
    }
  }
  cutUnits.sort((a, b) => a.score - b.score || a.entry.name.localeCompare(b.entry.name));

  const swaps: Array<{ out: DeckEntry; in: ExactLandCandidateV14; improvement: number; outScore: number; outReasons: string[] }> = [];
  const usedCandidates = new Set<string>();
  const usedOutNames = new Map<string, number>();
  for (const cut of cutUnits) {
    if (swaps.length >= maxSwaps) break;
    const candidate = candidates.find((item) => !usedCandidates.has(normalize(item.card.name)) && item.score - cut.score >= minImprovement);
    if (!candidate) continue;
    const original = resolved.parsed.main.find((entry) => normalize(entry.name) === normalize(cut.entry.name));
    if (!original) continue;
    const used = usedOutNames.get(normalize(original.name)) ?? 0;
    if (used >= original.quantity) continue;
    swaps.push({
      out: { ...original },
      in: candidate,
      improvement: Number((candidate.score - cut.score).toFixed(2)),
      outScore: cut.score,
      outReasons: cut.reasons,
    });
    usedCandidates.add(normalize(candidate.card.name));
    usedOutNames.set(normalize(original.name), used + 1);
  }

  if (swaps.length === 0) {
    return {
      status: 'no-supported-mana-base-improvement',
      finalDecklist: renderDeck(resolved.parsed),
      landCount: beforeLandCount,
      candidateCount: candidates.length,
      printingPolicy: describePrintingPolicyV08(policy),
    };
  }

  // Apply one copy at a time so basics with quantity >1 remain accurate.
  let nextParsed = resolved.parsed;
  let nextCards = resolved.cards;
  const applied: typeof swaps = [];
  for (const swap of swaps) {
    const currentEntry = nextParsed.main.find((entry) => normalize(entry.name) === normalize(swap.out.name));
    if (!currentEntry) continue;
    const oneSwap = [{ out: { ...currentEntry }, in: swap.in }];
    const parsedAfter = applyLandSwaps(nextParsed, oneSwap);
    const cardsAfter = applyResolvedLandSwaps(nextCards, oneSwap);
    if (!parsedAfter || !cardsAfter) continue;
    nextParsed = parsedAfter;
    nextCards = cardsAfter;
    applied.push(swap);
  }

  const nextRules = validateCommanderDeck(nextParsed, nextCards);
  const afterLandCount = nextParsed.main
    .map((entry) => ({ entry, card: resolveEntryCard(entry, nextCards) }))
    .filter((item) => item.card && isLand(item.card))
    .reduce((sum, item) => sum + item.entry.quantity, 0);
  if (!nextRules.isLegal || nextParsed.totalCards !== 100 || afterLandCount !== beforeLandCount || nextCards.some((card) => !printingMatchesPolicyV08(card, policy))) {
    return {
      status: 'candidate-mana-base-failed-validation',
      finalDecklist: renderDeck(resolved.parsed),
      beforeLandCount,
      afterLandCount,
      commanderRules: nextRules,
    };
  }

  const [beforeCombos, afterCombos] = await Promise.all([
    findDeckCombos(renderDeck(resolved.parsed), 100),
    findDeckCombos(renderDeck(nextParsed), 100),
  ]);
  if (comboCount(afterCombos) < comboCount(beforeCombos)) {
    return {
      status: 'rejected-combo-regression',
      finalDecklist: renderDeck(resolved.parsed),
      beforeComboCount: comboCount(beforeCombos),
      afterComboCount: comboCount(afterCombos),
    };
  }

  return {
    status: 'cedh-mana-base-refined',
    swaps: applied.map((swap) => ({
      out: swap.out.name,
      in: swap.in.card.name,
      improvementScore: swap.improvement,
      outLandScore: Number(swap.outScore.toFixed(2)),
      inLandScore: Number(swap.in.score.toFixed(2)),
      outReasons: swap.outReasons,
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
    finalDecklist: renderDeck(nextParsed),
    finalCommanderRules: nextRules,
    printingPolicy: describePrintingPolicyV08(policy),
    guidance: 'This lane is land-for-land only. It prioritizes color coverage and normally untapped access, penalizes unconditional tapped lands, preserves total land count, and may not destroy a previously verified combo.',
  };
}
