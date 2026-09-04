import type { ScryfallCard } from '../types/scryfall.js';
import { resolveEntryCard, type ParsedDeck } from './deck.js';
import { effectiveCardRolesV15 } from './card-role-truth-v15.js';

export type RefinementComponentZoneV15 = 'main' | 'all';

export interface RefinementComponentMatcherV15 {
  /**
   * Every listed effective role must be present. Role names are compared case-insensitively.
   */
  requiredRoles?: readonly string[];
  /**
   * At least one listed effective role must be present. Role names are compared case-insensitively.
   */
  anyRoles?: readonly string[];
  requireNonland?: boolean;
  requireNoncreature?: boolean;
  minManaValue?: number;
  maxManaValue?: number;
  /**
   * Treat an X spell as satisfying minManaValue when the X value could reach this threshold.
   * This is useful for stack mana-value triggers, where a printed CMC alone is insufficient.
   */
  countXAsAtLeastManaValue?: number;
}

export interface RefinementComponentRequirementV15 {
  id: string;
  minimumCount: number;
  matcher: RefinementComponentMatcherV15;
  zone?: RefinementComponentZoneV15;
}

export interface RefinementPackageAcceptanceContractV15 {
  /**
   * Caller-declared strategy fuel that must remain available after an accepted package.
   * These are structural descriptors, never card-name allow/deny lists.
   */
  strategyFuel?: readonly RefinementComponentRequirementV15[];
  /**
   * Caller-declared low-volume structural floors that an accepted package may not cross.
   */
  structuralFloors?: readonly RefinementComponentRequirementV15[];
}

export interface RefinementComponentAuditV15 {
  kind: 'strategy-fuel' | 'structural-floor';
  id: string;
  minimumCount: number;
  zone: RefinementComponentZoneV15;
  matcher: RefinementComponentMatcherV15;
  beforeCount: number;
  afterCount: number;
  delta: number;
  preserved: boolean;
}

export type RefinementPackageAcceptanceStatusV15 =
  | 'preserved'
  | 'strategy-fuel-loss'
  | 'structural-floor-loss'
  | 'strategy-fuel-and-structural-floor-loss'
  | 'evidence-incomplete';

export interface RefinementPackageAcceptanceAuditV15 {
  status: RefinementPackageAcceptanceStatusV15;
  evidenceComplete: boolean;
  preserved: boolean;
  strategyFuel: RefinementComponentAuditV15[];
  structuralFloors: RefinementComponentAuditV15[];
  losses: RefinementComponentAuditV15[];
  unresolvedBefore: string[];
  unresolvedAfter: string[];
  invalidRequirements: string[];
  acceptanceRule: string;
}

const ACCEPTANCE_RULE_V15 =
  'Every caller-declared strategy-fuel component and structural-floor component must retain at least its declared minimum count across the complete accepted package. Exact card resolution and descriptor validation are required; a missing or malformed component cannot be treated as preserved.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map(normalize).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function finiteNonNegative(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function validRoles(values: unknown): boolean {
  return Array.isArray(values) && values.length > 0 && values.every(
    (value) => typeof value === 'string' && value.trim().length > 0,
  );
}

function matcherHasSelector(matcher: RefinementComponentMatcherV15): boolean {
  return (
    validRoles(matcher.requiredRoles)
    || validRoles(matcher.anyRoles)
    || matcher.requireNonland === true
    || matcher.requireNoncreature === true
    || finiteNonNegative(matcher.minManaValue)
    || finiteNonNegative(matcher.maxManaValue)
    || finiteNonNegative(matcher.countXAsAtLeastManaValue)
  );
}

function validateMatcher(id: string, matcher: unknown): string[] {
  if (!isRecord(matcher)) {
    return [id + ': matcher must be an object'];
  }
  const candidate = matcher as RefinementComponentMatcherV15;
  const errors: string[] = [];
  if (!matcherHasSelector(candidate)) errors.push(id + ': matcher must declare at least one selector');
  if (candidate.requiredRoles !== undefined && !validRoles(candidate.requiredRoles)) {
    errors.push(id + ': requiredRoles must contain at least one non-empty role');
  }
  if (candidate.anyRoles !== undefined && !validRoles(candidate.anyRoles)) {
    errors.push(id + ': anyRoles must contain at least one non-empty role');
  }
  if (candidate.minManaValue !== undefined && !finiteNonNegative(candidate.minManaValue)) {
    errors.push(id + ': minManaValue must be a finite non-negative number');
  }
  if (candidate.maxManaValue !== undefined && !finiteNonNegative(candidate.maxManaValue)) {
    errors.push(id + ': maxManaValue must be a finite non-negative number');
  }
  if (
    finiteNonNegative(candidate.minManaValue)
    && finiteNonNegative(candidate.maxManaValue)
    && candidate.minManaValue! > candidate.maxManaValue!
  ) {
    errors.push(id + ': minManaValue cannot exceed maxManaValue');
  }
  if (
    candidate.countXAsAtLeastManaValue !== undefined
    && !finiteNonNegative(candidate.countXAsAtLeastManaValue)
  ) {
    errors.push(id + ': countXAsAtLeastManaValue must be a finite non-negative number');
  }
  if (candidate.countXAsAtLeastManaValue !== undefined && candidate.minManaValue === undefined) {
    errors.push(id + ': countXAsAtLeastManaValue requires minManaValue');
  }
  return errors;
}

function validateRequirements(
  kind: 'strategy-fuel' | 'structural-floor',
  requirements: unknown,
  seenIds: Set<string>,
): string[] {
  if (requirements === undefined) return [];
  if (!Array.isArray(requirements) || requirements.length === 0) {
    return [kind + ': at least one component is required when the list is supplied'];
  }

  const errors: string[] = [];
  for (const rawRequirement of requirements) {
    if (!isRecord(rawRequirement)) {
      errors.push(kind + ': each component must be an object');
      continue;
    }
    const requirement = rawRequirement as unknown as RefinementComponentRequirementV15;
    const id = typeof requirement.id === 'string' ? requirement.id.trim() : '';
    const normalizedId = normalize(id);
    if (!id) errors.push(kind + ': each component requires a non-empty id');
    if (normalizedId && seenIds.has(normalizedId)) errors.push(id + ': component id is duplicated');
    if (normalizedId) seenIds.add(normalizedId);
    if (
      typeof requirement.minimumCount !== 'number'
      || !Number.isInteger(requirement.minimumCount)
      || requirement.minimumCount < 0
    ) {
      errors.push((id || kind) + ': minimumCount must be a non-negative integer');
    }
    if (requirement.zone !== undefined && requirement.zone !== 'main' && requirement.zone !== 'all') {
      errors.push((id || kind) + ': zone must be main or all');
    }
    errors.push(...validateMatcher(id || kind, requirement.matcher));
  }
  return errors;
}

function isAuditableRequirement(value: unknown): value is RefinementComponentRequirementV15 {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || value.id.trim().length === 0) return false;
  if (
    typeof value.minimumCount !== 'number'
    || !Number.isInteger(value.minimumCount)
    || value.minimumCount < 0
  ) {
    return false;
  }
  if (value.zone !== undefined && value.zone !== 'main' && value.zone !== 'all') return false;
  return validateMatcher(value.id.trim(), value.matcher).length === 0;
}

function auditRequirements(
  kind: 'strategy-fuel' | 'structural-floor',
  requirements: unknown,
  beforeParsed: ParsedDeck,
  beforeCards: readonly ScryfallCard[],
  afterParsed: ParsedDeck,
  afterCards: readonly ScryfallCard[],
): { audits: RefinementComponentAuditV15[]; unresolvedBefore: string[]; unresolvedAfter: string[] } {
  const audits: RefinementComponentAuditV15[] = [];
  const unresolvedBefore = new Set<string>();
  const unresolvedAfter = new Set<string>();
  const candidates = Array.isArray(requirements) ? requirements : [];
  for (const rawRequirement of candidates) {
    if (!isAuditableRequirement(rawRequirement)) continue;
    const requirement = rawRequirement;
    const before = countComponent(beforeParsed, beforeCards, requirement);
    const after = countComponent(afterParsed, afterCards, requirement);
    before.unresolved.forEach((name) => unresolvedBefore.add(name));
    after.unresolved.forEach((name) => unresolvedAfter.add(name));
    const zone = requirement.zone ?? 'main';
    audits.push({
      kind,
      id: requirement.id.trim(),
      minimumCount: requirement.minimumCount,
      zone,
      matcher: requirement.matcher,
      beforeCount: before.count,
      afterCount: after.count,
      delta: after.count - before.count,
      preserved: after.count >= requirement.minimumCount,
    });
  }
  return {
    audits,
    unresolvedBefore: [...unresolvedBefore].sort((left, right) => left.localeCompare(right)),
    unresolvedAfter: [...unresolvedAfter].sort((left, right) => left.localeCompare(right)),
  };
}

export function auditRefinementPackageAcceptanceV15(input: {
  beforeParsed: ParsedDeck;
  beforeCards: readonly ScryfallCard[];
  afterParsed: ParsedDeck;
  afterCards: readonly ScryfallCard[];
  contract?: RefinementPackageAcceptanceContractV15;
}): RefinementPackageAcceptanceAuditV15 | null {
  if (input.contract === undefined) return null;

  const rawContract: unknown = input.contract;
  const contractRecord = isRecord(rawContract) ? rawContract : null;
  const strategyFuelRequirements: unknown = contractRecord?.strategyFuel;
  const structuralFloorRequirements: unknown = contractRecord?.structuralFloors;
  const seenIds = new Set<string>();
  const invalidRequirements = [
    ...(contractRecord === null ? ['packageAcceptanceContract: contract must be an object'] : []),
    ...validateRequirements('strategy-fuel', strategyFuelRequirements, seenIds),
    ...validateRequirements('structural-floor', structuralFloorRequirements, seenIds),
  ];
  const hasRequirements = (
    (Array.isArray(strategyFuelRequirements) ? strategyFuelRequirements.length : 0)
    + (Array.isArray(structuralFloorRequirements) ? structuralFloorRequirements.length : 0)
  ) > 0;
  if (!hasRequirements) invalidRequirements.push('packageAcceptanceContract: at least one component is required');

  const strategyFuel = auditRequirements(
    'strategy-fuel',
    strategyFuelRequirements,
    input.beforeParsed,
    input.beforeCards,
    input.afterParsed,
    input.afterCards,
  );
  const structuralFloors = auditRequirements(
    'structural-floor',
    structuralFloorRequirements,
    input.beforeParsed,
    input.beforeCards,
    input.afterParsed,
    input.afterCards,
  );
  const unresolvedBefore = uniqueSorted([...strategyFuel.unresolvedBefore, ...structuralFloors.unresolvedBefore]);
  const unresolvedAfter = uniqueSorted([...strategyFuel.unresolvedAfter, ...structuralFloors.unresolvedAfter]);
  const allAudits = [...strategyFuel.audits, ...structuralFloors.audits];
  const losses = allAudits.filter((audit) => !audit.preserved);
  const evidenceComplete = invalidRequirements.length === 0 && unresolvedBefore.length === 0 && unresolvedAfter.length === 0;
  const strategyFuelLoss = losses.some((loss) => loss.kind === 'strategy-fuel');
  const structuralFloorLoss = losses.some((loss) => loss.kind === 'structural-floor');
  const status: RefinementPackageAcceptanceStatusV15 = !evidenceComplete
    ? 'evidence-incomplete'
    : strategyFuelLoss && structuralFloorLoss
      ? 'strategy-fuel-and-structural-floor-loss'
      : strategyFuelLoss
        ? 'strategy-fuel-loss'
        : structuralFloorLoss
          ? 'structural-floor-loss'
          : 'preserved';

  return {
    status,
    evidenceComplete,
    preserved: evidenceComplete && losses.length === 0,
    strategyFuel,
    structuralFloors,
    losses,
    unresolvedBefore,
    unresolvedAfter,
    invalidRequirements,
    acceptanceRule: ACCEPTANCE_RULE_V15,
  };
}

export function packageAcceptanceGateV15(
  audit: RefinementPackageAcceptanceAuditV15 | null,
): { eligible: boolean; reason: string } {
  if (audit === null) return { eligible: true, reason: 'package-acceptance-contract-not-configured' };
  if (!audit.evidenceComplete) return { eligible: false, reason: 'package-acceptance-evidence-incomplete' };
  if (audit.preserved) return { eligible: true, reason: 'caller-declared-package-acceptance-preserved' };
  if (audit.status === 'strategy-fuel-loss') {
    return { eligible: false, reason: 'package-reduces-declared-strategy-fuel' };
  }
  if (audit.status === 'structural-floor-loss') {
    return { eligible: false, reason: 'package-breaks-declared-structural-floor' };
  }
  if (audit.status === 'strategy-fuel-and-structural-floor-loss') {
    return { eligible: false, reason: 'package-reduces-declared-strategy-fuel-and-structural-floor' };
  }
  return { eligible: false, reason: 'package-fails-declared-acceptance-contract' };
}
