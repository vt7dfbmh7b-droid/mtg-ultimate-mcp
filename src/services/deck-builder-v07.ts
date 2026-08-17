import type { ScryfallCard } from '../types/scryfall.js';
import { validateCommanderDeck } from './commander-rules.js';
import { buildDeckMetrics, parseDecklist, type DeckEntry, type ParsedDeck } from './deck.js';
import {
  describePrintingPolicyV08,
  printingMatchesPolicyV08,
  resolvePrintingPolicyV08,
  selectEligiblePrintingV08,
  type ResolvedPrintingPolicyV08,
} from './printing-policy-v08.js';
import { getCardsByIdentifiers, getCardsByNames, inferCardRoles, searchCards, summarizeCard } from './scryfall.js';
import { simulateDeckGameplayV06 } from './simulation-v06.js';
import { suggestDeckUpgrades, type UpgradeOptions } from './upgrade.js';

export interface DeckBuildOptionsV07 {
  targetBracket?: number;
  themeQuery?: string;
  /** User-visible hard cap. Applies to commanders, must-includes, and optional candidates. */
  maxUsdPerCard?: number;
  /**
   * Internal/search-only cap for optional candidates and lands. When omitted, maxUsdPerCard
   * remains the candidate cap. This must never relax maxUsdPerCard and deliberately does not
   * reject a fixed commander/must-include merely because a whole-deck search heuristic tightens.
   */
  candidateMaxUsdPerCard?: number;
  allowedSets?: string[];
  printingFamily?: string;
  includePromos?: boolean;
  includeSpecialReleases?: boolean;
  excludedCards?: string[];
  mustInclude?: string[];
  landCount?: number;
  maxNonbasicLands?: number;
}

export interface UpgradePlanOptionsV07 extends UpgradeOptions {
  maxSwaps?: number;
  protectedCards?: string[];
  simulationIterations?: number;
  simulationTurns?: number;
  seed?: number;
}

interface RoleTargetsV07 {
  ramp: number;
  draw: number;
  interaction: number;
  protection: number;
  tutors: number;
  recursion: number;
  boardWipes: number;
  early: number;
}

const ROLE_TARGETS: Record<number, RoleTargetsV07> = {
  1: { ramp: 7, draw: 7, interaction: 6, protection: 2, tutors: 0, recursion: 2, boardWipes: 1, early: 8 },
  2: { ramp: 9, draw: 9, interaction: 8, protection: 3, tutors: 1, recursion: 2, boardWipes: 2, early: 10 },
  3: { ramp: 10, draw: 10, interaction: 10, protection: 4, tutors: 3, recursion: 3, boardWipes: 2, early: 13 },
  4: { ramp: 12, draw: 12, interaction: 14, protection: 6, tutors: 6, recursion: 3, boardWipes: 2, early: 16 },
  5: { ramp: 14, draw: 14, interaction: 18, protection: 8, tutors: 10, recursion: 4, boardWipes: 2, early: 20 },
};

const BASIC_FOR_COLOR: Record<string, string> = {
  W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest',
};

function clampBracket(value: number | undefined): number {
  return Math.max(1, Math.min(5, Math.trunc(value ?? 4)));
}

function targetLands(bracket: number, explicit: number | undefined): number {
  if (explicit !== undefined) return Math.max(26, Math.min(44, Math.trunc(explicit)));
  return ({ 1: 39, 2: 38, 3: 36, 4: 34, 5: 31 } as Record<number, number>)[bracket] ?? 35;
}

function identity(commanders: ScryfallCard[]): string[] {
  return [...new Set(commanders.flatMap((card) => card.color_identity))].sort();
}

function identityQuery(colors: string[]): string {
  return colors.length === 0 ? 'id:c' : `id<=${colors.join('').toLowerCase()}`;
}

function legalIdentity(card: ScryfallCard, colors: string[]): boolean {
  const allowed = new Set(colors);
  return card.legalities.commander === 'legal' && card.color_identity.every((color) => allowed.has(color));
}

function roleSet(card: ScryfallCard): Set<string> {
  return new Set(inferCardRoles(card));
}

function roleContribution(card: ScryfallCard): Partial<Record<keyof RoleTargetsV07, number>> {
  const roles = roleSet(card);
  const output: Partial<Record<keyof RoleTargetsV07, number>> = {};
  if (roles.has('mana acceleration') || roles.has('land ramp') || roles.has('cost reduction') || roles.has('fast mana')) output.ramp = 1;
  if (roles.has('card draw') || roles.has('repeatable draw') || roles.has('card selection')) output.draw = 1;
  if (roles.has('spot interaction') || roles.has('countermagic') || roles.has('board wipe') || roles.has('free interaction')) output.interaction = 1;
  if (roles.has('protection') || roles.has('board protection')) output.protection = 1;
  if (roles.has('tutor')) output.tutors = 1;
  if (roles.has('graveyard recursion')) output.recursion = 1;
  if (roles.has('board wipe')) output.boardWipes = 1;
  if (!card.type_line.toLowerCase().includes('land') && card.cmc <= 2) output.early = 1;
  return output;
}

function roleQuery(role: keyof RoleTargetsV07): string {
  const map: Record<keyof RoleTargetsV07, string> = {
    ramp: '(o:"add" OR o:"search your library for" OR o:"costs" OR o:"Treasure")',
    draw: '(o:"draw" OR o:"scry" OR o:"surveil" OR o:"look at the top")',
    interaction: '(o:"counter target" OR o:"destroy target" OR o:"exile target" OR o:"return target")',
    protection: '(o:"hexproof" OR o:"indestructible" OR o:"protection from" OR o:"phase out")',
    tutors: 'o:"search your library for"',
    recursion: '(o:"from your graveyard" OR o:"return" o:"graveyard")',
    boardWipes: '((o:"destroy all" OR o:"exile all" OR o:"each creature") (t:instant OR t:sorcery))',
    early: 'mv<=2',
  };
  return map[role];
}

function staticCandidateScore(card: ScryfallCard): number {
  const roles = inferCardRoles(card);
  let score = Math.max(0, 10 - card.cmc) * 1.5;
  if (roles.includes('fast mana')) score += 8;
  if (roles.includes('free interaction')) score += 8;
  if (roles.includes('protection')) score += 3;
  if (card.edhrec_rank !== undefined) score += Math.max(0, 18 - Math.log10(card.edhrec_rank + 1) * 4);
  return score;
}

function dynamicCandidateScore(card: ScryfallCard, counts: RoleTargetsV07, targets: RoleTargetsV07): number {
  const contribution = roleContribution(card);
  let score = staticCandidateScore(card);
  for (const key of Object.keys(targets) as Array<keyof RoleTargetsV07>) {
    if (!contribution[key]) continue;
    const deficit = Math.max(0, targets[key] - counts[key]);
    score += Math.min(8, deficit) * 7;
  }
  return score;
}

function incrementCounts(counts: RoleTargetsV07, card: ScryfallCard): void {
  const contribution = roleContribution(card);
  for (const key of Object.keys(counts) as Array<keyof RoleTargetsV07>) {
    counts[key] += contribution[key] ?? 0;
  }
}

function emptyCounts(): RoleTargetsV07 {
  return { ramp: 0, draw: 0, interaction: 0, protection: 0, tutors: 0, recursion: 0, boardWipes: 0, early: 0 };
}

function selectedPrice(card: ScryfallCard): number | null {
  const values = [card.prices?.usd, card.prices?.usd_foil, card.prices?.usd_etched]
    .map((value) => value ? Number.parseFloat(value) : Number.NaN)
    .filter(Number.isFinite);
  return values.length > 0 ? Math.min(...values) : null;
}

function printingLine(quantity: number, card: ScryfallCard): string {
  return `${quantity} ${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`;
}

function hasPrintingRestriction(policy: ResolvedPrintingPolicyV08): boolean {
  return Boolean(policy.family) || policy.allowedSetCodes.length > 0 || policy.exactSpecialPrintings.length > 0;
}

export function candidatePriceCapV07(options: DeckBuildOptionsV07): number | undefined {
  const userCap = options.maxUsdPerCard;
  const searchCap = options.candidateMaxUsdPerCard;
  if (searchCap === undefined) return userCap;
  if (!Number.isFinite(searchCap) || searchCap <= 0) throw new Error('candidateMaxUsdPerCard must be positive and finite when supplied.');
  return userCap === undefined ? searchCap : Math.min(userCap, searchCap);
}

async function eligibleCardPrinting(
  card: ScryfallCard,
  policy: ResolvedPrintingPolicyV08,
  maxUsdPerCard: number | undefined,
  cache: Map<string, ScryfallCard | null>,
): Promise<ScryfallCard | null> {
  const cacheKey = `${card.name.toLocaleLowerCase()}|${maxUsdPerCard ?? 'any'}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;

  if (printingMatchesPolicyV08(card, policy)) {
    const price = selectedPrice(card);
    if (maxUsdPerCard === undefined || (price !== null && price <= maxUsdPerCard)) {
      cache.set(cacheKey, card);
      return card;
    }
  }

  const choice = await selectEligiblePrintingV08(card, policy, maxUsdPerCard);
  const chosen = choice?.card ?? null;
  cache.set(cacheKey, chosen);
  return chosen;
}

async function searchPool(
  colors: string[],
  options: DeckBuildOptionsV07,
  policy: ResolvedPrintingPolicyV08,
  cache: Map<string, ScryfallCard | null>,
  role: keyof RoleTargetsV07 | 'theme' | 'general' | 'land',
  limit = 50,
): Promise<ScryfallCard[]> {
  const clause = role === 'theme'
    ? options.themeQuery?.trim() ?? ''
    : role === 'general'
      ? '-t:land'
      : role === 'land'
        ? 't:land -t:basic'
        : roleQuery(role);
  const query = [
    'f:commander',
    identityQuery(colors),
    clause,
    policy.searchClause,
  ].filter(Boolean).join(' ');
  if (!query.trim()) return [];

  try {
    const results = await searchCards(query, limit);
    const eligible: ScryfallCard[] = [];
    const candidateCap = candidatePriceCapV07(options);
    for (const card of results) {
      const printing = await eligibleCardPrinting(card, policy, candidateCap, cache);
      if (printing) eligible.push(printing);
    }
    return eligible;
  } catch {
    return [];
  }
}

async function resolveMustIncludes(
  names: string[],
  colors: string[],
  policy: ResolvedPrintingPolicyV08,
  maxUsdPerCard: number | undefined,
  cache: Map<string, ScryfallCard | null>,
): Promise<ScryfallCard[]> {
  if (names.length === 0) return [];
  const { cards } = await getCardsByNames(names.slice(0, 30));
  const eligible: ScryfallCard[] = [];
  for (const card of cards.filter((candidate) => legalIdentity(candidate, colors))) {
    const printing = await eligibleCardPrinting(card, policy, maxUsdPerCard, cache);
    if (printing) eligible.push(printing);
  }
  return eligible;
}

function landScore(card: ScryfallCard, colors: string[]): number {
  const produced = new Set((card.produced_mana ?? []).map((color) => color.toUpperCase()));
  const coverage = colors.filter((color) => produced.has(color)).length;
  let score = coverage * 12;
  const text = card.oracle_text ?? '';
  if (/enters tapped/i.test(text)) score -= 3;
  if (/pay 1 life|pay 2 life/i.test(text)) score += 1;
  if (/search your library/i.test(text)) score += 4;
  if (card.edhrec_rank !== undefined) score += Math.max(0, 10 - Math.log10(card.edhrec_rank + 1) * 2);
  return score;
}

async function basicPrinting(
  name: string,
  options: DeckBuildOptionsV07,
  policy: ResolvedPrintingPolicyV08,
  cache: Map<string, ScryfallCard | null>,
): Promise<ScryfallCard | null> {
  const query = [`!"${name}"`, 't:basic', policy.searchClause].filter(Boolean).join(' ');
  try {
    const results = await searchCards(query, 10);
    const candidateCap = candidatePriceCapV07(options);
    for (const card of results) {
      const printing = await eligibleCardPrinting(card, policy, candidateCap, cache);
      if (printing) return printing;
    }
    return null;
  } catch {
    return null;
  }
}

export async function buildCommanderDeckDraftV07(
  commanders: ScryfallCard[],
  options: DeckBuildOptionsV07 = {},
): Promise<Record<string, unknown>> {
  if (commanders.length < 1 || commanders.length > 2) throw new Error('V0.7 deck building requires one or two resolved commanders.');

  const printingPolicy = await resolvePrintingPolicyV08({
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
  });
  const printingCache = new Map<string, ScryfallCard | null>();
  const eligibleCommanders: ScryfallCard[] = [];
  for (const commander of commanders) {
    const printing = await eligibleCardPrinting(commander, printingPolicy, options.maxUsdPerCard, printingCache);
    if (!printing) {
      throw new Error(`No eligible physical printing of commander ${commander.name} satisfies the active printing-family/set/price policy.`);
    }
    eligibleCommanders.push(printing);
  }

  const colors = identity(eligibleCommanders);
  const bracket = clampBracket(options.targetBracket);
  const targets = ROLE_TARGETS[bracket] as RoleTargetsV07;
  const landsWanted = targetLands(bracket, options.landCount);
  const nonlandSlots = Math.max(1, 100 - eligibleCommanders.length - landsWanted);
  const excluded = new Set((options.excludedCards ?? []).map((name) => name.toLocaleLowerCase()));
  const commanderNames = new Set(eligibleCommanders.map((card) => card.name.toLocaleLowerCase()));
  const candidateMap = new Map<string, ScryfallCard>();

  const searchRoles: Array<keyof RoleTargetsV07 | 'theme' | 'general'> = [
    'ramp', 'draw', 'interaction', 'protection', 'tutors', 'recursion', 'boardWipes', 'early', 'theme', 'general',
  ];
  for (const role of searchRoles) {
    const results = await searchPool(colors, options, printingPolicy, printingCache, role, role === 'general' ? 50 : 35);
    for (const card of results) {
      const key = card.name.toLocaleLowerCase();
      if (commanderNames.has(key) || excluded.has(key) || card.type_line.toLowerCase().includes('land')) continue;
      if (!legalIdentity(card, colors)) continue;
      if (!candidateMap.has(key)) candidateMap.set(key, card);
    }
  }

  const mustInclude = await resolveMustIncludes(
    options.mustInclude ?? [],
    colors,
    printingPolicy,
    options.maxUsdPerCard,
    printingCache,
  );
  for (const card of mustInclude) {
    const key = card.name.toLocaleLowerCase();
    if (!commanderNames.has(key) && !excluded.has(key) && !card.type_line.toLowerCase().includes('land')) candidateMap.set(key, card);
  }

  const selected: ScryfallCard[] = [];
  const selectedNames = new Set<string>();
  const counts = emptyCounts();
  for (const card of mustInclude) {
    if (selected.length >= nonlandSlots) break;
    const key = card.name.toLocaleLowerCase();
    if (selectedNames.has(key) || commanderNames.has(key) || excluded.has(key)) continue;
    selected.push(card);
    selectedNames.add(key);
    incrementCounts(counts, card);
  }

  const remaining = [...candidateMap.values()].filter((card) => !selectedNames.has(card.name.toLocaleLowerCase()));
  while (selected.length < nonlandSlots && remaining.length > 0) {
    remaining.sort((a, b) => dynamicCandidateScore(b, counts, targets) - dynamicCandidateScore(a, counts, targets) || a.name.localeCompare(b.name));
    const best = remaining.shift();
    if (!best) break;
    selected.push(best);
    selectedNames.add(best.name.toLocaleLowerCase());
    incrementCounts(counts, best);
  }

  const nonbasicLimit = Math.max(0, Math.min(landsWanted, Math.trunc(options.maxNonbasicLands ?? Math.min(16, Math.max(8, colors.length * 4)))));
  const landPool = (await searchPool(colors, options, printingPolicy, printingCache, 'land', 50))
    .filter((card) => legalIdentity(card, colors))
    .filter((card) => !excluded.has(card.name.toLocaleLowerCase()))
    .sort((a, b) => landScore(b, colors) - landScore(a, colors));
  const nonbasics: ScryfallCard[] = [];
  const landNames = new Set<string>();
  for (const land of landPool) {
    if (nonbasics.length >= nonbasicLimit) break;
    const key = land.name.toLocaleLowerCase();
    if (landNames.has(key)) continue;
    landNames.add(key);
    nonbasics.push(land);
  }

  const basicsNeeded = Math.max(0, landsWanted - nonbasics.length);
  const basicNames: string[] = colors.length > 0
    ? colors.map((color) => BASIC_FOR_COLOR[color]).filter((name): name is string => Boolean(name))
    : ['Wastes'];
  const basicCards: ScryfallCard[] = [];
  for (const name of basicNames) {
    const printing = await basicPrinting(name, options, printingPolicy, printingCache);
    if (printing) basicCards.push(printing);
  }
  const basicQuantities = new Map<string, number>();
  for (let index = 0; index < basicsNeeded && basicCards.length > 0; index += 1) {
    const card = basicCards[index % basicCards.length] as ScryfallCard;
    basicQuantities.set(card.name, (basicQuantities.get(card.name) ?? 0) + 1);
  }

  const commanderLines = eligibleCommanders.map((card) => printingLine(1, card));
  const mainLines = [
    ...selected.map((card) => printingLine(1, card)),
    ...nonbasics.map((card) => printingLine(1, card)),
    ...basicCards.filter((card) => (basicQuantities.get(card.name) ?? 0) > 0).map((card) => printingLine(basicQuantities.get(card.name) ?? 0, card)),
  ];
  const decklist = ['// COMMANDER', ...commanderLines, '', '// MAIN', ...mainLines].join('\n');
  const parsed = parseDecklist(decklist);
  const allCards = [...eligibleCommanders, ...selected, ...nonbasics, ...basicCards];
  const commanderRules = validateCommanderDeck(parsed, allCards);
  const roleDeficits = Object.fromEntries(
    (Object.keys(targets) as Array<keyof RoleTargetsV07>).map((key) => [key, Math.max(0, targets[key] - counts[key])]),
  );
  const selectedPricedCards = [...eligibleCommanders, ...selected, ...nonbasics];
  const estimatedUsd = selectedPricedCards.reduce((sum, card) => sum + (selectedPrice(card) ?? 0), 0)
    + basicCards.reduce((sum, card) => sum + (selectedPrice(card) ?? 0) * (basicQuantities.get(card.name) ?? 0), 0);
  const printingPolicySatisfied = allCards.every((card) => printingMatchesPolicyV08(card, printingPolicy));
  const hasEnoughCards = parsed.totalCards === 100;

  return {
    status: commanderRules.isLegal && hasEnoughCards && printingPolicySatisfied ? 'complete-draft' : 'incomplete-draft',
    targetBracket: bracket,
    commanders: eligibleCommanders.map(summarizeCard),
    commanderColorIdentity: colors,
    themeQuery: options.themeQuery ?? null,
    decklist,
    cardCount: parsed.totalCards,
    commanderRules,
    printingPolicySatisfied,
    printingPolicy: describePrintingPolicyV08(printingPolicy),
    roleTargets: targets,
    detectedRoleCounts: counts,
    remainingRoleDeficits: roleDeficits,
    landPlan: {
      targetLands: landsWanted,
      selectedNonbasicLands: nonbasics.length,
      selectedBasics: [...basicQuantities.entries()].map(([name, quantity]) => ({ name, quantity })),
    },
    exactPrintingPolicy:
      'Every selected line carries an exact Scryfall set code and collector number. Oracle identity drives rules; the selected physical printing must independently satisfy the active family/set/promo policy. User maxUsdPerCard applies to all required and optional cards; candidateMaxUsdPerCard, when supplied, only tightens optional candidate search.',
    selectedPrintingEstimatedUsd: Number(estimatedUsd.toFixed(2)),
    constraints: {
      maxUsdPerCard: options.maxUsdPerCard ?? null,
      candidateMaxUsdPerCard: options.candidateMaxUsdPerCard ?? null,
      allowedSets: options.allowedSets ?? [],
      printingFamily: options.printingFamily ?? null,
      excludedCards: [...excluded],
      mustInclude: options.mustInclude ?? [],
    },
  };
}

export async function analyzeDeckBuildV07(
  decklist: string,
  options: Pick<DeckBuildOptionsV07, 'targetBracket' | 'themeQuery'> = {},
): Promise<Record<string, unknown>> {
  const parsed = parseDecklist(decklist);
  const ids = [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
  const { cards, notFound } = await getCardsByIdentifiers(ids);
  if (notFound.length > 0) {
    return { status: 'unresolved-cards', unresolved: notFound };
  }
  const metrics = buildDeckMetrics(parsed, cards);
  const commanderRules = validateCommanderDeck(parsed, cards);
  return {
    status: commanderRules.isLegal ? 'ok' : 'illegal',
    targetBracket: clampBracket(options.targetBracket),
    themeQuery: options.themeQuery ?? null,
    commanderRules,
    metrics,
  };
}

export async function planDeckUpgradeV07(
  decklist: string,
  options: UpgradePlanOptionsV07 = {},
): Promise<Record<string, unknown>> {
  const initial = await analyzeDeckBuildV07(decklist);
  if (initial.status === 'unresolved-cards') return initial;
  const parsed = parseDecklist(decklist);
  const ids = [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
  const resolved = await getCardsByIdentifiers(ids);
  if (resolved.notFound.length > 0) return { status: 'unresolved-cards', unresolved: resolved.notFound };

  const upgrades = await suggestDeckUpgrades(decklist, options);
  const swaps = Array.isArray(upgrades.suggestedSwaps) ? upgrades.suggestedSwaps : [];
  const maxSwaps = Math.max(0, Math.min(20, Math.trunc(options.maxSwaps ?? 10)));
  const protectedSet = new Set((options.protectedCards ?? []).map((name) => name.toLocaleLowerCase()));
  const chosen = swaps.filter((swap) => !protectedSet.has(swap.remove.toLocaleLowerCase())).slice(0, maxSwaps);
  const recommendations = chosen.map((swap) => ({ remove: swap.remove, add: swap.add, reasons: swap.reasons }));
  const simulations = options.simulationIterations && options.simulationIterations > 0
    ? await simulateDeckGameplayV06(decklist, {
      iterations: options.simulationIterations,
      maxTurns: options.simulationTurns,
      seed: options.seed,
    })
    : null;

  return {
    status: 'ok',
    initial,
    recommendations,
    simulationBaseline: simulations,
  };
}
