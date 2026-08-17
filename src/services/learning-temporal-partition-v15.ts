export interface TemporalPartitionItemV15 {
  id: string;
  observedAt: string;
  leakageGroup: string;
}

export interface TemporalLeakagePartitionV15 {
  trainingIds: string[];
  holdoutIds: string[];
  cutoff: string | null;
  leakageChecksPassed: boolean;
  overlappingLeakageGroups: string[];
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function timestampMs(name: string, value: string): number {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty valid timestamp.`);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`${name} must be a valid timestamp.`);
  return ms;
}

function canonicalItemCompare(a: TemporalPartitionItemV15, b: TemporalPartitionItemV15): number {
  const timeDifference = timestampMs('observedAt', a.observedAt) - timestampMs('observedAt', b.observedAt);
  if (timeDifference !== 0) return timeDifference;
  const groupDifference = normalize(a.leakageGroup).localeCompare(normalize(b.leakageGroup));
  if (groupDifference !== 0) return groupDifference;
  return normalize(a.id).localeCompare(normalize(b.id));
}

/**
 * Plans a temporal split using only pre-feature provenance. The planner never
 * inspects labels, deck metrics, normalized predictors, or model outputs.
 */
export function planTemporalLeakagePartitionV15(
  items: TemporalPartitionItemV15[],
  holdoutFraction = 0.2,
): TemporalLeakagePartitionV15 {
  if (!Array.isArray(items)) throw new Error('items must be an array.');
  if (items.length === 0) {
    return {
      trainingIds: [],
      holdoutIds: [],
      cutoff: null,
      leakageChecksPassed: true,
      overlappingLeakageGroups: [],
    };
  }

  const seenIds = new Set<string>();
  for (const item of items) {
    if (!item || typeof item !== 'object') throw new Error('Each temporal partition item must be an object.');
    if (typeof item.id !== 'string' || !item.id.trim()) throw new Error('Temporal partition item id must be non-empty.');
    const id = normalize(item.id);
    if (seenIds.has(id)) throw new Error(`Duplicate temporal partition id: ${item.id}.`);
    seenIds.add(id);
    timestampMs('observedAt', item.observedAt);
    if (typeof item.leakageGroup !== 'string' || !item.leakageGroup.trim()) {
      throw new Error('leakageGroup must be a non-empty string.');
    }
  }

  const sorted = [...items].sort(canonicalItemCompare);
  const fraction = Math.min(0.5, Math.max(0.05, Number.isFinite(holdoutFraction) ? holdoutFraction : 0.2));
  const desiredHoldout = Math.max(1, Math.ceil(sorted.length * fraction));
  const tentativeCut = Math.max(1, sorted.length - desiredHoldout);
  const cutoffItem = sorted[tentativeCut] ?? sorted[sorted.length - 1];
  if (!cutoffItem) throw new Error('Temporal partition could not derive a cutoff item.');
  const cutoffMs = timestampMs('cutoff observedAt', cutoffItem.observedAt);

  const latestByLeakageGroup = new Map<string, number>();
  for (const item of sorted) {
    const group = normalize(item.leakageGroup);
    const time = timestampMs('observedAt', item.observedAt);
    latestByLeakageGroup.set(group, Math.max(latestByLeakageGroup.get(group) ?? Number.NEGATIVE_INFINITY, time));
  }

  const trainingIds: string[] = [];
  const holdoutIds: string[] = [];
  const trainingGroups = new Set<string>();
  const holdoutGroups = new Set<string>();
  for (const item of sorted) {
    const group = normalize(item.leakageGroup);
    const latest = latestByLeakageGroup.get(group) ?? 0;
    if (latest >= cutoffMs) {
      holdoutIds.push(item.id);
      holdoutGroups.add(group);
    } else {
      trainingIds.push(item.id);
      trainingGroups.add(group);
    }
  }

  const overlappingLeakageGroups = [...trainingGroups].filter((group) => holdoutGroups.has(group)).sort();
  return {
    trainingIds,
    holdoutIds,
    cutoff: new Date(cutoffMs).toISOString(),
    leakageChecksPassed: overlappingLeakageGroups.length === 0,
    overlappingLeakageGroups,
  };
}
