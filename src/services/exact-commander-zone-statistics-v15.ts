import {
  calculateExactOverlapPackageAssemblyV15,
  MAX_EXACT_OVERLAP_FRONTIER_STATES_V15,
  MAX_EXACT_OVERLAP_ROLES_V15,
  MAX_EXACT_OVERLAP_ROUTES_V15,
  type ExactOverlapCardCategoryV15,
  type ExactOverlapPackageAssemblyResultV15,
  type ExactOverlapRouteRequirementV15,
  type ExactOverlapRouteV15,
} from './exact-overlap-package-statistics-v15.js';
import {
  MAX_EXACT_STATISTICS_POPULATION_V15,
  type ExactFractionV15,
} from './exact-statistics-v15.js';

/**
 * Standard Commander currently starts one or more designated commander cards in
 * the command zone before the remaining deck becomes the library. This service
 * deliberately does not hard-code a 100-card deck: callers supply the total deck
 * size, while the library population is derived by subtracting the known physical
 * command-zone cards. Commander legality remains a separate hard-truth layer.
 */
export const MAX_EXACT_COMMAND_ZONE_CARDS_V15 = 16;
export const MAX_EXACT_COMMAND_ZONE_FRONTIER_STATES_V15 = MAX_EXACT_OVERLAP_FRONTIER_STATES_V15;
export const MAX_EXACT_COMMAND_ZONE_WORK_V15 = 100_000;

export interface ExactCommandZoneCardV15 {
  name: string;
  roles: readonly string[];
}

export interface ExactCommanderZonePackageAssemblyResultV15 {
  deckSize: number;
  libraryPopulation: number;
  draws: number;
  commandZoneCards: Array<{ name: string; roles: string[] }>;
  roles: Array<{ name: string; maximumRequired: number }>;
  routes: Array<{ name: string; requirements: ExactOverlapRouteRequirementV15[] }>;
  commandZoneFrontierStates: number;
  effectiveLibraryRouteCount: number;
  categories: ExactOverlapPackageAssemblyResultV15['categories'];
  untrackedCards: number;
  neutralCards: number;
  favorableHands: string;
  totalHands: string;
  probability: ExactFractionV15;
  complement: ExactFractionV15;
  formula: 'commander-zone-overlap-aware-hypergeometric-package-v15';
}

interface NormalizedRouteV15 {
  name: string;
  requirements: ExactOverlapRouteRequirementV15[];
  requirementByRole: Map<string, number>;
}

interface WorkCounterV15 {
  value: number;
}

function requireInteger(name: string, value: number, minimum: number, maximum?: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(value)) throw new Error(`${name} must be a finite integer.`);
  if (value < minimum) throw new Error(`${name} must be at least ${minimum}.`);
  if (maximum !== undefined && value > maximum) throw new Error(`${name} must be at most ${maximum}.`);
  return value;
}

function requireName(name: string, value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error(`${name} must be a non-empty string.`);
  if (normalized.length > 120) throw new Error(`${name} must be at most 120 characters.`);
  return normalized;
}

function bumpWork(counter: WorkCounterV15, amount = 1): void {
  counter.value += amount;
  if (counter.value > MAX_EXACT_COMMAND_ZONE_WORK_V15) {
    throw new Error(`exact commander-zone calculation exceeded the ${MAX_EXACT_COMMAND_ZONE_WORK_V15} work limit.`);
  }
}

function vectorDominates(left: readonly number[], right: readonly number[]): boolean {
  for (let index = 0; index < left.length; index += 1) {
    if ((left[index] ?? 0) < (right[index] ?? 0)) return false;
  }
  return true;
}

function vectorNoHarder(left: readonly number[], right: readonly number[]): boolean {
  for (let index = 0; index < left.length; index += 1) {
    if ((left[index] ?? 0) > (right[index] ?? 0)) return false;
  }
  return true;
}

function compareVectors(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < left.length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * Keep only Pareto-maximal guaranteed fulfillment vectors. A dominated command-
 * zone assignment can never help a later library draw more than the assignment
 * that dominates it.
 */
function canonicalizeAttainmentFrontier(vectors: readonly number[][]): number[][] {
  const unique = new Map<string, number[]>();
  for (const vector of vectors) unique.set(vector.join(','), vector);

  const maximal: number[][] = [];
  for (const candidate of unique.values()) {
    let dominated = false;
    for (let index = maximal.length - 1; index >= 0; index -= 1) {
      const existing = maximal[index]!;
      if (vectorDominates(existing, candidate)) {
        dominated = true;
        break;
      }
      if (vectorDominates(candidate, existing)) maximal.splice(index, 1);
    }
    if (dominated) continue;
    maximal.push(candidate);
    if (maximal.length > MAX_EXACT_COMMAND_ZONE_FRONTIER_STATES_V15) {
      throw new Error(`exact commander-zone assignment frontier exceeded the ${MAX_EXACT_COMMAND_ZONE_FRONTIER_STATES_V15} state limit.`);
    }
  }
  maximal.sort(compareVectors);
  return maximal;
}

function addKnownPhysicalCard(
  frontier: readonly number[][],
  roleIndexes: readonly number[],
  caps: readonly number[],
  work: WorkCounterV15,
): number[][] {
  const generated: number[][] = [];
  for (const vector of frontier) {
    let advanced = false;
    for (const roleIndex of roleIndexes) {
      if ((vector[roleIndex] ?? 0) >= (caps[roleIndex] ?? 0)) continue;
      const next = [...vector];
      next[roleIndex] = (next[roleIndex] ?? 0) + 1;
      generated.push(next);
      advanced = true;
      bumpWork(work);
    }
    if (!advanced) generated.push([...vector]);
  }
  return canonicalizeAttainmentFrontier(generated);
}

/**
 * Routes are ORed. If residual requirement vector A is no harder than B in every
 * role, every library hand satisfying B also satisfies A, so B can be discarded.
 */
function canonicalizeResidualRouteFrontier(vectors: readonly number[][]): number[][] {
  const unique = new Map<string, number[]>();
  for (const vector of vectors) unique.set(vector.join(','), vector);

  const minimal: number[][] = [];
  for (const candidate of unique.values()) {
    let subsumed = false;
    for (let index = minimal.length - 1; index >= 0; index -= 1) {
      const existing = minimal[index]!;
      if (vectorNoHarder(existing, candidate)) {
        subsumed = true;
        break;
      }
      if (vectorNoHarder(candidate, existing)) minimal.splice(index, 1);
    }
    if (!subsumed) minimal.push(candidate);
  }
  minimal.sort(compareVectors);
  if (minimal.length > MAX_EXACT_OVERLAP_ROUTES_V15) {
    throw new Error(`commander-zone reduction produced more than ${MAX_EXACT_OVERLAP_ROUTES_V15} irreducible library routes.`);
  }
  return minimal;
}

/**
 * Exact probability that the random library draws plus one or more guaranteed
 * command-zone physical cards can satisfy at least one package route.
 *
 * A command-zone card may be capable of multiple roles, but it is assigned to at
 * most one simultaneous role. The resulting residual library requirements are
 * handed to the overlap-aware exact solver, preserving the same physical-card
 * one-assignment semantics for library cards and tutors.
 */
export function calculateExactCommanderZonePackageAssemblyV15(input: {
  deckSize: number;
  draws: number;
  commandZoneCards: readonly ExactCommandZoneCardV15[];
  routes: readonly ExactOverlapRouteV15[];
  libraryCategories: readonly ExactOverlapCardCategoryV15[];
}): ExactCommanderZonePackageAssemblyResultV15 {
  const maximumModeledDeckSize = MAX_EXACT_STATISTICS_POPULATION_V15 + MAX_EXACT_COMMAND_ZONE_CARDS_V15;
  const deckSize = requireInteger('deckSize', input.deckSize, 0, maximumModeledDeckSize);
  if (!Array.isArray(input.routes)) throw new Error('routes must be an array.');
  if (input.routes.length < 1) throw new Error('routes must contain at least one route.');
  if (input.routes.length > MAX_EXACT_OVERLAP_ROUTES_V15) {
    throw new Error(`routes must contain at most ${MAX_EXACT_OVERLAP_ROUTES_V15} routes.`);
  }
  if (!Array.isArray(input.commandZoneCards)) throw new Error('commandZoneCards must be an array.');
  if (input.commandZoneCards.length > MAX_EXACT_COMMAND_ZONE_CARDS_V15) {
    throw new Error(`commandZoneCards must contain at most ${MAX_EXACT_COMMAND_ZONE_CARDS_V15} cards.`);
  }
  if (!Array.isArray(input.libraryCategories)) throw new Error('libraryCategories must be an array.');

  const routeNames = new Set<string>();
  const roleMaximums = new Map<string, number>();
  const routes: NormalizedRouteV15[] = input.routes.map((entry: ExactOverlapRouteV15, routeIndex: number) => {
    if (!entry || typeof entry !== 'object') throw new Error(`routes[${routeIndex}] must be an object.`);
    const name = requireName(`routes[${routeIndex}].name`, entry.name);
    if (routeNames.has(name)) throw new Error(`route names must be unique; duplicate: ${name}.`);
    routeNames.add(name);
    if (!Array.isArray(entry.requirements)) throw new Error(`routes[${routeIndex}].requirements must be an array.`);

    const localRoles = new Set<string>();
    const requirementByRole = new Map<string, number>();
    const requirements = entry.requirements.map((requirement: ExactOverlapRouteRequirementV15, requirementIndex: number) => {
      if (!requirement || typeof requirement !== 'object') {
        throw new Error(`routes[${routeIndex}].requirements[${requirementIndex}] must be an object.`);
      }
      const role = requireName(
        `routes[${routeIndex}].requirements[${requirementIndex}].role`,
        requirement.role,
      );
      if (localRoles.has(role)) throw new Error(`route ${name} contains duplicate role requirement: ${role}.`);
      localRoles.add(role);
      const minimum = requireInteger(
        `routes[${routeIndex}].requirements[${requirementIndex}].minimum`,
        requirement.minimum,
        0,
        maximumModeledDeckSize,
      );
      requirementByRole.set(role, minimum);
      roleMaximums.set(role, Math.max(roleMaximums.get(role) ?? 0, minimum));
      return { role, minimum };
    });
    return { name, requirements, requirementByRole };
  });

  if (roleMaximums.size > MAX_EXACT_OVERLAP_ROLES_V15) {
    throw new Error(`commander-zone routes may reference at most ${MAX_EXACT_OVERLAP_ROLES_V15} unique roles.`);
  }

  const roles = [...roleMaximums.keys()];
  const roleIndexByName = new Map(roles.map((role: string, index: number) => [role, index] as const));
  const caps = roles.map((role: string) => roleMaximums.get(role) ?? 0);
  const commandZoneNames = new Set<string>();
  const commandZoneCards = input.commandZoneCards.map((entry: ExactCommandZoneCardV15, cardIndex: number) => {
    if (!entry || typeof entry !== 'object') throw new Error(`commandZoneCards[${cardIndex}] must be an object.`);
    const name = requireName(`commandZoneCards[${cardIndex}].name`, entry.name);
    if (commandZoneNames.has(name)) throw new Error(`command-zone card names must be unique; duplicate: ${name}.`);
    commandZoneNames.add(name);
    if (!Array.isArray(entry.roles)) throw new Error(`commandZoneCards[${cardIndex}].roles must be an array.`);

    const localRoles = new Set<string>();
    const cardRoles = entry.roles.map((roleValue: string, roleIndex: number) => {
      const role = requireName(`commandZoneCards[${cardIndex}].roles[${roleIndex}]`, roleValue);
      if (!roleMaximums.has(role)) throw new Error(`command-zone card ${name} references unknown role: ${role}.`);
      if (localRoles.has(role)) throw new Error(`command-zone card ${name} contains duplicate role capability: ${role}.`);
      localRoles.add(role);
      return role;
    });
    return { name, roles: cardRoles };
  });

  if (commandZoneCards.length > deckSize) {
    throw new Error('commandZoneCards cannot contain more physical cards than deckSize.');
  }
  const libraryPopulation = deckSize - commandZoneCards.length;
  if (libraryPopulation > MAX_EXACT_STATISTICS_POPULATION_V15) {
    throw new Error(`derived library population must be at most ${MAX_EXACT_STATISTICS_POPULATION_V15}.`);
  }
  const draws = requireInteger('draws', input.draws, 0, libraryPopulation);

  let declaredLibraryCards = 0;
  for (const category of input.libraryCategories) {
    if (!category || typeof category !== 'object') continue;
    if (!Number.isFinite(category.count) || !Number.isInteger(category.count) || category.count < 0) continue;
    declaredLibraryCards += category.count;
  }
  if (declaredLibraryCards > libraryPopulation) {
    throw new Error('library category counts must sum to no more than population after removing command-zone cards.');
  }

  const work: WorkCounterV15 = { value: 0 };
  let commandZoneFrontier = [new Array<number>(roles.length).fill(0)];
  for (const card of commandZoneCards) {
    const roleIndexes = card.roles.map((role: string) => {
      const roleIndex = roleIndexByName.get(role);
      if (roleIndex === undefined) throw new Error(`Internal command-zone role index missing for ${role}.`);
      return roleIndex;
    }).filter((roleIndex: number) => (caps[roleIndex] ?? 0) > 0);
    commandZoneFrontier = addKnownPhysicalCard(commandZoneFrontier, roleIndexes, caps, work);
  }

  const residualVectors: number[][] = [];
  for (const route of routes) {
    for (const guaranteed of commandZoneFrontier) {
      const residual = roles.map((role: string, roleIndex: number) => Math.max(
        0,
        (route.requirementByRole.get(role) ?? 0) - (guaranteed[roleIndex] ?? 0),
      ));
      bumpWork(work);
      if (residual.some((minimum) => minimum > libraryPopulation)) continue;
      residualVectors.push(residual);
    }
  }
  const residualFrontier = canonicalizeResidualRouteFrontier(residualVectors);

  const effectiveRoutes: ExactOverlapRouteV15[] = residualFrontier.map((vector: number[], routeIndex: number) => ({
    name: `command-zone-effective-${routeIndex + 1}`,
    requirements: roles.map((role: string, roleIndex: number) => ({
      role,
      minimum: vector[roleIndex] ?? 0,
    })),
  }));

  const libraryResult = calculateExactOverlapPackageAssemblyV15({
    population: libraryPopulation,
    draws,
    routes: effectiveRoutes.length > 0
      ? effectiveRoutes
      : [{
          name: 'command-zone-validation-only',
          requirements: roles.map((role: string) => ({ role, minimum: 0 })),
        }],
    categories: input.libraryCategories,
  });
  const noPhysicallyPossibleRoute = effectiveRoutes.length === 0;

  return {
    deckSize,
    libraryPopulation,
    draws,
    commandZoneCards: commandZoneCards.map((card: { name: string; roles: string[] }) => ({
      name: card.name,
      roles: [...card.roles],
    })),
    roles: roles.map((name: string) => ({ name, maximumRequired: roleMaximums.get(name) ?? 0 })),
    routes: routes.map((route: NormalizedRouteV15) => ({
      name: route.name,
      requirements: route.requirements.map((requirement: ExactOverlapRouteRequirementV15) => ({ ...requirement })),
    })),
    commandZoneFrontierStates: commandZoneFrontier.length,
    effectiveLibraryRouteCount: residualFrontier.length,
    categories: libraryResult.categories,
    untrackedCards: libraryResult.untrackedCards,
    neutralCards: libraryResult.neutralCards,
    favorableHands: noPhysicallyPossibleRoute ? '0' : libraryResult.favorableHands,
    totalHands: libraryResult.totalHands,
    probability: noPhysicallyPossibleRoute
      ? { numerator: '0', denominator: '1', decimal: 0 }
      : libraryResult.probability,
    complement: noPhysicallyPossibleRoute
      ? { numerator: '1', denominator: '1', decimal: 1 }
      : libraryResult.complement,
    formula: 'commander-zone-overlap-aware-hypergeometric-package-v15',
  };
}
