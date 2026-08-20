import type { ScryfallCard } from '../types/scryfall.js';
import { validateCommanderDeck } from './commander-rules.js';
import {
  cardCommanderStrategyAffinityV15,
  deriveCommanderStrategyContextFromCommandersV15,
} from './commander-strategy-affinity-v15.js';
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
  const targets = ROLE_TARGETS[bracket] as RoleTargetsV07;
  const landsWanted = targetLands(bracket, options.landCount);
  const nonlandSlots = Math.max(1, 100 - eligibleCommanders.length - landsWanted);
  const excluded = new Set((options.excludedCards ?? []).map((name) => name.toLocaleLowerCase()));
  const commanderNames = new Set(eligibleCommanders.map((card) => card.name.toLocaleLowerCase()));
  const candidateMap = new Map<string, ScryfallCard>();
  const themeCandidateNames = new Set<string>();

  const searchRoles: Array<keyof RoleTargetsV07 | 'theme' | 'general'> = [
    'ramp', 'draw', 'interaction', 'protection', 'tutors', 'recursion', 'boardWipes', 'early', 'theme', 'general',
  ];
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
    status: commanderRules.isLegal && hasEnoughCards && printingPolicySatisfied && themeSelectionSatisfied ? 'complete-draft' : 'incomplete-draft',
    targetBracket: bracket,
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
        ? 'If the printing family does not contain enough suitable legal cards or basics under the requested price cap, the builder returns an incomplete draft instead of leaking cards from outside the family.'
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

type UpgradeStructuralRoleV15 = 'ramp' | 'draw' | 'interaction' | 'protection' | 'tutor' | 'early';

interface UpgradeAddSelectionV15 {
  candidate: Record<string, unknown>;
  role: UpgradeStructuralRoleV15;
}

interface UpgradeStructuralCountsV15 {
  ramp: number;
  draw: number;
  interaction: number;
  protection: number;
  tutor: number;
  early: number;
}

interface UpgradeStructuralTargetsV15 extends UpgradeStructuralCountsV15 {}

interface UpgradePairingV15 {
  add: Record<string, unknown>;
  cut: Record<string, unknown>;
  addressedRole: UpgradeStructuralRoleV15;
  structuralDeficitAfterSwap: number;
}

const UPGRADE_STRUCTURAL_ROLES_V15: UpgradeStructuralRoleV15[] = [
  'ramp', 'draw', 'interaction', 'protection', 'tutor', 'early',
];

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

function summaryMatchesUpgradeRoleV15(card: Record<string, unknown>, role: UpgradeStructuralRoleV15): boolean {
  const roles = summarizedRoles(card);
  if (role === 'ramp') return roles.has('mana acceleration') || roles.has('land ramp') || roles.has('cost reduction') || roles.has('fast mana');
  if (role === 'draw') return roles.has('card draw') || roles.has('repeatable draw') || roles.has('card selection');
  if (role === 'interaction') return roles.has('spot interaction') || roles.has('countermagic') || roles.has('board wipe') || roles.has('free interaction');
  if (role === 'protection') return roles.has('protection') || roles.has('board protection');
  if (role === 'tutor') return roles.has('tutor');
  return !recordString(card.typeLine).toLocaleLowerCase().includes('land') && recordNumber(card.manaValue) <= 2;
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

function upgradeStructuralStateV15(
  currentMetrics: Record<string, unknown>,
  structuralTargets: Record<string, unknown>,
): { counts: UpgradeStructuralCountsV15; targets: UpgradeStructuralTargetsV15 } {
  return {
    counts: {
      ramp: recordNumber(currentMetrics.rampCount),
      draw: recordNumber(currentMetrics.drawCount),
      interaction: recordNumber(currentMetrics.interactionCount),
      protection: recordNumber(currentMetrics.protectionCount),
      tutor: recordNumber(currentMetrics.tutorCount),
      early: recordNumber(currentMetrics.earlyPlayCount),
    },
    targets: {
      ramp: recordNumber(structuralTargets.ramp),
      draw: recordNumber(structuralTargets.draw),
      interaction: recordNumber(structuralTargets.interaction),
      protection: recordNumber(structuralTargets.protection),
      tutor: recordNumber(structuralTargets.tutors),
      early: recordNumber(structuralTargets.earlyPlays),
    },
  };
}

/**
 * Pair the already-ranked additions with cuts by marginal structural preservation.
 * Candidate generation, cut pressure, commander-strategy protection, budgets, printings and
 * simulation remain unchanged; this only stops independent IN/OUT rankings from accidentally
 * undoing the role deficit that an incoming card is meant to repair.
 */
export function pairUpgradeSwapsByStructureV15(
  additions: UpgradeAddSelectionV15[],
  cutPool: Array<Record<string, unknown>>,
  currentMetrics: Record<string, unknown>,
  structuralTargets: Record<string, unknown>,
): UpgradePairingV15[] {
  const state = upgradeStructuralStateV15(currentMetrics, structuralTargets);
  let counts = state.counts;
  const remainingCuts = [...cutPool];
  const pairs: UpgradePairingV15[] = [];

  for (const selection of additions) {
    if (remainingCuts.length === 0) break;
    const addCard = summarizedCard(selection.candidate);
    const afterAdd = applySummaryToStructuralCountsV15(counts, addCard, 1);
    remainingCuts.sort((left, right) => {
      const leftCounts = applySummaryToStructuralCountsV15(afterAdd, summarizedCard(left), -1);
      const rightCounts = applySummaryToStructuralCountsV15(afterAdd, summarizedCard(right), -1);
      const leftDeficit = structuralDeficitTotalV15(leftCounts, state.targets);
      const rightDeficit = structuralDeficitTotalV15(rightCounts, state.targets);
      const leftPressure = recordNumber(left.heuristicCutPressure);
      const rightPressure = recordNumber(right.heuristicCutPressure);
      const leftName = recordString(summarizedCard(left).name);
      const rightName = recordString(summarizedCard(right).name);
      return leftDeficit - rightDeficit || rightPressure - leftPressure || leftName.localeCompare(rightName);
    });
    const cut = remainingCuts.shift();
    if (!cut) break;
    counts = applySummaryToStructuralCountsV15(afterAdd, summarizedCard(cut), -1);
    pairs.push({
      add: selection.candidate,
      cut,
      addressedRole: selection.role,
      structuralDeficitAfterSwap: structuralDeficitTotalV15(counts, state.targets),
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
  const cutPool = ((suggestions.candidateCuts ?? []) as Array<Record<string, unknown>>)
    .filter((cut) => {
      const card = cut.card as Record<string, unknown> | undefined;
      return typeof card?.name !== 'string' || !protectedNames.has(card.name.toLocaleLowerCase());
    });

  const chosenAdds: UpgradeAddSelectionV15[] = [];
  const addNames = new Set<string>();
  for (const group of groups) {
    const role = recordString(group.role) as UpgradeStructuralRoleV15;
    if (!UPGRADE_STRUCTURAL_ROLES_V15.includes(role)) continue;
    for (const candidate of (group.candidates ?? []) as Array<Record<string, unknown>>) {
      if (chosenAdds.length >= maxSwaps) break;
      const name = candidateName(candidate);
      if (!name || addNames.has(name.toLocaleLowerCase())) continue;
      addNames.add(name.toLocaleLowerCase());
      chosenAdds.push({ candidate, role });
    }
    if (chosenAdds.length >= maxSwaps) break;
  }
  const pairings = pairUpgradeSwapsByStructureV15(
    chosenAdds,
    cutPool,
    (suggestions.currentMetrics ?? {}) as Record<string, unknown>,
    (suggestions.structuralTargets ?? {}) as Record<string, unknown>,
  );
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
      },
    })),
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
      'IN/OUT pairing now minimizes damage to the existing structural role targets before using cut pressure as a tie-breaker; candidate generation, budgets, printing constraints, commander-strategy protection, and same-seed simulation remain unchanged.',
      'Same-seed simulation improves comparability but does not remove multiplayer variance, pilot decisions, hidden information, or meta effects.',
    ],
  };
}
