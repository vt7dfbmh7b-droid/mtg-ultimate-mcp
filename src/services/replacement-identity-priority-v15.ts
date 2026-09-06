export interface ReplacementIdentitySignalV15 {
  /** Whether the card matches the active caller-controlled requested theme. */
  matchesControlledTheme?: boolean;
  /** Substantive commander/deck-strategy overlap already inferred by V0.15. */
  substantiveStrategyAffinity?: number;
}

export interface ReplacementIdentityPriorityV15 {
  requestedThemeDelta: number;
  substantiveStrategyAffinityDelta: number;
  identityErosion: number;
  identityGain: number;
  verdict: 'identity-improving' | 'identity-neutral' | 'identity-eroding';
}

function finiteNonNegative(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Compare the relative identity value of an incoming card with the outgoing card after hard
 * legality, structural, package, target-progress, and preservation gates have already admitted
 * the swap. This is a ranking signal only: it never makes requested-theme cards uncuttable and
 * never weakens a hard target gate.
 *
 * A controlled-theme match contributes one discrete identity unit. Substantive V0.15 strategy
 * affinity is retained as a continuous signal. The comparator deliberately reports erosion and
 * gain separately so callers can prefer the least identity-destructive legal replacement before
 * using generic structural/cut-pressure tie-breaks.
 */
export function replacementIdentityPriorityV15(
  add: ReplacementIdentitySignalV15,
  cut: ReplacementIdentitySignalV15,
): ReplacementIdentityPriorityV15 {
  const addTheme = add.matchesControlledTheme === true ? 1 : 0;
  const cutTheme = cut.matchesControlledTheme === true ? 1 : 0;
  const requestedThemeDelta = addTheme - cutTheme;
  const substantiveStrategyAffinityDelta = Number((
    finiteNonNegative(add.substantiveStrategyAffinity)
      - finiteNonNegative(cut.substantiveStrategyAffinity)
  ).toFixed(3));

  const themeErosion = Math.max(0, -requestedThemeDelta);
  const themeGain = Math.max(0, requestedThemeDelta);
  const strategyErosion = Math.max(0, -substantiveStrategyAffinityDelta);
  const strategyGain = Math.max(0, substantiveStrategyAffinityDelta);
  const identityErosion = Number((themeErosion + strategyErosion).toFixed(3));
  const identityGain = Number((themeGain + strategyGain).toFixed(3));

  return {
    requestedThemeDelta,
    substantiveStrategyAffinityDelta,
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
 * Ordering helper for already-legal swap alternatives. Lower erosion wins first; when erosion is
 * equal, higher identity gain wins. Returning zero deliberately leaves every existing downstream
 * structural and heuristic tie-break unchanged.
 */
export function compareReplacementIdentityPriorityV15(
  left: ReplacementIdentityPriorityV15,
  right: ReplacementIdentityPriorityV15,
): number {
  if (left.identityErosion !== right.identityErosion) {
    return left.identityErosion - right.identityErosion;
  }
  if (left.identityGain !== right.identityGain) {
    return right.identityGain - left.identityGain;
  }
  return 0;
}
