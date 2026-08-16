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
import {
  getCardsByIdentifiers,
  inferCardRoles,
  lookupCard,
  type CardIdentifierInput,
} from './scryfall.js';
import { estimateCommanderBracket, findDeckCombos } from './spellbook.js';

export interface CedhComboCompletionOptionsV14 {
  printingFamily?: string;
  allowedSets?: string[];
  includePromos?: boolean;
  includeSpecialReleases?: boolean;
  maxUsdPerCard?: number;
  protectedCards?: string[];
  maxMissingCards?: number;
  maxCandidatesToVerify?: number;
}

interface ExactComboAdditionV14 {
  name: string;
  card: ScryfallCard;
  finish: 'nonfoil' | 'foil' | 'etched' | null;
  priceUsd: number | null;
}

interface ComboPlanV14 {
  comboId: unknown;
  bracketTag: string | null;
  comboCardNames: string[];
  missingNames: string[];
  results: string[];
  description: string;
  commanderCentric: boolean;
  desirability: number;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function finishMarker(finish: DeckEntry['finish'] | ExactComboAdditionV14['finish']): string {
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

function deckCounts(parsed: ParsedDeck): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of [...parsed.commanders, ...parsed.main]) {
    counts.set(normalize(entry.name), (counts.get(normalize(entry.name)) ?? 0) + entry.quantity);
  }
  return counts;
}

function tagValue(tag: string | null): number {
  if (tag === 'R') return 100;
  if (tag === 'S') return 55;
  if (tag === 'P') return 35;
  return 0;
}

function competitiveResultBonus(results: string[]): number {
  const text = results.join(' ').toLocaleLowerCase();
  let bonus = 0;
  if (/infinite combat/.test(text)) bonus += 70;
  if (/infinite damage|each opponent loses|win the game|infinite mill/.test(text)) bonus += 60;
  if (/infinite mana|infinite treasure/.test(text)) bonus += 45;
  if (/infinite tokens|infinite etb/.test(text)) bonus += 20;
  return bonus;
}

function planNearCombos(parsed: ParsedDeck, comboData: Record<string, unknown>, maxMissingCards: number): ComboPlanV14[] {
  const near = Array.isArray(comboData.almostIncluded) ? comboData.almostIncluded.map(record) : [];
  const counts = deckCounts(parsed);
  const commanderNames = new Set(parsed.commanders.map((entry) => normalize(entry.name)));
  const seenMissing = new Set<string>();
  const plans: ComboPlanV14[] = [];

  for (const variant of near) {
    const requirements = Array.isArray(variant.requirements) ? variant.requirements : [];
    if (requirements.length > 0) continue;
    const uses = Array.isArray(variant.cards) ? variant.cards.map(record) : [];
    const comboCardNames: string[] = [];
    const missing: string[] = [];

    for (const use of uses) {
      const name = typeof use.name === 'string' ? use.name.trim() : '';
      if (!name || name === 'Unknown card') continue;
      comboCardNames.push(name);
      const requiredQuantity = typeof use.quantity === 'number' ? Math.max(1, Math.trunc(use.quantity)) : 1;
      const owned = counts.get(normalize(name)) ?? 0;
      for (let index = owned; index < requiredQuantity; index += 1) missing.push(name);
    }

    const missingNames = [...new Set(missing)];
    if (missingNames.length < 1 || missingNames.length > maxMissingCards) continue;
    const missingKey = missingNames.map(normalize).sort().join('|');
    if (seenMissing.has(missingKey)) continue;
    seenMissing.add(missingKey);

    const bracketTag = typeof variant.bracketTag === 'string' ? variant.bracketTag : null;
    const results = Array.isArray(variant.results) ? variant.results.map(String) : [];
    const commanderCentric = comboCardNames.some((name) => commanderNames.has(normalize(name)));
    let desirability = missingNames.length === 1 ? 80 : 45;
    if (commanderCentric) desirability += 120;
    desirability += tagValue(bracketTag);
    desirability += competitiveResultBonus(results);

    plans.push({
      comboId: variant.id,
      bracketTag,
      comboCardNames,
      missingNames,
      results,
      description: typeof variant.description === 'string' ? variant.description : '',
      commanderCentric,
      desirability,
    });
  }

  return plans.sort((a, b) => b.desirability - a.desirability || a.missingNames.length - b.missingNames.length);
}

async function eligibleAddition(
  name: string,
  identity: string[],
  policy: ResolvedPrintingPolicyV08,
  maxUsdPerCard: number | undefined,
): Promise<ExactComboAdditionV14 | null> {
  let oracle: ScryfallCard;
  try {
    oracle = await lookupCard(name, true);
  } catch {
    return null;
  }
  if (oracle.legalities.commander !== 'legal') return null;
  if (oracle.color_identity.some((color) => !identity.includes(color))) return null;
  const printing = await selectEligiblePrintingV08(oracle, policy, maxUsdPerCard);
  if (!printing) return null;
  return {
    name: oracle.name,
    card: printing.card,
    finish: printing.finish,
    priceUsd: printing.priceUsd,
  };
}

function slowCardPressure(card: ScryfallCard, protectedNames: Set<string>): number {
  if (card.type_line.toLocaleLowerCase().includes('land') || protectedNames.has(normalize(card.name))) return -999;
  const roles = new Set(inferCardRoles(card));
  let pressure = Math.max(0, card.cmc - 2) * 14;
  if (card.cmc >= 5) pressure += 20;
  if (roles.has('board wipe')) pressure += 10;
  if ((roles.has('land ramp') || roles.has('mana acceleration')) && card.cmc >= 3) pressure += 18;
  if (roles.has('fast mana')) pressure -= 90;
  if (roles.has('free interaction')) pressure -= 85;
  if (roles.has('tutor')) pressure -= 60;
  if (roles.has('countermagic') && card.cmc <= 2) pressure -= 45;
  if (roles.has('spot interaction') && card.cmc <= 2) pressure -= 40;
  if (roles.has('protection') && card.cmc <= 2) pressure -= 30;
  if (roles.has('repeatable draw') && card.cmc <= 3) pressure -= 35;
  return pressure;
}

function chooseCuts(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  count: number,
  protectedNames: Set<string>,
): string[] {
  const ranked = parsed.main
    .map((entry) => ({ entry, card: resolveEntryCard(entry, cards) }))
    .filter((item): item is { entry: DeckEntry; card: ScryfallCard } => Boolean(item.card))
    .filter(({ entry }) => entry.quantity === 1)
    .map(({ card }) => ({ name: card.name, pressure: slowCardPressure(card, protectedNames) }))
    .filter((entry) => entry.pressure > -500)
    .sort((a, b) => b.pressure - a.pressure || a.name.localeCompare(b.name));
  return [...new Set(ranked.map((entry) => entry.name))].slice(0, count);
}

function applyPackage(parsed: ParsedDeck, cuts: string[], additions: ExactComboAdditionV14[]): ParsedDeck | null {
  if (cuts.length !== additions.length || additions.length === 0) return null;
  const cutNames = new Set(cuts.map(normalize));
  const main: DeckEntry[] = [];
  let removed = 0;
  for (const entry of parsed.main) {
    if (entry.quantity === 1 && cutNames.has(normalize(entry.name))) {
      removed += 1;
      continue;
    }
    main.push({ ...entry });
  }
  if (removed !== additions.length) return null;
  for (const addition of additions) {
    main.push({
      name: addition.name,
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

function applyResolvedCards(cards: ScryfallCard[], cuts: string[], additions: ExactComboAdditionV14[]): ScryfallCard[] | null {
  const next = [...cards];
  for (const cut of cuts) {
    const index = next.findIndex((card) => normalize(card.name) === normalize(cut));
    if (index < 0) return null;
    next.splice(index, 1);
  }
  next.push(...additions.map((addition) => addition.card));
  return next;
}

export async function completeBestCedhComboV14(
  decklist: string,
  options: CedhComboCompletionOptionsV14 = {},
): Promise<Record<string, unknown>> {
  const maxMissingCards = Math.max(1, Math.min(3, Math.trunc(options.maxMissingCards ?? 2)));
  const maxCandidatesToVerify = Math.max(1, Math.min(12, Math.trunc(options.maxCandidatesToVerify ?? 6)));
  const policy = await resolvePrintingPolicyV08({
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
  });
  const resolved = await resolveDeck(decklist);
  const startingRules = validateCommanderDeck(resolved.parsed, resolved.cards);
  if (resolved.notFound.length > 0 || resolved.parsed.totalCards !== 100 || !startingRules.isLegal) {
    return { status: 'invalid-starting-deck', unresolvedCards: resolved.notFound, commanderRules: startingRules };
  }
  if (resolved.cards.some((card) => !printingMatchesPolicyV08(card, policy))) {
    return { status: 'starting-deck-violates-printing-policy', printingPolicy: describePrintingPolicyV08(policy) };
  }

  const commanderNames = new Set(resolved.parsed.commanders.map((entry) => normalize(entry.name)));
  const identity = [...new Set(resolved.cards
    .filter((card) => commanderNames.has(normalize(card.name)))
    .flatMap((card) => card.color_identity))].sort();
  const beforeCombos = await findDeckCombos(renderDeck(resolved.parsed), 100);
  const beforeCount = Number(record(beforeCombos.counts).included ?? 0);
  const plans = planNearCombos(resolved.parsed, beforeCombos, maxMissingCards);
  const audit: Array<Record<string, unknown>> = [];
  let verified = 0;

  for (const plan of plans) {
    if (verified >= maxCandidatesToVerify) break;
    const additions: ExactComboAdditionV14[] = [];
    const unavailable: string[] = [];
    for (const name of plan.missingNames) {
      const addition = await eligibleAddition(name, identity, policy, options.maxUsdPerCard);
      if (!addition) unavailable.push(name);
      else additions.push(addition);
    }
    if (unavailable.length > 0) {
      audit.push({
        comboId: plan.comboId,
        missingNames: plan.missingNames,
        commanderCentric: plan.commanderCentric,
        bracketTag: plan.bracketTag,
        status: 'missing-card-has-no-eligible-printing-or-is-illegal',
        unavailable,
      });
      continue;
    }

    verified += 1;
    const protectedNames = new Set((options.protectedCards ?? []).map(normalize));
    for (const name of plan.comboCardNames) protectedNames.add(normalize(name));
    for (const commander of resolved.parsed.commanders) protectedNames.add(normalize(commander.name));
    const cuts = chooseCuts(resolved.parsed, resolved.cards, additions.length, protectedNames);
    if (cuts.length !== additions.length) continue;
    const nextParsed = applyPackage(resolved.parsed, cuts, additions);
    const nextCards = applyResolvedCards(resolved.cards, cuts, additions);
    if (!nextParsed || !nextCards || nextParsed.totalCards !== 100) continue;
    const rules = validateCommanderDeck(nextParsed, nextCards);
    if (!rules.isLegal || nextCards.some((card) => !printingMatchesPolicyV08(card, policy))) continue;

    const candidateDecklist = renderDeck(nextParsed);
    const afterCombos = await findDeckCombos(candidateDecklist, 100);
    const afterCount = Number(record(afterCombos.counts).included ?? 0);
    audit.push({
      comboId: plan.comboId,
      missingNames: plan.missingNames,
      commanderCentric: plan.commanderCentric,
      bracketTag: plan.bracketTag,
      status: afterCount > beforeCount ? 'verified-combo-gain' : 'did-not-produce-new-complete-combo',
      beforeIncludedCombos: beforeCount,
      afterIncludedCombos: afterCount,
    });
    if (afterCount <= beforeCount) continue;

    const bracket = await estimateCommanderBracket(candidateDecklist);
    return {
      status: 'combo-completed',
      beforeIncludedCombos: beforeCount,
      afterIncludedCombos: afterCount,
      completedPlan: {
        comboId: plan.comboId,
        bracketTag: plan.bracketTag,
        commanderCentric: plan.commanderCentric,
        comboCardNames: plan.comboCardNames,
        results: plan.results,
        description: plan.description,
      },
      swaps: additions.map((addition, index) => ({
        out: cuts[index] ?? null,
        in: addition.name,
        printing: {
          set: addition.card.set.toUpperCase(),
          collectorNumber: addition.card.collector_number,
          finish: addition.finish,
          priceUsd: addition.priceUsd,
        },
      })),
      finalDecklist: candidateDecklist,
      finalCommanderRules: rules,
      bracketEvidence: bracket,
      printingPolicy: describePrintingPolicyV08(policy),
      audit,
      guidance: 'This gate only accepts a combo package when Commander Spellbook confirms the rebuilt deck gained at least one complete combo while retaining Commander legality and the exact physical-printing policy.',
    };
  }

  return {
    status: 'no-verifiable-eligible-combo-completion',
    beforeIncludedCombos: beforeCount,
    nearComboCount: plans.length,
    printingPolicy: describePrintingPolicyV08(policy),
    audit,
    finalDecklist: renderDeck(resolved.parsed),
    guidance: 'No checked near-combo could be completed with legal, policy-compliant physical printings and independently verified as a new complete Commander Spellbook combo.',
  };
}
