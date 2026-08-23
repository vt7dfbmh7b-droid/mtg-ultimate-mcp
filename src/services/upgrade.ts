import type { ScryfallCard } from '../types/scryfall.js';
import {
  cardCommanderStrategyAffinityV15,
  deriveCommanderStrategyContextV15,
  substantiveCommanderStrategyAffinityScoreV15,
  type CommanderStrategyContextV15,
} from './commander-strategy-affinity-v15.js';
import { commanderTargetPressureV15 } from './commander-target-pressure-v15.js';
import { buildDeckMetrics, type ParsedDeck } from './deck.js';
import { discoverEligiblePoolV15 } from './neutral-deck-builder-v15.js';
import {
  describePrintingPolicyV08,
  resolvePrintingPolicyV08,
  selectEligiblePrintingV08,
  type ResolvedPrintingPolicyV08,
} from './printing-policy-v08.js';
import { inferCardRoles, searchCards, summarizeCard } from './scryfall.js';

export interface UpgradeOptions {
  targetBracket?: number;
  maxUsdPerCard?: number;
  allowedSets?: string[];
  printingFamily?: string;
  includePromos?: boolean;
  includeSpecialReleases?: boolean;
  /**
   * In the V0.12 refinement path this is a V0.15 adapter-generated, bounded Scryfall clause.
   * It is used as a theme-membership signal rather than being appended to every role search.
   */
  themeQuery?: string;
  themeMinimumMainMatches?: number;
  themeCurrentMainMatches?: number;
  excludedCards?: string[];
  maxCandidatesPerRole?: number;
}

export interface UpgradeStructuralTargetsV15 {
  ramp: number;
  draw: number;
  interaction: number;
  freeInteraction: number;
  protection: number;
  tutors: number;
  recursion: number;
  boardWipes: number;
  earlyPlays: number;
}

export interface UpgradeCandidateMetricsV15 {
  rampCount: number;
  drawCount: number;
  interactionCount: number;
  protectionCount: number;
  tutorCount: number;
  recursionCount: number;
  boardWipeCount: number;
  earlyPlayCount: number;
  cheapInteractionCount: number;
  fastManaCount: number;
  averageNonlandManaValue: number;
  roleCounts: Record<string, number>;
  persistentColoredManaSourceCount?: number;
  commanderColorCount?: number;
}

export type UpgradeTargetGateV15 =
  | 'average-nonland-mv'
  | 'early-plays'
  | 'cheap-interaction'
  | 'fast-mana'
  | 'free-interaction'
  | 'tutors';

export interface UpgradeCandidatePriorityV15 {
  role: 'average-nonland-mv' | 'ramp' | 'draw' | 'interaction' | 'free-interaction' | 'protection' | 'tutor' | 'early';
  current: number;
  target: number;
  deficit: number;
  prioritySource: 'authoritative-target-gate' | 'aspirational-role-target';
  targetGate: UpgradeTargetGateV15 | null;
}

const TARGETS: Record<number, UpgradeStructuralTargetsV15> = {
  1: { ramp: 6, draw: 6, interaction: 5, freeInteraction: 0, protection: 2, tutors: 0, recursion: 2, boardWipes: 1, earlyPlays: 8 },
  2: { ramp: 8, draw: 8, interaction: 8, freeInteraction: 0, protection: 3, tutors: 1, recursion: 2, boardWipes: 2, earlyPlays: 10 },
  3: { ramp: 10, draw: 10, interaction: 10, freeInteraction: 0, protection: 4, tutors: 3, recursion: 3, boardWipes: 2, earlyPlays: 12 },
  4: { ramp: 12, draw: 12, interaction: 14, freeInteraction: 0, protection: 6, tutors: 6, recursion: 3, boardWipes: 2, earlyPlays: 16 },
  5: { ramp: 14, draw: 14, interaction: 18, freeInteraction: 0, protection: 8, tutors: 10, recursion: 4, boardWipes: 2, earlyPlays: 20 },
};
export const BRACKET_FOUR_AVERAGE_NONLAND_MV_MAX_V15 = 3.1;
export const BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15 = 2.6;

export const BRACKET_FOUR_AUTHORITATIVE_TARGETS_V15 = {
  earlyPlays: 25,
  cheapInteraction: 6,
  fastMana: 2,
  tutors: 2,
} as const;

export const BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15 = {
  earlyPlays: 35,
  cheapInteraction: 8,
  fastMana: 3,
  freeInteraction: 1,
  tutors: 4,
} as const;

export function minimumPersistentColoredManaSourcesV15(commanderColorCount: number): number {
  const colors = Math.max(0, Math.min(5, Math.trunc(commanderColorCount)));
  if (colors <= 1) return 0;
  return ({ 2: 4, 3: 6, 4: 7, 5: 8 } as Record<number, number>)[colors] ?? 0;
}

function clampBracket(value: number | undefined): number {
  return Math.max(1, Math.min(5, Math.trunc(value ?? 4)));
}

function authoritativePriority(
  role: UpgradeCandidatePriorityV15['role'],
  targetGate: UpgradeTargetGateV15,
  current: number,
  target: number,
  direction: 'at-most' | 'at-least' = 'at-least',
): UpgradeCandidatePriorityV15 | null {
  const deficit = direction === 'at-most' ? current - target : target - current;
  if (deficit <= 0) return null;
  return {
    role,
    current,
    target,
    deficit: Number(deficit.toFixed(3)),
    prioritySource: 'authoritative-target-gate',
    targetGate,
  };
}

/**
 * Put currently failed authoritative construction gates for the requested bracket ahead of
 * aspirational role targets. Bracket 4 uses the actual optimized-structure thresholds from the
 * finished-deck assessor; Bracket 5 uses its construction thresholds. Verified win-route pressure
 * remains handled atomically by deck-builder-v07 rather than being approximated as a role count.
 */
export function upgradeCandidatePrioritiesV15(
  metrics: UpgradeCandidateMetricsV15,
  targets: UpgradeStructuralTargetsV15,
  targetBracket: number,
): UpgradeCandidatePriorityV15[] {
  const bracket = clampBracket(targetBracket);
  const authoritative: UpgradeCandidatePriorityV15[] = [];
  const push = (priority: UpgradeCandidatePriorityV15 | null) => {
    if (priority) authoritative.push(priority);
  };

  if (bracket >= 5) {
    push(authoritativePriority('average-nonland-mv', 'average-nonland-mv', metrics.averageNonlandManaValue, BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15, 'at-most'));
    push(authoritativePriority('early', 'early-plays', metrics.earlyPlayCount, BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.earlyPlays));
    push(authoritativePriority('interaction', 'cheap-interaction', metrics.cheapInteractionCount, BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.cheapInteraction));
    push(authoritativePriority('ramp', 'fast-mana', metrics.fastManaCount, BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.fastMana));
    push(authoritativePriority('free-interaction', 'free-interaction', Number(metrics.roleCounts['free interaction'] ?? 0), BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.freeInteraction));
    push(authoritativePriority('tutor', 'tutors', metrics.tutorCount, BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.tutors));
  } else if (bracket >= 4) {
    push(authoritativePriority('average-nonland-mv', 'average-nonland-mv', metrics.averageNonlandManaValue, BRACKET_FOUR_AVERAGE_NONLAND_MV_MAX_V15, 'at-most'));
    push(authoritativePriority('early', 'early-plays', metrics.earlyPlayCount, BRACKET_FOUR_AUTHORITATIVE_TARGETS_V15.earlyPlays));
    push(authoritativePriority('interaction', 'cheap-interaction', metrics.cheapInteractionCount, BRACKET_FOUR_AUTHORITATIVE_TARGETS_V15.cheapInteraction));
    push(authoritativePriority('ramp', 'fast-mana', metrics.fastManaCount, BRACKET_FOUR_AUTHORITATIVE_TARGETS_V15.fastMana));
    push(authoritativePriority('tutor', 'tutors', metrics.tutorCount, BRACKET_FOUR_AUTHORITATIVE_TARGETS_V15.tutors));
  }

  const authoritativeRoles = new Set(authoritative.map((priority) => priority.role));
  const aspirational = [
    { role: 'ramp' as const, current: metrics.rampCount, target: targets.ramp },
    { role: 'draw' as const, current: metrics.drawCount, target: targets.draw },
    { role: 'interaction' as const, current: metrics.interactionCount, target: targets.interaction },
    { role: 'free-interaction' as const, current: Number(metrics.roleCounts['free interaction'] ?? 0), target: targets.freeInteraction },
    { role: 'protection' as const, current: metrics.protectionCount, target: targets.protection },
    { role: 'tutor' as const, current: metrics.tutorCount, target: targets.tutors },
    { role: 'early' as const, current: metrics.earlyPlayCount, target: targets.earlyPlays },
  ]
    .filter((item) => !authoritativeRoles.has(item.role))
    .map((item): UpgradeCandidatePriorityV15 => ({
      ...item,
      deficit: Math.max(0, item.target - item.current),
      prioritySource: 'aspirational-role-target',
      targetGate: null,
    }))
    .filter((item) => item.deficit > 0)
    .sort((a, b) => b.deficit - a.deficit || a.role.localeCompare(b.role));

  return [...authoritative, ...aspirational];
}

function identityQuery(identity: string[]): string {
  if (identity.length === 0) return 'id:c';
  return `id<=${identity.join('').toLowerCase()}`;
}

function roleClause(role: string, targetGate: UpgradeTargetGateV15 | null = null): string {
  if (targetGate === 'cheap-interaction') {
    return 'mv<=2 (o:"counter target spell" OR o:"destroy target" OR o:"exile target" OR o:"return target" OR o:"target creature gets -")';
  }
  if (targetGate === 'fast-mana') {
    return 'mv<=2 (o:"add" OR o:"Treasure")';
  }
  const roleClauses: Record<string, string> = {
    ramp: '(o:"add" OR o:"search your library for" OR o:"costs" )',
    draw: '(o:"draw" OR o:"scry" OR o:"surveil" OR o:"look at the top")',
    interaction: '(o:"counter target spell" OR o:"destroy target" OR o:"exile target" OR o:"return target" OR o:"target creature gets -")',
    'free-interaction': '((mv=0 OR o:"rather than pay") (o:"counter target" OR o:"destroy target" OR o:"exile target"))',
    protection: '(o:"hexproof" OR o:"indestructible" OR o:"protection from" OR o:"phase out")',
    tutor: 'o:"search your library for"',
    early: 'mv<=2',
    'average-nonland-mv': 'mv<=2',
  };
  return roleClauses[role] ?? '';
}

function roleSearchQuery(
  role: string,
  identity: string[],
  printingPolicy: ResolvedPrintingPolicyV08,
  targetGate: UpgradeTargetGateV15 | null = null,
): string {
  return [
    'f:commander',
    identityQuery(identity),
    '-t:land',
    roleClause(role, targetGate),
    printingPolicy.searchClause,
  ]
    .filter(Boolean)
    .join(' ');
}

function themeSearchQuery(
  identity: string[],
  themeClause: string,
  printingPolicy: ResolvedPrintingPolicyV08,
): string {
  return [
    'f:commander',
    identityQuery(identity),
    '-t:land',
    themeClause,
    printingPolicy.searchClause,
  ]
    .filter(Boolean)
    .join(' ');
}

function themedRoleSearchQuery(
  role: string,
  identity: string[],
  themeClause: string,
  printingPolicy: ResolvedPrintingPolicyV08,
  targetGate: UpgradeTargetGateV15 | null = null,
): string {
  return [
    'f:commander',
    identityQuery(identity),
    '-t:land',
    roleClause(role, targetGate),
    themeClause,
    printingPolicy.searchClause,
  ]
    .filter(Boolean)
    .join(' ');
}

function cardMatchesRole(card: ScryfallCard, role: string, targetGate: UpgradeTargetGateV15 | null = null): boolean {
  const roles = new Set(inferCardRoles(card));
  if (targetGate === 'cheap-interaction') {
    return card.cmc <= 2
      && (roles.has('spot interaction') || roles.has('countermagic') || roles.has('free interaction'));
  }
  if (targetGate === 'fast-mana') return roles.has('fast mana');
  if (targetGate === 'free-interaction') return roles.has('free interaction');
  if (role === 'ramp') return roles.has('mana acceleration') || roles.has('land ramp') || roles.has('cost reduction');
  if (role === 'draw') return roles.has('card draw') || roles.has('repeatable draw') || roles.has('card selection');
  if (role === 'interaction') return roles.has('spot interaction') || roles.has('countermagic') || roles.has('board wipe') || roles.has('free interaction');
  if (role === 'free-interaction') return roles.has('free interaction');
  if (role === 'protection') return roles.has('protection') || roles.has('board protection');
  if (role === 'tutor') return roles.has('tutor');
  if (role === 'early') return !card.type_line.toLowerCase().includes('land') && card.cmc <= 2;
  if (role === 'average-nonland-mv') return !card.type_line.toLowerCase().includes('land') && card.cmc <= 2;
  return false;
}

function hasPrintingRestriction(policy: ResolvedPrintingPolicyV08): boolean {
  return Boolean(policy.family) || policy.allowedSetCodes.length > 0 || policy.exactSpecialPrintings.length > 0;
}

export function restrictedUpgradeCandidatesForRoleV15(
  pool: readonly ScryfallCard[],
  role: string,
  existingNames: ReadonlySet<string> = new Set<string>(),
  excludedNames: ReadonlySet<string> = new Set<string>(),
  targetGate: UpgradeTargetGateV15 | null = null,
): ScryfallCard[] {
  return pool.filter((card) => {
    const key = card.name.toLocaleLowerCase();
    return !card.type_line.toLocaleLowerCase().includes('land')
      && !existingNames.has(key)
      && !excludedNames.has(key)
      && card.legalities.commander === 'legal'
      && cardMatchesRole(card, role, targetGate);
  });
}

function candidateScore(
  card: ScryfallCard,
  role: string,
  strategyContext: CommanderStrategyContextV15,
  target: number | null = null,
  targetGate: UpgradeTargetGateV15 | null = null,
): number {
  const roles = inferCardRoles(card);
  let score = cardMatchesRole(card, role, targetGate) ? 100 : 0;
  if (role === 'average-nonland-mv') score += Math.max(0, (target ?? BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15) - card.cmc) * 20;
  score += Math.max(0, 8 - card.cmc) * 3;
  if (roles.includes('fast mana')) score += 20;
  if (roles.includes('free interaction')) score += 20;
  if (card.edhrec_rank !== undefined) score += Math.max(0, 20 - Math.log10(card.edhrec_rank + 1) * 5);
  score += cardCommanderStrategyAffinityV15(card, strategyContext).score;
  return score;
}

const CORE_UTILITY_CUT_ROLES_V15 = new Set([
  'mana acceleration',
  'land ramp',
  'cost reduction',
  'fast mana',
  'card draw',
  'repeatable draw',
  'card selection',
  'tutor',
  'spot interaction',
  'countermagic',
  'free interaction',
  'protection',
  'board protection',
  'board wipe',
  'graveyard recursion',
  'stax/control',
  'life drain',
]);

export function contextualCutPressureV15(
  card: ScryfallCard,
  strategyContext: CommanderStrategyContextV15,
): {
  cutPressure: number;
  strategyAffinityScore: number;
  strategyProtectionApplied: number;
  matchedStrategies: string[];
  reasons: string[];
} {
  const roles = inferCardRoles(card).filter((role) => !['creature', 'equipment', 'etb synergy'].includes(role));
  const affinity = cardCommanderStrategyAffinityV15(card, strategyContext);
  const substantiveAffinityScore = substantiveCommanderStrategyAffinityScoreV15(affinity);
  const hasCoreUtilityRole = roles.some((role) => CORE_UTILITY_CUT_ROLES_V15.has(role));
  const onlySecondaryOffPlanRoles = roles.length > 0 && !hasCoreUtilityRole && substantiveAffinityScore <= 0;

  let cutPressure = Math.max(0, card.cmc - 3) * 2;
  if (roles.length === 0) cutPressure += 5;
  if (onlySecondaryOffPlanRoles) cutPressure += 2;
  if (card.cmc >= 6) cutPressure += 4;
  if (hasCoreUtilityRole) cutPressure -= 4;

  // Reuse the existing four-point protection scale already applied to important utility roles.
  // Strategy fit lowers cut pressure but never makes an on-plan card automatically untouchable.
  const strategyProtectionApplied = Math.min(4, substantiveAffinityScore);
  cutPressure -= strategyProtectionApplied;

  const reasons: string[] = [];
  if (card.cmc >= 6) reasons.push('high mana value');
  if (roles.length === 0) reasons.push('few detected utility roles');
  if (onlySecondaryOffPlanRoles) reasons.push('only secondary detected roles without substantive commander-strategy support');
  if (card.cmc >= 4 && roles.length <= 1) reasons.push('expensive relative to detected flexibility');

  return {
    cutPressure: Number(cutPressure.toFixed(1)),
    strategyAffinityScore: Number(affinity.score.toFixed(1)),
    strategyProtectionApplied: Number(strategyProtectionApplied.toFixed(1)),
    matchedStrategies: affinity.matches.map((match) => match.archetype),
    reasons: reasons.length > 0 ? reasons : ['no strong structural cut signal; only consider if it underperforms in actual games'],
  };
}

function cutCandidates(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  strategyContext: CommanderStrategyContextV15,
  themeCandidateNames: ReadonlySet<string>,
  protectThemeMatches: boolean,
  allowCurveFallback: boolean,
): Array<Record<string, unknown>> {
  const mainNames = new Set(parsed.main.map((entry) => entry.name.toLocaleLowerCase()));
  const candidates = cards
    .filter((card) => mainNames.has(card.name.toLocaleLowerCase()) && !card.type_line.toLowerCase().includes('land'))
    .map((card) => {
      const context = contextualCutPressureV15(card, strategyContext);
      const themeMatch = themeCandidateNames.has(card.name.toLocaleLowerCase());
      const themeProtectionApplied = protectThemeMatches && themeMatch ? 4 : 0;
      const cutPressure = Number((context.cutPressure - themeProtectionApplied).toFixed(1));
      return {
        card: summarizeCard(card),
        heuristicCutPressure: cutPressure,
        strategyAffinity: {
          score: context.strategyAffinityScore,
          protectionApplied: context.strategyProtectionApplied,
          matchedStrategies: context.matchedStrategies,
          matches: cardCommanderStrategyAffinityV15(card, strategyContext).matches,
        },
        explicitTheme: {
          matchesControlledTheme: themeMatch,
          protectionApplied: themeProtectionApplied,
        },
        reasons: themeProtectionApplied > 0
          ? [...context.reasons, 'supports the explicit controlled theme while the deck is at or below its required theme density']
          : context.reasons,
      };
    });
  return selectUpgradeCutCandidatesV15(candidates, allowCurveFallback);
}

export function selectUpgradeCutCandidatesV15(
  candidates: Array<Record<string, unknown>>,
  allowNonPositivePressure: boolean,
): Array<Record<string, unknown>> {
  return candidates
    .filter((item) => Number(item.heuristicCutPressure) > 0 || allowNonPositivePressure)
    .sort((a, b) => Number(b.heuristicCutPressure) - Number(a.heuristicCutPressure))
    .slice(0, 15);
}

function mergeCardsByName(...groups: ScryfallCard[][]): ScryfallCard[] {
  const merged = new Map<string, ScryfallCard>();
  for (const group of groups) {
    for (const card of group) {
      const key = card.name.toLocaleLowerCase();
      if (!merged.has(key)) merged.set(key, card);
    }
  }
  return [...merged.values()];
}

export async function suggestDeckUpgrades(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  allowedIdentity: string[],
  options: UpgradeOptions = {},
): Promise<Record<string, unknown>> {
  const targetBracket = clampBracket(options.targetBracket);
  const targetPressure = commanderTargetPressureV15(targetBracket);
  const targets: UpgradeStructuralTargetsV15 = {
    ...(TARGETS[targetBracket] as UpgradeStructuralTargetsV15),
    freeInteraction: targetPressure.minimumFreeInteraction,
  };
  const metrics = buildDeckMetrics(parsed, cards);
  const currentMetrics: UpgradeCandidateMetricsV15 = {
    ...metrics,
    commanderColorCount: allowedIdentity.length,
  };
  const strategyContext = deriveCommanderStrategyContextV15(parsed, cards);
  const printingPolicy = await resolvePrintingPolicyV08({
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
  });
  const candidatePriorities = upgradeCandidatePrioritiesV15(currentMetrics, targets, targetBracket);
  const authoritativeTargetGatePriorities = candidatePriorities
    .filter((priority) => priority.prioritySource === 'authoritative-target-gate');
  const deficits = candidatePriorities
    .filter((priority) => priority.prioritySource === 'aspirational-role-target');

  const themeClause = options.themeQuery?.trim() ?? '';
  const themeMinimumMainMatches = Math.max(0, Math.trunc(options.themeMinimumMainMatches ?? 0));
  const themeCurrentMainMatches = Math.max(0, Math.trunc(options.themeCurrentMainMatches ?? 0));
  const themeDeficit = Math.max(0, themeMinimumMainMatches - themeCurrentMainMatches);
  const themeCandidateNames = new Set<string>();
  let controlledThemeSearchQuery: string | null = null;
  if (themeClause) {
    controlledThemeSearchQuery = themeSearchQuery(allowedIdentity, themeClause, printingPolicy);
    try {
      const themeResults = await searchCards(controlledThemeSearchQuery, 100);
      for (const card of themeResults) themeCandidateNames.add(card.name.toLocaleLowerCase());
    } catch {
      // Theme membership is independently audited by the V0.15 refinement caller. A transient
      // membership-search failure only removes positive ranking help here; it never proves absence.
    }
  }

  const existing = new Set([...parsed.commanders, ...parsed.main].map((entry) => entry.name.toLocaleLowerCase()));
  const excluded = new Set((options.excludedCards ?? []).map((name) => name.toLocaleLowerCase()));
  const maxCandidates = Math.max(1, Math.min(10, Math.trunc(options.maxCandidatesPerRole ?? 5)));
  const candidateGroups: Array<Record<string, unknown>> = [];
  const restrictedPoolActive = hasPrintingRestriction(printingPolicy);
  const restrictedEligiblePool = restrictedPoolActive
    ? await discoverEligiblePoolV15(allowedIdentity, printingPolicy, options.maxUsdPerCard)
    : null;
  const candidateDiscovery = restrictedPoolActive
    ? {
        mode: 'exhaustive-bounded-printing-policy',
        exhaustiveWithinSafetyCeilings: true,
        eligiblePoolCards: restrictedEligiblePool?.length ?? 0,
        roleSearchResultCap: null,
        note: 'Restricted Upgrade reuses the same bounded eligible physical-printing pool as restricted Build, then applies the existing Upgrade role, strategy, theme, legality, exclusion, and pricing logic. Role-search ordering cannot hide an otherwise eligible family/set card.',
      }
    : {
        mode: 'bounded-role-search',
        exhaustiveWithinSafetyCeilings: false,
        eligiblePoolCards: null,
        roleSearchResultCap: 40,
        note: 'Unrestricted Upgrade still uses bounded role-specific discovery; final candidates remain independently filtered by role and Commander legality.',
      };

  for (const deficit of candidatePriorities.slice(0, 5)) {
    const query = restrictedPoolActive ? null : roleSearchQuery(deficit.role, allowedIdentity, printingPolicy, deficit.targetGate);
    let genericResults: ScryfallCard[] = [];
    if (restrictedEligiblePool) {
      genericResults = restrictedUpgradeCandidatesForRoleV15(restrictedEligiblePool, deficit.role, existing, excluded, deficit.targetGate);
    } else if (query) {
      try {
        genericResults = await searchCards(query, 40);
      } catch {
        // A supplemental controlled-theme query can still provide candidates below.
      }
    }

    let themedQuery: string | null = null;
    let themedResults: ScryfallCard[] = [];
    if (themeDeficit > 0 && themeClause) {
      themedQuery = themedRoleSearchQuery(deficit.role, allowedIdentity, themeClause, printingPolicy, deficit.targetGate);
      try {
        themedResults = await searchCards(themedQuery, 40);
        for (const card of themedResults) themeCandidateNames.add(card.name.toLocaleLowerCase());
      } catch {
        // Generic structural discovery remains usable. Final theme truth is independently audited.
      }
    }

    // Under a printing-family/set restriction the exhaustive eligible pool is the candidate universe.
    // The supplemental theme search only marks which pool cards support the controlled theme; it cannot
    // inject a card that the shared physical-printing truth boundary did not admit.
    const results = restrictedPoolActive ? genericResults : mergeCardsByName(themedResults, genericResults);
    if (results.length === 0) continue;
    const candidatesForPriority = deficit.prioritySource === 'authoritative-target-gate'
      && authoritativeTargetGatePriorities.length > 1
      ? 1
      : maxCandidates;
    const ranked = results
      .filter((card) => !card.type_line.toLowerCase().includes('land'))
      .filter((card) => !existing.has(card.name.toLocaleLowerCase()))
      .filter((card) => !excluded.has(card.name.toLocaleLowerCase()))
      .filter((card) => card.legalities.commander === 'legal')
      .filter((card) => cardMatchesRole(card, deficit.role, deficit.targetGate))
      .sort((a, b) => {
        if (themeDeficit > 0) {
          const aTheme = themeCandidateNames.has(a.name.toLocaleLowerCase()) ? 1 : 0;
          const bTheme = themeCandidateNames.has(b.name.toLocaleLowerCase()) ? 1 : 0;
          if (aTheme !== bTheme) return bTheme - aTheme;
        }
        return candidateScore(b, deficit.role, strategyContext, deficit.target, deficit.targetGate)
          - candidateScore(a, deficit.role, strategyContext, deficit.target, deficit.targetGate)
          || a.name.localeCompare(b.name);
      })
      .slice(0, Math.max(candidatesForPriority * 3, candidatesForPriority));

    const candidates: Array<Record<string, unknown>> = [];
    for (const card of ranked) {
      if (candidates.length >= candidatesForPriority) break;
      const printing = await selectEligiblePrintingV08(card, printingPolicy, options.maxUsdPerCard);
      if (!printing) continue;
      const affinity = cardCommanderStrategyAffinityV15(card, strategyContext);
      const substantiveAffinityScore = substantiveCommanderStrategyAffinityScoreV15(affinity);
      const matchedStrategies = affinity.matches.map((match) => match.archetype);
      const matchesControlledTheme = themeCandidateNames.has(card.name.toLocaleLowerCase());
      const strategyReason = matchedStrategies.length > 0
        ? ` and also supports the existing V0.15 commander strategy signal${matchedStrategies.length === 1 ? '' : 's'}: ${matchedStrategies.join(', ')}`
        : '';
      const themeReason = matchesControlledTheme && themeDeficit > 0
        ? ' It also helps close the current controlled theme-density deficit.'
        : '';
      const targetDirection = deficit.targetGate === 'average-nonland-mv'
        ? `${deficit.current} must fall to ${deficit.target} or lower`
        : `${deficit.current} must rise to ${deficit.target} or higher`;
      const targetReason = deficit.prioritySource === 'authoritative-target-gate'
        ? `Advances the currently failed authoritative Bracket-${targetBracket} ${deficit.targetGate} gate (${targetDirection})`
        : `Addresses the detected ${deficit.role} deficit`;
      candidates.push({
        card: summarizeCard(card),
        score: Number(candidateScore(card, deficit.role, strategyContext, deficit.target, deficit.targetGate).toFixed(1)),
        authoritativeTargetGate: deficit.prioritySource === 'authoritative-target-gate' ? deficit.targetGate : null,
        strategyAffinity: {
          score: Number(affinity.score.toFixed(1)),
          protectionApplied: Number(Math.min(4, substantiveAffinityScore).toFixed(1)),
          matchedStrategies,
          matches: affinity.matches,
        },
        explicitTheme: {
          matchesControlledTheme,
          currentMainMatches: themeCurrentMainMatches,
          requiredMainMatches: themeMinimumMainMatches,
          deficitBeforeSwap: themeDeficit,
        },
        recommendedPrinting: {
          set: printing.card.set.toUpperCase(),
          setName: printing.card.set_name,
          collectorNumber: printing.card.collector_number,
          releaseDate: printing.card.released_at ?? null,
          finish: printing.finish,
          priceUsd: printing.priceUsd,
          promo: Boolean(printing.card.promo),
          promoTypes: printing.card.promo_types ?? [],
          flavorName: printing.card.flavor_name ?? null,
          familyMatch: printing.matchedBy,
          scryfallUrl: printing.card.scryfall_uri,
        },
        whyItFits: `${targetReason}${strategyReason}. The recommended physical printing satisfies the active printing-family/set policy.${themeReason}`,
      });
    }

    candidateGroups.push({
      ...deficit,
      candidateDiscoveryMode: candidateDiscovery.mode,
      searchQuery: query,
      supplementalThemeRoleQuery: themedQuery,
      candidates,
    });
  }

  return {
    targetBracket,
    targetPressure,
    currentMetrics,
    structuralTargets: targets,
    structuralDeficits: deficits,
    authoritativeTargetGatePriorities,
    candidateGenerationPriorities: candidatePriorities,
    candidateDiscovery,
    candidateAddsByDeficit: candidateGroups,
    candidateCuts: cutCandidates(
      parsed,
      cards,
      strategyContext,
      themeCandidateNames,
      themeMinimumMainMatches > 0 && themeCurrentMainMatches <= themeMinimumMainMatches,
      authoritativeTargetGatePriorities.some((priority) => priority.targetGate === 'average-nonland-mv'),
    ),
    controlledThemeSelection: {
      active: Boolean(themeClause),
      queryClause: themeClause || null,
      searchQuery: controlledThemeSearchQuery,
      currentMainMatches: themeCurrentMainMatches,
      requiredMainMatches: themeMinimumMainMatches,
      deficit: themeDeficit,
      discoveredThemeCandidateNames: themeCandidateNames.size,
      supplementalRoleSearchesEnabled: themeDeficit > 0 && Boolean(themeClause),
    },
    constraints: {
      maxUsdPerCard: options.maxUsdPerCard ?? null,
      allowedSets: options.allowedSets ?? [],
      printingFamily: options.printingFamily ?? null,
      includePromos: options.includePromos ?? true,
      includeSpecialReleases: options.includeSpecialReleases ?? true,
      themeQuery: options.themeQuery ?? null,
      excludedCards: options.excludedCards ?? [],
    },
    printingPolicy: describePrintingPolicyV08(printingPolicy),
    pricingPolicy: {
      printingAware: true,
      explanation:
        'Candidates are tied to a qualifying physical printing with set code, collector number, finish, promo metadata, and price. A cheaper or more common unrelated printing of the same Oracle card cannot bypass a themed printing-family restriction.',
    },
    caveats: [
      'Role-count targets are engineering heuristics for deck consistency, but failed Bracket-4/5 construction gates now outrank aspirational role targets. When several authoritative gates are failing, candidate generation gives each gate one slot per pass before allowing a single generic role to consume the package.',
      'Candidate ordering keeps the existing role fit, mana efficiency, and EDHREC/community-adoption signals, then reuses V0.15 commander strategy inference as an additional deck-context signal. Popularity or strategy affinity alone is not proof of optimality.',
      'Printing-family/set-restricted Upgrade reuses the exhaustive bounded eligible pool already used by restricted Build, so a qualifying card cannot be missed merely because it fell outside a small role-search result window. Unrestricted Upgrade retains bounded role search for now.',
      'When a V0.15 controlled theme is below its minimum density, the engine uses the controlled theme query as a positive membership/ranking signal. Under a printing restriction, only cards already admitted by the exhaustive shared eligible pool can become candidates.',
      'Cut ordering uses the same V0.15 commander strategy context as additions. When the deck is at or below its controlled theme minimum, matching cards also receive a capped four-point cut-protection signal; final theme preservation is still enforced independently by refinement rather than by this heuristic alone.',
      'Automatic upgrade packages pair the nonland cut pool with nonland additions so a utility land cannot silently replace a spell; dedicated mana-base work should be handled explicitly.',
      'Cut suggestions deliberately avoid claiming thematic/high-mana cards are bad; validate them against simulations, actual games, and reference-deck evidence.',
      'Scryfall USD prices are printing-specific reference values rather than guaranteed store checkout prices, and this version does not yet convert them to NZD.',
      'Promo status by itself never grants membership in a printing family; the printing must match a family set or a curated exact special-printing selector.',
    ],
  };
}
