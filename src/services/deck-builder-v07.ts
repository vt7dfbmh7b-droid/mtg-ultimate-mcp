import type { ScryfallCard } from '../types/scryfall.js';
import { validateCommanderDeck } from './commander-rules.js';
import {
  cardCommanderStrategyAffinityV15,
  deriveCommanderStrategyContextFromCommandersV15,
  SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15,
} from './commander-strategy-affinity-v15.js';
import { commanderTargetPressureV15, selectInjectableTargetAwareWinPackageV15 } from './commander-target-pressure-v15.js';
import { effectiveCardRolesV15 } from './card-role-truth-v15.js';
import { buildDeckMetrics, parseDecklist, type DeckEntry, type ParsedDeck } from './deck.js';
import { discoverGeneralWinPackagesV15 } from './general-win-package-v15.js';
import { discoverEligiblePoolV15 } from './neutral-deck-builder-v15.js';
import {
  describePrintingPolicyV08,
  printingMatchesPolicyV08,
  resolvePrintingPolicyV08,
  selectEligiblePrintingV08,
  type ResolvedPrintingPolicyV08,
} from './printing-policy-v08.js';
import { getCardsByIdentifiers, getCardsByNames, searchCards, summarizeCard } from './scryfall.js';
import { simulateDeckGameplayV06 } from './simulation-v06.js';
import {
  BRACKET_FOUR_AUTHORITATIVE_TARGETS_V15,
  BRACKET_FOUR_AVERAGE_NONLAND_MV_MAX_V15,
  BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15,
  BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15,
  minimumPersistentColoredManaSourcesV15,
  suggestDeckUpgrades,
  type UpgradeOptions,
  type UpgradeTargetGateV15,
} from './upgrade.js';

export interface DeckBuildOptionsV07 {
  targetBracket?: number;
  themeQuery?: string;
  /** Controlled minimum supplied by the V0.15 theme adapter; zero keeps legacy theme behavior. */
  themeMinimumMainMatches?: number;
  /** User-visible hard cap. Applies to commanders, must-includes, and optional candidates. */
  maxUsdPerCard?: number;
  /**
   * Search-only cap for optional candidates and lands. When omitted, maxUsdPerCard remains
   * the candidate cap. It may tighten but never loosen an explicit user maxUsdPerCard.
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
  winRouteVerificationStatus?: 'protected' | 'no-verified-route' | 'verification-unavailable';
  simulationIterations?: number;
  simulationTurns?: number;
  seed?: number;
}

interface RoleTargetsV07 {
  ramp: number;
  draw: number;
  interaction: number;
  freeInteraction: number;
  protection: number;
  tutors: number;
  recursion: number;
  boardWipes: number;
  early: number;
}

const ROLE_TARGETS: Record<number, RoleTargetsV07> = {
  1: { ramp: 7, draw: 7, interaction: 6, freeInteraction: 0, protection: 2, tutors: 0, recursion: 2, boardWipes: 1, early: 8 },
  2: { ramp: 9, draw: 9, interaction: 8, freeInteraction: 0, protection: 3, tutors: 1, recursion: 2, boardWipes: 2, early: 10 },
  3: { ramp: 10, draw: 10, interaction: 10, freeInteraction: 0, protection: 4, tutors: 3, recursion: 3, boardWipes: 2, early: 13 },
  4: { ramp: 12, draw: 12, interaction: 14, freeInteraction: 0, protection: 6, tutors: 6, recursion: 3, boardWipes: 2, early: 16 },
  5: { ramp: 14, draw: 14, interaction: 18, freeInteraction: 0, protection: 8, tutors: 10, recursion: 4, boardWipes: 2, early: 20 },
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
  return new Set(effectiveCardRolesV15(card));
}

function roleContribution(card: ScryfallCard): Partial<Record<keyof RoleTargetsV07, number>> {
  const roles = roleSet(card);
  const output: Partial<Record<keyof RoleTargetsV07, number>> = {};
  if (roles.has('mana acceleration') || roles.has('land ramp') || roles.has('cost reduction') || roles.has('fast mana')) output.ramp = 1;
  if (roles.has('card draw') || roles.has('repeatable draw') || roles.has('card selection')) output.draw = 1;
  if (roles.has('spot interaction') || roles.has('countermagic') || roles.has('board wipe') || roles.has('free interaction')) output.interaction = 1;
  if (roles.has('free interaction')) output.freeInteraction = 1;
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
    freeInteraction: '((mv=0 OR o:"rather than pay") (o:"counter target" OR o:"destroy target" OR o:"exile target"))',
    protection: '(o:"hexproof" OR o:"indestructible" OR o:"protection from" OR o:"phase out")',
    tutors: 'o:"search your library for"',
    recursion: '(o:"from your graveyard" OR o:"return" o:"graveyard")',
    boardWipes: '((o:"destroy all" OR o:"exile all" OR o:"each creature") (t:instant OR t:sorcery))',
    early: 'mv<=2',
  };
  return map[role];
}

function staticCandidateScore(card: ScryfallCard): number {
  const roles = effectiveCardRolesV15(card);
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
  return { ramp: 0, draw: 0, interaction: 0, freeInteraction: 0, protection: 0, tutors: 0, recursion: 0, boardWipes: 0, early: 0 };
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
  const candidateCap = options.candidateMaxUsdPerCard;
  if (candidateCap === undefined) return userCap;
  if (!Number.isFinite(candidateCap) || candidateCap <= 0) throw new Error('candidateMaxUsdPerCard must be positive and finite when supplied.');
  return userCap === undefined ? candidateCap : Math.min(userCap, candidateCap);
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
    const priceCap = candidatePriceCapV07(options);
    for (const card of results) {
      const printing = await eligibleCardPrinting(card, policy, priceCap, cache);
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
    const priceCap = candidatePriceCapV07(options);
    for (const card of results) {
      const printing = await eligibleCardPrinting(card, policy, priceCap, cache);
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

  const strategyContext = deriveCommanderStrategyContextFromCommandersV15(eligibleCommanders);
  const colors = identity(eligibleCommanders);
  const bracket = clampBracket(options.targetBracket);
  const targetPressure = commanderTargetPressureV15(bracket);
  const targets: RoleTargetsV07 = {
    ...(ROLE_TARGETS[bracket] as RoleTargetsV07),
    freeInteraction: targetPressure.minimumFreeInteraction,
  };
  const landsWanted = targetLands(bracket, options.landCount);
  const nonlandSlots = Math.max(1, 100 - eligibleCommanders.length - landsWanted);
  const excluded = new Set((options.excludedCards ?? []).map((name) => name.toLocaleLowerCase()));
  const commanderNames = new Set(eligibleCommanders.map((card) => card.name.toLocaleLowerCase()));
  const candidateMap = new Map<string, ScryfallCard>();
  const themeCandidateNames = new Set<string>();

  const restrictedPool = hasPrintingRestriction(printingPolicy)
    ? await discoverEligiblePoolV15(colors, printingPolicy, candidatePriceCapV07(options))
    : null;
  if (restrictedPool) {
    for (const card of restrictedPool) {
      const key = card.name.toLocaleLowerCase();
      if (commanderNames.has(key) || excluded.has(key) || card.type_line.toLowerCase().includes('land')) continue;
      if (!legalIdentity(card, colors)) continue;
      if (!candidateMap.has(key)) candidateMap.set(key, card);
    }
  }

  const searchRoles: Array<keyof RoleTargetsV07 | 'theme' | 'general'> = restrictedPool
    ? (options.themeQuery?.trim() ? ['theme'] : [])
    : ['ramp', 'draw', 'interaction', 'freeInteraction', 'protection', 'tutors', 'recursion', 'boardWipes', 'early', 'theme', 'general'];
  for (const role of searchRoles) {
    const results = await searchPool(colors, options, printingPolicy, printingCache, role, role === 'general' ? 50 : 35);
    for (const card of results) {
      const key = card.name.toLocaleLowerCase();
      if (commanderNames.has(key) || excluded.has(key) || card.type_line.toLowerCase().includes('land')) continue;
      if (!legalIdentity(card, colors)) continue;
      if (role === 'theme') themeCandidateNames.add(key);
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

  const themeMinimumMainMatches = options.themeQuery?.trim()
    ? Math.max(0, Math.min(nonlandSlots, Math.trunc(options.themeMinimumMainMatches ?? 0)))
    : 0;
  let selectedThemeMatches = selected.filter((card) => themeCandidateNames.has(card.name.toLocaleLowerCase())).length;
  const remaining = [...candidateMap.values()].filter((card) => !selectedNames.has(card.name.toLocaleLowerCase()));

  while (selected.length < nonlandSlots && selectedThemeMatches < themeMinimumMainMatches) {
    const themedRemaining = remaining.filter((card) => themeCandidateNames.has(card.name.toLocaleLowerCase()));
    if (themedRemaining.length === 0) break;
    themedRemaining.sort((a, b) => {
      const aScore = dynamicCandidateScore(a, counts, targets) + cardCommanderStrategyAffinityV15(a, strategyContext).score;
      const bScore = dynamicCandidateScore(b, counts, targets) + cardCommanderStrategyAffinityV15(b, strategyContext).score;
      return bScore - aScore || a.name.localeCompare(b.name);
    });
    const best = themedRemaining[0];
    if (!best) break;
    const index = remaining.findIndex((card) => card.name.toLocaleLowerCase() === best.name.toLocaleLowerCase());
    if (index >= 0) remaining.splice(index, 1);
    selected.push(best);
    selectedNames.add(best.name.toLocaleLowerCase());
    incrementCounts(counts, best);
    selectedThemeMatches += 1;
  }

  while (selected.length < nonlandSlots && remaining.length > 0) {
    remaining.sort((a, b) => {
      const aScore = dynamicCandidateScore(a, counts, targets) + cardCommanderStrategyAffinityV15(a, strategyContext).score;
      const bScore = dynamicCandidateScore(b, counts, targets) + cardCommanderStrategyAffinityV15(b, strategyContext).score;
      return bScore - aScore || a.name.localeCompare(b.name);
    });
    const best = remaining.shift();
    if (!best) break;
    selected.push(best);
    selectedNames.add(best.name.toLocaleLowerCase());
    incrementCounts(counts, best);
    if (themeCandidateNames.has(best.name.toLocaleLowerCase())) selectedThemeMatches += 1;
  }

  const themeSelectionSatisfied = themeMinimumMainMatches === 0 || selectedThemeMatches >= themeMinimumMainMatches;
  const nonbasicLimit = Math.max(0, Math.min(landsWanted, Math.trunc(options.maxNonbasicLands ?? Math.min(16, Math.max(8, colors.length * 4)))));
  const restrictedLandPool = restrictedPool
    ? restrictedPool.filter((card) => card.type_line.toLowerCase().includes('land'))
    : null;
  const landPool = (restrictedLandPool ?? await searchPool(colors, options, printingPolicy, printingCache, 'land', 50))
    .filter((card) => !card.type_line.toLowerCase().includes('basic land'))
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
    if (excluded.has(name.toLocaleLowerCase())) continue;
    const printing = restrictedPool
      ? restrictedPool.find((card) => card.name.toLocaleLowerCase() === name.toLocaleLowerCase() && card.type_line.toLowerCase().includes('basic land')) ?? null
      : await basicPrinting(name, options, printingPolicy, printingCache);
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
    status: commanderRules.isLegal && hasEnoughCards && printingPolicySatisfied && themeSelectionSatisfied ? 'complete-draft' : 'incomplete-draft',
    targetBracket: bracket,
    targetPressure,
    commanders: eligibleCommanders.map(summarizeCard),
    commanderColorIdentity: colors,
    themeQuery: options.themeQuery ?? null,
    themeSelection: {
      requestedMinimumMainMatches: themeMinimumMainMatches,
      selectedControlledThemeCandidates: selectedThemeMatches,
      satisfied: themeSelectionSatisfied,
    },
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
      candidateSource: restrictedPool ? 'exhaustive-bounded-eligible-pool' : 'role-search',
    },
    exactPrintingPolicy:
      'Every selected line carries an exact Scryfall set code and collector number. Oracle identity drives rules; the selected physical printing must independently satisfy the active family/set/promo policy. User maxUsdPerCard applies to required and optional cards; candidateMaxUsdPerCard, when supplied, only tightens optional candidate search.',
    selectedPrintingEstimatedUsd: Number(estimatedUsd.toFixed(2)),
    constraints: {
      maxUsdPerCard: options.maxUsdPerCard ?? null,
      candidateMaxUsdPerCard: options.candidateMaxUsdPerCard ?? null,
      allowedSets: options.allowedSets ?? [],
      printingFamily: options.printingFamily ?? null,
      includePromos: options.includePromos ?? true,
      includeSpecialReleases: options.includeSpecialReleases ?? true,
      excludedCards: options.excludedCards ?? [],
      mustInclude: options.mustInclude ?? [],
      themeMinimumMainMatches,
    },
    caveats: [
      'This is an evidence-oriented draft builder, not a claim that the first generated 100 cards are the globally optimal list.',
      'Role targets are consistency heuristics. Current official bracket classification should still be checked after construction because bracket rules are not just role counts.',
      themeMinimumMainMatches > 0
        ? `The V0.15 controlled theme adapter reserved at least ${themeMinimumMainMatches} nonland slots from the bounded theme candidate pool before the normal role/strategy ranking filled the remaining spell slots.`
        : 'No V0.15 controlled theme-density minimum was supplied to this legacy-targeted builder.',
      'The selected printing is explicit for pricing and shopping. When a printing-family restriction is active, an unrelated edition of the same Oracle card cannot substitute for a qualifying themed edition.',
      hasPrintingRestriction(printingPolicy)
        ? 'For bounded printing-family/set builds, the targeted builder reuses the existing V0.15 exhaustive eligible physical pool for both spells and mana-base cards before applying role/strategy or land scoring. This keeps curated exact special-release lands visible without allowing unrelated editions to leak into the deck.'
        : 'No themed printing-family restriction was requested.',
      'Promo status alone never qualifies a printing for a themed family; the promo must belong to a matching family set or an exact curated special-release selector.',
    ],
  };
}

function entryLine(entry: DeckEntry): string {
  const printing = entry.set && entry.collectorNumber ? ` (${entry.set.toUpperCase()}) ${entry.collectorNumber}` : '';
  const finish = entry.finish === 'foil' ? ' *F*' : entry.finish === 'etched' ? ' *E*' : entry.finish === 'nonfoil' ? ' *N*' : '';
  return `${entry.quantity} ${entry.name}${printing}${finish}`;
}

function candidateName(candidate: Record<string, unknown>): string | null {
  const card = candidate.card as Record<string, unknown> | undefined;
  return typeof card?.name === 'string' ? card.name : null;
}

function candidateLine(candidate: Record<string, unknown>): string | null {
  const name = candidateName(candidate);
  if (!name) return null;
  const printing = candidate.recommendedPrinting as Record<string, unknown> | undefined;
  const set = typeof printing?.set === 'string' ? printing.set : null;
  const collector = typeof printing?.collectorNumber === 'string' ? printing.collectorNumber : null;
  const finish = printing?.finish === 'foil' ? ' *F*' : printing?.finish === 'etched' ? ' *E*' : printing?.finish === 'nonfoil' ? ' *N*' : '';
  return set && collector ? `1 ${name} (${set}) ${collector}${finish}` : `1 ${name}`;
}

type UpgradeStructuralRoleV15 =
  | 'ramp'
  | 'draw'
  | 'interaction'
  | 'free-interaction'
  | 'protection'
  | 'tutor'
  | 'recursion'
  | 'board-wipe'
  | 'early';
type UpgradeTargetGateRoleV15 = UpgradeTargetGateV15;
type UpgradeAddressedRoleV15 = UpgradeStructuralRoleV15 | UpgradeTargetGateRoleV15 | 'win-package';

interface UpgradeAddSelectionV15 {
  candidate: Record<string, unknown>;
  role: UpgradeAddressedRoleV15;
}

interface UpgradeStructuralCountsV15 {
  ramp: number;
  draw: number;
  interaction: number;
  'free-interaction': number;
  protection: number;
  tutor: number;
  recursion: number;
  'board-wipe': number;
  early: number;
}

interface UpgradeStructuralTargetsV15 extends UpgradeStructuralCountsV15 {}

interface UpgradePairingV15 {
  add: Record<string, unknown>;
  cut: Record<string, unknown>;
  addressedRole: UpgradeAddressedRoleV15;
  structuralDeficitAfterSwap: number;
  strategyPreservation: UpgradeSwapStrategyPreservationV15;
  persistentColoredManaSourcesAfterSwap: number;
  persistentColoredManaSourceFloor: number;
  authoritativeTargetGate?: UpgradeTargetGateRoleV15;
  nonlandManaValueReduction?: number;
}

interface UpgradePairingOptionsV15 {
  rejectMeaningfulStrategyLoss?: boolean;
  maxPairs?: number;
}

interface UpgradeStrategyAffinityEvidenceV15 {
  score: number;
  protectionApplied: number;
  matchedStrategies: string[];
  scoreByStrategy: Map<string, number>;
  commanderScoreByStrategy: Map<string, number>;
}

export interface UpgradeSwapStrategyPreservationV15 {
  cutStrategyAffinityScore: number;
  addStrategyAffinityScore: number;
  cutStrategyProtectionApplied: number;
  cutMatchedStrategies: string[];
  addMatchedStrategies: string[];
  locallyUnreplacedStrategies: string[];
  cutRoles: string[];
  addRoles: string[];
  unreplacedRoles: string[];
  unreplacedStrategyComponentRoles: string[];
  meaningfulStrategyLoss: boolean;
  verdict: 'preserved' | 'meaningful-strategy-loss';
}

export interface UpgradeStrategyPreservationAuditV15 {
  status: 'preserved' | 'meaningful-strategy-loss';
  evidenceComplete: true;
  meaningfulLosses: Array<{
    strategy: string;
    commanderStrategyScore: number;
    cutAffinityScore: number;
    addAffinityScore: number;
    netAffinityLoss: number;
    strongestCutProtectionApplied: number;
  }>;
  strategyDeltas: Array<{
    strategy: string;
    cutAffinityScore: number;
    addAffinityScore: number;
    netAffinityDelta: number;
  }>;
  swapImpacts: UpgradeSwapStrategyPreservationV15[];
  acceptanceRule: string;
}

const UPGRADE_STRUCTURAL_ROLES_V15: UpgradeStructuralRoleV15[] = [
  'ramp', 'draw', 'interaction', 'free-interaction', 'protection', 'tutor', 'recursion', 'board-wipe', 'early',
];
const UPGRADE_CANDIDATE_ROLES_V15: UpgradeAddressedRoleV15[] = [
  'average-nonland-mv', ...UPGRADE_STRUCTURAL_ROLES_V15, 'win-package',
];
const MEANINGFUL_STRATEGY_AFFINITY_LOSS_V15 = 4;
const STRATEGY_COMPONENT_ROLES_V15: Record<string, ReadonlySet<string>> = {
  'combat-tokens': new Set(['go-wide payoff', 'typal board control payoff', 'repeatable token engine', 'death-trigger token engine', 'token multiplier', 'token-event life drain', 'team combat-damage draw engine', 'extra combat', 'untap engine', 'haste']),
  'equipment-voltron': new Set(['equipment', 'protection', 'board protection']),
  counters: new Set(['+1/+1 counters', 'proliferate']),
  'graveyard-reanimator': new Set(['graveyard recursion', 'high-capacity graveyard recursion']),
  'artifact-engine': new Set(['artifact sacrifice outlet', 'sacrifice outlet', 'artifact graveyard recursion', 'graveyard recursion']),
  aristocrats: new Set(['repeatable life drain', 'token-event life drain', 'death-trigger draw engine', 'death-trigger token engine', 'mass sacrifice conversion', 'forced sacrifice interaction', 'sacrifice outlet', 'creature sacrifice outlet']),
  'food-lifegain': new Set(['repeatable life gain engine', 'repeatable life drain', 'token-event life drain']),
  'spells-control': new Set(['countermagic', 'stax/control', 'copy effect']),
  'value-engine': new Set(['repeatable draw', 'board-scaling card draw']),
  'big-mana': new Set(['mana acceleration', 'cost reduction', 'untap engine']),
};

function recordNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function recordString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function summarizedCard(item: Record<string, unknown>): Record<string, unknown> {
  const card = item.card;
  return card && typeof card === 'object' && !Array.isArray(card) ? card as Record<string, unknown> : {};
}

function summarizedRoles(card: Record<string, unknown>): Set<string> {
  return new Set(Array.isArray(card.roles) ? card.roles.filter((role): role is string => typeof role === 'string') : []);
}

function summaryIsPersistentColoredManaSourceV15(card: Record<string, unknown>): boolean {
  return summarizedRoles(card).has('persistent colored mana source');
}

function summaryIsPremiumEarlyInfrastructureV15(card: Record<string, unknown>): boolean {
  const manaValue = recordNumber(card.manaValue);
  if (manaValue > 2) return false;
  const roles = summarizedRoles(card);
  return roles.has('fast mana')
    || roles.has('mana rock')
    || roles.has('mana dork')
    || roles.has('mana acceleration')
    || roles.has('conditional mana acceleration')
    || roles.has('persistent colored mana source');
}

function summaryIsBroadColorFixingManaSourceV15(card: Record<string, unknown>): boolean {
  const roles = summarizedRoles(card);
  return roles.has('persistent colored mana source') && roles.has('mana rock');
}

function recordObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function recordStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))]
      .sort((left, right) => left.localeCompare(right))
    : [];
}

function strategyAffinityEvidenceV15(item: Record<string, unknown>): UpgradeStrategyAffinityEvidenceV15 {
  const affinity = recordObject(item.strategyAffinity);
  const score = recordNumber(affinity.score);
  const protectionApplied = recordNumber(affinity.protectionApplied);
  const explicitMatches = Array.isArray(affinity.matches)
    ? affinity.matches.map(recordObject).map((match) => ({
        strategy: recordString(match.archetype),
        score: recordNumber(match.overlapScore),
        commanderScore: recordNumber(match.commanderScore),
      })).filter((match) => match.strategy.length > 0 && match.score > 0)
    : [];
  const matchedStrategies = recordStrings([
    ...recordStrings(affinity.matchedStrategies),
    ...explicitMatches.map((match) => match.strategy),
  ]);
  const scoreByStrategy = new Map<string, number>();
  const commanderScoreByStrategy = new Map<string, number>();
  for (const match of explicitMatches) {
    scoreByStrategy.set(match.strategy, (scoreByStrategy.get(match.strategy) ?? 0) + match.score);
    commanderScoreByStrategy.set(
      match.strategy,
      Math.max(commanderScoreByStrategy.get(match.strategy) ?? 0, match.commanderScore),
    );
  }
  if (scoreByStrategy.size === 0 && matchedStrategies.length > 0 && score > 0) {
    const fallback = score / matchedStrategies.length;
    for (const strategy of matchedStrategies) {
      scoreByStrategy.set(strategy, fallback);
      commanderScoreByStrategy.set(strategy, fallback);
    }
  }
  return { score, protectionApplied, matchedStrategies, scoreByStrategy, commanderScoreByStrategy };
}

function upgradeSwapStrategyPreservationV15(
  add: Record<string, unknown>,
  cut: Record<string, unknown>,
): UpgradeSwapStrategyPreservationV15 {
  const addAffinity = strategyAffinityEvidenceV15(add);
  const cutAffinity = strategyAffinityEvidenceV15(cut);
  const addStrategies = new Set(addAffinity.matchedStrategies);
  const cutRoles = [...summarizedRoles(summarizedCard(cut))].sort((left, right) => left.localeCompare(right));
  const addRoles = [...summarizedRoles(summarizedCard(add))].sort((left, right) => left.localeCompare(right));
  const addRoleSet = new Set(addRoles);
  const locallyUnreplacedStrategies = cutAffinity.matchedStrategies.filter((strategy) => !addStrategies.has(strategy));
  const affinityStrategyLoss = cutAffinity.protectionApplied >= 4
    && cutAffinity.matchedStrategies.some((strategy) => {
      const commanderScore = cutAffinity.commanderScoreByStrategy.get(strategy) ?? 0;
      const cutScore = cutAffinity.scoreByStrategy.get(strategy) ?? 0;
      const addScore = addAffinity.scoreByStrategy.get(strategy) ?? 0;
      return commanderScore >= SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15
        && cutScore - addScore >= MEANINGFUL_STRATEGY_AFFINITY_LOSS_V15;
    });
  const substantiveCutStrategies = cutAffinity.matchedStrategies.filter((strategy) => (
    (cutAffinity.commanderScoreByStrategy.get(strategy) ?? 0) >= SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15
  ));
  const strategyComponentRoles = new Set(substantiveCutStrategies.flatMap((strategy) => (
    [...(STRATEGY_COMPONENT_ROLES_V15[strategy] ?? [])]
  )));
  const unreplacedStrategyComponentRoles = cutRoles.filter((role) => (
    strategyComponentRoles.has(role) && !addRoleSet.has(role)
  ));
  const meaningfulStrategyLoss = affinityStrategyLoss
    || cutAffinity.protectionApplied >= 4 && unreplacedStrategyComponentRoles.length > 0;
  return {
    cutStrategyAffinityScore: Number(cutAffinity.score.toFixed(3)),
    addStrategyAffinityScore: Number(addAffinity.score.toFixed(3)),
    cutStrategyProtectionApplied: Number(cutAffinity.protectionApplied.toFixed(3)),
    cutMatchedStrategies: cutAffinity.matchedStrategies,
    addMatchedStrategies: addAffinity.matchedStrategies,
    locallyUnreplacedStrategies,
    cutRoles,
    addRoles,
    unreplacedRoles: cutRoles.filter((role) => !addRoleSet.has(role)),
    unreplacedStrategyComponentRoles,
    meaningfulStrategyLoss,
    verdict: meaningfulStrategyLoss ? 'meaningful-strategy-loss' : 'preserved',
  };
}

function upgradeSwapSubstantiveStrategyLossScoreV15(
  add: Record<string, unknown>,
  cut: Record<string, unknown>,
): number {
  const addAffinity = strategyAffinityEvidenceV15(add);
  const cutAffinity = strategyAffinityEvidenceV15(cut);
  let loss = 0;
  for (const [strategy, cutScore] of cutAffinity.scoreByStrategy) {
    if ((cutAffinity.commanderScoreByStrategy.get(strategy) ?? 0) < SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15) continue;
    loss += Math.max(0, cutScore - (addAffinity.scoreByStrategy.get(strategy) ?? 0));
  }
  return loss;
}

export function auditUpgradeStrategyPreservationV15(
  pairings: ReadonlyArray<Pick<UpgradePairingV15, 'add' | 'cut'>>,
): UpgradeStrategyPreservationAuditV15 {
  const cutScores = new Map<string, number>();
  const addScores = new Map<string, number>();
  const strongestCutProtection = new Map<string, number>();
  const strongestCommanderScore = new Map<string, number>();
  const swapImpacts = pairings.map((pair) => upgradeSwapStrategyPreservationV15(pair.add, pair.cut));

  for (const pair of pairings) {
    const cut = strategyAffinityEvidenceV15(pair.cut);
    const add = strategyAffinityEvidenceV15(pair.add);
    for (const [strategy, strategyScore] of cut.scoreByStrategy) {
      cutScores.set(strategy, (cutScores.get(strategy) ?? 0) + strategyScore);
      strongestCutProtection.set(strategy, Math.max(strongestCutProtection.get(strategy) ?? 0, cut.protectionApplied));
      strongestCommanderScore.set(
        strategy,
        Math.max(strongestCommanderScore.get(strategy) ?? 0, cut.commanderScoreByStrategy.get(strategy) ?? 0),
      );
    }
    for (const [strategy, strategyScore] of add.scoreByStrategy) {
      addScores.set(strategy, (addScores.get(strategy) ?? 0) + strategyScore);
    }
  }

  const strategies = [...new Set([...cutScores.keys(), ...addScores.keys()])].sort((left, right) => left.localeCompare(right));
  const strategyDeltas = strategies.map((strategy) => {
    const cutAffinityScore = Number((cutScores.get(strategy) ?? 0).toFixed(3));
    const addAffinityScore = Number((addScores.get(strategy) ?? 0).toFixed(3));
    return {
      strategy,
      cutAffinityScore,
      addAffinityScore,
      netAffinityDelta: Number((addAffinityScore - cutAffinityScore).toFixed(3)),
    };
  });
  const meaningfulLosses = strategyDeltas
    .filter((delta) => (strongestCutProtection.get(delta.strategy) ?? 0) >= 4
      && (strongestCommanderScore.get(delta.strategy) ?? 0) >= SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15
      && delta.netAffinityDelta <= -MEANINGFUL_STRATEGY_AFFINITY_LOSS_V15)
    .map((delta) => ({
      strategy: delta.strategy,
      commanderStrategyScore: Number((strongestCommanderScore.get(delta.strategy) ?? 0).toFixed(3)),
      cutAffinityScore: delta.cutAffinityScore,
      addAffinityScore: delta.addAffinityScore,
      netAffinityLoss: Number((-delta.netAffinityDelta).toFixed(3)),
      strongestCutProtectionApplied: Number((strongestCutProtection.get(delta.strategy) ?? 0).toFixed(3)),
    }));

  return {
    status: meaningfulLosses.length > 0 ? 'meaningful-strategy-loss' : 'preserved',
    evidenceComplete: true,
    meaningfulLosses,
    strategyDeltas,
    swapImpacts,
    acceptanceRule: 'Reject an autonomous package when a maximum-protected card either loses at least four affinity points from a substantive upgrade-strategy signal (at least six inferred points) or removes an exact engine/payoff component of that strategy without replacing the same functional role in the incoming card.',
  };
}

function summaryMatchesUpgradeRoleV15(card: Record<string, unknown>, role: UpgradeStructuralRoleV15): boolean {
  const roles = summarizedRoles(card);
  if (role === 'ramp') return roles.has('mana acceleration') || roles.has('land ramp') || roles.has('cost reduction') || roles.has('fast mana');
  if (role === 'draw') return roles.has('card draw') || roles.has('repeatable draw') || roles.has('card selection');
  if (role === 'interaction') return roles.has('spot interaction') || roles.has('countermagic') || roles.has('board wipe') || roles.has('free interaction');
  if (role === 'free-interaction') return roles.has('free interaction');
  if (role === 'protection') return roles.has('protection') || roles.has('board protection');
  if (role === 'tutor') return roles.has('tutor');
  if (role === 'recursion') return roles.has('graveyard recursion');
  if (role === 'board-wipe') return roles.has('board wipe');
  return !recordString(card.typeLine).toLocaleLowerCase().includes('land') && recordNumber(card.manaValue) <= 2;
}

type UpgradeCountTargetGateV15 = Exclude<UpgradeTargetGateV15, 'average-nonland-mv'>;
const UPGRADE_TARGET_GATES_V15: UpgradeTargetGateV15[] = [
  'average-nonland-mv', 'early-plays', 'cheap-interaction', 'fast-mana', 'free-interaction', 'tutors',
];

function asUpgradeTargetGateV15(value: unknown): UpgradeTargetGateV15 | null {
  return typeof value === 'string' && UPGRADE_TARGET_GATES_V15.includes(value as UpgradeTargetGateV15)
    ? value as UpgradeTargetGateV15
    : null;
}

function summaryMatchesCountTargetGateV15(card: Record<string, unknown>, gate: UpgradeCountTargetGateV15): boolean {
  const roles = summarizedRoles(card);
  if (gate === 'early-plays') return !recordString(card.typeLine).toLocaleLowerCase().includes('land') && recordNumber(card.manaValue) <= 2;
  if (gate === 'cheap-interaction') return roles.has('cheap interaction');
  if (gate === 'fast-mana') return roles.has('fast mana');
  if (gate === 'free-interaction') return roles.has('free interaction');
  return roles.has('tutor');
}

/**
 * Preserve low-volume semantic infrastructure even when aggregate structural counts have
 * surplus. These are deliberately role-level floors, not card-name exceptions: a replacement
 * may spend the role only when the incoming card supplies the same semantic role and the
 * starting deck has demonstrated enough redundancy for that role.
 */
function preservesSemanticSafetyFloorsV15(
  cutCard: Record<string, unknown>,
  addCard: Record<string, unknown>,
  semanticRoleCounts: Readonly<Record<string, number>>,
  selectionRole: UpgradeAddressedRoleV15,
  authoritativeCounts: Record<UpgradeCountTargetGateV15, number>,
): boolean {
  const cutRoles = summarizedRoles(cutCard);
  const addRoles = summarizedRoles(addCard);
  const cutResourceAxes = [
    cutRoles.has('repeatable token engine'),
    cutRoles.has('card draw') || cutRoles.has('repeatable draw') || cutRoles.has('board-scaling card draw'),
    cutRoles.has('treasure') || cutRoles.has('mana acceleration') || cutRoles.has('conditional mana acceleration'),
  ].filter(Boolean).length;
  if (cutResourceAxes === 3) {
    const replacementResourceAxes = [
      addRoles.has('repeatable token engine'),
      addRoles.has('card draw') || addRoles.has('repeatable draw') || addRoles.has('board-scaling card draw'),
      addRoles.has('treasure') || addRoles.has('mana acceleration') || addRoles.has('conditional mana acceleration'),
    ].filter(Boolean).length;
    // A repeatable engine spanning bodies, cards and mana is more than an aggregate role
    // count. An incoming card must retain at least two of those functional axes rather
    // than exchanging the engine for a single token/protection payoff.
    if (replacementResourceAxes < 2) return false;
  }
  const safetyFloors: Array<{ role: string; floor: number }> = [
    // A curve repair must not trade away cost reducers that directly support the speed goal.
    {
      role: 'cost reduction',
      floor: selectionRole === 'average-nonland-mv'
        ? (semanticRoleCounts['cost reduction'] ?? 0)
        : Math.min(semanticRoleCounts['cost reduction'] ?? 0, 3),
    },
    // Preserve at least one graveyard utility effect whenever the deck has only one.
    { role: 'graveyard utility', floor: Math.min(semanticRoleCounts['graveyard utility'] ?? 0, 1) },
    // Narrow tutors are consistency infrastructure while the authoritative tutor gate is
    // still failed; do not silently replace them with unrelated protection or creatures.
    {
      role: 'narrow tutor',
      floor: authoritativeCounts.tutors < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.tutors
        ? (semanticRoleCounts['narrow tutor'] ?? 0)
        : Math.min(semanticRoleCounts['narrow tutor'] ?? 0, 4),
    },
    // Keep a complete spot-interaction floor at the established bracket-5 structural target.
    { role: 'spot interaction', floor: Math.min(semanticRoleCounts['spot interaction'] ?? 0, 14) },
    // Cheap interaction is operationally premium at high power. Do not spend it on an
    // unrelated protection/curve quota merely because aggregate interaction has surplus.
    { role: 'cheap interaction', floor: semanticRoleCounts['cheap interaction'] ?? 0 },
  ];
  return safetyFloors.every(({ role, floor }) => {
    if (!cutRoles.has(role) || floor <= 0) return true;
    const after = (semanticRoleCounts[role] ?? 0)
      - 1
      + (addRoles.has(role) ? 1 : 0);
    return after >= floor;
  });
}

function applySummaryToStructuralCountsV15(
  counts: UpgradeStructuralCountsV15,
  card: Record<string, unknown>,
  delta: 1 | -1,
): UpgradeStructuralCountsV15 {
  const next = { ...counts };
  for (const role of UPGRADE_STRUCTURAL_ROLES_V15) {
    if (summaryMatchesUpgradeRoleV15(card, role)) next[role] += delta;
  }
  return next;
}

function structuralDeficitTotalV15(counts: UpgradeStructuralCountsV15, targets: UpgradeStructuralTargetsV15): number {
  return UPGRADE_STRUCTURAL_ROLES_V15.reduce(
    (sum, role) => sum + Math.max(0, targets[role] - counts[role]),
    0,
  );
}

function preservesStructuralFloorsV15(
  before: UpgradeStructuralCountsV15,
  after: UpgradeStructuralCountsV15,
  targets: UpgradeStructuralTargetsV15,
): boolean {
  return UPGRADE_STRUCTURAL_ROLES_V15.every((role) => (
    after[role] >= Math.min(before[role], targets[role])
  ));
}

function currentRoleCountV15(currentMetrics: Record<string, unknown>, role: string): number {
  const roleCounts = currentMetrics.roleCounts;
  if (!roleCounts || typeof roleCounts !== 'object' || Array.isArray(roleCounts)) return 0;
  return recordNumber((roleCounts as Record<string, unknown>)[role]);
}

function upgradeStructuralStateV15(
  currentMetrics: Record<string, unknown>,
  structuralTargets: Record<string, unknown>,
): { counts: UpgradeStructuralCountsV15; targets: UpgradeStructuralTargetsV15 } {
  return {
    counts: {
      ramp: recordNumber(currentMetrics.rampCount),
      draw: recordNumber(currentMetrics.drawCount),
      interaction: recordNumber(currentMetrics.interactionCount),
      'free-interaction': currentRoleCountV15(currentMetrics, 'free interaction'),
      protection: recordNumber(currentMetrics.protectionCount),
      tutor: recordNumber(currentMetrics.tutorCount),
      recursion: recordNumber(currentMetrics.recursionCount),
      'board-wipe': recordNumber(currentMetrics.boardWipeCount),
      early: recordNumber(currentMetrics.earlyPlayCount),
    },
    targets: {
      ramp: recordNumber(structuralTargets.ramp),
      draw: recordNumber(structuralTargets.draw),
      interaction: recordNumber(structuralTargets.interaction),
      'free-interaction': recordNumber(structuralTargets.freeInteraction),
      protection: recordNumber(structuralTargets.protection),
      tutor: recordNumber(structuralTargets.tutors),
      recursion: recordNumber(structuralTargets.recursion),
      'board-wipe': recordNumber(structuralTargets.boardWipes),
      early: recordNumber(structuralTargets.earlyPlays),
    },
  };
}

export function pairUpgradeSwapsByStructureV15(
  additions: UpgradeAddSelectionV15[],
  cutPool: Array<Record<string, unknown>>,
  currentMetrics: Record<string, unknown>,
  structuralTargets: Record<string, unknown>,
  targetBracket = 5,
  options: UpgradePairingOptionsV15 = {},
): UpgradePairingV15[] {
  const state = upgradeStructuralStateV15(currentMetrics, structuralTargets);
  const bracket = clampBracket(targetBracket);
  const currentAverageNonlandManaValue = recordNumber(currentMetrics.averageNonlandManaValue);
  const currentNonlandCount = recordNumber(currentMetrics.nonlandCount);
  const curveTarget = bracket >= 5
    ? BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15
    : bracket >= 4
      ? BRACKET_FOUR_AVERAGE_NONLAND_MV_MAX_V15
      : Number.POSITIVE_INFINITY;
  const requiredCurveReduction = Number.isFinite(curveTarget)
    && currentAverageNonlandManaValue > curveTarget
    && currentNonlandCount > 0
    ? (currentAverageNonlandManaValue - curveTarget) * currentNonlandCount
    : Number.POSITIVE_INFINITY;
  let remainingCurveReduction = requiredCurveReduction;
  let currentNonlandManaValueTotal = currentAverageNonlandManaValue * currentNonlandCount;
  let counts = state.counts;
  const authoritativeCountTargets: Partial<Record<UpgradeCountTargetGateV15, number>> = bracket >= 5
    ? {
        'early-plays': BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.earlyPlays,
        'cheap-interaction': BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.cheapInteraction,
        'fast-mana': BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.fastMana,
        'free-interaction': BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.freeInteraction,
        tutors: BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.tutors,
      }
    : bracket >= 4
      ? {
          'early-plays': BRACKET_FOUR_AUTHORITATIVE_TARGETS_V15.earlyPlays,
          'cheap-interaction': BRACKET_FOUR_AUTHORITATIVE_TARGETS_V15.cheapInteraction,
          'fast-mana': BRACKET_FOUR_AUTHORITATIVE_TARGETS_V15.fastMana,
          tutors: BRACKET_FOUR_AUTHORITATIVE_TARGETS_V15.tutors,
        }
      : {};
  let authoritativeCounts: Record<UpgradeCountTargetGateV15, number> = {
    'early-plays': recordNumber(currentMetrics.earlyPlayCount),
    'cheap-interaction': recordNumber(currentMetrics.cheapInteractionCount),
    'fast-mana': recordNumber(currentMetrics.fastManaCount),
    'free-interaction': currentRoleCountV15(currentMetrics, 'free interaction'),
    tutors: recordNumber(currentMetrics.tutorCount),
  };
  let persistentColoredManaSources = recordNumber(currentMetrics.persistentColoredManaSourceCount);
  const persistentColoredManaSourceTarget = minimumPersistentColoredManaSourcesV15(
    recordNumber(currentMetrics.commanderColorCount),
  );
  const maxPairs = options.maxPairs === undefined
    ? Number.POSITIVE_INFINITY
    : Math.max(0, Math.trunc(options.maxPairs));
  const remainingCuts = [...cutPool];
  const pairs: UpgradePairingV15[] = [];
  const semanticRoleCounts: Record<string, number> = Object.fromEntries(
    Object.entries(currentMetrics.roleCounts && typeof currentMetrics.roleCounts === 'object' && !Array.isArray(currentMetrics.roleCounts)
      ? currentMetrics.roleCounts as Record<string, unknown>
      : {}).map(([role, count]) => [role, recordNumber(count)]),
  );

  for (const selection of additions) {
    if (pairs.length >= maxPairs) break;
    if (selection.role === 'average-nonland-mv' && remainingCurveReduction <= 0.0001) continue;
    if (remainingCuts.length === 0) break;
    const addCard = summarizedCard(selection.candidate);
    const addManaValue = recordNumber(addCard.manaValue);
    const selectionTargetGate = asUpgradeTargetGateV15(selection.candidate.authoritativeTargetGate)
      ?? (selection.role === 'average-nonland-mv' ? 'average-nonland-mv' : null);
    const afterAdd = applySummaryToStructuralCountsV15(counts, addCard, 1);
    const persistentColoredManaSourcesAfterAdd = persistentColoredManaSources
      + (summaryIsPersistentColoredManaSourceV15(addCard) ? 1 : 0);
    const persistentColoredManaSourceFloor = Math.min(
      persistentColoredManaSources,
      persistentColoredManaSourceTarget,
    );
    const deficitBeforeSwap = structuralDeficitTotalV15(counts, state.targets);
    const candidateCuts = (selection.role === 'average-nonland-mv'
      ? remainingCuts.filter((cut) => recordNumber(summarizedCard(cut).manaValue) > Math.max(2, addManaValue))
      : [...remainingCuts])
      .filter((cut) => {
        const cutCard = summarizedCard(cut);
        // Do not spend a premium one- or two-mana acceleration piece on an unrelated
        // upgrade. A persistent low-cost mana source is foundational early infrastructure;
        // only another premium early infrastructure card may replace it.
        if (summaryIsPremiumEarlyInfrastructureV15(cutCard)
          && !summaryIsPremiumEarlyInfrastructureV15(addCard)) return false;
        // In four- and five-colour decks, a broad persistent fixing rock is not
        // interchangeable with a conditional land tutor. Preserve the fixing
        // source unless the incoming card supplies the same persistent role.
        if (recordNumber(currentMetrics.commanderColorCount) >= 4
          && summaryIsBroadColorFixingManaSourceV15(cutCard)
          && !summaryIsBroadColorFixingManaSourceV15(addCard)) return false;
        if (!preservesSemanticSafetyFloorsV15(
          cutCard,
          addCard,
          semanticRoleCounts,
          selection.role,
          authoritativeCounts,
        )) return false;
        const afterSwap = applySummaryToStructuralCountsV15(afterAdd, summarizedCard(cut), -1);
        if (!preservesStructuralFloorsV15(counts, afterSwap, state.targets)) return false;
        const persistentColoredManaSourcesAfterSwap = persistentColoredManaSourcesAfterAdd
          - (summaryIsPersistentColoredManaSourceV15(summarizedCard(cut)) ? 1 : 0);
        if (persistentColoredManaSourcesAfterSwap < persistentColoredManaSourceFloor) return false;

        const afterAuthoritative = { ...authoritativeCounts };
        for (const [gate, target] of Object.entries(authoritativeCountTargets) as Array<[UpgradeCountTargetGateV15, number]>) {
          const beforeCount = authoritativeCounts[gate];
          const addDelta = summaryMatchesCountTargetGateV15(addCard, gate) ? 1 : 0;
          const cutDelta = summaryMatchesCountTargetGateV15(cutCard, gate) ? 1 : 0;
          afterAuthoritative[gate] = beforeCount + addDelta - cutDelta;
          if (afterAuthoritative[gate] < Math.min(beforeCount, target)) return false;
        }
        if (selectionTargetGate && selectionTargetGate !== 'average-nonland-mv') {
          if (afterAuthoritative[selectionTargetGate] <= authoritativeCounts[selectionTargetGate]) return false;
        }

        if (currentNonlandCount > 0 && Number.isFinite(curveTarget)) {
          const beforeAverage = currentNonlandManaValueTotal / currentNonlandCount;
          const afterAverage = (currentNonlandManaValueTotal + addManaValue - recordNumber(cutCard.manaValue)) / currentNonlandCount;
          const allowedAverage = Math.max(curveTarget, beforeAverage);
          if (afterAverage > allowedAverage + 0.0001) return false;
          if (selectionTargetGate === 'average-nonland-mv' && afterAverage >= beforeAverage - 0.0001) return false;
        }

        if (selection.role === 'average-nonland-mv' || selection.role === 'win-package') return true;
        return structuralDeficitTotalV15(afterSwap, state.targets) < deficitBeforeSwap;
      });
    candidateCuts.sort((left, right) => {
      const leftCounts = applySummaryToStructuralCountsV15(afterAdd, summarizedCard(left), -1);
      const rightCounts = applySummaryToStructuralCountsV15(afterAdd, summarizedCard(right), -1);
      const leftDeficit = structuralDeficitTotalV15(leftCounts, state.targets);
      const rightDeficit = structuralDeficitTotalV15(rightCounts, state.targets);
      const leftStrategy = upgradeSwapStrategyPreservationV15(selection.candidate, left);
      const rightStrategy = upgradeSwapStrategyPreservationV15(selection.candidate, right);
      if (leftStrategy.meaningfulStrategyLoss !== rightStrategy.meaningfulStrategyLoss) {
        return leftStrategy.meaningfulStrategyLoss ? 1 : -1;
      }
      const leftStrategyLoss = upgradeSwapSubstantiveStrategyLossScoreV15(selection.candidate, left);
      const rightStrategyLoss = upgradeSwapSubstantiveStrategyLossScoreV15(selection.candidate, right);
      if (leftStrategyLoss !== rightStrategyLoss) return leftStrategyLoss - rightStrategyLoss;
      let leftCurveReduction: number | null = null;
      let rightCurveReduction: number | null = null;
      let bothCurveCutsSufficient = false;
      if (selection.role === 'average-nonland-mv') {
        leftCurveReduction = recordNumber(summarizedCard(left).manaValue) - addManaValue;
        rightCurveReduction = recordNumber(summarizedCard(right).manaValue) - addManaValue;
        const leftSufficient = leftCurveReduction + 0.0001 >= remainingCurveReduction;
        const rightSufficient = rightCurveReduction + 0.0001 >= remainingCurveReduction;
        if (leftSufficient !== rightSufficient) return leftSufficient ? -1 : 1;
        bothCurveCutsSufficient = leftSufficient && rightSufficient;
        if (!bothCurveCutsSufficient && leftCurveReduction !== rightCurveReduction) {
          return rightCurveReduction - leftCurveReduction;
        }
      }
      if (leftDeficit !== rightDeficit) return leftDeficit - rightDeficit;
      const leftPressure = recordNumber(left.heuristicCutPressure);
      const rightPressure = recordNumber(right.heuristicCutPressure);
      if (leftPressure !== rightPressure) return rightPressure - leftPressure;
      if (bothCurveCutsSufficient && leftCurveReduction !== rightCurveReduction) {
        return (leftCurveReduction ?? 0) - (rightCurveReduction ?? 0);
      }
      const leftName = recordString(summarizedCard(left).name);
      const rightName = recordString(summarizedCard(right).name);
      return leftName.localeCompare(rightName);
    });
    const cut = candidateCuts[0];
    if (!cut) continue;
    const strategyPreservation = upgradeSwapStrategyPreservationV15(selection.candidate, cut);
    if (options.rejectMeaningfulStrategyLoss
      && selection.role !== 'win-package'
      && strategyPreservation.meaningfulStrategyLoss) continue;
    const cutIndex = remainingCuts.indexOf(cut);
    if (cutIndex < 0) continue;
    remainingCuts.splice(cutIndex, 1);
    const cutCard = summarizedCard(cut);
    for (const role of new Set([...summarizedRoles(addCard), ...summarizedRoles(cutCard)])) {
      semanticRoleCounts[role] = (semanticRoleCounts[role] ?? 0)
        + (summarizedRoles(addCard).has(role) ? 1 : 0)
        - (summarizedRoles(cutCard).has(role) ? 1 : 0);
    }
    counts = applySummaryToStructuralCountsV15(afterAdd, cutCard, -1);
    persistentColoredManaSources = persistentColoredManaSourcesAfterAdd
      - (summaryIsPersistentColoredManaSourceV15(cutCard) ? 1 : 0);
    for (const gate of Object.keys(authoritativeCountTargets) as UpgradeCountTargetGateV15[]) {
      authoritativeCounts[gate] += (summaryMatchesCountTargetGateV15(addCard, gate) ? 1 : 0)
        - (summaryMatchesCountTargetGateV15(cutCard, gate) ? 1 : 0);
    }
    currentNonlandManaValueTotal += addManaValue - recordNumber(cutCard.manaValue);
    const nonlandManaValueReduction = recordNumber(cutCard.manaValue) - addManaValue;
    if (selection.role === 'average-nonland-mv') {
      remainingCurveReduction = Math.max(0, remainingCurveReduction - nonlandManaValueReduction);
    }
    pairs.push({
      add: selection.candidate,
      cut,
      addressedRole: selection.role,
      structuralDeficitAfterSwap: structuralDeficitTotalV15(counts, state.targets),
      strategyPreservation,
      persistentColoredManaSourcesAfterSwap: persistentColoredManaSources,
      persistentColoredManaSourceFloor,
      ...(selectionTargetGate ? { authoritativeTargetGate: selectionTargetGate } : {}),
      ...(selection.role === 'average-nonland-mv' ? {
        nonlandManaValueReduction: Number(nonlandManaValueReduction.toFixed(3)),
      } : {}),
    });
  }
  return pairs;
}

function simulationSignals(result: Record<string, unknown>): Record<string, number | null> {
  const baseline = result.baseline as Record<string, unknown> | undefined;
  const opening = baseline?.openingHands as Record<string, unknown> | undefined;
  const advanced = result.advanced as Record<string, unknown> | undefined;
  const commander = advanced?.commanderPressure as Record<string, unknown> | undefined;
  const interaction = advanced?.interactionPressure as Record<string, unknown> | undefined;
  const flow = advanced?.cardFlow as Record<string, unknown> | undefined;
  const resources = advanced?.resources as Record<string, unknown> | undefined;
  const numeric = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
  return {
    functionalKeepRate: numeric(opening?.functionalKeepRate),
    commanderUptimePercent: numeric(commander?.battlefieldUptimePercent),
    protectionWinRate: numeric(interaction?.protectionWinRateWhenChallenged),
    averageSpellsCast: numeric(flow?.averageSpellsCast),
    averageTreasuresSpent: numeric(resources?.averageTreasuresSpent),
  };
}

function signalDeltas(before: Record<string, number | null>, after: Record<string, number | null>): Record<string, number | null> {
  return Object.fromEntries(Object.keys(before).map((key) => {
    const left = before[key] ?? null;
    const right = after[key] ?? null;
    return [key, left === null || right === null ? null : Number((right - left).toFixed(2))];
  }));
}

interface UpgradeWinPackagePriorityV15 {
  attempted: boolean;
  sourceStatus: string;
  selectedComboId: string | null;
  selectedBracketTag: string | null;
  missingSeedNames: string[];
  protectedExistingPackageNames?: string[];
  selections: UpgradeAddSelectionV15[];
  reason: string;
}

function commanderCardsForUpgradeV15(parsed: ParsedDeck, cards: ScryfallCard[]): ScryfallCard[] {
  return parsed.commanders
    .map((entry) => cards.find((card) => card.name.toLocaleLowerCase() === entry.name.toLocaleLowerCase()))
    .filter((card): card is ScryfallCard => Boolean(card));
}

async function buildWinPackagePriorityV15(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  options: UpgradePlanOptionsV07,
): Promise<UpgradeWinPackagePriorityV15> {
  const pressure = commanderTargetPressureV15(options.targetBracket);
  const verificationStatus = options.winRouteVerificationStatus ?? 'verification-unavailable';
  if (!pressure.verifiedWinningPackageRequired) {
    return {
      attempted: false,
      sourceStatus: 'not-required-below-bracket-5',
      selectedComboId: null,
      selectedBracketTag: null,
      missingSeedNames: [],
      selections: [],
      reason: 'The requested target does not require a verified winning package.',
    };
  }
  if (verificationStatus !== 'no-verified-route') {
    return {
      attempted: false,
      sourceStatus: verificationStatus,
      selectedComboId: null,
      selectedBracketTag: null,
      missingSeedNames: [],
      selections: [],
      reason: verificationStatus === 'protected'
        ? 'The existing V0.15 route audit already found a verified route, so refinement preserves it instead of adding another package by default.'
        : 'Win-route verification was unavailable, so refinement does not convert missing evidence into a claim that a package is absent.',
    };
  }

  const commanders = commanderCardsForUpgradeV15(parsed, cards);
  if (commanders.length !== parsed.commanders.length) {
    return {
      attempted: false,
      sourceStatus: 'commander-resolution-incomplete',
      selectedComboId: null,
      selectedBracketTag: null,
      missingSeedNames: [],
      selections: [],
      reason: 'The resolved commander cards were incomplete, so package discovery was not attempted.',
    };
  }

  const discovery = await discoverGeneralWinPackagesV15(commanders, {
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
    ...(options.maxUsdPerCard !== undefined ? { maxUsdPerCard: options.maxUsdPerCard } : {}),
    ...(options.excludedCards ? { excludedCards: options.excludedCards } : {}),
    maxPackageCards: 4,
  });
  const existingCardNames = [...parsed.commanders, ...parsed.main].map((entry) => entry.name);
  const injection = selectInjectableTargetAwareWinPackageV15({
    targetBracket: options.targetBracket,
    candidates: discovery.candidates,
    existingSelected: discovery.selected,
    existingCardNames,
    maxMissingSeedCards: Math.max(1, Math.min(15, Math.trunc(options.maxSwaps ?? 8))),
  });
  const selected = injection?.candidate ?? null;
  if (!selected || !injection) {
    return {
      attempted: true,
      sourceStatus: discovery.status,
      selectedComboId: null,
      selectedBracketTag: null,
      missingSeedNames: [],
      selections: [],
      reason: discovery.status === 'verification-unavailable'
        ? 'Verified package discovery was unavailable/incomplete; no package was invented.'
        : 'Completed verified package discovery found no legal verified package that can be injected atomically within the current swap capacity and active printing/budget/exclusion constraints.',
    };
  }

  const missingSeedNames = injection.missingSeedNames;
  if (missingSeedNames.length === 0) {
    return {
      attempted: true,
      sourceStatus: discovery.status,
      selectedComboId: selected.comboId,
      selectedBracketTag: selected.bracketTag,
      missingSeedNames: [],
      selections: [],
      reason: 'The target-aware verified package has no missing seed cards to add.',
    };
  }

  const lookup = await getCardsByNames(missingSeedNames);
  if (lookup.notFound.length > 0) {
    return {
      attempted: true,
      sourceStatus: 'package-card-resolution-incomplete',
      selectedComboId: selected.comboId,
      selectedBracketTag: selected.bracketTag,
      missingSeedNames,
      selections: [],
      reason: `A verified package was selected, but one or more seed cards could not be resolved: ${lookup.notFound.join(', ')}.`,
    };
  }
  const byName = new Map(lookup.cards.map((card) => [card.name.toLocaleLowerCase(), card]));
  const printings = new Map(selected.exactPrintings.map((printing) => [printing.name.toLocaleLowerCase(), printing]));
  const selections: UpgradeAddSelectionV15[] = [];
  for (const name of missingSeedNames) {
    const card = byName.get(name.toLocaleLowerCase());
    const printing = printings.get(name.toLocaleLowerCase());
    if (!card || !printing) {
      return {
        attempted: true,
        sourceStatus: 'package-printing-resolution-incomplete',
        selectedComboId: selected.comboId,
        selectedBracketTag: selected.bracketTag,
        missingSeedNames,
        selections: [],
        reason: `The selected verified package did not retain an exact eligible physical printing for ${name}.`,
      };
    }
    selections.push({
      role: 'win-package',
      candidate: {
        card: { ...summarizeCard(card), roles: effectiveCardRolesV15(card) },
        score: selected.score,
        recommendedPrinting: {
          set: printing.set,
          collectorNumber: printing.collectorNumber,
          finish: printing.finish,
          priceUsd: printing.priceUsd,
          familyMatch: 'verified-win-package',
        },
        whyItFits: `Adds the verified ${selected.bracketTag === 'R' ? 'R-tagged competitive ' : ''}winning package ${selected.comboId} because the existing V0.15 route audit found no verified route under a Bracket-5 target.`,
      },
    });
  }
  return {
    attempted: true,
    sourceStatus: discovery.status,
    selectedComboId: selected.comboId,
    selectedBracketTag: selected.bracketTag,
    missingSeedNames,
    protectedExistingPackageNames: injection.existingComboCardNames,
    selections,
    reason: selected.bracketTag === 'R'
      ? 'Bracket-5 target pressure preferred an existing verified R-tagged package.'
      : 'No verified R-tagged package survived the active constraints, so the existing verified portfolio selection is used as the fallback winning package.',
  };
}

export async function buildSimulationBackedUpgradePlanV07(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  allowedIdentity: string[],
  options: UpgradePlanOptionsV07 = {},
): Promise<Record<string, unknown>> {
  const maxSwaps = Math.max(1, Math.min(15, Math.trunc(options.maxSwaps ?? 8)));
  const protectedNames = new Set((options.protectedCards ?? []).map((name) => name.toLocaleLowerCase()));
  const suggestions = await suggestDeckUpgrades(parsed, cards, allowedIdentity, options);
  const groups = (suggestions.candidateAddsByDeficit ?? []) as Array<Record<string, unknown>>;
  const targetPressure = commanderTargetPressureV15(options.targetBracket);
  const winPackagePriority = await buildWinPackagePriorityV15(parsed, cards, options);
  const packageProtectedNames = new Set(
    (winPackagePriority.protectedExistingPackageNames ?? []).map((name) => name.toLocaleLowerCase()),
  );
  const cutPool = ((suggestions.candidateCuts ?? []) as Array<Record<string, unknown>>)
    .filter((cut) => {
      const card = cut.card as Record<string, unknown> | undefined;
      if (typeof card?.name !== 'string') return true;
      const name = card.name.toLocaleLowerCase();
      return !protectedNames.has(name) && !packageProtectedNames.has(name);
    });
  const swapCapacity = Math.min(maxSwaps, cutPool.length);

  const chosenAdds: UpgradeAddSelectionV15[] = [];
  const addNames = new Set<string>();
  const atomicWinPackageFits = winPackagePriority.selections.length > 0
    && winPackagePriority.selections.length <= swapCapacity;
  if (atomicWinPackageFits) {
    for (const selection of winPackagePriority.selections) {
      const name = candidateName(selection.candidate);
      if (!name || addNames.has(name.toLocaleLowerCase())) continue;
      addNames.add(name.toLocaleLowerCase());
      chosenAdds.push(selection);
    }
  }

  const candidateLanes = groups
    .map((group) => ({
      role: recordString(group.role) as UpgradeAddressedRoleV15,
      candidates: Array.isArray(group.candidates) ? group.candidates as Array<Record<string, unknown>> : [],
    }))
    .filter((lane) => UPGRADE_CANDIDATE_ROLES_V15.includes(lane.role) && lane.role !== 'win-package');
  const candidateDepth = candidateLanes.reduce((depth, lane) => Math.max(depth, lane.candidates.length), 0);
  for (let depth = 0; depth < candidateDepth; depth += 1) {
    for (const lane of candidateLanes) {
      const candidate = lane.candidates[depth];
      if (!candidate) continue;
      const name = candidateName(candidate);
      if (!name || addNames.has(name.toLocaleLowerCase())) continue;
      addNames.add(name.toLocaleLowerCase());
      chosenAdds.push({ candidate, role: lane.role });
    }
  }

  const pairings = pairUpgradeSwapsByStructureV15(
    chosenAdds,
    cutPool,
    (suggestions.currentMetrics ?? {}) as Record<string, unknown>,
    (suggestions.structuralTargets ?? {}) as Record<string, unknown>,
    options.targetBracket ?? 4,
    { rejectMeaningfulStrategyLoss: true, maxPairs: swapCapacity },
  );
  const strategyPreservation = auditUpgradeStrategyPreservationV15(pairings);
  const chosenCuts = pairings.map((pair) => pair.cut);
  const selectedAdds = pairings.map((pair) => pair.add);
  const cutNames = new Set(chosenCuts.flatMap((cut) => {
    const card = cut.card as Record<string, unknown> | undefined;
    return typeof card?.name === 'string' ? [card.name.toLocaleLowerCase()] : [];
  }));

  const newMainLines = parsed.main
    .filter((entry) => !cutNames.has(entry.name.toLocaleLowerCase()))
    .map(entryLine);
  const addLines = selectedAdds.map(candidateLine).filter((line): line is string => Boolean(line));
  const newDecklist = [
    '// COMMANDER',
    ...parsed.commanders.map(entryLine),
    '',
    '// MAIN',
    ...newMainLines,
    ...addLines,
  ].join('\n');
  const upgradedParsed = parseDecklist(newDecklist);
  const identifiers = [...upgradedParsed.commanders, ...upgradedParsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
  const resolved = await getCardsByIdentifiers(identifiers);
  const upgradedRules = validateCommanderDeck(upgradedParsed, resolved.cards);

  const iterations = Math.max(100, Math.min(5_000, Math.trunc(options.simulationIterations ?? 750)));
  const turns = Math.max(3, Math.min(12, Math.trunc(options.simulationTurns ?? 7)));
  const seed = Math.max(1, Math.min(2_147_483_647, Math.trunc(options.seed ?? 20_260_816)));
  const simulationOptions = { iterations, advancedIterations: Math.min(iterations, 1_500), turns, seed, pressure: 'upgraded' as const };
  const beforeSimulation = simulateDeckGameplayV06(parsed, cards, simulationOptions);
  const afterSimulation = resolved.notFound.length === 0 && upgradedRules.isLegal
    ? simulateDeckGameplayV06(upgradedParsed, resolved.cards, simulationOptions)
    : null;
  const beforeSignals = simulationSignals(beforeSimulation);
  const afterSignals = afterSimulation ? simulationSignals(afterSimulation) : null;

  return {
    status: afterSimulation ? 'simulated-candidate-plan' : 'candidate-plan-not-simulated',
    v15TargetPressure: {
      targetPressure,
      winRouteVerificationStatus: options.winRouteVerificationStatus ?? 'verification-unavailable',
      winPackageDiscoveryAttempted: winPackagePriority.attempted,
      winPackageSourceStatus: winPackagePriority.sourceStatus,
      selectedComboId: winPackagePriority.selectedComboId,
      selectedBracketTag: winPackagePriority.selectedBracketTag,
      missingSeedNames: winPackagePriority.missingSeedNames,
      protectedExistingPackageNames: winPackagePriority.protectedExistingPackageNames ?? [],
      atomicWinPackageInjected: atomicWinPackageFits,
      reason: winPackagePriority.reason,
    },
    swaps: pairings.map((pair) => ({
      out: (() => {
        const card = pair.cut.card as Record<string, unknown> | undefined;
        return typeof card?.name === 'string' ? card.name : null;
      })(),
      in: candidateName(pair.add),
      recommendedPrinting: pair.add.recommendedPrinting ?? null,
      why: pair.add.whyItFits ?? 'Addresses a detected structural deficit.',
      structuralPairing: {
        addressedRole: pair.addressedRole,
        remainingStructuralDeficitAfterSwap: pair.structuralDeficitAfterSwap,
        authoritativeTargetGate: pair.authoritativeTargetGate ?? null,
        nonlandManaValueReduction: pair.nonlandManaValueReduction ?? null,
        persistentColoredManaSourcesAfterSwap: pair.persistentColoredManaSourcesAfterSwap,
        persistentColoredManaSourceFloor: pair.persistentColoredManaSourceFloor,
        strategyPreservation: pair.strategyPreservation,
      },
    })),
    strategyPreservation,
    protectedCards: options.protectedCards ?? [],
    upgradedDecklist: newDecklist,
    upgradedCommanderRules: upgradedRules,
    unresolvedAfterSwaps: resolved.notFound,
    beforeMetrics: buildDeckMetrics(parsed, cards),
    afterMetrics: resolved.notFound.length === 0 ? buildDeckMetrics(upgradedParsed, resolved.cards) : null,
    simulation: {
      seed,
      iterations,
      turns,
      before: beforeSignals,
      after: afterSignals,
      delta: afterSignals ? signalDeltas(beforeSignals, afterSignals) : null,
      guidance: 'Positive deltas can support a swap, but simulation consistency is not the only goal. Preserve the deck’s intended theme, win routes, and cards the player explicitly wants to keep.',
    },
    sourceUpgradeAnalysis: suggestions,
    caveats: [
      'V0.7 does not automatically claim the suggested swaps are final. It deliberately returns the whole candidate deck and before/after evidence so an AI or player can reject a swap that harms theme or a preferred win route.',
      'IN/OUT pairing can inspect ranked backup additions across each structural lane. Autonomous non-win-package planning skips a candidate when its best structurally legal cut would cause a meaningful commander-strategy loss, then tries the next bounded backup without consuming the cut or swap slot. Final package-level strategy preservation remains independently audited.',
      'Bracket-5 verified packages remain atomic: the planner does not silently drop a verified package seed merely to satisfy the backup-addition shortcut.',
      'Same-seed simulation improves comparability but does not remove multiplayer variance, pilot decisions, hidden information, or meta effects.',
    ],
  };
}
