export interface BudgetSelectionCandidateV15 {
  id: string;
  priceUsd: number;
  score: number;
}

export interface BudgetSelectionInputV15 {
  slots: number;
  maxTotalUsd: number;
  fixedCostUsd: number;
  candidates: readonly BudgetSelectionCandidateV15[];
  requiredIds?: readonly string[];
}

export interface BudgetSelectionResultV15 {
  status: 'complete' | 'infeasible';
  selectedIds: string[];
  selectedCostUsd: number;
  totalWithFixedCostUsd: number;
  unusedBudgetUsd: number;
  reason: string | null;
}

function money(value: number): number {
  return Number(value.toFixed(2));
}

function validateMoney(label: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a finite non-negative price.`);
}

function sortedCandidates(candidates: readonly BudgetSelectionCandidateV15[]): BudgetSelectionCandidateV15[] {
  const seen = new Set<string>();
  return [...candidates]
    .map((candidate) => {
      const id = candidate.id.trim();
      if (!id) throw new Error('Budget candidate id must be non-empty.');
      validateMoney(`Budget candidate ${id}`, candidate.priceUsd);
      if (!Number.isFinite(candidate.score)) throw new Error(`Budget candidate ${id} score must be finite.`);
      if (seen.has(id)) throw new Error(`Duplicate budget candidate id: ${id}.`);
      seen.add(id);
      return { ...candidate, id };
    })
    .sort((a, b) => b.score - a.score || a.priceUsd - b.priceUsd || a.id.localeCompare(b.id));
}

function cheapestTailCost(candidates: readonly BudgetSelectionCandidateV15[], count: number): number | null {
  if (count <= 0) return 0;
  if (candidates.length < count) return null;
  const prices = [...candidates].sort((a, b) => a.priceUsd - b.priceUsd || a.id.localeCompare(b.id));
  return prices.slice(0, count).reduce((sum, candidate) => sum + candidate.priceUsd, 0);
}

export function planBudgetedSelectionV15(input: BudgetSelectionInputV15): BudgetSelectionResultV15 {
  const slots = Math.trunc(input.slots);
  if (!Number.isFinite(input.slots) || slots < 0 || slots !== input.slots) throw new Error('Budget slots must be a non-negative integer.');
  validateMoney('Maximum total budget', input.maxTotalUsd);
  validateMoney('Fixed budget cost', input.fixedCostUsd);
  if (input.fixedCostUsd > input.maxTotalUsd) {
    return {
      status: 'infeasible',
      selectedIds: [],
      selectedCostUsd: 0,
      totalWithFixedCostUsd: money(input.fixedCostUsd),
      unusedBudgetUsd: money(input.maxTotalUsd - input.fixedCostUsd),
      reason: `Fixed costs ${money(input.fixedCostUsd)} exceed the maximum total budget ${money(input.maxTotalUsd)}.`,
    };
  }

  const candidates = sortedCandidates(input.candidates);
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const requiredIds = [...new Set((input.requiredIds ?? []).map((id) => id.trim()).filter(Boolean))].sort();
  if (requiredIds.length > slots) {
    return {
      status: 'infeasible',
      selectedIds: [],
      selectedCostUsd: 0,
      totalWithFixedCostUsd: money(input.fixedCostUsd),
      unusedBudgetUsd: money(input.maxTotalUsd - input.fixedCostUsd),
      reason: `The ${requiredIds.length} required cards exceed the ${slots} available budgeted slots.`,
    };
  }

  const required: BudgetSelectionCandidateV15[] = [];
  for (const id of requiredIds) {
    const candidate = byId.get(id);
    if (!candidate) {
      return {
        status: 'infeasible',
        selectedIds: [],
        selectedCostUsd: 0,
        totalWithFixedCostUsd: money(input.fixedCostUsd),
        unusedBudgetUsd: money(input.maxTotalUsd - input.fixedCostUsd),
        reason: `Required budget card ${id} has no known eligible priced candidate.`,
      };
    }
    required.push(candidate);
  }

  const requiredCost = required.reduce((sum, candidate) => sum + candidate.priceUsd, 0);
  if (input.fixedCostUsd + requiredCost > input.maxTotalUsd) {
    return {
      status: 'infeasible',
      selectedIds: [],
      selectedCostUsd: money(requiredCost),
      totalWithFixedCostUsd: money(input.fixedCostUsd + requiredCost),
      unusedBudgetUsd: money(input.maxTotalUsd - input.fixedCostUsd - requiredCost),
      reason: `Fixed plus required-card costs exceed the maximum total budget ${money(input.maxTotalUsd)}. Required cards are never silently dropped for budget compliance.`,
    };
  }

  const requiredSet = new Set(requiredIds);
  let remaining = candidates.filter((candidate) => !requiredSet.has(candidate.id));
  const remainingSlots = slots - required.length;
  const minimumTail = cheapestTailCost(remaining, remainingSlots);
  if (minimumTail === null || input.fixedCostUsd + requiredCost + minimumTail > input.maxTotalUsd) {
    const minimum = minimumTail === null ? null : money(input.fixedCostUsd + requiredCost + minimumTail);
    return {
      status: 'infeasible',
      selectedIds: [],
      selectedCostUsd: money(requiredCost),
      totalWithFixedCostUsd: money(input.fixedCostUsd + requiredCost),
      unusedBudgetUsd: money(input.maxTotalUsd - input.fixedCostUsd - requiredCost),
      reason: minimum === null
        ? `Only ${remaining.length + required.length} priced candidates exist for ${slots} required slots.`
        : `The minimum known-price cost to fill all ${slots} slots is ${minimum}, above the maximum total budget ${money(input.maxTotalUsd)}.`,
    };
  }

  const selected = [...required];
  let selectedCost = requiredCost;
  while (selected.length < slots) {
    const slotsAfterPick = slots - selected.length - 1;
    let chosen: BudgetSelectionCandidateV15 | null = null;
    for (const candidate of remaining) {
      const others = remaining.filter((entry) => entry.id !== candidate.id);
      const tail = cheapestTailCost(others, slotsAfterPick);
      if (tail === null) continue;
      if (input.fixedCostUsd + selectedCost + candidate.priceUsd + tail <= input.maxTotalUsd + 1e-9) {
        chosen = candidate;
        break;
      }
    }
    if (!chosen) {
      return {
        status: 'infeasible',
        selectedIds: [],
        selectedCostUsd: money(selectedCost),
        totalWithFixedCostUsd: money(input.fixedCostUsd + selectedCost),
        unusedBudgetUsd: money(input.maxTotalUsd - input.fixedCostUsd - selectedCost),
        reason: `No deterministic selection can fill the remaining ${slots - selected.length} slots without exceeding the whole-deck budget.`,
      };
    }
    selected.push(chosen);
    selectedCost += chosen.priceUsd;
    remaining = remaining.filter((entry) => entry.id !== chosen?.id);
  }

  const total = input.fixedCostUsd + selectedCost;
  return {
    status: 'complete',
    selectedIds: selected.map((candidate) => candidate.id),
    selectedCostUsd: money(selectedCost),
    totalWithFixedCostUsd: money(total),
    unusedBudgetUsd: money(input.maxTotalUsd - total),
    reason: null,
  };
}
