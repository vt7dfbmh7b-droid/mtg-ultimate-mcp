import type { GeneralWinPackageCandidateV15 } from './general-win-package-v15.js';

export interface CommanderTargetPressureV15 {
  targetBracket: number;
  minimumFreeInteraction: number;
  verifiedWinningPackageRequired: boolean;
  competitiveComboSignalRequired: boolean;
  preferRuthlessPackage: boolean;
}

export interface InjectableWinPackageSelectionV15 {
  candidate: GeneralWinPackageCandidateV15;
  missingSeedNames: string[];
  existingComboCardNames: string[];
}

function boundedBracket(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 4;
  return Math.max(1, Math.min(5, Math.trunc(value)));
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
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

/**
 * Choose only among packages the current swap package can actually inject atomically. Bracket-5
 * R preference is applied after feasibility filtering, so an impossible larger R route cannot
 * hide a smaller verified route that can be installed now. Existing combo pieces are returned so
 * the caller can protect them from cuts while adding the missing seeds.
 */
export function selectInjectableTargetAwareWinPackageV15(input: {
  targetBracket: number | null | undefined;
  candidates: readonly GeneralWinPackageCandidateV15[];
  existingSelected: GeneralWinPackageCandidateV15 | null;
  existingCardNames: readonly string[];
  maxMissingSeedCards: number;
}): InjectableWinPackageSelectionV15 | null {
  const existing = new Set(input.existingCardNames.map(normalize));
  const capacity = Math.max(1, Math.trunc(input.maxMissingSeedCards));
  const feasible = input.candidates
    .map((candidate) => ({
      candidate,
      missingSeedNames: candidate.seedNames.filter((name) => !existing.has(normalize(name))),
      existingComboCardNames: candidate.comboCardNames.filter((name) => existing.has(normalize(name))),
    }))
    .filter((entry) => entry.missingSeedNames.length > 0 && entry.missingSeedNames.length <= capacity);
  if (feasible.length === 0) return null;

  const fallback = input.existingSelected
    ? feasible.find((entry) => entry.candidate.comboId === input.existingSelected?.comboId)?.candidate ?? feasible[0]!.candidate
    : feasible[0]!.candidate;
  const selected = selectTargetAwareWinPackageV15(
    input.targetBracket,
    feasible.map((entry) => entry.candidate),
    fallback,
  );
  if (!selected) return null;
  return feasible.find((entry) => entry.candidate.comboId === selected.comboId) ?? null;
}
