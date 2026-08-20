import type { GeneralWinPackageCandidateV15 } from './general-win-package-v15.js';

export interface CommanderTargetPressureV15 {
  targetBracket: number;
  minimumFreeInteraction: number;
  verifiedWinningPackageRequired: boolean;
  competitiveComboSignalRequired: boolean;
  preferRuthlessPackage: boolean;
}

function boundedBracket(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 4;
  return Math.max(1, Math.min(5, Math.trunc(value)));
}

/**
 * Re-express only hard target pressure already present in the V0.15 bracket assessment.
 * This is an adapter for candidate selection, not a new bracket model or power score.
 */
export function commanderTargetPressureV15(targetBracket: number | null | undefined): CommanderTargetPressureV15 {
  const target = boundedBracket(targetBracket);
  if (target < 5) {
    return {
      targetBracket: target,
      minimumFreeInteraction: 0,
      verifiedWinningPackageRequired: false,
      competitiveComboSignalRequired: false,
      preferRuthlessPackage: false,
    };
  }
  return {
    targetBracket: target,
    minimumFreeInteraction: 1,
    verifiedWinningPackageRequired: true,
    competitiveComboSignalRequired: true,
    preferRuthlessPackage: true,
  };
}

/**
 * Keep the existing V0.15 package ordering, except that a Bracket-5 target explicitly prefers
 * an R-tagged candidate because the existing Bracket-5 assessor requires a competitive combo signal.
 * If no R-tagged package exists, fall back to the package already selected by the existing portfolio.
 */
export function selectTargetAwareWinPackageV15(
  targetBracket: number | null | undefined,
  candidates: readonly GeneralWinPackageCandidateV15[],
  existingSelected: GeneralWinPackageCandidateV15 | null,
): GeneralWinPackageCandidateV15 | null {
  const pressure = commanderTargetPressureV15(targetBracket);
  if (!pressure.preferRuthlessPackage) return existingSelected;
  return candidates.find((candidate) => String(candidate.bracketTag ?? '').toUpperCase() === 'R') ?? existingSelected;
}
