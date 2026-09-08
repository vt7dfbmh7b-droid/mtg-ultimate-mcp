export interface ReplacementIdentitySignalV15 {
  /** Whether the card matches the active caller-controlled requested theme. */
  matchesControlledTheme?: boolean;
  /** Exact active requested-theme component IDs supported by this card, when known. */
  matchedRequestedComponentIds?: unknown;
  /** Substantive commander/deck-strategy overlap already inferred by V0.15. */
  substantiveStrategyAffinity?: number;
  /** Advisory payoff/engine/commander-shape relationship strength within the requested plan. */
  requestedRelationshipAffinity?: number;
}

export interface ReplacementIdentityPriorityV15 {
  requestedThemeDelta: number;
  requestedComponentLossCount: number;
  requestedComponentGainCount: number;
  requestedComponentPreservedCount: number;
  requestedRelationshipLossCount: number;
  requestedRelationshipGainCount: number;
  requestedRelationshipPreservedCount: number;
  substantiveStrategyAffinityDelta: number;
  requestedRelationshipAffinityDelta: number;
  identityErosion: number;
  identityGain: number;
  verdict: 'identity-improving' | 'identity-neutral' | 'identity-eroding';
}

function finiteNonNegative(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function normalizedRequestedComponentIds(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toLocaleLowerCase())
    .filter(Boolean));
}

function requestedRelationshipIds(componentIds: ReadonlySet<string>): Set<string> {
  return new Set([...componentIds].filter((id) => id.startsWith('relation:')));
}

/**
 * Compare relative requested/deck identity after all hard legality, structural, package,
 * target-progress, and preservation gates have already admitted the swap. Exact requested
 * component and relationship loss are deliberately advisory: they change replacement priority
 * but never make a theme card uncuttable and never weaken an authoritative target gate.
 */
export function replacementIdentityPriorityV15(
  add: ReplacementIdentitySignalV15,
  cut: ReplacementIdentitySignalV15,
): ReplacementIdentityPriorityV15 {
  const addTheme = add.matchesControlledTheme === true ? 1 : 0;
  const cutTheme = cut.matchesControlledTheme === true ? 1 : 0;
  const requestedThemeDelta = addTheme - cutTheme;
  const addComponents = normalizedRequestedComponentIds(add.matchedRequestedComponentIds);
  const cutComponents = normalizedRequestedComponentIds(cut.matchedRequestedComponentIds);
  const requestedComponentLossCount = [...cutComponents].filter((id) => !addComponents.has(id)).length;
  const requestedComponentGainCount = [...addComponents].filter((id) => !cutComponents.has(id)).length;
  const requestedComponentPreservedCount = [...cutComponents].filter((id) => addComponents.has(id)).length;
  const addRelationships = requestedRelationshipIds(addComponents);
  const cutRelationships = requestedRelationshipIds(cutComponents);
  const requestedRelationshipLossCount = [...cutRelationships].filter((id) => !addRelationships.has(id)).length;
  const requestedRelationshipGainCount = [...addRelationships].filter((id) => !cutRelationships.has(id)).length;
  const requestedRelationshipPreservedCount = [...cutRelationships].filter((id) => addRelationships.has(id)).length;
  const substantiveStrategyAffinityDelta = Number((
    finiteNonNegative(add.substantiveStrategyAffinity)
      - finiteNonNegative(cut.substantiveStrategyAffinity)
  ).toFixed(3));
  const requestedRelationshipAffinityDelta = Number((
    finiteNonNegative(add.requestedRelationshipAffinity)
      - finiteNonNegative(cut.requestedRelationshipAffinity)
  ).toFixed(3));

  const netBroadIdentityDelta = Number((
    requestedThemeDelta + substantiveStrategyAffinityDelta + requestedRelationshipAffinityDelta
  ).toFixed(3));
  const identityErosion = Number((
    Math.max(0, -netBroadIdentityDelta) + requestedComponentLossCount
  ).toFixed(3));
  const identityGain = Number((
    Math.max(0, netBroadIdentityDelta) + requestedComponentGainCount
  ).toFixed(3));

  return {
    requestedThemeDelta,
    requestedComponentLossCount,
    requestedComponentGainCount,
    requestedComponentPreservedCount,
    requestedRelationshipLossCount,
    requestedRelationshipGainCount,
    requestedRelationshipPreservedCount,
    substantiveStrategyAffinityDelta,
    requestedRelationshipAffinityDelta,
    identityErosion,
    identityGain,
    verdict: identityErosion > 0
      ? 'identity-eroding'
      : identityGain > 0
        ? 'identity-improving'
        : 'identity-neutral',
  };
}

/**
 * Typed requested relationships represent the concrete engine/payoff/commander-shape mechanism
 * inside a broad requested component. Prefer preserving those mechanisms before comparing broad
 * identity erosion/gain. This remains advisory: when every eligible cut loses the relationship,
 * downstream structural/curve/cut-pressure ranking still decides the replacement.
 */
export function compareReplacementIdentityPriorityV15(
  left: ReplacementIdentityPriorityV15,
  right: ReplacementIdentityPriorityV15,
): number {
  if (left.requestedRelationshipLossCount !== right.requestedRelationshipLossCount) {
    return left.requestedRelationshipLossCount - right.requestedRelationshipLossCount;
  }
  if (left.identityErosion !== right.identityErosion) {
    return left.identityErosion - right.identityErosion;
  }
  if (left.requestedRelationshipGainCount !== right.requestedRelationshipGainCount) {
    return right.requestedRelationshipGainCount - left.requestedRelationshipGainCount;
  }
  if (left.identityGain !== right.identityGain) {
    return right.identityGain - left.identityGain;
  }
  return 0;
}
