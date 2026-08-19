import {
  assertHistoricalLearningRecordEligibleV15,
  type HistoricalLearningRecordV15,
} from './historical-learning-corpus-v15.js';
import { learningTargetForRecordV15 } from './learning-corpus-v15.js';
import {
  realOutcomeSourceByIdV15,
  sourceCanTrainTargetV15,
  type RealOutcomeSourceInventoryEntryV15,
} from './real-outcome-source-inventory-v15.js';

export const REAL_CORPUS_QUALITY_SCHEMA_V15 = 'real-corpus-quality-v15.1' as const;

export interface RealCorpusBucketV15 {
  key: string;
  records: number;
  share: number;
}

export interface RealCorpusSourceSummaryV15 {
  sourceId: string;
  sourceName: string | null;
  lineageFamily: string;
  population: string | null;
  trainingStatus: RealOutcomeSourceInventoryEntryV15['trainingStatus'] | 'unregistered';
  records: number;
  replayableRecords: number;
  uniqueEvents: number;
  uniquePilots: number;
}

export interface RealCorpusQualityAuditV15 {
  schemaVersion: typeof REAL_CORPUS_QUALITY_SCHEMA_V15;
  records: number;
  positiveRecords: number;
  negativeRecords: number;
  minorityShare: number;
  learningTargets: string[];
  sourceIds: string[];
  lineageFamilies: string[];
  independentLineageFamilies: number;
  sources: RealCorpusSourceSummaryV15[];
  blockedSourceRecords: number;
  unregisteredSourceRecords: number;
  temporalCoverage: {
    earliestOutcomeAt: string | null;
    latestOutcomeAt: string | null;
    coverageDays: number;
    byMonth: RealCorpusBucketV15[];
  };
  commanderCoverage: {
    uniqueCommanderIdentities: number;
    top: RealCorpusBucketV15[];
  };
  eventCoverage: {
    uniqueEvents: number;
    repeatedEvents: number;
    maximumRecordsInOneEvent: number;
    missingEventIdentityRecords: number;
    fieldSizeBuckets: RealCorpusBucketV15[];
  };
  pilotCoverage: {
    uniquePilots: number;
    repeatedPilots: number;
    maximumRecordsPerPilot: number;
    missingPilotIdentityRecords: number;
  };
  deckReuse: {
    uniqueDeckFingerprints: number;
    repeatedDeckFingerprints: number;
    maximumOccurrencesOfOneDeck: number;
    deckFingerprintsAcrossMultipleEvents: number;
  };
  leakageCoverage: {
    groups: number;
    maximumRecordsInOneGroup: number;
    maximumGroupShare: number;
  };
  metadataCoverage: {
    recordsWithRegion: number;
    recordsWithArchetype: number;
    missingRegionShare: number;
    missingArchetypeShare: number;
  };
  sourceLineageCollisions: Array<{
    lineageFamily: string;
    sourceIds: string[];
    records: number;
  }>;
  qualityGatePassed: boolean;
  warnings: string[];
  blockers: string[];
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function round(value: number, digits = 4): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function metadataString(record: HistoricalLearningRecordV15, key: string): string | null {
  const value = record.record.metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function metadataNumber(record: HistoricalLearningRecordV15, key: string): number | null {
  const value = record.record.metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function increment(map: Map<string, number>, key: string, amount = 1): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function buckets(map: Map<string, number>, total: number, limit?: number): RealCorpusBucketV15[] {
  const values = [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, records]) => ({ key, records, share: total > 0 ? round(records / total) : 0 }));
  return limit === undefined ? values : values.slice(0, limit);
}

function fieldSizeBucket(value: number | null): string {
  if (value === null || !Number.isInteger(value) || value < 1) return 'missing';
  if (value < 16) return '1-15';
  if (value < 32) return '16-31';
  if (value < 64) return '32-63';
  if (value < 128) return '64-127';
  return '128+';
}

function commanderIdentity(record: HistoricalLearningRecordV15): string {
  return record.record.commanderNames.map((name) => name.trim()).filter(Boolean).sort().join(' / ');
}

function regionIdentity(record: HistoricalLearningRecordV15): string | null {
  const explicit = metadataString(record, 'eventRegion') ?? metadataString(record, 'region');
  if (explicit) return explicit;
  const city = metadataString(record, 'eventCity');
  const state = metadataString(record, 'eventState');
  if (!city && !state) return null;
  return [city, state].filter((value): value is string => Boolean(value)).join(', ');
}

function temporalRange(records: HistoricalLearningRecordV15[]): {
  earliestOutcomeAt: string | null;
  latestOutcomeAt: string | null;
  coverageDays: number;
} {
  const times = records
    .map((record) => Date.parse(record.record.observedAt))
    .filter((value) => Number.isFinite(value));
  if (times.length === 0) return { earliestOutcomeAt: null, latestOutcomeAt: null, coverageDays: 0 };
  const earliest = Math.min(...times);
  const latest = Math.max(...times);
  return {
    earliestOutcomeAt: new Date(earliest).toISOString(),
    latestOutcomeAt: new Date(latest).toISOString(),
    coverageDays: round((latest - earliest) / 86_400_000, 2),
  };
}

/**
 * Audits only strict, replayable historical learning records. This is a corpus
 * quality report, not a model score: it surfaces concentration, missing coverage,
 * mirror lineage, repeated pilots/events/decks, and source-policy blockers before
 * any fitting step is allowed to claim useful evidence.
 */
export function auditRealCorpusQualityV15(records: HistoricalLearningRecordV15[]): RealCorpusQualityAuditV15 {
  if (!Array.isArray(records) || records.length === 0) throw new Error('At least one strict historical learning record is required.');
  for (const record of records) assertHistoricalLearningRecordEligibleV15(record);

  const total = records.length;
  const positiveRecords = records.filter((record) => record.record.label === 1).length;
  const negativeRecords = total - positiveRecords;
  const learningTargets = [...new Set(records.map((record) => learningTargetForRecordV15(record.record)))].sort();
  const sourceIds = [...new Set(records.map((record) => normalize(record.record.sourceId)))].sort();

  const monthCounts = new Map<string, number>();
  const commanderCounts = new Map<string, number>();
  const eventCounts = new Map<string, number>();
  const pilotCounts = new Map<string, number>();
  const deckCounts = new Map<string, number>();
  const deckEvents = new Map<string, Set<string>>();
  const leakageCounts = new Map<string, number>();
  const fieldSizeCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  const sourceReplayableCounts = new Map<string, number>();
  const sourceEvents = new Map<string, Set<string>>();
  const sourcePilots = new Map<string, Set<string>>();
  const lineageSources = new Map<string, Set<string>>();
  const lineageRecordCounts = new Map<string, number>();

  let missingEventIdentityRecords = 0;
  let missingPilotIdentityRecords = 0;
  let recordsWithRegion = 0;
  let recordsWithArchetype = 0;
  let blockedSourceRecords = 0;
  let unregisteredSourceRecords = 0;

  for (const historical of records) {
    const record = historical.record;
    const target = learningTargetForRecordV15(record);
    const sourceId = normalize(record.sourceId);
    const inventory = realOutcomeSourceByIdV15(sourceId);
    const lineage = inventory?.lineageFamily ?? `unregistered:${sourceId}`;
    increment(sourceCounts, sourceId);
    if (historical.outcomeEvidence.replayable) increment(sourceReplayableCounts, sourceId);
    if (!inventory) unregisteredSourceRecords += 1;
    if (!sourceCanTrainTargetV15(sourceId, target)) blockedSourceRecords += 1;
    const lineageSet = lineageSources.get(lineage) ?? new Set<string>();
    lineageSet.add(sourceId);
    lineageSources.set(lineage, lineageSet);
    increment(lineageRecordCounts, lineage);

    const time = new Date(record.observedAt);
    increment(monthCounts, time.toISOString().slice(0, 7));
    increment(commanderCounts, commanderIdentity(historical));
    increment(deckCounts, record.deckFingerprint.toLocaleLowerCase());
    increment(leakageCounts, normalize(record.leakageGroup));
    increment(fieldSizeCounts, fieldSizeBucket(metadataNumber(historical, 'fieldSize')));

    const eventId = metadataString(historical, 'providerEventId') ?? metadataString(historical, 'eventId');
    if (eventId) {
      const eventKey = `${sourceId}:${normalize(eventId)}`;
      increment(eventCounts, eventKey);
      const perSource = sourceEvents.get(sourceId) ?? new Set<string>();
      perSource.add(eventKey);
      sourceEvents.set(sourceId, perSource);
      const events = deckEvents.get(record.deckFingerprint.toLocaleLowerCase()) ?? new Set<string>();
      events.add(eventKey);
      deckEvents.set(record.deckFingerprint.toLocaleLowerCase(), events);
    } else {
      missingEventIdentityRecords += 1;
    }

    const pilotId = metadataString(historical, 'providerPlayerId') ?? metadataString(historical, 'pilotId');
    if (pilotId) {
      const pilotKey = `${sourceId}:${normalize(pilotId)}`;
      increment(pilotCounts, pilotKey);
      const perSource = sourcePilots.get(sourceId) ?? new Set<string>();
      perSource.add(pilotKey);
      sourcePilots.set(sourceId, perSource);
    } else {
      missingPilotIdentityRecords += 1;
    }

    if (regionIdentity(historical)) recordsWithRegion += 1;
    if (metadataString(historical, 'archetype') ?? metadataString(historical, 'archetypeId')) recordsWithArchetype += 1;
  }

  const sources: RealCorpusSourceSummaryV15[] = sourceIds.map((sourceId) => {
    const inventory = realOutcomeSourceByIdV15(sourceId);
    return {
      sourceId,
      sourceName: inventory?.name ?? null,
      lineageFamily: inventory?.lineageFamily ?? `unregistered:${sourceId}`,
      population: inventory?.population ?? null,
      trainingStatus: inventory?.trainingStatus ?? 'unregistered',
      records: sourceCounts.get(sourceId) ?? 0,
      replayableRecords: sourceReplayableCounts.get(sourceId) ?? 0,
      uniqueEvents: sourceEvents.get(sourceId)?.size ?? 0,
      uniquePilots: sourcePilots.get(sourceId)?.size ?? 0,
    };
  });

  const sourceLineageCollisions = [...lineageSources.entries()]
    .filter(([, ids]) => ids.size > 1)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([lineageFamily, ids]) => ({
      lineageFamily,
      sourceIds: [...ids].sort(),
      records: lineageRecordCounts.get(lineageFamily) ?? 0,
    }));

  const maxEvent = Math.max(0, ...eventCounts.values());
  const maxPilot = Math.max(0, ...pilotCounts.values());
  const maxDeck = Math.max(0, ...deckCounts.values());
  const maxLeakage = Math.max(0, ...leakageCounts.values());
  const lineages = [...lineageSources.keys()].sort();
  const warnings: string[] = [];
  const blockers: string[] = [];

  if (learningTargets.length !== 1) blockers.push(`Corpus mixes learning targets (${learningTargets.join(', ')}).`);
  if (positiveRecords === 0 || negativeRecords === 0) blockers.push('Corpus contains only one outcome class.');
  if (blockedSourceRecords > 0) blockers.push(`${blockedSourceRecords} record(s) come from a source/target combination not enabled for strict training.`);
  if (unregisteredSourceRecords > 0) blockers.push(`${unregisteredSourceRecords} record(s) come from an unregistered real-outcome source.`);
  if (sourceLineageCollisions.length > 0) warnings.push('Multiple source IDs share an underlying lineage family; they must not be counted as independent corroboration merely because the host/source ID differs.');
  if (lineages.length < 2) warnings.push('Corpus currently represents only one source-lineage family; cross-provider generalization cannot yet be measured.');
  if (missingEventIdentityRecords > 0) warnings.push(`${missingEventIdentityRecords} record(s) lack explicit provider event identity, limiting event concentration and mirror audits.`);
  if (missingPilotIdentityRecords > 0) warnings.push(`${missingPilotIdentityRecords} record(s) lack explicit pilot identity, limiting repeated-pilot leakage analysis.`);
  if (recordsWithRegion < total) warnings.push(`${total - recordsWithRegion} record(s) lack region/location metadata.`);
  if (recordsWithArchetype < total) warnings.push(`${total - recordsWithArchetype} record(s) lack explicit archetype metadata.`);
  if (maxLeakage / total > 0.25) warnings.push('More than 25% of the corpus belongs to one leakage group; event/pilot concentration may dominate model estimates.');

  const range = temporalRange(records);
  return {
    schemaVersion: REAL_CORPUS_QUALITY_SCHEMA_V15,
    records: total,
    positiveRecords,
    negativeRecords,
    minorityShare: round(Math.min(positiveRecords, negativeRecords) / total),
    learningTargets,
    sourceIds,
    lineageFamilies: lineages,
    independentLineageFamilies: lineages.length,
    sources,
    blockedSourceRecords,
    unregisteredSourceRecords,
    temporalCoverage: {
      ...range,
      byMonth: buckets(monthCounts, total),
    },
    commanderCoverage: {
      uniqueCommanderIdentities: commanderCounts.size,
      top: buckets(commanderCounts, total, 20),
    },
    eventCoverage: {
      uniqueEvents: eventCounts.size,
      repeatedEvents: [...eventCounts.values()].filter((count) => count > 1).length,
      maximumRecordsInOneEvent: maxEvent,
      missingEventIdentityRecords,
      fieldSizeBuckets: buckets(fieldSizeCounts, total),
    },
    pilotCoverage: {
      uniquePilots: pilotCounts.size,
      repeatedPilots: [...pilotCounts.values()].filter((count) => count > 1).length,
      maximumRecordsPerPilot: maxPilot,
      missingPilotIdentityRecords,
    },
    deckReuse: {
      uniqueDeckFingerprints: deckCounts.size,
      repeatedDeckFingerprints: [...deckCounts.values()].filter((count) => count > 1).length,
      maximumOccurrencesOfOneDeck: maxDeck,
      deckFingerprintsAcrossMultipleEvents: [...deckEvents.values()].filter((events) => events.size > 1).length,
    },
    leakageCoverage: {
      groups: leakageCounts.size,
      maximumRecordsInOneGroup: maxLeakage,
      maximumGroupShare: round(maxLeakage / total),
    },
    metadataCoverage: {
      recordsWithRegion,
      recordsWithArchetype,
      missingRegionShare: round((total - recordsWithRegion) / total),
      missingArchetypeShare: round((total - recordsWithArchetype) / total),
    },
    sourceLineageCollisions,
    qualityGatePassed: blockers.length === 0,
    warnings,
    blockers,
  };
}
