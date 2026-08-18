import type { ScryfallCard } from '../types/scryfall.js';
import { exactPrintingBudgetWitnessV15 } from './exact-printing-budget-v15.js';
import { parseDecklist, resolveEntryCard } from './deck.js';
import {
  buildNeutralCommanderDeckV15,
  neutralCandidatePriceCapV15,
  neutralCommanderLookupNameV15,
  type NeutralDeckBuildOptionsV15,
} from './neutral-deck-builder-v15.js';
import type { NeutralArchetypeV15 } from './neutral-commander-selection-v15.js';
import {
  auditNeutralThemeV15,
  cardMatchesNeutralThemeV15,
  resolveNeutralThemeIntentV15,
  type NeutralThemeIntentV15,
} from './neutral-theme-v15.js';
import {
  printingMatchesPolicyV08,
  resolvePrintingPolicyV08,
  type ResolvedPrintingPolicyV08,
} from './printing-policy-v08.js';
import { boundedScryfallSearchV15 } from './scryfall-paged-search-v15.js';
import {
  getCardOracleText,
  getCardsByIdentifiers,
  getCardsByNames,
  inferCardRoles,
  type CardIdentifierInput,
} from './scryfall.js';

export interface NeutralThemedDeckBuildOptionsV15 extends NeutralDeckBuildOptionsV15 {
  themeQuery: string;
}

export interface NeutralThemeCandidateProvenanceV15 {
  mode: 'controlled-theme-supplement';
  normalizedTheme: string | null;
  generatedQueryClause: string | null;
  pagesFetched: number;
  providerTotalCards: number | null;
  exhaustiveWithinBounds: boolean;
  sourceOrderedByEdhrec: boolean;
  constructionRankingUsesPopularity: false;
  eligibleThemeCandidates: number;
  generatedThemeSeeds: number;
  effectiveCandidateMaxUsdPerCard: number | null;
}

const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'] as const;

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function oracleKey(card: ScryfallCard): string {
  return card.oracle_id ?? normalize(card.name);
}

function identity(cards: readonly ScryfallCard[]): string[] {
  const present = new Set(cards.flatMap((card) => card.color_identity.map((color) => color.toUpperCase())));
  return COLOR_ORDER.filter((color) => present.has(color));
}

function identityQuery(colors: readonly string[]): string {
  return colors.length === 0 ? 'id:c' : `id<=${colors.join('').toLocaleLowerCase()}`;
}

function legalIdentity(card: ScryfallCard, colors: readonly string[]): boolean {
  const allowed = new Set(colors.map((color) => color.toUpperCase()));
  return card.legalities.commander === 'legal'
    && card.color_identity.every((color) => allowed.has(color.toUpperCase()));
}

function archetypeAffinity(card: ScryfallCard, archetype: NeutralArchetypeV15): number {
  const roles = new Set(inferCardRoles(card));
  const text = getCardOracleText(card).toLocaleLowerCase();
  let score = 0;
  const add = (condition: boolean, points: number): void => { if (condition) score += points; };
  switch (archetype) {
    case 'combat-tokens':
      add(roles.has('token production'), 6); add(roles.has('extra combat'), 5); add(/attacks|attacking|combat damage/.test(text), 3); break;
    case 'equipment-voltron':
      add(roles.has('equipment'), 7); add(roles.has('protection'), 3); add(/equip |equipped creature|attach/.test(text), 4); break;
    case 'counters':
      add(roles.has('+1/+1 counters'), 7); add(/proliferate|counter is put|counters? are put/.test(text), 4); break;
    case 'graveyard-reanimator':
      add(roles.has('graveyard recursion'), 7); add(/graveyard|mill|surveil|discard/.test(text), 3); break;
    case 'aristocrats':
      add(roles.has('sacrifice synergy') || roles.has('sacrifice outlet'), 7); add(roles.has('life drain'), 5); add(/dies|sacrifice/.test(text), 3); break;
    case 'spells-control':
      add(roles.has('countermagic'), 6); add(roles.has('copy effect'), 4); add(/instant|sorcery|whenever you cast/.test(text), 3); break;
    case 'value-engine':
      add(roles.has('repeatable draw'), 6); add(roles.has('card draw') || roles.has('card selection'), 4); add(roles.has('treasure'), 3); break;
    case 'big-mana':
      add(roles.has('mana acceleration') || roles.has('cost reduction'), 7); add(/add .*mana|costs? .*less to cast/.test(text), 3); break;
  }
  return score;
}

function roleUtility(card: ScryfallCard): number {
  const roles = new Set(inferCardRoles(card));
  let score = 0;
  if (roles.has('mana acceleration') || roles.has('land ramp') || roles.has('fast mana')) score += 5;
  if (roles.has('card draw') || roles.has('repeatable draw') || roles.has('card selection')) score += 5;
  if (roles.has('spot interaction') || roles.has('countermagic') || roles.has('board wipe') || roles.has('free interaction')) score += 5;
  if (roles.has('protection') || roles.has('board protection')) score += 3;
  if (roles.has('tutor')) score += 2;
  if (roles.has('graveyard recursion')) score += 2;
  if (card.cmc <= 2) score += 4;
  else if (card.cmc <= 4) score += 2;
  else if (card.cmc >= 7) score -= 2;
  return score;
}

export function selectNeutralThemeSeedCandidatesV15(
  cards: ScryfallCard[],
  intent: NeutralThemeIntentV15,
  options: {
    archetype: NeutralArchetypeV15;
    needed: number;
    excludedNames?: string[];
    protectedNames?: string[];
  },
): ScryfallCard[] {
  const excluded = new Set((options.excludedNames ?? []).map(normalize));
  const protectedNames = new Set((options.protectedNames ?? []).map(normalize));
  const byOracle = new Map<string, ScryfallCard>();
  for (const card of cards) {
    if (card.type_line.toLocaleLowerCase().includes('land')) continue;
    if (!cardMatchesNeutralThemeV15(card, intent)) continue;
    if (excluded.has(normalize(card.name)) || protectedNames.has(normalize(card.name))) continue;
    const key = oracleKey(card);
    const current = byOracle.get(key);
    if (!current) {
      byOracle.set(key, card);
      continue;
    }
    const currentPrice = Math.min(
      ...[current.prices?.usd, current.prices?.usd_foil, current.prices?.usd_etched]
        .map((value) => value ? Number.parseFloat(value) : Number.POSITIVE_INFINITY),
    );
    const candidatePrice = Math.min(
      ...[card.prices?.usd, card.prices?.usd_foil, card.prices?.usd_etched]
        .map((value) => value ? Number.parseFloat(value) : Number.POSITIVE_INFINITY),
    );
    if (candidatePrice < currentPrice) byOracle.set(key, card);
  }
  return [...byOracle.values()]
    .sort((a, b) => {
      const scoreA = archetypeAffinity(a, options.archetype) * 4 + roleUtility(a);
      const scoreB = archetypeAffinity(b, options.archetype) * 4 + roleUtility(b);
      return scoreB - scoreA || a.cmc - b.cmc || a.name.localeCompare(b.name);
    })
    .slice(0, Math.max(0, Math.trunc(options.needed)));
}

function exactCandidateWithinCap(card: ScryfallCard, cap: number | undefined): boolean {
  return cap === undefined || exactPrintingBudgetWitnessV15(card, cap).status === 'within-cap';
}

async function resolveCommanderOracleCards(commanderNames: string[]): Promise<ScryfallCard[]> {
  const lookup = commanderNames.map(neutralCommanderLookupNameV15);
  const result = await getCardsByNames(lookup);
  if (result.notFound.length > 0) throw new Error(`Neutral theme commander resolution failed: ${result.notFound.join(', ')}`);
  return result.cards;
}

async function resolveExistingMatchingMustIncludes(
  names: string[],
  commanderNames: string[],
  intent: NeutralThemeIntentV15,
): Promise<number> {
  const uniqueNames = [...new Map(names.map((name) => [normalize(name), name.trim()])).values()].filter(Boolean);
  if (uniqueNames.length === 0) return 0;
  const result = await getCardsByNames(uniqueNames);
  if (result.notFound.length > 0) throw new Error(`Neutral theme must-include resolution failed: ${result.notFound.join(', ')}`);
  const commanderSet = new Set(commanderNames.map((name) => normalize(neutralCommanderLookupNameV15(name))));
  return result.cards.filter((card) => !commanderSet.has(normalize(neutralCommanderLookupNameV15(card.name))) && cardMatchesNeutralThemeV15(card, intent)).length;
}

async function resolveFinalThemeEntries(decklist: string): Promise<Array<{ card: ScryfallCard; quantity: number; zone: 'commander' | 'main' }>> {
  const parsed = parseDecklist(decklist);
  const entries = [...parsed.commanders, ...parsed.main];
  const identifiers: CardIdentifierInput[] = entries.map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
  const resolved = await getCardsByIdentifiers(identifiers);
  if (resolved.notFound.length > 0) throw new Error(`Neutral theme final exact-printing resolution failed: ${resolved.notFound.join(', ')}`);
  const output: Array<{ card: ScryfallCard; quantity: number; zone: 'commander' | 'main' }> = [];
  for (const entry of parsed.commanders) {
    const card = resolveEntryCard(entry, resolved.cards);
    if (!card) throw new Error(`Neutral theme final audit could not resolve commander ${entry.name}.`);
    output.push({ card, quantity: entry.quantity, zone: 'commander' });
  }
  for (const entry of parsed.main) {
    const card = resolveEntryCard(entry, resolved.cards);
    if (!card) throw new Error(`Neutral theme final audit could not resolve main-deck card ${entry.name}.`);
    output.push({ card, quantity: entry.quantity, zone: 'main' });
  }
  return output;
}

async function compatiblePrintingFamilyTheme(
  intent: NeutralThemeIntentV15,
  options: NeutralThemedDeckBuildOptionsV15,
): Promise<{ compatible: boolean; effectivePrintingFamily: string | undefined; explanation?: string }> {
  if (intent.kind !== 'printing-family' || !intent.printingFamily) {
    return { compatible: true, effectivePrintingFamily: options.printingFamily };
  }
  const themed = await resolvePrintingPolicyV08({ printingFamily: intent.printingFamily });
  if (options.printingFamily) {
    const supplied = await resolvePrintingPolicyV08({ printingFamily: options.printingFamily });
    if (themed.familyPreset !== supplied.familyPreset) {
      return {
        compatible: false,
        effectivePrintingFamily: options.printingFamily,
        explanation: `Theme ${intent.canonicalLabel ?? intent.original} conflicts with printingFamily=${options.printingFamily}.`,
      };
    }
  }
  const familySetCodes = new Set(themed.familyMatchedSetCodes.map((set) => set.toLocaleLowerCase()));
  const conflictingSets = (options.allowedSets ?? []).filter((set) => !familySetCodes.has(set.trim().toLocaleLowerCase()));
  if (conflictingSets.length > 0) {
    return {
      compatible: false,
      effectivePrintingFamily: intent.printingFamily,
      explanation: `Theme ${intent.canonicalLabel ?? intent.original} conflicts with allowed set codes outside that printing family: ${conflictingSets.join(', ')}.`,
    };
  }
  return { compatible: true, effectivePrintingFamily: intent.printingFamily };
}

async function discoverThemeCandidatePool(
  commanders: ScryfallCard[],
  intent: NeutralThemeIntentV15,
  policy: ResolvedPrintingPolicyV08,
  options: NeutralThemedDeckBuildOptionsV15,
): Promise<{ cards: ScryfallCard[]; provenance: NeutralThemeCandidateProvenanceV15 }> {
  if (!intent.queryClause) {
    return {
      cards: [],
      provenance: {
        mode: 'controlled-theme-supplement',
        normalizedTheme: intent.canonicalLabel,
        generatedQueryClause: null,
        pagesFetched: 0,
        providerTotalCards: null,
        exhaustiveWithinBounds: true,
        sourceOrderedByEdhrec: true,
        constructionRankingUsesPopularity: false,
        eligibleThemeCandidates: 0,
        generatedThemeSeeds: 0,
        effectiveCandidateMaxUsdPerCard: neutralCandidatePriceCapV15(options) ?? null,
      },
    };
  }
  const colors = identity(commanders);
  const candidateCap = neutralCandidatePriceCapV15(options);
  const clauses = [
    intent.queryClause,
    'f:commander',
    'game:paper',
    identityQuery(colors),
    policy.searchClause,
    policy.includePromos ? '' : '-is:promo',
  ].filter(Boolean);
  const search = await boundedScryfallSearchV15(clauses.join(' '), {
    maxCards: 1_500,
    maxPages: 40,
    minRequestGapMs: 300,
    unique: candidateCap === undefined ? 'cards' : 'prints',
  });
  const specialSelectors = policy.exactSpecialPrintings.map((entry): CardIdentifierInput => ({
    name: entry.oracleName,
    set: entry.set,
    collectorNumber: entry.collectorNumber,
  }));
  const specials = specialSelectors.length > 0 ? await getCardsByIdentifiers(specialSelectors) : { cards: [], notFound: [] };
  if (specials.notFound.length > 0) throw new Error(`Neutral theme curated special-printing resolution failed: ${specials.notFound.join(', ')}`);
  const eligible = [...search.cards, ...specials.cards]
    .filter((card) => !card.type_line.toLocaleLowerCase().includes('land'))
    .filter((card) => legalIdentity(card, colors))
    .filter((card) => printingMatchesPolicyV08(card, policy))
    .filter((card) => cardMatchesNeutralThemeV15(card, intent))
    .filter((card) => exactCandidateWithinCap(card, candidateCap));
  return {
    cards: eligible,
    provenance: {
      mode: 'controlled-theme-supplement',
      normalizedTheme: intent.canonicalLabel,
      generatedQueryClause: intent.queryClause,
      pagesFetched: search.pagesFetched,
      providerTotalCards: search.providerTotalCards,
      exhaustiveWithinBounds: search.exhaustiveWithinBounds,
      sourceOrderedByEdhrec: true,
      constructionRankingUsesPopularity: false,
      eligibleThemeCandidates: new Set(eligible.map(oracleKey)).size,
      generatedThemeSeeds: 0,
      effectiveCandidateMaxUsdPerCard: candidateCap ?? null,
    },
  };
}

export async function buildNeutralThemedCommanderDeckV15(
  commanderNames: string[],
  options: NeutralThemedDeckBuildOptionsV15,
): Promise<Record<string, unknown>> {
  const themeIntent = await resolveNeutralThemeIntentV15(options.themeQuery);
  if (themeIntent.enforceability === 'verification-unavailable') {
    return {
      status: 'neutral-theme-verification-unavailable',
      constructionIntent: 'neutral-themed',
      themeIntent,
      guidance: themeIntent.explanation,
    };
  }
  if (themeIntent.enforceability === 'unsupported') {
    return {
      status: 'unsupported-neutral-theme',
      constructionIntent: 'neutral-themed',
      themeIntent,
      guidance: themeIntent.explanation,
    };
  }

  const familyCompatibility = await compatiblePrintingFamilyTheme(themeIntent, options);
  if (!familyCompatibility.compatible) {
    return {
      status: 'neutral-theme-constraint-conflict',
      constructionIntent: 'neutral-themed',
      themeIntent,
      guidance: familyCompatibility.explanation,
    };
  }
  const effectiveOptions: NeutralDeckBuildOptionsV15 = {
    ...options,
    ...(familyCompatibility.effectivePrintingFamily ? { printingFamily: familyCompatibility.effectivePrintingFamily } : {}),
  };

  let generatedThemeSeedNames: string[] = [];
  let themeCandidateProvenance: NeutralThemeCandidateProvenanceV15 = {
    mode: 'controlled-theme-supplement',
    normalizedTheme: themeIntent.canonicalLabel,
    generatedQueryClause: themeIntent.queryClause,
    pagesFetched: 0,
    providerTotalCards: null,
    exhaustiveWithinBounds: true,
    sourceOrderedByEdhrec: true,
    constructionRankingUsesPopularity: false,
    eligibleThemeCandidates: 0,
    generatedThemeSeeds: 0,
    effectiveCandidateMaxUsdPerCard: neutralCandidatePriceCapV15(effectiveOptions) ?? null,
  };

  if (themeIntent.enforceability === 'full') {
    const commanders = await resolveCommanderOracleCards(commanderNames);
    const policy = await resolvePrintingPolicyV08(effectiveOptions);
    const alreadyMatching = await resolveExistingMatchingMustIncludes(
      effectiveOptions.mustInclude ?? [],
      commanderNames,
      themeIntent,
    );
    const needed = Math.max(0, themeIntent.minimumMainMatches - alreadyMatching);
    if (needed > 0) {
      let discovered: Awaited<ReturnType<typeof discoverThemeCandidatePool>>;
      try {
        discovered = await discoverThemeCandidatePool(commanders, themeIntent, policy, options);
      } catch (error) {
        return {
          status: 'neutral-theme-candidate-verification-unavailable',
          constructionIntent: 'neutral-themed',
          themeIntent,
          guidance: `Theme candidate discovery was incomplete/unavailable: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
      const protectedNames = [...commanderNames, ...(effectiveOptions.mustInclude ?? [])];
      const selectedSeeds = selectNeutralThemeSeedCandidatesV15(discovered.cards, themeIntent, {
        archetype: effectiveOptions.archetype,
        needed,
        excludedNames: effectiveOptions.excludedCards ?? [],
        protectedNames,
      });
      themeCandidateProvenance = {
        ...discovered.provenance,
        generatedThemeSeeds: selectedSeeds.length,
      };
      if (selectedSeeds.length < needed) {
        return {
          status: 'neutral-theme-candidate-pool-insufficient',
          constructionIntent: 'neutral-themed',
          themeIntent,
          themeCandidateProvenance,
          requiredAdditionalThemeCards: needed,
          selectedAdditionalThemeCards: selectedSeeds.length,
          guidance: 'A completed bounded theme search found too few legal, printing-policy-compliant, budget-compliant nonland cards to guarantee the requested theme density.',
        };
      }
      generatedThemeSeedNames = selectedSeeds.map((card) => card.name);
    }
  }

  const combinedMustInclude = [...new Map([
    ...(effectiveOptions.mustInclude ?? []),
    ...generatedThemeSeedNames,
  ].map((name) => [normalize(name), name.trim()])).values()].filter(Boolean);
  const built = await buildNeutralCommanderDeckV15(commanderNames, {
    ...effectiveOptions,
    ...(combinedMustInclude.length > 0 ? { mustInclude: combinedMustInclude } : {}),
  });
  const decklist = typeof built.decklist === 'string' ? built.decklist : '';
  if (!decklist.trim()) {
    return {
      ...built,
      themeIntent,
      themeCandidateProvenance,
      generatedThemeSeedNames,
      guidance: 'The underlying neutral builder did not emit a decklist, so the theme cannot be independently audited.',
    };
  }

  const finalEntries = await resolveFinalThemeEntries(decklist);
  const printingPolicySatisfied = built.printingPolicySatisfied === true;
  const themeAudit = auditNeutralThemeV15(finalEntries, themeIntent, {
    printingPolicySatisfied,
    activePrintingFamily: familyCompatibility.effectivePrintingFamily ?? null,
  });
  const candidateCap = neutralCandidatePriceCapV15(effectiveOptions);
  const generatedSeedSet = new Set(generatedThemeSeedNames.map(normalize));
  const generatedThemeSeedBudgetSatisfied = candidateCap === undefined || finalEntries
    .filter((entry) => entry.zone === 'main' && generatedSeedSet.has(normalize(entry.card.name)))
    .every((entry) => exactPrintingBudgetWitnessV15(entry.card, candidateCap).status === 'within-cap');
  const baseComplete = built.status === 'complete-neutral-draft';
  const complete = baseComplete && themeAudit.satisfied && generatedThemeSeedBudgetSatisfied;

  return {
    ...built,
    status: complete ? 'complete-neutral-themed-draft' : 'incomplete-neutral-themed-draft',
    constructionIntent: 'neutral-themed',
    themeIntent,
    themeAudit,
    themeCandidateProvenance,
    generatedThemeSeedNames,
    generatedThemeSeedBudgetSatisfied,
    constraints: {
      ...((built.constraints && typeof built.constraints === 'object') ? built.constraints as Record<string, unknown> : {}),
      themeQuery: options.themeQuery,
      normalizedTheme: themeIntent.canonicalLabel,
      themeKind: themeIntent.kind,
      themeMinimumMainMatches: themeIntent.minimumMainMatches,
    },
    constructionExplanation: [
      ...(Array.isArray(built.constructionExplanation) ? built.constructionExplanation : []),
      themeIntent.explanation,
      themeIntent.enforceability === 'full'
        ? `The adapter generated ${generatedThemeSeedNames.length} bounded theme seed(s), routed them through the existing exact-printing/budget/must-include machinery, and independently audited the final 99/98-card main deck for at least ${themeIntent.minimumMainMatches} theme matches.`
        : 'The free-form theme delegates to the existing exact physical-printing policy and is independently checked after construction.',
      'The original free-form user text is never executed directly as Scryfall query grammar.',
    ],
  };
}
