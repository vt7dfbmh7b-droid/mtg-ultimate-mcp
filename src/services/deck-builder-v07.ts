import type { ScryfallCard } from '../types/scryfall.js';
import type { ParsedDeck } from './deck.js';
import {
  buildSimulationBackedUpgradePlanV07 as buildSimulationBackedUpgradePlanCoreV07,
  pairUpgradeSwapsByStructureV15 as pairUpgradeSwapsByStructureCoreV15,
} from './deck-builder-v07-core.js';
import type { UpgradePlanOptionsV07 } from './deck-builder-v07-core.js';

export * from './deck-builder-v07-core.js';

type UpgradePairingOptionsCoreV15 = NonNullable<Parameters<typeof pairUpgradeSwapsByStructureCoreV15>[5]>;
type ContextCardV15 = Record<string, unknown>;

type UpgradePairingOptionsContextV15 = UpgradePairingOptionsCoreV15 & {
  /** Resolved baseline cards used only for conservative contextual setup/effectiveness checks. */
  contextualDeckCards?: readonly ContextCardV15[];
  /** Current counts for typed requested mechanisms, keyed by relation:* component id. */
  contextualRelationshipCounts?: Readonly<Record<string, number>>;
  /** Current counts for requested theme/mechanism components used to prefer the weakest component. */
  contextualComponentCounts?: Readonly<Record<string, number>>;
};

function recordObjectV15(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function recordStringV15(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function recordNumberV15(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function recordStringsV15(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function summarizedCardV15(item: Record<string, unknown>): Record<string, unknown> {
  const card = item.card;
  return card && typeof card === 'object' && !Array.isArray(card) ? card as Record<string, unknown> : {};
}

function requestedComponentIdsV15(item: Record<string, unknown>): string[] {
  return [...new Set(recordStringsV15(recordObjectV15(item.explicitTheme).matchedComponentIds))]
    .sort((left, right) => left.localeCompare(right));
}

function requestedRelationshipIdsV15(item: Record<string, unknown>): string[] {
  return requestedComponentIdsV15(item).filter((id) => id.startsWith('relation:'));
}

function requestedRelationshipAffinityV15(item: Record<string, unknown>): number {
  return recordNumberV15(recordObjectV15(item.explicitTheme).requestedRelationshipAffinity);
}

function authoritativeTargetGateV15(item: Record<string, unknown>): string {
  return recordStringV15(item.authoritativeTargetGate);
}

function hasUncompensatedStrongRelationshipV15(
  cut: Record<string, unknown>,
  availableReplacementRelationships: ReadonlySet<string>,
): boolean {
  if (requestedRelationshipAffinityV15(cut) < 4) return false;
  const relationships = requestedRelationshipIdsV15(cut);
  return relationships.length > 0 && relationships.some((id) => !availableReplacementRelationships.has(id));
}

const CONTEXTUAL_PERMANENT_TYPE_WORDS_V15 = new Set([
  'artifact', 'battle', 'creature', 'enchantment', 'land', 'permanent', 'planeswalker',
]);
const CONTEXTUAL_PERMANENT_QUALIFIER_WORDS_V15 = new Set(['basic', 'legendary', 'snow']);
const CONTEXTUAL_IGNORED_REQUIREMENT_WORDS_V15 = new Set(['a', 'an', 'another', 'target']);

function descriptorMatchesContextCardV15(descriptor: string, card: ContextCardV15): boolean | null {
  const normalized = descriptor
    .toLocaleLowerCase()
    .replace(/[(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return null;
  const tokens = normalized.split(' ').filter((token) => !CONTEXTUAL_IGNORED_REQUIREMENT_WORDS_V15.has(token));
  if (tokens.length === 0) return null;
  if (tokens.some((token) => !CONTEXTUAL_PERMANENT_TYPE_WORDS_V15.has(token)
    && !CONTEXTUAL_PERMANENT_QUALIFIER_WORDS_V15.has(token))) return null;

  const typeLine = recordStringV15(card.typeLine).toLocaleLowerCase();
  if (!typeLine) return null;
  for (const token of tokens) {
    if (token === 'permanent') {
      if (typeLine.includes('instant') || typeLine.includes('sorcery')) return false;
      continue;
    }
    if (!typeLine.includes(token)) return false;
  }
  return true;
}

function candidateSelfTargetSetupSupportedV15(
  item: Record<string, unknown>,
  contextualDeckCards: readonly ContextCardV15[],
): boolean {
  const oracleText = recordStringV15(summarizedCardV15(item).oracleText);
  if (!oracleText || contextualDeckCards.length === 0) return true;
  const controlledEnchantLines = oracleText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => /^enchant\s+(.+?)\s+you\s+(?:control|own)$/i.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match));
  if (controlledEnchantLines.length === 0) return true;

  for (const match of controlledEnchantLines) {
    const descriptor = recordStringV15(match[1]);
    const alternatives = descriptor.split(/\s+or\s+/i).map((part) => part.trim()).filter(Boolean);
    let parsedAnyAlternative = false;
    let supported = false;
    for (const alternative of alternatives) {
      const results = contextualDeckCards.map((card) => descriptorMatchesContextCardV15(alternative, card));
      if (results.some((result) => result !== null)) parsedAnyAlternative = true;
      if (results.some((result) => result === true)) {
        supported = true;
        break;
      }
    }
    // Unknown/complex Oracle shapes are left eligible. Only a confidently parsed absent setup is gated.
    if (parsedAnyAlternative && !supported) return false;
  }
  return true;
}

function normalizedPermanentDescriptorV15(raw: string): string {
  const normalized = raw.trim().toLocaleLowerCase();
  if (normalized === 'permanents') return 'permanent';
  if (normalized.endsWith('s')) return normalized.slice(0, -1);
  return normalized;
}

function candidateContextualRoleEffectiveV15(
  item: Record<string, unknown>,
  contextualDeckCards: readonly ContextCardV15[],
): boolean {
  if (contextualDeckCards.length === 0) return true;
  const oracleText = recordStringV15(summarizedCardV15(item).oracleText);
  if (!oracleText) return true;

  // Static protection for a controlled permanent class is useful only when that class exists.
  // Complex/unknown protection text remains eligible; this gate is deliberately fail-open unless
  // the protected class can be parsed confidently.
  const staticProtection = /\b(?:other\s+)?(artifacts?|battles?|creatures?|enchantments?|lands?|permanents?|planeswalkers?)\s+you\s+control\s+(?:have|gain)\s+(?:[^.]*\b)?(?:hexproof|indestructible|ward\b)/i.exec(oracleText);
  if (!staticProtection) return true;
  const descriptor = normalizedPermanentDescriptorV15(recordStringV15(staticProtection[1]));
  if (!CONTEXTUAL_PERMANENT_TYPE_WORDS_V15.has(descriptor)) return true;
  const results = contextualDeckCards.map((card) => descriptorMatchesContextCardV15(descriptor, card));
  return results.some((result) => result === true) || results.every((result) => result === null);
}

function relationshipCountsFromCutsV15(cutPool: Array<Record<string, unknown>>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const cut of cutPool) {
    for (const id of requestedRelationshipIdsV15(cut)) counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

function contextuallyDominantAdditionsV15(
  additions: Parameters<typeof pairUpgradeSwapsByStructureCoreV15>[0],
  cuts: Parameters<typeof pairUpgradeSwapsByStructureCoreV15>[1],
  componentCounts: Readonly<Record<string, number>>,
): Parameters<typeof pairUpgradeSwapsByStructureCoreV15>[0] {
  let remaining = [...additions];
  const strongCutRelationships = new Set(
    cuts.flatMap((cut) => requestedRelationshipAffinityV15(cut) >= 4 ? requestedRelationshipIdsV15(cut) : []),
  );
  const gates = [...new Set(remaining.map((selection) => authoritativeTargetGateV15(selection.candidate)).filter(Boolean))];

  for (const gate of gates) {
    const sameGate = remaining.filter((selection) => authoritativeTargetGateV15(selection.candidate) === gate);
    if (sameGate.length <= 1) continue;

    const relationshipMatches = sameGate.filter((selection) => (
      requestedRelationshipIdsV15(selection.candidate).some((id) => strongCutRelationships.has(id))
    ));
    if (strongCutRelationships.size > 0 && relationshipMatches.length > 0) {
      const allowed = new Set(relationshipMatches);
      remaining = remaining.filter((selection) => (
        authoritativeTargetGateV15(selection.candidate) !== gate || allowed.has(selection)
      ));
    }

    const afterRelationship = remaining.filter((selection) => authoritativeTargetGateV15(selection.candidate) === gate);
    const componentCandidates = afterRelationship
      .map((selection) => ({
        selection,
        counts: requestedComponentIdsV15(selection.candidate)
          .filter((id) => !id.startsWith('relation:') && componentCounts[id] !== undefined)
          .map((id) => componentCounts[id] ?? 0),
      }))
      .filter((entry) => entry.counts.length > 0);
    if (componentCandidates.length > 1) {
      const weakestCount = Math.min(...componentCandidates.flatMap((entry) => entry.counts));
      const weakest = componentCandidates.filter((entry) => entry.counts.includes(weakestCount));
      if (weakest.length > 0 && weakest.length < afterRelationship.length) {
        const allowed = new Set(weakest.map((entry) => entry.selection));
        remaining = remaining.filter((selection) => (
          authoritativeTargetGateV15(selection.candidate) !== gate || allowed.has(selection)
        ));
      }
    }

    const afterComponent = remaining.filter((selection) => authoritativeTargetGateV15(selection.candidate) === gate);
    if (gate === 'cheap-interaction' && afterComponent.length > 1) {
      const minimumManaValue = Math.min(...afterComponent.map((selection) => (
        recordNumberV15(summarizedCardV15(selection.candidate).manaValue)
      )));
      const allowed = new Set(afterComponent.filter((selection) => (
        recordNumberV15(summarizedCardV15(selection.candidate).manaValue) === minimumManaValue
      )));
      remaining = remaining.filter((selection) => (
        authoritativeTargetGateV15(selection.candidate) !== gate || allowed.has(selection)
      ));
    }
  }
  return remaining;
}

export function pairUpgradeSwapsByStructureV15(
  additions: Parameters<typeof pairUpgradeSwapsByStructureCoreV15>[0],
  cutPool: Parameters<typeof pairUpgradeSwapsByStructureCoreV15>[1],
  currentMetrics: Parameters<typeof pairUpgradeSwapsByStructureCoreV15>[2],
  structuralTargets: Parameters<typeof pairUpgradeSwapsByStructureCoreV15>[3],
  targetBracket = 5,
  options: UpgradePairingOptionsContextV15 = {},
): ReturnType<typeof pairUpgradeSwapsByStructureCoreV15> {
  const contextualDeckCards = options.contextualDeckCards ?? [];
  const supportedAdditions = additions.filter((selection) => (
    candidateSelfTargetSetupSupportedV15(selection.candidate, contextualDeckCards)
    && candidateContextualRoleEffectiveV15(selection.candidate, contextualDeckCards)
  ));
  const availableAddRelationships = new Set(
    supportedAdditions.flatMap((selection) => requestedRelationshipIdsV15(selection.candidate)),
  );
  const relationshipCounts = options.contextualRelationshipCounts ?? relationshipCountsFromCutsV15(cutPool);
  const advisoryContextSafeCuts = cutPool.filter((cut) => (
    !hasUncompensatedStrongRelationshipV15(cut, availableAddRelationships)
    && requestedRelationshipIdsV15(cut).every((id) => (
      (relationshipCounts[id] ?? 0) > 1 || availableAddRelationships.has(id)
    ))
  ));
  // Strong engine/payoff relationships are protected while a weaker fallback exists. If every
  // structural fallback carries the same loss, keep the established advisory behavior rather
  // than turning requested identity into an absolute hard freeze.
  const contextSafeCuts = advisoryContextSafeCuts.length > 0 ? advisoryContextSafeCuts : cutPool;
  const contextRankedAdditions = contextuallyDominantAdditionsV15(
    supportedAdditions,
    contextSafeCuts,
    options.contextualComponentCounts ?? {},
  );
  const {
    contextualDeckCards: _contextualDeckCards,
    contextualRelationshipCounts: _contextualRelationshipCounts,
    contextualComponentCounts: _contextualComponentCounts,
    ...coreOptions
  } = options;
  return pairUpgradeSwapsByStructureCoreV15(
    contextRankedAdditions,
    contextSafeCuts,
    currentMetrics,
    structuralTargets,
    targetBracket,
    coreOptions,
  );
}

function upgradeCandidateItemsV15(sourceUpgradeAnalysis: Record<string, unknown>): Array<Record<string, unknown>> {
  const groups = Array.isArray(sourceUpgradeAnalysis.candidateAddsByDeficit)
    ? sourceUpgradeAnalysis.candidateAddsByDeficit as Array<Record<string, unknown>>
    : [];
  return groups.flatMap((group) => (
    Array.isArray(group.candidates) ? group.candidates as Array<Record<string, unknown>> : []
  ));
}

function contextualDeckCardsFromResolvedV15(cards: ScryfallCard[]): ContextCardV15[] {
  return cards.map((card) => ({
    name: card.name,
    typeLine: card.type_line,
    oracleText: card.oracle_text ?? '',
  }));
}

interface ContextualPlanGuardsV15 {
  invalidSelected: boolean;
  excludedCandidateNames: string[];
  protectedCutNames: string[];
}

function contextualPlanGuardsV15(
  plan: Record<string, unknown>,
  cards: ScryfallCard[],
): ContextualPlanGuardsV15 {
  const source = recordObjectV15(plan.sourceUpgradeAnalysis);
  const candidates = upgradeCandidateItemsV15(source);
  const cuts = Array.isArray(source.candidateCuts) ? source.candidateCuts as Array<Record<string, unknown>> : [];
  const contextCards = contextualDeckCardsFromResolvedV15(cards);
  const candidateByName = new Map<string, Record<string, unknown>>();
  const unsupportedNames = new Set<string>();
  for (const candidate of candidates) {
    const name = recordStringV15(summarizedCardV15(candidate).name);
    if (!name) continue;
    candidateByName.set(name.toLocaleLowerCase(), candidate);
    if (!candidateSelfTargetSetupSupportedV15(candidate, contextCards)
      || !candidateContextualRoleEffectiveV15(candidate, contextCards)) unsupportedNames.add(name);
  }

  const cutByName = new Map<string, Record<string, unknown>>();
  const relationshipCounts = relationshipCountsFromCutsV15(cuts);
  for (const cut of cuts) {
    const name = recordStringV15(summarizedCardV15(cut).name);
    if (name) cutByName.set(name.toLocaleLowerCase(), cut);
  }
  const supportedCandidateRelationships = new Set(
    candidates
      .filter((candidate) => candidateSelfTargetSetupSupportedV15(candidate, contextCards)
        && candidateContextualRoleEffectiveV15(candidate, contextCards))
      .flatMap(requestedRelationshipIdsV15),
  );
  const protectedNames = new Set<string>();
  for (const cut of cuts) {
    const name = recordStringV15(summarizedCardV15(cut).name);
    if (!name) continue;
    const uncompensatedUniqueRelationship = requestedRelationshipIdsV15(cut).some((id) => (
      (relationshipCounts[id] ?? 0) <= 1 && !supportedCandidateRelationships.has(id)
    ));
    const uncompensatedStrongRelationship = hasUncompensatedStrongRelationshipV15(
      cut,
      supportedCandidateRelationships,
    );
    if (uncompensatedUniqueRelationship || uncompensatedStrongRelationship) protectedNames.add(name);
  }

  let invalidSelected = false;
  const swaps = Array.isArray(plan.swaps) ? plan.swaps as Array<Record<string, unknown>> : [];
  for (const swap of swaps) {
    const inName = recordStringV15(swap.in);
    const outName = recordStringV15(swap.out);
    if (inName && [...unsupportedNames].some((name) => name.toLocaleLowerCase() === inName.toLocaleLowerCase())) {
      invalidSelected = true;
    }
    const cut = cutByName.get(outName.toLocaleLowerCase());
    const add = candidateByName.get(inName.toLocaleLowerCase());
    if (!cut) continue;
    const addRelationships = new Set(add ? requestedRelationshipIdsV15(add) : []);
    const uncompensatedUniqueRelationship = requestedRelationshipIdsV15(cut).some((id) => (
      (relationshipCounts[id] ?? 0) <= 1 && !addRelationships.has(id)
    ));
    const uncompensatedStrongRelationship = hasUncompensatedStrongRelationshipV15(cut, addRelationships);
    if (uncompensatedUniqueRelationship || uncompensatedStrongRelationship) {
      invalidSelected = true;
      if (outName) protectedNames.add(outName);
    }
  }

  return {
    invalidSelected,
    excludedCandidateNames: [...unsupportedNames].sort((left, right) => left.localeCompare(right)),
    protectedCutNames: [...protectedNames].sort((left, right) => left.localeCompare(right)),
  };
}

function mergeNamesV15(...groups: Array<readonly string[] | undefined>): string[] {
  const byKey = new Map<string, string>();
  for (const name of groups.flatMap((group) => group ?? [])) {
    const trimmed = name.trim();
    if (trimmed) byKey.set(trimmed.toLocaleLowerCase(), trimmed);
  }
  return [...byKey.values()].sort((left, right) => left.localeCompare(right));
}

export async function buildSimulationBackedUpgradePlanV07(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  allowedIdentity: string[],
  options: UpgradePlanOptionsV07 = {},
): Promise<Record<string, unknown>> {
  let effectiveOptions: UpgradePlanOptionsV07 = { ...options };
  let plan = await buildSimulationBackedUpgradePlanCoreV07(parsed, cards, allowedIdentity, effectiveOptions);

  // The core remains the source of candidate generation, target pressure, pairing, legality and
  // simulation. The wrapper only reruns when the concrete proposed package demonstrates one of
  // the evidence-backed contextual defects, preserving all other established behavior.
  for (let correctionRound = 0; correctionRound < 2; correctionRound += 1) {
    const guards = contextualPlanGuardsV15(plan, cards);
    if (!guards.invalidSelected) return plan;
    effectiveOptions = {
      ...effectiveOptions,
      excludedCards: mergeNamesV15(effectiveOptions.excludedCards, guards.excludedCandidateNames),
      protectedCards: mergeNamesV15(effectiveOptions.protectedCards, guards.protectedCutNames),
    };
    plan = await buildSimulationBackedUpgradePlanCoreV07(parsed, cards, allowedIdentity, effectiveOptions);
  }
  return plan;
}
