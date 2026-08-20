import { createHash } from 'node:crypto';
import { fingerprintExactDeckV15 } from './learning-corpus-v15.js';
import type { TopDeckLearningCandidateV15 } from './topdeck-learning-adapter-v15.js';
import type { TopDeckLearningLinkageV15 } from './topdeck-learning-materializer-v15.js';

export const TOPDECK_LEAKAGE_LINKAGE_SCHEMA_V15 = 'topdeck-leakage-linkage-v15.1' as const;

export interface PlannedTopDeckLearningLinkageV15 extends TopDeckLearningLinkageV15 {
  sourceRetrievedAt: string;
}

export interface TopDeckLeakageLinkagePlanV15 {
  schemaVersion: typeof TOPDECK_LEAKAGE_LINKAGE_SCHEMA_V15;
  candidates: number;
  components: number;
  eventGroups: number;
  pilotGroups: number;
  exactDeckGroups: number;
  repeatedEvents: number;
  repeatedPilots: number;
  repeatedExactDecks: number;
  maximumComponentSize: number;
  linkagesByProviderRecordId: Record<string, PlannedTopDeckLearningLinkageV15>;
  safeguards: readonly [
    'Rows from the same TopDeck event share one independence group.',
    'Rows connected by event, pilot identity, or exact deck fingerprint share one leakage component before temporal partitioning.',
    'Provider record IDs must be unique within the planned corpus batch.',
    'Outcome timestamps may not occur after source observation.'
  ];
}

function normalize(value: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('TopDeck linkage identity must be a non-empty string.');
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function timestamp(name: string, value: string): { iso: string; ms: number } {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty timestamp.`);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`${name} must be a valid timestamp.`);
  return { iso: new Date(ms).toISOString(), ms };
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

class UnionFind {
  private readonly parent: number[];
  private readonly rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
    this.rank = Array.from({ length: size }, () => 0);
  }

  find(index: number): number {
    const parent = this.parent[index];
    if (parent === undefined) throw new Error(`Union-find index ${index} is outside the planned corpus.`);
    if (parent === index) return index;
    const root = this.find(parent);
    this.parent[index] = root;
    return root;
  }

  union(left: number, right: number): void {
    let leftRoot = this.find(left);
    let rightRoot = this.find(right);
    if (leftRoot === rightRoot) return;
    const leftRank = this.rank[leftRoot] ?? 0;
    const rightRank = this.rank[rightRoot] ?? 0;
    if (leftRank < rightRank) [leftRoot, rightRoot] = [rightRoot, leftRoot];
    this.parent[rightRoot] = leftRoot;
    if (leftRank === rightRank) this.rank[leftRoot] = leftRank + 1;
  }
}

function repeatedGroupCount(map: Map<string, number[]>): number {
  return [...map.values()].filter((indices) => indices.length > 1).length;
}

function connectToken(map: Map<string, number[]>, key: string, index: number): void {
  const indices = map.get(key) ?? [];
  indices.push(index);
  map.set(key, indices);
}

function unionGroups(unionFind: UnionFind, groups: Map<string, number[]>): void {
  for (const indices of groups.values()) {
    const first = indices[0];
    if (first === undefined) continue;
    for (const index of indices.slice(1)) unionFind.union(first, index);
  }
}

/**
 * Builds pre-feature leakage groups for a TopDeck corpus batch.
 *
 * The transitive closure matters: if event A shares pilot X with event B, and
 * event B shares an exact deck with event C, all three events belong to one
 * leakage component even when A and C do not directly share an identifier.
 * This grouping happens before feature normalization or model fitting.
 */
export function planTopDeckLeakageLinkagesV15(
  candidates: TopDeckLearningCandidateV15[],
  options: {
    sourceObservedAt: string;
    sourceRetrievedAt: string;
  },
): TopDeckLeakageLinkagePlanV15 {
  if (!Array.isArray(candidates) || candidates.length === 0) throw new Error('At least one TopDeck candidate is required for leakage planning.');
  const observed = timestamp('sourceObservedAt', options.sourceObservedAt);
  const retrieved = timestamp('sourceRetrievedAt', options.sourceRetrievedAt);
  if (retrieved.ms < observed.ms) throw new Error('sourceRetrievedAt cannot occur before sourceObservedAt.');

  const providerRecordIds = new Set<string>();
  const eventGroups = new Map<string, number[]>();
  const pilotGroups = new Map<string, number[]>();
  const deckGroups = new Map<string, number[]>();
  const identities = candidates.map((candidate, index) => {
    if (!candidate || typeof candidate !== 'object') throw new Error(`TopDeck candidate ${index} must be an object.`);
    const recordId = normalize(candidate.providerRecordId);
    if (providerRecordIds.has(recordId)) throw new Error(`Duplicate TopDeck providerRecordId in corpus batch: ${candidate.providerRecordId}.`);
    providerRecordIds.add(recordId);
    const event = normalize(candidate.providerEventId);
    const pilot = normalize(candidate.providerPlayerId);
    const outcome = timestamp(`candidate[${index}].outcomeOccurredAt`, candidate.outcomeOccurredAt);
    if (outcome.ms > observed.ms) throw new Error(`TopDeck candidate ${candidate.providerRecordId} outcome occurs after source observation.`);
    const deck = fingerprintExactDeckV15(candidate.decklist).toLocaleLowerCase();
    connectToken(eventGroups, event, index);
    connectToken(pilotGroups, pilot, index);
    connectToken(deckGroups, deck, index);
    return { recordId, event, pilot, deck, outcome: outcome.iso };
  });

  const unionFind = new UnionFind(candidates.length);
  unionGroups(unionFind, eventGroups);
  unionGroups(unionFind, pilotGroups);
  unionGroups(unionFind, deckGroups);

  const componentMembers = new Map<number, number[]>();
  for (let index = 0; index < candidates.length; index += 1) {
    const root = unionFind.find(index);
    const members = componentMembers.get(root) ?? [];
    members.push(index);
    componentMembers.set(root, members);
  }

  const leakageKeyByIndex = new Map<number, string>();
  for (const members of componentMembers.values()) {
    const tokens = new Set<string>();
    for (const index of members) {
      const identity = identities[index];
      if (!identity) throw new Error(`Missing TopDeck leakage identity for index ${index}.`);
      tokens.add(`event:${identity.event}`);
      tokens.add(`pilot:${identity.pilot}`);
      tokens.add(`deck:${identity.deck}`);
    }
    const digest = sha256([...tokens].sort().join('\n'));
    const leakageKey = `topdeck-lineage-component:${digest}`;
    for (const index of members) leakageKeyByIndex.set(index, leakageKey);
  }

  const linkagesByProviderRecordId: Record<string, PlannedTopDeckLearningLinkageV15> = {};
  const canonicalIds = new Set<string>();
  candidates.forEach((candidate, index) => {
    const identity = identities[index];
    const leakageKey = leakageKeyByIndex.get(index);
    if (!identity || !leakageKey) throw new Error(`Failed to plan TopDeck linkage for candidate index ${index}.`);
    const canonicalOutcomeId = `topdeck:event-top-cut:${sha256([
      identity.recordId,
      identity.event,
      identity.pilot,
      identity.deck,
      identity.outcome,
    ].join('\n'))}`;
    if (canonicalIds.has(canonicalOutcomeId)) throw new Error(`Canonical TopDeck outcome collision for ${candidate.providerRecordId}.`);
    canonicalIds.add(canonicalOutcomeId);
    linkagesByProviderRecordId[candidate.providerRecordId] = {
      canonicalOutcomeId,
      independenceKey: `topdeck-event:${sha256(identity.event)}`,
      leakageKey,
      sourceObservedAt: observed.iso,
      sourceRetrievedAt: retrieved.iso,
    };
  });

  return {
    schemaVersion: TOPDECK_LEAKAGE_LINKAGE_SCHEMA_V15,
    candidates: candidates.length,
    components: componentMembers.size,
    eventGroups: eventGroups.size,
    pilotGroups: pilotGroups.size,
    exactDeckGroups: deckGroups.size,
    repeatedEvents: repeatedGroupCount(eventGroups),
    repeatedPilots: repeatedGroupCount(pilotGroups),
    repeatedExactDecks: repeatedGroupCount(deckGroups),
    maximumComponentSize: Math.max(...[...componentMembers.values()].map((members) => members.length)),
    linkagesByProviderRecordId,
    safeguards: [
      'Rows from the same TopDeck event share one independence group.',
      'Rows connected by event, pilot identity, or exact deck fingerprint share one leakage component before temporal partitioning.',
      'Provider record IDs must be unique within the planned corpus batch.',
      'Outcome timestamps may not occur after source observation.',
    ],
  };
}
