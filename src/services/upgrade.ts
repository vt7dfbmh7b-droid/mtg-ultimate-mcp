import type { ScryfallCard } from '../types/scryfall.js';
import {
  cardCommanderStrategyAffinityV15,
  deriveCommanderStrategyContextV15,
  type CommanderStrategyContextV15,
} from './commander-strategy-affinity-v15.js';
import { buildDeckMetrics, type ParsedDeck } from './deck.js';
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

interface StructuralTarget {
  ramp: number;
  draw: number;
  interaction: number;
  protection: number;
  tutors: number;
  earlyPlays: number;
}

const TARGETS: Record<number, StructuralTarget> = {
  1: { ramp: 6, draw: 6, interaction: 5, protection: 2, tutors: 0, earlyPlays: 8 },
  2: { ramp: 8, draw: 8, interaction: 8, protection: 3, tutors: 1, earlyPlays: 10 },
  3: { ramp: 10, draw: 10, interaction: 10, protection: 4, tutors: 3, earlyPlays: 12 },
  4: { ramp: 12, draw: 12, interaction: 14, protection: 6, tutors: 6, earlyPlays: 16 },
  5: { ramp: 14, draw: 14, interaction: 18, protection: 8, tutors: 10, earlyPlays: 20 },
};

function clampBracket(value: number | undefined): number {
  return Math.max(1, Math.min(5, Math.trunc(value ?? 4)));
}

function identityQuery(identity: string[]): string {
  if (identity.length === 0) return 'id:c';
  return `id<=${identity.join('').toLowerCase()}`;
}

function roleSearchQuery(
  role: string,
  identity: string[],
  printingPolicy: ResolvedPrintingPolicyV08,
): string {
  const roleClause: Record<string, string> = {
    ramp: '(o:"add" OR o:"search your library for" OR o:"costs" )',
    draw: '(o:"draw" OR o:"scry" OR o:"surveil" OR o:"look at the top")',
    interaction: '(o:"counter target spell" OR o:"destroy target" OR o:"exile target" OR o:"return target")',
    protection: '(o:"hexproof" OR o:"indestructible" OR o:"protection from" OR o:"phase out")',
    tutor: 'o:"search your library for"',
    early: 'mv<=2',
  };
  return [
    'f:commander',
    identityQuery(identity),
    '-t:land',
    roleClause[role] ?? '',
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

function cardMatchesRole(card: ScryfallCard, role: string): boolean {
  const roles = new Set(inferCardRoles(card));
  if (role === 'ramp') return roles.has('mana acceleration') || roles.has('land ramp') || roles.has('cost reduction');
  if (role === 'draw') return roles.has('card draw') || roles.has('repeatable draw') || roles.has('card selection');
  if (role === 'interaction') return roles.has('spot interaction') || roles.has('countermagic') || roles.has('board wipe') || roles.has('free interaction');
  if (role === 'protection') return roles.has('protection') || roles.has('board protection');
  if (role === 'tutor') return roles.has('tutor');
  if (role === 'early') return !card.type_line.toLowerCase().includes('land') && card.cmc <= 2;
  return false;
}

function candidateScore(
  card: ScryfallCard,
  role: string,
  strategyContext: CommanderStrategyContextV15,
): number {
  const roles = inferCardRoles(card);
  let score = cardMatchesRole(card, role) ? 100 : 0;
  score += Math.max(0, 8 - card.cmc) * 3;
  if (roles.includes('fast mana')) score += 20;
  if (roles.includes('free interaction')) score += 20;
  if (card.edhrec_rank !== undefined) score += Math.max(0, 20 - Math.log10(card.edhrec_rank + 1) * 5);
  score += cardCommanderStrategyAffinityV15(card, strategyContext).score;
  return score;
}

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
  let cutPressure = Math.max(0, card.cmc - 3) * 2;
  if (roles.length === 0) cutPressure += 5;
  if (card.cmc >= 6) cutPressure += 4;
  if (roles.includes('card draw') || roles.includes('tutor') || roles.includes('spot interaction') || roles.includes('countermagic') || roles.includes('protection')) cutPressure -= 4;

  const affinity = cardCommanderStrategyAffinityV15(card, strategyContext);
  // Reuse the existing four-point protection scale already applied to important utility roles.
  // Strategy fit lowers cut pressure but never makes an on-plan card automatically untouchable.
  const strategyProtectionApplied = Math.min(4, affinity.score);
  cutPressure -= strategyProtectionApplied;

  const reasons: string[] = [];
  if (card.cmc >= 6) reasons.push('high mana value');
  if (roles.length === 0) reasons.push('few detected utility roles');
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
): Array<Record<string, unknown>> {
  const mainNames = new Set(parsed.main.map((entry) => entry.name.toLocaleLowerCase()));
  return cards
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
        },
        explicitTheme: {
          matchesControlledTheme: themeMatch,
          protectionApplied: themeProtectionApplied,
        },
        reasons: themeProtectionApplied > 0
          ? [...context.reasons, 'supports the explicit controlled theme while the deck is at or below its required theme density']
          : context.reasons,
      };
    })
    .filter((item) => Number(item.heuristicCutPressure) > 0)
    .sort((a, b) => Number(b.heuristicCutPressure) - Number(a.heuristicCutPressure))
    .slice(0, 15);
}

export async function suggestDeckUpgrades(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  allowedIdentity: string[],
  options: UpgradeOptions = {},
): Promise<Record<string, unknown>> {
  const targetBracket = clampBracket(options.targetBracket);
  const targets = TARGETS[targetBracket] as StructuralTarget;
  const metrics = buildDeckMetrics(parsed, cards);
  const strategyContext = deriveCommanderStrategyContextV15(parsed, cards);
  const printingPolicy = await resolvePrintingPolicyV08({
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
  });
  const deficits = [
    { role: 'ramp', current: metrics.rampCount, target: targets.ramp },
    { role: 'draw', current: metrics.drawCount, target: targets.draw },
    { role: 'interaction', current: metrics.interactionCount, target: targets.interaction },
    { role: 'protection', current: metrics.protectionCount, target: targets.protection },
    { role: 'tutor', current: metrics.tutorCount, target: targets.tutors },
    { role: 'early', current: metrics.earlyPlayCount, target: targets.earlyPlays },
  ]
    .map((item) => ({ ...item, deficit: Math.max(0, item.target - item.current) }))
    .filter((item) => item.deficit > 0)
    .sort((a, b) => b.deficit - a.deficit);

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

  for (const deficit of deficits.slice(0, 5)) {
    const query = roleSearchQuery(deficit.role, allowedIdentity, printingPolicy);
    let results: ScryfallCard[] = [];
    try {
      results = await searchCards(query, 40);
    } catch {
      continue;
    }

    const ranked = results
      .filter((card) => !card.type_line.toLowerCase().includes('land'))
      .filter((card) => !existing.has(card.name.toLocaleLowerCase()))
      .filter((card) => !excluded.has(card.name.toLocaleLowerCase()))
      .filter((card) => card.legalities.commander === 'legal')
      .filter((card) => cardMatchesRole(card, deficit.role))
      .sort((a, b) => {
        if (themeDeficit > 0) {
          const aTheme = themeCandidateNames.has(a.name.toLocaleLowerCase()) ? 1 : 0;
          const bTheme = themeCandidateNames.has(b.name.toLocaleLowerCase()) ? 1 : 0;
          if (aTheme !== bTheme) return bTheme - aTheme;
        }
        return candidateScore(b, deficit.role, strategyContext) - candidateScore(a, deficit.role, strategyContext)
          || a.name.localeCompare(b.name);
      })
      .slice(0, Math.max(maxCandidates * 3, maxCandidates));

    const candidates: Array<Record<string, unknown>> = [];
    for (const card of ranked) {
      if (candidates.length >= maxCandidates) break;
      const printing = await selectEligiblePrintingV08(card, printingPolicy, options.maxUsdPerCard);
      if (!printing) continue;
      const affinity = cardCommanderStrategyAffinityV15(card, strategyContext);
      const matchedStrategies = affinity.matches.map((match) => match.archetype);
      const matchesControlledTheme = themeCandidateNames.has(card.name.toLocaleLowerCase());
      const strategyReason = matchedStrategies.length > 0
        ? ` and also supports the existing V0.15 commander strategy signal${matchedStrategies.length === 1 ? '' : 's'}: ${matchedStrategies.join(', ')}`
        : '';
      const themeReason = matchesControlledTheme && themeDeficit > 0
        ? ' It also helps close the current controlled theme-density deficit.'
        : '';

      candidates.push({
        card: summarizeCard(card),
        score: Number(candidateScore(card, deficit.role, strategyContext).toFixed(1)),
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
        whyItFits: `Addresses the detected ${deficit.role} deficit${strategyReason}. The recommended physical printing satisfies the active printing-family/set policy.${themeReason}`,
      });
    }

    candidateGroups.push({ ...deficit, searchQuery: query, candidates });
  }

  return {
    targetBracket,
    currentMetrics: metrics,
    structuralTargets: targets,
    structuralDeficits: deficits,
    candidateAddsByDeficit: candidateGroups,
    candidateCuts: cutCandidates(
      parsed,
      cards,
      strategyContext,
      themeCandidateNames,
      themeMinimumMainMatches > 0 && themeCurrentMainMatches <= themeMinimumMainMatches,
    ),
    controlledThemeSelection: {
      active: Boolean(themeClause),
      queryClause: themeClause || null,
      searchQuery: controlledThemeSearchQuery,
      currentMainMatches: themeCurrentMainMatches,
      requiredMainMatches: themeMinimumMainMatches,
      deficit: themeDeficit,
      discoveredThemeCandidateNames: themeCandidateNames.size,
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
      'These role-count targets are engineering heuristics for deck consistency and are not the official Commander bracket definitions.',
      'Candidate ordering keeps the existing role fit, mana efficiency, and EDHREC/community-adoption signals, then reuses V0.15 commander strategy inference as an additional deck-context signal. Popularity or strategy affinity alone is not proof of optimality.',
      'When a V0.15 controlled theme is below its minimum density, theme-matching cards are preferred within each structural deficit; the theme is not appended to every role search, so generic ramp, interaction, protection, or other utility can still be selected when appropriate.',
      'Cut ordering uses the same V0.15 commander strategy context as additions. When the deck is at or below its controlled theme minimum, matching cards also receive a capped four-point cut-protection signal; final theme preservation is still enforced independently by refinement rather than by this heuristic alone.',
      'Automatic upgrade packages pair the nonland cut pool with nonland additions so a utility land cannot silently replace a spell; dedicated mana-base work should be handled explicitly.',
      'Cut suggestions deliberately avoid claiming thematic/high-mana cards are bad; validate them against simulations, actual games, and reference-deck evidence.',
      'Scryfall USD prices are printing-specific reference values rather than guaranteed store checkout prices, and this version does not yet convert them to NZD.',
      'Promo status by itself never grants membership in a printing family; the printing must match a family set or a curated exact special-printing selector.',
    ],
  };
}
