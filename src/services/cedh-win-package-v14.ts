import type { ScryfallCard } from '../types/scryfall.js';
import { effectiveCardRolesV15 } from './card-role-truth-v15.js';
import { validateCommanderDeck } from './commander-rules.js';
import { parseDecklist, resolveEntryCard, type DeckEntry, type ParsedDeck } from './deck.js';
import {
  describePrintingPolicyV08,
  printingMatchesPolicyV08,
  resolvePrintingPolicyV08,
  selectEligiblePrintingV08,
} from './printing-policy-v08.js';
import {
  getCardsByIdentifiers,
  getCardsByNames,
  type CardIdentifierInput,
} from './scryfall.js';
import { estimateCommanderBracket, findDeckCombos } from './spellbook.js';

export interface CedhWinPackageOptionsV14 {
  printingFamily?: string;
  allowedSets?: string[];
  includePromos?: boolean;
  includeSpecialReleases?: boolean;
  maxUsdPerCard?: number;
  protectedCards?: string[];
  maxMissingCards?: number;
  maxCandidatesToVerify?: number;
}

interface ExactAdditionV14 {
  name: string;
  card: ScryfallCard;
  finish: 'nonfoil' | 'foil' | 'etched' | null;
  priceUsd: number | null;
}

interface WinPlanV14 {
  id: string;
  bracketTag: string | null;
  cardNames: string[];
  missingNames: string[];
  results: string[];
  description: string;
  commanderCentric: boolean;
  independentFromExistingWins: boolean;
  score: number;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function finishMarker(finish: DeckEntry['finish'] | ExactAdditionV14['finish']): string {
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

function deckCounts(parsed: ParsedDeck): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of [...parsed.commanders, ...parsed.main]) {
    counts.set(normalize(entry.name), (counts.get(normalize(entry.name)) ?? 0) + entry.quantity);
  }
  return counts;
}

function normalizedResultText(results: string[]): string {
  return results
    .join(' ')
    .toLocaleLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function hasDirectGameWin(text: string): boolean {
  return /\b(?:win|wins) the game\b/.test(text)
    || /\b(?:each|all) opponents? (?:lose|loses) the game\b/.test(text)
    || /\bopponents? (?:lose|loses) the game\b/.test(text);
}

function hasDeterministicDamageWin(text: string): boolean {
  return /\b(?:infinite|unbounded|arbitrarily (?:large|high)) (?:amounts? of )?damage\b/.test(text)
    || /\b(?:infinite|unbounded|arbitrarily (?:large|high)) (?:amounts? of )?(?:life ?loss|loss of life)\b/.test(text)
    || /\b(?:each|all) opponents? (?:lose|loses) (?:an? )?(?:infinite|unbounded|arbitrarily large) (?:amount of )?life\b/.test(text);
}

function hasDeterministicCombatWin(text: string): boolean {
  return /\b(?:infinite|unbounded|arbitrarily many) (?:combat(?: phases?| steps?)?|extra combats?)\b/.test(text);
}

function hasDeterministicMillWin(text: string): boolean {
  if (/\b(?:infinite|unbounded) mill(?:ing)?\b/.test(text)) return true;
  return /\bmill(?:s|ing)? (?:each|all) opponents?'?s? (?:entire )?(?:library|libraries)\b/.test(text)
    || /\bmill(?:s|ing)? (?:each|all) opponents?' (?:entire )?(?:library|libraries)\b/.test(text)
    || /\b(?:each|all) opponents? (?:mill|mills) (?:their|his or her) (?:entire )?(?:library|libraries)\b/.test(text);
}

export function isWinResultV14(results: string[]): boolean {
  const text = normalizedResultText(results);
  if (!text) return false;
  return hasDirectGameWin(text)
    || hasDeterministicDamageWin(text)
    || hasDeterministicCombatWin(text)
    || hasDeterministicMillWin(text);
}

function winResultScore(results: string[]): number {
  const text = normalizedResultText(results);
  let score = 0;
  if (hasDirectGameWin(text)) score += 180;
  if (hasDeterministicDamageWin(text)) score += 160;
  if (hasDeterministicCombatWin(text)) score += 150;
  if (hasDeterministicMillWin(text)) score += 130;
  return score;
}

function bracketScore(tag: string | null): number {
  if (tag === 'R') return 240;
  if (tag === 'S') return 70;
  if (tag === 'P') return 25;
  return 0;
}

function winningComboCardSets(
  comboData: Record<string, unknown>,
  commanderNames: Set<string>,
): Array<Set<string>> {
  const included = Array.isArray(comboData.included) ? comboData.included.map(record) : [];
  const sets: Array<Set<string>> = [];
  for (const variant of included) {
    const results = Array.isArray(variant.results) ? variant.results.map(String) : [];
    if (!isWinResultV14(results)) continue;
    const cards = Array.isArray(variant.cards) ? variant.cards.map(record) : [];
    const names = new Set(cards
      .filter((card) => card.mustBeCommander !== true)
      .map((card) => typeof card.name === 'string' ? normalize(card.name) : '')
      .filter((name) => Boolean(name) && !commanderNames.has(name)));
    if (names.size > 0) sets.push(names);
  }
  return sets;
}

export function winningPlanIsIndependentV14(
  comboData: Record<string, unknown>,
  planCardNames: string[],
  commanderCardNames: string[] = [],
): boolean {
  const commanders = new Set(commanderCardNames.map(normalize));
  const existingWinningSets = winningComboCardSets(comboData, commanders);
  if (existingWinningSets.length === 0) return false;
  const planSet = new Set(planCardNames.map(normalize).filter((name) => !commanders.has(name)));
  if (planSet.size === 0) return false;
  return existingWinningSets.every((existing) => ![...planSet].some((name) => existing.has(name)));
}

function planWinningNearCombos(parsed: ParsedDeck, comboData: Record<string, unknown>, maxMissingCards: number): WinPlanV14[] {
  const near = Array.isArray(comboData.almostIncluded) ? comboData.almostIncluded.map(record) : [];
  const counts = deckCounts(parsed);
  const commanders = new Set(parsed.commanders.map((entry) => normalize(entry.name)));
  const commanderNames = [...commanders];
  const existingWinningSets = winningComboCardSets(comboData, commanders);
  const hasExistingWinningCore = existingWinningSets.length > 0;
  const seen = new Set<string>();
  const plans: WinPlanV14[] = [];

  for (const variant of near) {
    const requirements = Array.isArray(variant.requirements) ? variant.requirements : [];
    if (requirements.length > 0) continue;
    const results = Array.isArray(variant.results) ? variant.results.map(String) : [];
    if (!isWinResultV14(results)) continue;

    const uses = Array.isArray(variant.cards) ? variant.cards.map(record) : [];
    const cardNames: string[] = [];
    const missing: string[] = [];
    for (const use of uses) {
      const name = typeof use.name === 'string' ? use.name.trim() : '';
      if (!name || name === 'Unknown card') continue;
      cardNames.push(name);
      const required = typeof use.quantity === 'number' ? Math.max(1, Math.trunc(use.quantity)) : 1;
      const owned = counts.get(normalize(name)) ?? 0;
      for (let index = owned; index < required; index += 1) missing.push(name);
    }
    const missingNames = [...new Set(missing)];
    if (missingNames.length < 1 || missingNames.length > maxMissingCards) continue;
    const id = typeof variant.id === 'string' ? variant.id : String(variant.id ?? 'unknown');
    const dedupeKey = `${id}|${missingNames.map(normalize).sort().join('|')}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const tag = typeof variant.bracketTag === 'string' ? variant.bracketTag : null;
    const commanderCentric = cardNames.some((name) => commanders.has(normalize(name)));
    const independentFromExistingWins = winningPlanIsIndependentV14(comboData, cardNames, commanderNames);
    const independenceAdjustment = hasExistingWinningCore
      ? (independentFromExistingWins ? 420 : -120)
      : 0;
    const score = (missingNames.length === 1 ? 90 : 55)
      + bracketScore(tag)
      + winResultScore(results)
      + (commanderCentric ? 90 : 0)
      + independenceAdjustment;
    plans.push({
      id,
      bracketTag: tag,
      cardNames,
      missingNames,
      results,
      description: typeof variant.description === 'string' ? variant.description : '',
      commanderCentric,
      independentFromExistingWins,
      score,
    });
  }

  return plans.sort((a, b) => b.score - a.score || a.missingNames.length - b.missingNames.length);
}

function slowCardPressure(card: ScryfallCard, protectedNames: Set<string>): number {
  if (card.type_line.toLocaleLowerCase().includes('land') || protectedNames.has(normalize(card.name))) return -999;
  const roles = new Set(effectiveCardRolesV15(card));
  let pressure = Math.max(0, card.cmc - 2) * 15;
  if (card.cmc >= 5) pressure += 24;
  if (roles.has('board wipe')) pressure += 12;
  if ((roles.has('land ramp') || roles.has('mana acceleration')) && card.cmc >= 3) pressure += 18;
  if (roles.has('fast mana')) pressure -= 100;
  if (roles.has('free interaction')) pressure -= 95;
  if (roles.has('tutor')) pressure -= 60;
  if (roles.has('countermagic') && card.cmc <= 2) pressure -= 50;
  if (roles.has('spot interaction') && card.cmc <= 2) pressure -= 45;
  if (roles.has('protection') && card.cmc <= 2) pressure -= 35;
  if (roles.has('repeatable draw') && card.cmc <= 3) pressure -= 38;
  if (roles.has('creature sacrifice outlet')) pressure -= 35;
  return pressure;
}

function chooseCuts(parsed: ParsedDeck, cards: ScryfallCard[], count: number, protectedNames: Set<string>): string[] {
  return [...new Set(parsed.main
    .map((entry) => ({ entry, card: resolveEntryCard(entry, cards) }))
    .filter((item): item is { entry: DeckEntry; card: ScryfallCard } => Boolean(item.card) && item.entry.quantity === 1)
    .map(({ card }) => ({ name: card.name, pressure: slowCardPressure(card, protectedNames) }))
    .filter((item) => item.pressure > -500)
    .sort((a, b) => b.pressure - a.pressure || a.name.localeCompare(b.name))
    .map((item) => item.name))].slice(0, count);
}

function applyPackage(parsed: ParsedDeck, cuts: string[], additions: ExactAdditionV14[]): ParsedDeck | null {
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

function applyResolvedCards(cards: ScryfallCard[], cuts: string[], additions: ExactAdditionV14[]): ScryfallCard[] | null {
  const next = [...cards];
  for (const cut of cuts) {
    const index = next.findIndex((card) => normalize(card.name) === normalize(cut));
    if (index < 0) return null;
    next.splice(index, 1);
  }
  next.push(...additions.map((addition) => addition.card));
  return next;
}

function includedWinningComboIds(comboData: Record<string, unknown>): Set<string> {
  const included = Array.isArray(comboData.included) ? comboData.included.map(record) : [];
  return new Set(included
    .filter((variant) => Array.isArray(variant.results) && isWinResultV14((variant.results as unknown[]).map(String)))
    .map((variant) => String(variant.id ?? ''))
    .filter(Boolean));
}

export function countWinningCombosV14(comboData: Record<string, unknown>): number {
  return includedWinningComboIds(comboData).size;
}

export async function completeBestCedhWinPackageV14(
  decklist: string,
  options: CedhWinPackageOptionsV14 = {},
): Promise<Record<string, unknown>> {
  const maxMissingCards = Math.max(1, Math.min(3, Math.trunc(options.maxMissingCards ?? 2)));
  const maxCandidatesToVerify = Math.max(1, Math.min(12, Math.trunc(options.maxCandidatesToVerify ?? 8)));
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

  const commanderNames = new Set(resolved.parsed.commanders.map((entry) => normalize(entry.name)));
  const identity = [...new Set(resolved.cards
    .filter((card) => commanderNames.has(normalize(card.name)))
    .flatMap((card) => card.color_identity))].sort();
  const beforeCombos = await findDeckCombos(renderDeck(resolved.parsed), 100);
  const beforeWinningIds = includedWinningComboIds(beforeCombos);
  const plans = planWinningNearCombos(resolved.parsed, beforeCombos, maxMissingCards);

  const lookupNames = [...new Set(plans.slice(0, 24).flatMap((plan) => plan.missingNames))];
  const oracleLookup = lookupNames.length > 0 ? await getCardsByNames(lookupNames) : { cards: [], notFound: [] };
  const oracleByName = new Map(oracleLookup.cards.map((card) => [normalize(card.name), card]));
  const audit: Array<Record<string, unknown>> = [];
  let verified = 0;

  for (const plan of plans) {
    if (verified >= maxCandidatesToVerify) break;
    const additions: ExactAdditionV14[] = [];
    const unavailable: string[] = [];
    for (const name of plan.missingNames) {
      const oracleCard = oracleByName.get(normalize(name));
      if (!oracleCard || oracleCard.legalities.commander !== 'legal' || oracleCard.color_identity.some((color) => !identity.includes(color))) {
        unavailable.push(name);
        continue;
      }
      const printing = await selectEligiblePrintingV08(oracleCard, policy, options.maxUsdPerCard);
      if (!printing) {
        unavailable.push(name);
        continue;
      }
      additions.push({
        name: oracleCard.name,
        card: printing.card,
        finish: printing.finish,
        priceUsd: printing.priceUsd,
      });
    }
    if (unavailable.length > 0) {
      audit.push({
        comboId: plan.id,
        results: plan.results,
        missingNames: plan.missingNames,
        independentFromExistingWins: plan.independentFromExistingWins,
        status: 'missing-card-has-no-eligible-printing-or-is-illegal',
        unavailable,
      });
      continue;
    }

    verified += 1;
    const protectedNames = new Set((options.protectedCards ?? []).map(normalize));
    for (const name of plan.cardNames) protectedNames.add(normalize(name));
    for (const commander of resolved.parsed.commanders) protectedNames.add(normalize(commander.name));
    const cuts = chooseCuts(resolved.parsed, resolved.cards, additions.length, protectedNames);
    if (cuts.length !== additions.length) continue;
    const nextParsed = applyPackage(resolved.parsed, cuts, additions);
    const nextCards = applyResolvedCards(resolved.cards, cuts, additions);
    if (!nextParsed || !nextCards || nextParsed.totalCards !== 100) continue;
    const nextRules = validateCommanderDeck(nextParsed, nextCards);
    if (!nextRules.isLegal || nextCards.some((card) => !printingMatchesPolicyV08(card, policy))) continue;

    const candidateDecklist = renderDeck(nextParsed);
    const afterCombos = await findDeckCombos(candidateDecklist, 100);
    const afterWinningIds = includedWinningComboIds(afterCombos);
    const verifiedPlan = afterWinningIds.has(plan.id) && !beforeWinningIds.has(plan.id);
    audit.push({
      comboId: plan.id,
      results: plan.results,
      missingNames: plan.missingNames,
      independentFromExistingWins: plan.independentFromExistingWins,
      status: verifiedPlan ? 'verified-winning-combo-gain' : 'winning-combo-not-verified-after-rebuild',
      beforeWinningCombos: beforeWinningIds.size,
      afterWinningCombos: afterWinningIds.size,
    });
    if (!verifiedPlan) continue;

    const bracket = await estimateCommanderBracket(candidateDecklist);
    return {
      status: 'winning-combo-completed',
      beforeWinningCombos: beforeWinningIds.size,
      afterWinningCombos: afterWinningIds.size,
      completedPlan: {
        comboId: plan.id,
        bracketTag: plan.bracketTag,
        commanderCentric: plan.commanderCentric,
        independentFromExistingWins: plan.independentFromExistingWins,
        comboCardNames: plan.cardNames,
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
      finalCommanderRules: nextRules,
      bracketEvidence: bracket,
      printingPolicy: describePrintingPolicyV08(policy),
      audit,
      guidance: 'This cEDH gate verifies a deterministic Commander Spellbook win package after rebuilding. When the starting deck already has a winning core, independent packages that do not share a critical non-commander card with existing wins are prioritized over duplicate variants. If no independent eligible route can be completed, a redundant winning variant remains an allowed fallback. Lifegain-only, value-only, standalone infinite-mana, draw-your-library, and bounded life-loss or mill outputs do not satisfy this gate.',
    };
  }

  return {
    status: 'no-verifiable-eligible-winning-combo',
    beforeWinningCombos: beforeWinningIds.size,
    winningNearComboCount: plans.length,
    printingPolicy: describePrintingPolicyV08(policy),
    audit,
    finalDecklist: renderDeck(resolved.parsed),
    guidance: 'No checked deterministic winning near-combo could be completed with legal policy-compliant printings and independently verified after rebuilding the deck.',
  };
}
