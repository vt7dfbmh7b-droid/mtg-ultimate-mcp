export interface RestrictedWinPackagePrefilterAuditV15 {
  candidatesBefore: number;
  candidatesAfter: number;
  rejectedCandidates: number;
  eligibleCardNames: number;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function candidateNames(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const names = (value as Record<string, unknown>).names;
  return Array.isArray(names) ? names.filter((name): name is string => typeof name === 'string' && name.trim().length > 0) : [];
}

/**
 * Conservative early rejection for a restricted physical-printing pool. Commander cards are
 * allowed independently because their exact selected printings were already resolved by the
 * caller. Every non-commander combo piece must be represented in the eligible pool before the
 * more expensive final Oracle/printing verification is attempted.
 */
export function prefilterRestrictedWinPackageCandidatesV15<T>(
  candidates: readonly T[],
  commanderNames: readonly string[],
  eligibleCardNames: readonly string[],
): { candidates: T[]; audit: RestrictedWinPackagePrefilterAuditV15 } {
  const commanders = new Set(commanderNames.map(normalize));
  const eligible = new Set(eligibleCardNames.map(normalize));
  const filtered = candidates.filter((candidate) => {
    const names = candidateNames(candidate);
    if (names.length === 0) return false;
    return names.every((name) => commanders.has(normalize(name)) || eligible.has(normalize(name)));
  });
  return {
    candidates: filtered,
    audit: {
      candidatesBefore: candidates.length,
      candidatesAfter: filtered.length,
      rejectedCandidates: candidates.length - filtered.length,
      eligibleCardNames: eligible.size,
    },
  };
}
