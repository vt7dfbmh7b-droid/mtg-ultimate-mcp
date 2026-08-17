import {
  MAX_EXACT_STATISTICS_POPULATION_V15,
  type ExactFractionV15,
} from './exact-statistics-v15.js';

/**
 * Conservative role ceiling chosen from 99-card / draw-7 synthetic overlap benchmarks.
 * 16-role cases remained inside the transition ceiling on the benchmark workload; the
 * independent state/frontier/work guards below remain the authoritative safety stops.
 */
export const MAX_EXACT_OVERLAP_ROLES_V15 = 16;
export const MAX_EXACT_OVERLAP_ROUTES_V15 = 32;
export const MAX_EXACT_OVERLAP_CATEGORIES_V15 = 64;
export const MAX_EXACT_OVERLAP_FRONTIER_STATES_V15 = 512;
export const MAX_EXACT_OVERLAP_DP_STATES_V15 = 20_000;
export const MAX_EXACT_OVERLAP_DP_WORK_V15 = 500_000;

export interface ExactOverlapRouteRequirementV15 {
  role: string;
  minimum: number;
}

export interface ExactOverlapRouteV15 {
  name: string;
  requirements: readonly ExactOverlapRouteRequirementV15[];
}

export interface ExactOverlapCardCategoryV15 {
  name: string;
  count: number;
  roles: readonly string[];
}

export interface ExactOverlapPackageAssemblyResultV15 {
  population: number;
  draws: number;
  roles: Array<{ name: string; maximumRequired: number }>;
  routes: Array<{ name: string; requirements: ExactOverlapRouteRequirementV15[] }>;
  categories: Array<ExactOverlapCardCategoryV15 & { expectation: ExactFractionV15 }>;
  untrackedCards: number;
  neutralCards: number;
  favorableHands: string;
  totalHands: string;
  probability: ExactFractionV15;
  complement: ExactFractionV15;
  formula: 'overlap-aware-hypergeometric-package-v15';
}

interface NormalizedRouteV15 {
  name: string;
  requirements: ExactOverlapRouteRequirementV15[];
}

interface NormalizedCategoryV15 {
  name: string;
  count: number;
  roles: string[];
}

interface DpStateV15 {
  drawn: number;
  frontier: number[][];
  ways: bigint;
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

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function fraction(numerator: bigint, denominator: bigint): ExactFractionV15 {
  if (denominator === 0n) throw new Error('Exact fraction denominator cannot be zero.');
  let n = numerator;
  let d = denominator;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const divisor = gcd(n, d);
  n /= divisor;
  d /= divisor;
  const decimal = Number(n) / Number(d);
  if (!Number.isFinite(decimal)) {
    throw new Error('Exact fraction decimal presentation exceeded the supported finite range.');
  }
  return { numerator: n.toString(), denominator: d.toString(), decimal };
}

function choose(population: number, selected: number): bigint {
  if (selected < 0 || selected > population) return 0n;
  const count = Math.min(selected, population - selected);
  let result = 1n;
  for (let index = 1; index <= count; index += 1) {
    result = (result * BigInt(population - count + index)) / BigInt(index);
  }
  return result;
}

function bumpWork(counter: WorkCounterV15, amount = 1): void {
  counter.value += amount;
  if (counter.value > MAX_EXACT_OVERLAP_DP_WORK_V15) {
    throw new Error(`exact overlap package calculation exceeded the ${MAX_EXACT_OVERLAP_DP_WORK_V15} transition work limit.`);
  }
}

function vectorDominates(left: readonly number[], right: readonly number[]): boolean {
  for (let index = 0; index < left.length; index += 1) {
    if ((left[index] ?? 0) < (right[index] ?? 0)) return false;
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
 * Keep only the Pareto-maximal fulfillment vectors. A dominated vector can never
 * become preferable later because future physical cards only add fulfillment.
 */
function canonicalizeFrontier(vectors: readonly number[][]): number[][] {
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
    if (maximal.length > MAX_EXACT_OVERLAP_FRONTIER_STATES_V15) {
      throw new Error(`exact overlap package frontier exceeded the ${MAX_EXACT_OVERLAP_FRONTIER_STATES_V15} state limit.`);
    }
  }
  maximal.sort(compareVectors);
  return maximal;
}

function addPhysicalCard(
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
  return canonicalizeFrontier(generated);
}

function frontierKey(frontier: readonly number[][]): string {
  return frontier.map((vector) => vector.join(',')).join(';');
}

function frontierSatisfiesAnyRoute(
  frontier: readonly number[][],
  requirementVectors: readonly number[][],
): boolean {
  return frontier.some((vector) => requirementVectors.some((requirements) => (
    requirements.every((minimum, roleIndex) => (vector[roleIndex] ?? 0) >= minimum)
  )));
}

/**
 * Exact probability that a sampled hand can satisfy at least one package route
 * when physical cards may cover multiple roles.
 *
 * Every drawn physical card may be assigned to at most one role. The DP tracks a
 * canonical Pareto frontier of all attainable saturated role-fulfillment vectors,
 * so a universal tutor/dual-role card can support A or B but can never satisfy A
 * and B simultaneously by itself. Alternative routes are evaluated against the
 * same physical-card frontier and are unioned without double-counting hands.
 */
export function calculateExactOverlapPackageAssemblyV15(input: {
  population: number;
  draws: number;
  routes: readonly ExactOverlapRouteV15[];
  categories: readonly ExactOverlapCardCategoryV15[];
}): ExactOverlapPackageAssemblyResultV15 {
  const population = requireInteger(
    'population',
    input.population,
    0,
    MAX_EXACT_STATISTICS_POPULATION_V15,
  );
  const draws = requireInteger('draws', input.draws, 0, population);
  if (!Array.isArray(input.routes)) throw new Error('routes must be an array.');
  if (input.routes.length < 1) throw new Error('routes must contain at least one route.');
  if (input.routes.length > MAX_EXACT_OVERLAP_ROUTES_V15) {
    throw new Error(`routes must contain at most ${MAX_EXACT_OVERLAP_ROUTES_V15} routes.`);
  }
  if (!Array.isArray(input.categories)) throw new Error('categories must be an array.');
  if (input.categories.length > MAX_EXACT_OVERLAP_CATEGORIES_V15) {
    throw new Error(`categories must contain at most ${MAX_EXACT_OVERLAP_CATEGORIES_V15} categories.`);
  }

  const routeNames = new Set<string>();
  const roleMaximums = new Map<string, number>();
  const routes: NormalizedRouteV15[] = input.routes.map((entry, routeIndex) => {
    if (!entry || typeof entry !== 'object') throw new Error(`routes[${routeIndex}] must be an object.`);
    const name = requireName(`routes[${routeIndex}].name`, entry.name);
    if (routeNames.has(name)) throw new Error(`route names must be unique; duplicate: ${name}.`);
    routeNames.add(name);
    if (!Array.isArray(entry.requirements)) throw new Error(`routes[${routeIndex}].requirements must be an array.`);

    const localRoles = new Set<string>();
    const requirements = entry.requirements.map((requirement: ExactOverlapRouteRequirementV15, requirementIndex: number) => {
      if (!requirement || typeof requirement !== 'object') {
        throw new Error(`routes[${routeIndex}].requirements[${requirementIndex}] must be an object.`);
      }
      const role = requireName(
        `routes[${routeIndex}].requirements[${requirementIndex}].role`,
        requirement.role,
      );
      if (localRoles.has(role)) {
        throw new Error(`route ${name} contains duplicate role requirement: ${role}.`);
      }
      localRoles.add(role);
      const minimum = requireInteger(
        `routes[${routeIndex}].requirements[${requirementIndex}].minimum`,
        requirement.minimum,
        0,
        population,
      );
      roleMaximums.set(role, Math.max(roleMaximums.get(role) ?? 0, minimum));
      return { role, minimum };
    });
    return { name, requirements };
  });

  if (roleMaximums.size > MAX_EXACT_OVERLAP_ROLES_V15) {
    throw new Error(`overlap routes may reference at most ${MAX_EXACT_OVERLAP_ROLES_V15} unique roles.`);
  }

  const categoryNames = new Set<string>();
  let declaredTrackedCards = 0;
  const categories: NormalizedCategoryV15[] = input.categories.map((entry, categoryIndex) => {
    if (!entry || typeof entry !== 'object') throw new Error(`categories[${categoryIndex}] must be an object.`);
    const name = requireName(`categories[${categoryIndex}].name`, entry.name);
    if (categoryNames.has(name)) throw new Error(`category names must be unique; duplicate: ${name}.`);
    categoryNames.add(name);
    const count = requireInteger(`categories[${categoryIndex}].count`, entry.count, 0, population);
    declaredTrackedCards += count;
    if (!Array.isArray(entry.roles)) throw new Error(`categories[${categoryIndex}].roles must be an array.`);
    if (entry.roles.length < 1) throw new Error(`categories[${categoryIndex}].roles must contain at least one role.`);

    const localRoles = new Set<string>();
    const roles = entry.roles.map((roleValue: string, roleIndex: number) => {
      const role = requireName(`categories[${categoryIndex}].roles[${roleIndex}]`, roleValue);
      if (!roleMaximums.has(role)) throw new Error(`category ${name} references unknown role: ${role}.`);
      if (localRoles.has(role)) throw new Error(`category ${name} contains duplicate role capability: ${role}.`);
      localRoles.add(role);
      return role;
    });
    return { name, count, roles };
  });

  if (declaredTrackedCards > population) {
    throw new Error('category counts must describe disjoint physical cards and sum to no more than population.');
  }

  const total = choose(population, draws);
  const untrackedCards = population - declaredTrackedCards;
  const roles = [...roleMaximums.keys()];
  const roleIndexByName = new Map(roles.map((role, index) => [role, index] as const));

  const possibleRoutes = routes.filter((route) => (
    route.requirements.reduce((sum, requirement) => sum + requirement.minimum, 0) <= draws
  ));

  const activeCaps = new Array<number>(roles.length).fill(0);
  const requirementVectors = possibleRoutes.map((route) => {
    const vector = new Array<number>(roles.length).fill(0);
    for (const requirement of route.requirements) {
      const roleIndex = roleIndexByName.get(requirement.role);
      if (roleIndex === undefined) throw new Error(`Internal overlap role index missing for ${requirement.role}.`);
      vector[roleIndex] = requirement.minimum;
      activeCaps[roleIndex] = Math.max(activeCaps[roleIndex] ?? 0, requirement.minimum);
    }
    return vector;
  });

  let favorable = 0n;
  let neutralCards = population;

  if (possibleRoutes.length > 0) {
    const zeroRequirementRoute = requirementVectors.some((vector) => vector.every((minimum) => minimum === 0));
    if (zeroRequirementRoute) {
      favorable = total;
    } else {
      const relevantCategories = categories.map((category) => ({
        ...category,
        roleIndexes: category.roles
          .map((role) => roleIndexByName.get(role))
          .filter((roleIndex): roleIndex is number => roleIndex !== undefined && (activeCaps[roleIndex] ?? 0) > 0),
      })).filter((category) => category.roleIndexes.length > 0 && category.count > 0);

      const relevantTrackedCards = relevantCategories.reduce((sum, category) => sum + category.count, 0);
      neutralCards = population - relevantTrackedCards;

      const initialFrontier = [new Array<number>(roles.length).fill(0)];
      let dp = new Map<string, DpStateV15>();
      dp.set(`0|${frontierKey(initialFrontier)}`, { drawn: 0, frontier: initialFrontier, ways: 1n });
      const work: WorkCounterV15 = { value: 0 };

      for (const category of relevantCategories) {
        const next = new Map<string, DpStateV15>();
        for (const state of dp.values()) {
          const maximumPicked = Math.min(category.count, draws - state.drawn);
          let frontierForPicked = state.frontier;
          for (let picked = 0; picked <= maximumPicked; picked += 1) {
            if (picked > 0) {
              frontierForPicked = addPhysicalCard(frontierForPicked, category.roleIndexes, activeCaps, work);
            }
            bumpWork(work);
            const drawn = state.drawn + picked;
            const key = `${drawn}|${frontierKey(frontierForPicked)}`;
            const ways = state.ways * choose(category.count, picked);
            const existing = next.get(key);
            if (existing) {
              existing.ways += ways;
            } else {
              next.set(key, { drawn, frontier: frontierForPicked, ways });
              if (next.size > MAX_EXACT_OVERLAP_DP_STATES_V15) {
                throw new Error(`exact overlap package DP exceeded the ${MAX_EXACT_OVERLAP_DP_STATES_V15} state limit.`);
              }
            }
          }
        }
        dp = next;
      }

      for (const state of dp.values()) {
        if (!frontierSatisfiesAnyRoute(state.frontier, requirementVectors)) continue;
        favorable += state.ways * choose(neutralCards, draws - state.drawn);
      }
    }
  }

  const probability = fraction(favorable, total);
  const complement = fraction(total - favorable, total);
  return {
    population,
    draws,
    roles: roles.map((name) => ({ name, maximumRequired: roleMaximums.get(name) ?? 0 })),
    routes: routes.map((route) => ({
      name: route.name,
      requirements: route.requirements.map((requirement) => ({ ...requirement })),
    })),
    categories: categories.map((category) => ({
      name: category.name,
      count: category.count,
      roles: [...category.roles],
      expectation: population === 0
        ? fraction(0n, 1n)
        : fraction(BigInt(draws) * BigInt(category.count), BigInt(population)),
    })),
    untrackedCards,
    neutralCards,
    favorableHands: favorable.toString(),
    totalHands: total.toString(),
    probability,
    complement,
    formula: 'overlap-aware-hypergeometric-package-v15',
  };
}
