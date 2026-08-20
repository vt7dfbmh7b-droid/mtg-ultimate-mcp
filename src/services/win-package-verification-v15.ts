export type WinClosureKindV15 =
  | 'direct-game-win'
  | 'opponent-loss'
  | 'deterministic-damage'
  | 'deterministic-life-loss'
  | 'deterministic-mill'
  | 'conditional-combat-engine'
  | 'resource-engine-only'
  | 'non-winning';

export interface WinClosureAssessmentV15 {
  verifiedDeterministicWin: boolean;
  kind: WinClosureKindV15;
  matchedSignals: string[];
  resourceOutputs: string[];
  normalizedText: string;
  caveat: string;
}

export interface WinPackagePortfolioCandidateV15 {
  comboId: string;
  comboCardNames: string[];
  seedNames: string[];
  results: string[];
  score: number;
}

export type WinPackageRelationshipV15 =
  | 'fully-independent'
  | 'commander-coupled'
  | 'partially-overlapping'
  | 'shared-core';

export interface WinPackageRelationshipAssessmentV15 {
  primaryComboId: string;
  candidateComboId: string;
  relationship: WinPackageRelationshipV15;
  sharedSeedCards: string[];
  sharedCommanderCards: string[];
  seedOverlapRatio: number;
  allCardOverlapRatio: number;
  resilienceAdjustment: number;
}

export interface WinPackagePortfolioV15 {
  primaryComboId: string | null;
  backupComboId: string | null;
  verifiedCandidateCount: number;
  distinctLibraryRouteCount: number;
  fullyIndependentRouteCount: number;
  sharedCoreCandidateCount: number;
  resilienceBand: 'none' | 'single-route' | 'commander-coupled' | 'independent-backup';
  relationships: WinPackageRelationshipAssessmentV15[];
  selectionRationale: string;
}

function normalizeText(values: readonly string[]): string {
  return values
    .join(' ')
    .toLocaleLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function hasDirectWin(text: string): boolean {
  return /\b(?:you|controller) (?:win|wins) the game\b/.test(text)
    || /\b(?:win|wins) the game\b/.test(text);
}

function hasOpponentLoss(text: string): boolean {
  return /\b(?:each|all) opponents? (?:lose|loses) the game\b/.test(text)
    || /\bopponents? (?:lose|loses) the game\b/.test(text);
}

function hasUnboundedDamage(text: string): boolean {
  return /\b(?:infinite|unbounded|arbitrarily (?:large|high)) (?:amounts? of )?damage\b/.test(text)
    || /\bdeal(?:s|ing)? (?:infinite|unbounded|arbitrarily (?:large|high)) (?:amounts? of )?damage\b/.test(text);
}

function hasUnboundedLifeLoss(text: string): boolean {
  return /\b(?:infinite|unbounded|arbitrarily (?:large|high)) (?:amounts? of )?(?:life ?loss|loss of life)\b/.test(text)
    || /\b(?:each|all) opponents? (?:lose|loses) (?:an? )?(?:infinite|unbounded|arbitrarily (?:large|high)) (?:amount of )?life\b/.test(text);
}

function hasOpponentLibraryExhaustion(text: string): boolean {
  return /\bmill(?:s|ing)? (?:each|all) opponents?'?s? (?:entire )?(?:library|libraries)\b/.test(text)
    || /\b(?:each|all) opponents? (?:mill|mills) (?:their|his or her) (?:entire )?(?:library|libraries)\b/.test(text)
    || /\b(?:each|all) opponents?'?s? (?:libraries|library) (?:are|is) (?:milled|put into (?:their )?graveyards?)\b/.test(text);
}

function hasInfiniteCombatOnly(text: string): boolean {
  return /\b(?:infinite|unbounded|arbitrarily many) (?:combat(?: phases?| steps?)?|extra combats?)\b/.test(text);
}

const RESOURCE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'mana', pattern: /\b(?:infinite|unbounded|arbitrarily (?:large|high)) (?:amounts? of )?mana\b/ },
  { label: 'life', pattern: /\b(?:infinite|unbounded|arbitrarily (?:large|high)) (?:amounts? of )?life\b/ },
  { label: 'card-draw', pattern: /\b(?:draw|draws|drawing) (?:your )?(?:entire|whole) (?:deck|library)\b|\b(?:infinite|unbounded) (?:card )?draw\b/ },
  { label: 'tokens', pattern: /\b(?:infinite|unbounded|arbitrarily many) (?:creature )?tokens?\b/ },
  { label: 'counters', pattern: /\b(?:infinite|unbounded|arbitrarily many) [^.!;]{0,40}counters?\b/ },
  { label: 'untaps', pattern: /\b(?:infinite|unbounded|arbitrarily many) untaps?\b/ },
  { label: 'storm-count', pattern: /\b(?:infinite|unbounded|arbitrarily (?:large|high)) storm(?: count)?\b/ },
  { label: 'etb-ltb-triggers', pattern: /\b(?:infinite|unbounded|arbitrarily many) (?:etb|ltb|enter(?:s)? the battlefield|leave(?:s)? the battlefield)\b/ },
  { label: 'mill-unspecified', pattern: /\b(?:infinite|unbounded) mill(?:ing)?\b/ },
];

/**
 * Strict closure classifier for a purported win package.
 *
 * Resource generation is deliberately not treated as a win by itself. For example,
 * "infinite mana", "infinite life", "infinite tokens", or generic "infinite mill"
 * remains an engine until the same verified variant also states a game-ending outcome.
 * Likewise, infinite combat phases alone are reported as conditional rather than deterministic:
 * the text still needs an actual lethal/opponent-loss closure signal.
 */
export function assessWinResultClosureV15(results: readonly string[]): WinClosureAssessmentV15 {
  const normalizedText = normalizeText(results);
  const resourceOutputs = RESOURCE_PATTERNS
    .filter(({ pattern }) => pattern.test(normalizedText))
    .map(({ label }) => label);
  const matchedSignals: string[] = [];

  if (!normalizedText) {
    return {
      verifiedDeterministicWin: false,
      kind: 'non-winning',
      matchedSignals,
      resourceOutputs,
      normalizedText,
      caveat: 'No game-ending result text was supplied.',
    };
  }

  if (hasOpponentLoss(normalizedText)) {
    matchedSignals.push('opponent-loss');
    return {
      verifiedDeterministicWin: true,
      kind: 'opponent-loss',
      matchedSignals,
      resourceOutputs,
      normalizedText,
      caveat: 'The verified variant explicitly makes opponents lose the game.',
    };
  }
  if (hasDirectWin(normalizedText)) {
    matchedSignals.push('direct-game-win');
    return {
      verifiedDeterministicWin: true,
      kind: 'direct-game-win',
      matchedSignals,
      resourceOutputs,
      normalizedText,
      caveat: 'The verified variant explicitly states a game win.',
    };
  }
  if (hasUnboundedDamage(normalizedText)) {
    matchedSignals.push('unbounded-damage');
    return {
      verifiedDeterministicWin: true,
      kind: 'deterministic-damage',
      matchedSignals,
      resourceOutputs,
      normalizedText,
      caveat: 'The verified variant explicitly produces unbounded damage, which supplies its own lethal outlet.',
    };
  }
  if (hasUnboundedLifeLoss(normalizedText)) {
    matchedSignals.push('unbounded-life-loss');
    return {
      verifiedDeterministicWin: true,
      kind: 'deterministic-life-loss',
      matchedSignals,
      resourceOutputs,
      normalizedText,
      caveat: 'The verified variant explicitly produces unbounded life loss, which supplies its own lethal outlet.',
    };
  }
  if (hasOpponentLibraryExhaustion(normalizedText)) {
    matchedSignals.push('opponent-library-exhaustion');
    return {
      verifiedDeterministicWin: true,
      kind: 'deterministic-mill',
      matchedSignals,
      resourceOutputs,
      normalizedText,
      caveat: 'The verified variant explicitly exhausts opponents’ libraries rather than merely producing an unspecified mill resource.',
    };
  }
  if (hasInfiniteCombatOnly(normalizedText)) {
    matchedSignals.push('unbounded-combat-without-lethal-closure');
    return {
      verifiedDeterministicWin: false,
      kind: 'conditional-combat-engine',
      matchedSignals,
      resourceOutputs,
      normalizedText,
      caveat: 'Unbounded combat steps are powerful but are not called deterministic without an explicit lethal or opponent-loss closure in the same verified result.',
    };
  }
  if (resourceOutputs.length > 0) {
    matchedSignals.push('resource-generation-without-closure');
    return {
      verifiedDeterministicWin: false,
      kind: 'resource-engine-only',
      matchedSignals,
      resourceOutputs,
      normalizedText,
      caveat: 'The variant generates an unbounded resource but does not itself prove a game-ending outlet.',
    };
  }

  return {
    verifiedDeterministicWin: false,
    kind: 'non-winning',
    matchedSignals,
    resourceOutputs,
    normalizedText,
    caveat: 'No strict game-ending closure signal was found.',
  };
}

export function isStrictDeterministicWinResultV15(results: readonly string[]): boolean {
  return assessWinResultClosureV15(results).verifiedDeterministicWin;
}

function setFrom(values: readonly string[]): Set<string> {
  return new Set(values.map(normalizeName).filter(Boolean));
}

function displayNames(values: readonly string[], wanted: Set<string>): string[] {
  return uniqueSorted(values.filter((value) => wanted.has(normalizeName(value))));
}

function commanderCards(candidate: WinPackagePortfolioCandidateV15): string[] {
  const seeds = setFrom(candidate.seedNames);
  return candidate.comboCardNames.filter((name) => !seeds.has(normalizeName(name)));
}

function overlapRatio(left: Set<string>, right: Set<string>): number {
  const denominator = Math.min(left.size, right.size);
  if (denominator === 0) return 0;
  let shared = 0;
  for (const value of left) if (right.has(value)) shared += 1;
  return shared / denominator;
}

export function assessWinPackageRelationshipV15(
  primary: WinPackagePortfolioCandidateV15,
  candidate: WinPackagePortfolioCandidateV15,
): WinPackageRelationshipAssessmentV15 {
  const primarySeeds = setFrom(primary.seedNames);
  const candidateSeeds = setFrom(candidate.seedNames);
  const primaryAll = setFrom(primary.comboCardNames);
  const candidateAll = setFrom(candidate.comboCardNames);
  const primaryCommanders = setFrom(commanderCards(primary));
  const candidateCommanders = setFrom(commanderCards(candidate));
  const sharedSeeds = new Set([...primarySeeds].filter((name) => candidateSeeds.has(name)));
  const sharedCommanders = new Set([...primaryCommanders].filter((name) => candidateCommanders.has(name)));
  const seedOverlapRatio = overlapRatio(primarySeeds, candidateSeeds);
  const allCardOverlapRatio = overlapRatio(primaryAll, candidateAll);

  let relationship: WinPackageRelationshipV15;
  let resilienceAdjustment: number;
  if (sharedSeeds.size === 0 && sharedCommanders.size === 0) {
    relationship = 'fully-independent';
    resilienceAdjustment = 420;
  } else if (sharedSeeds.size === 0) {
    relationship = 'commander-coupled';
    resilienceAdjustment = 220;
  } else if (seedOverlapRatio >= 0.5 || allCardOverlapRatio >= 0.67) {
    relationship = 'shared-core';
    resilienceAdjustment = -360;
  } else {
    relationship = 'partially-overlapping';
    resilienceAdjustment = 40;
  }

  return {
    primaryComboId: primary.comboId,
    candidateComboId: candidate.comboId,
    relationship,
    sharedSeedCards: displayNames(primary.seedNames, sharedSeeds),
    sharedCommanderCards: displayNames(commanderCards(primary), sharedCommanders),
    seedOverlapRatio: Math.round(seedOverlapRatio * 1000) / 1000,
    allCardOverlapRatio: Math.round(allCardOverlapRatio * 1000) / 1000,
    resilienceAdjustment,
  };
}

function candidateOrder(a: WinPackagePortfolioCandidateV15, b: WinPackagePortfolioCandidateV15): number {
  return b.score - a.score
    || a.seedNames.length - b.seedNames.length
    || a.comboId.localeCompare(b.comboId);
}

function relationOrder(
  a: { candidate: WinPackagePortfolioCandidateV15; relation: WinPackageRelationshipAssessmentV15 },
  b: { candidate: WinPackagePortfolioCandidateV15; relation: WinPackageRelationshipAssessmentV15 },
): number {
  return (b.candidate.score + b.relation.resilienceAdjustment) - (a.candidate.score + a.relation.resilienceAdjustment)
    || b.relation.resilienceAdjustment - a.relation.resilienceAdjustment
    || candidateOrder(a.candidate, b.candidate);
}

function disjointFromAll(
  candidate: WinPackagePortfolioCandidateV15,
  selected: readonly WinPackagePortfolioCandidateV15[],
  includeCommanderDependency: boolean,
): boolean {
  const candidateSeeds = setFrom(candidate.seedNames);
  const candidateCommanders = setFrom(commanderCards(candidate));
  return selected.every((other) => {
    const otherSeeds = setFrom(other.seedNames);
    if ([...candidateSeeds].some((name) => otherSeeds.has(name))) return false;
    if (!includeCommanderDependency) return true;
    const otherCommanders = setFrom(commanderCards(other));
    return ![...candidateCommanders].some((name) => otherCommanders.has(name));
  });
}

function greedyRouteCount(candidates: readonly WinPackagePortfolioCandidateV15[], includeCommanderDependency: boolean): number {
  const selected: WinPackagePortfolioCandidateV15[] = [];
  for (const candidate of [...candidates].sort(candidateOrder)) {
    if (disjointFromAll(candidate, selected, includeCommanderDependency)) selected.push(candidate);
  }
  return selected.length;
}

/**
 * Builds a deterministic primary/backup portfolio from already discovered packages.
 * Every candidate is re-checked for strict closure, so a caller cannot obtain redundancy
 * credit from resource-only loops. Backup selection deliberately rewards a distinct disruption
 * surface before small raw-score differences.
 */
export function buildWinPackagePortfolioV15(
  candidates: readonly WinPackagePortfolioCandidateV15[],
): WinPackagePortfolioV15 {
  const verified = candidates
    .filter((candidate) => isStrictDeterministicWinResultV15(candidate.results))
    .map((candidate) => ({
      ...candidate,
      comboCardNames: uniqueSorted(candidate.comboCardNames),
      seedNames: uniqueSorted(candidate.seedNames),
    }))
    .sort(candidateOrder);

  const primary = verified[0];
  if (!primary) {
    return {
      primaryComboId: null,
      backupComboId: null,
      verifiedCandidateCount: 0,
      distinctLibraryRouteCount: 0,
      fullyIndependentRouteCount: 0,
      sharedCoreCandidateCount: 0,
      resilienceBand: 'none',
      relationships: [],
      selectionRationale: 'No candidate supplied strict deterministic game-ending closure evidence.',
    };
  }

  const related = verified.slice(1).map((candidate) => ({
    candidate,
    relation: assessWinPackageRelationshipV15(primary, candidate),
  }));
  const rankedBackups = [...related].sort(relationOrder);
  const backup = rankedBackups[0]?.candidate ?? null;
  const relationships = related.map((item) => item.relation);
  const distinctLibraryRouteCount = greedyRouteCount(verified, false);
  const fullyIndependentRouteCount = greedyRouteCount(verified, true);
  const sharedCoreCandidateCount = relationships.filter((item) => item.relationship === 'shared-core').length;

  let resilienceBand: WinPackagePortfolioV15['resilienceBand'];
  if (verified.length === 1) resilienceBand = 'single-route';
  else if (fullyIndependentRouteCount >= 2) resilienceBand = 'independent-backup';
  else if (distinctLibraryRouteCount >= 2) resilienceBand = 'commander-coupled';
  else resilienceBand = 'single-route';

  const backupRelation = backup
    ? relationships.find((item) => item.candidateComboId === backup.comboId)
    : undefined;
  const selectionRationale = backup && backupRelation
    ? `Primary ${primary.comboId} is highest-ranked after strict closure verification; backup ${backup.comboId} is preferred as ${backupRelation.relationship} rather than counting raw combo IDs as equivalent redundancy.`
    : `Primary ${primary.comboId} is the only strict deterministic route in the supplied candidate set.`;

  return {
    primaryComboId: primary.comboId,
    backupComboId: backup?.comboId ?? null,
    verifiedCandidateCount: verified.length,
    distinctLibraryRouteCount,
    fullyIndependentRouteCount,
    sharedCoreCandidateCount,
    resilienceBand,
    relationships,
    selectionRationale,
  };
}
