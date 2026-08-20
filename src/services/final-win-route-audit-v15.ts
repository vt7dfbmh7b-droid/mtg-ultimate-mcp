import type { VerifiedWinningComboDetailV15 } from './commander-build-evaluation-v15.js';
import {
  buildWinPackagePortfolioV15,
  type WinPackagePortfolioV15,
  type WinPackagePortfolioCandidateV15,
} from './win-package-verification-v15.js';

export type FinalWinRouteAuditStatusV15 =
  | 'verification-unavailable'
  | 'no-full-table-win-verified'
  | 'single-route'
  | 'multiple-routes-independence-partial'
  | 'multiple-routes-analyzed';

export interface FinalWinRouteAuditV15 {
  status: FinalWinRouteAuditStatusV15;
  comboVerificationComplete: boolean;
  verifiedFullTableWinCount: number;
  explicitDependencyRouteCount: number;
  unresolvedDependencyRouteCount: number;
  preferredComboId: string | null;
  preferredComboVerified: boolean;
  portfolio: WinPackagePortfolioV15;
  unresolvedDependencyComboIds: string[];
  delayedWinComboIds: string[];
  resilienceSummary: string;
}

function scoreCandidate(detail: VerifiedWinningComboDetailV15, preferredComboId: string | null): number {
  const preferredBonus = detail.comboId === preferredComboId ? 5000 : 0;
  const immediateBonus = detail.closureTiming === 'immediate' ? 300 : detail.closureTiming === 'delayed' ? -150 : 0;
  const compactnessBonus = Math.max(0, 5 - detail.seedNames.length) * 100;
  const commanderReuseBonus = detail.comboCardNames.length > detail.seedNames.length ? 90 : 0;
  return 1000 + preferredBonus + immediateBonus + compactnessBonus + commanderReuseBonus;
}

function toPortfolioCandidate(
  detail: VerifiedWinningComboDetailV15,
  preferredComboId: string | null,
): WinPackagePortfolioCandidateV15 {
  return {
    comboId: detail.comboId,
    comboCardNames: detail.comboCardNames,
    seedNames: detail.seedNames,
    results: detail.results,
    score: scoreCandidate(detail, preferredComboId),
  };
}

/**
 * Audits redundancy from the finished 100-card deck, not from intended construction alone.
 *
 * Template requirements are deliberately excluded from independence claims because the summarized
 * Spellbook evidence does not bind a concrete satisfying card to that requirement. The combo may
 * still be a verified full-table win, but its disruption surface is reported as unresolved rather
 * than pretending two combo IDs are independent routes.
 */
export function auditFinalWinRoutesV15(input: {
  comboVerificationComplete: boolean;
  verifiedWinningComboDetails: readonly VerifiedWinningComboDetailV15[];
  preferredComboId?: string | null;
}): FinalWinRouteAuditV15 {
  const preferredComboId = input.preferredComboId?.trim() || null;
  const details = [...input.verifiedWinningComboDetails]
    .sort((a, b) => a.comboId.localeCompare(b.comboId));
  const preferredComboVerified = preferredComboId !== null
    && details.some((detail) => detail.comboId === preferredComboId);
  const explicit = details.filter((detail) =>
    detail.dependencyCompleteness === 'explicit-cards-only' && detail.comboCardNames.length > 0);
  const unresolved = details.filter((detail) =>
    detail.dependencyCompleteness !== 'explicit-cards-only' || detail.comboCardNames.length === 0);
  const portfolio = buildWinPackagePortfolioV15(explicit.map((detail) => toPortfolioCandidate(detail, preferredComboId)));
  const unresolvedDependencyComboIds = unresolved.map((detail) => detail.comboId);
  const delayedWinComboIds = details
    .filter((detail) => detail.closureTiming === 'delayed')
    .map((detail) => detail.comboId);

  let status: FinalWinRouteAuditStatusV15;
  if (!input.comboVerificationComplete) status = 'verification-unavailable';
  else if (details.length === 0) status = 'no-full-table-win-verified';
  else if (details.length === 1) status = 'single-route';
  else if (unresolved.length > 0 || explicit.length < 2) status = 'multiple-routes-independence-partial';
  else status = 'multiple-routes-analyzed';

  let resilienceSummary: string;
  if (!input.comboVerificationComplete) {
    resilienceSummary = 'Combo verification was unavailable, so the finished deck receives no positive redundancy claim.';
  } else if (details.length === 0) {
    resilienceSummary = 'No full-table deterministic combo route was verified in the finished deck.';
  } else if (details.length === 1) {
    resilienceSummary = 'Exactly one full-table deterministic combo route was verified; no combo-backup resilience is claimed.';
  } else if (unresolved.length > 0 || explicit.length < 2) {
    resilienceSummary = `${details.length} full-table win routes were verified, but ${unresolved.length} route${unresolved.length === 1 ? ' has' : 's have'} template or unresolved dependencies, so complete independence cannot be claimed.`;
  } else if (portfolio.resilienceBand === 'independent-backup') {
    resilienceSummary = 'The finished deck has at least one verified backup combo with a fully independent explicit disruption surface.';
  } else if (portfolio.resilienceBand === 'commander-coupled') {
    resilienceSummary = 'The finished deck has distinct library win packages, but at least two routes share a commander dependency.';
  } else {
    resilienceSummary = 'Multiple full-table combos were verified, but their explicit pieces overlap enough that they are not counted as independent backup routes.';
  }

  return {
    status,
    comboVerificationComplete: input.comboVerificationComplete,
    verifiedFullTableWinCount: details.length,
    explicitDependencyRouteCount: explicit.length,
    unresolvedDependencyRouteCount: unresolved.length,
    preferredComboId,
    preferredComboVerified,
    portfolio,
    unresolvedDependencyComboIds,
    delayedWinComboIds,
    resilienceSummary,
  };
}
