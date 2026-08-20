import { createHash } from 'node:crypto';
import {
  assertHistoricalLearningRecordEligibleV15,
  buildHistoricalLearningCorpusManifestV15,
  createHistoricalLearningRecordV15,
  type HistoricalLearningCorpusManifestV15,
  type HistoricalLearningRecordV15,
} from './historical-learning-corpus-v15.js';
import { buildLearningCorpusManifestV15, type LearningCorpusManifestV15 } from './learning-corpus-manifest-v15.js';
import { fingerprintExactDeckV15 } from './learning-corpus-v15.js';
import {
  materializeTopDeckRealCorpusV15,
  type TopDeckRealCorpusMaterializationV15,
} from './topdeck-real-corpus-materializer-v15.js';
import type {
  TopDeckProspectivePromotionJoinV15,
  TopDeckProspectivePromotionJoinedRowV15,
} from './topdeck-prospective-promotion-join-v15.js';

export const TOPDECK_PROMOTION_CORPUS_ADMISSION_SCHEMA_V15 = 'topdeck-promotion-corpus-admission-v15.1' as const;

export interface TopDeckPromotionJoinArtifactInputV15 {
  artifactReference: string;
  join: TopDeckProspectivePromotionJoinV15;
}

export interface TopDeckPromotionCorpusAdmissionV15 {
  schemaVersion: typeof TOPDECK_PROMOTION_CORPUS_ADMISSION_SCHEMA_V15;
  joinArtifacts: string[];
  joinArtifactCount: number;
  joinedRows: number;
  admittedRows: number;
  evidenceLineageHash: string;
  conservativeOutcomeSourceObservedAt: string;
  linkagePlan: TopDeckRealCorpusMaterializationV15['linkagePlan'];
  partition: TopDeckRealCorpusMaterializationV15['corpus']['partition'];
  normalizer: TopDeckRealCorpusMaterializationV15['corpus']['normalizer'];
  ingestion: TopDeckRealCorpusMaterializationV15['corpus']['ingestion'];
  learningManifest: LearningCorpusManifestV15;
  historicalRecords: HistoricalLearningRecordV15[];
  historicalManifest: HistoricalLearningCorpusManifestV15;
  safeguards: readonly [
    'Joined artifacts must use immutable private GHCR digest references.',
    'Every joined row is re-checked for exact deck identity and internally consistent promotion-grade timing before corpus materialization.',
    'Outcome source observation uses the latest original event-end evidence observation across the admitted batch, which is conservative rather than backdated.',
    'Each historical record is rebound to the immutable joined-evidence artifact and evidence hashes before the promotion corpus manifest is built.',
    'Promotion corpus admission does not authorize a model or stable runtime release.'
  ];
}

interface FlattenedJoinedRowV15 {
  artifactReference: string;
  join: TopDeckProspectivePromotionJoinV15;
  row: TopDeckProspectivePromotionJoinedRowV15;
}

function required(name: string, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  return value.trim();
}

function timestamp(name: string, value: unknown): { iso: string; ms: number } {
  const text = required(name, value);
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) throw new Error(`${name} must be a valid timestamp.`);
  return { iso: new Date(ms).toISOString(), ms };
}

function sha256(name: string, value: unknown): string {
  const text = required(name, value).toLocaleLowerCase();
  if (!/^[a-f0-9]{64}$/.test(text)) throw new Error(`${name} must be a SHA-256 hex digest.`);
  return text;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function digest(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function immutableTopDeckArtifactReference(value: unknown): string {
  const text = required('artifactReference', value).toLocaleLowerCase();
  if (!/^ghcr\.io\/[^/\s]+\/mtg-ultimate-mcp-topdeck-evidence@sha256:[a-f0-9]{64}$/.test(text)) {
    throw new Error('Promotion corpus join artifact must be an immutable private TopDeck GHCR digest reference.');
  }
  return text;
}

function allSafeguardsPass(row: TopDeckProspectivePromotionJoinedRowV15): boolean {
  return Object.values(row.prepared.assessment.safeguards).every((value) => value === true);
}

function assertJoinedRowConsistency(
  artifactReference: string,
  join: TopDeckProspectivePromotionJoinV15,
  row: TopDeckProspectivePromotionJoinedRowV15,
): void {
  if (!row || typeof row !== 'object') throw new Error('Joined promotion row must be an object.');
  if (!row.prepared || typeof row.prepared !== 'object') throw new Error('Joined promotion row is missing prepared evidence.');
  const candidate = row.prepared.candidate;
  const snapshot = row.prepared.snapshot;
  const assessment = row.prepared.assessment;
  if (!assessment.eligibleForPromotionGradeTraining || assessment.reasons.length !== 0 || !allSafeguardsPass(row)) {
    throw new Error(`Joined promotion row ${row.providerRecordId} does not contain a fully passing promotion-grade assessment.`);
  }
  if (normalize(join.providerEventId) !== normalize(row.providerEventId)
    || normalize(row.providerEventId) !== normalize(candidate.providerEventId)
    || normalize(row.providerPlayerId) !== normalize(candidate.providerPlayerId)
    || normalize(row.providerRecordId) !== normalize(candidate.providerRecordId)) {
    throw new Error(`Joined promotion row ${row.providerRecordId} has inconsistent provider identity.`);
  }
  const candidateFingerprint = fingerprintExactDeckV15(candidate.decklist).toLocaleLowerCase();
  if (candidateFingerprint !== snapshot.deckFingerprint.toLocaleLowerCase()) {
    throw new Error(`Joined promotion row ${row.providerRecordId} candidate/snapshot fingerprint changed after evidence joining.`);
  }
  if (candidate.outcomeOccurredAt !== assessment.outcomeOccurredAt
    || candidate.metadata.eventStartAt !== assessment.predictionCutoff
    || candidate.metadata.preEventDecklistObservedAt !== assessment.decklistObservedAt
    || snapshot.availableAt !== assessment.snapshotAvailableAt
    || snapshot.cardDataObservedAt !== assessment.cardDataObservedAt
    || join.predictionCutoff !== assessment.predictionCutoff
    || join.eventEndedAt !== assessment.outcomeOccurredAt) {
    throw new Error(`Joined promotion row ${row.providerRecordId} temporal fields no longer match its promotion-grade assessment.`);
  }
  sha256('row.completedResponseContentHash', row.completedResponseContentHash);
  sha256('row.retainedCardDataManifestFingerprint', row.retainedCardDataManifestFingerprint);
  sha256('candidate.metadata.preEventDecklistSourceContentHash', candidate.metadata.preEventDecklistSourceContentHash);
  sha256('candidate.metadata.eventEndEvidenceSourceContentHash', candidate.metadata.eventEndEvidenceSourceContentHash);
  immutableTopDeckArtifactReference(artifactReference);
}

function flattenAndValidate(inputs: TopDeckPromotionJoinArtifactInputV15[]): FlattenedJoinedRowV15[] {
  if (!Array.isArray(inputs) || inputs.length === 0) throw new Error('At least one joined promotion evidence artifact is required.');
  const artifactRefs = new Set<string>();
  const providerRecordIds = new Set<string>();
  const rows: FlattenedJoinedRowV15[] = [];
  for (const input of inputs) {
    if (!input || typeof input !== 'object') throw new Error('Each promotion join artifact input must be an object.');
    const artifactReference = immutableTopDeckArtifactReference(input.artifactReference);
    if (artifactRefs.has(artifactReference)) throw new Error(`Duplicate joined evidence artifact reference: ${artifactReference}.`);
    artifactRefs.add(artifactReference);
    if (!input.join || input.join.schemaVersion !== 'topdeck-prospective-promotion-join-v15.1') {
      throw new Error('Unsupported prospective promotion join schema.');
    }
    for (const row of input.join.joinedRows) {
      assertJoinedRowConsistency(artifactReference, input.join, row);
      const recordId = normalize(row.providerRecordId);
      if (providerRecordIds.has(recordId)) throw new Error(`Duplicate providerRecordId across joined evidence artifacts: ${row.providerRecordId}.`);
      providerRecordIds.add(recordId);
      rows.push({ artifactReference, join: input.join, row });
    }
  }
  if (rows.length === 0) throw new Error('Joined evidence artifacts contain no promotion-grade rows.');
  return rows;
}

function conservativeSourceObservedAt(rows: FlattenedJoinedRowV15[]): string {
  const times = rows.map(({ row }) => timestamp(
    `row ${row.providerRecordId} outcomeEvidenceObservedAt`,
    row.prepared.assessment.outcomeEvidenceObservedAt,
  ));
  return new Date(Math.max(...times.map((entry) => entry.ms))).toISOString();
}

function evidenceMetadata(entry: FlattenedJoinedRowV15): Record<string, string> {
  const { artifactReference, join, row } = entry;
  return {
    promotionEvidenceJoinArtifactReference: artifactReference,
    promotionEvidenceCompletedSourceContentHash: sha256('completedResponseContentHash', row.completedResponseContentHash),
    promotionEvidenceRetainedCardDataManifestFingerprint: sha256('retainedCardDataManifestFingerprint', row.retainedCardDataManifestFingerprint),
    promotionEvidencePredictionCutoff: timestamp('predictionCutoff', row.prepared.assessment.predictionCutoff).iso,
    promotionEvidenceFeatureAvailableAt: timestamp('featureAvailableAt', row.prepared.assessment.snapshotAvailableAt).iso,
    promotionEvidenceOutcomeOccurredAt: timestamp('outcomeOccurredAt', row.prepared.assessment.outcomeOccurredAt).iso,
    promotionEvidenceOutcomeObservedAt: timestamp('outcomeEvidenceObservedAt', row.prepared.assessment.outcomeEvidenceObservedAt).iso,
    promotionEvidencePreEventDecklistSourceContentHash: sha256(
      'preEventDecklistSourceContentHash',
      row.prepared.candidate.metadata.preEventDecklistSourceContentHash,
    ),
    promotionEvidenceEventEndSourceContentHash: sha256(
      'eventEndEvidenceSourceContentHash',
      row.prepared.candidate.metadata.eventEndEvidenceSourceContentHash,
    ),
    promotionEvidenceJoinContentHash: digest(join),
  };
}

/**
 * Admits already joined prospective evidence into the strict TopDeck corpus.
 * The generic materializer is used for leakage grouping, temporal partitioning,
 * normalization and label construction; then records are re-bound to immutable
 * join-artifact provenance so the historical manifest/future seal commits to the
 * evidence lineage instead of trusting a serialized eligibility boolean.
 */
export function materializeTopDeckPromotionCorpusFromJoinedEvidenceV15(
  inputs: TopDeckPromotionJoinArtifactInputV15[],
  options: {
    holdoutFraction?: number;
  } = {},
): TopDeckPromotionCorpusAdmissionV15 {
  const rows = flattenAndValidate(inputs);
  const sourceObservedAt = conservativeSourceObservedAt(rows);
  const base = materializeTopDeckRealCorpusV15(
    rows.map(({ row }) => ({ candidate: row.prepared.candidate, snapshot: row.prepared.snapshot })),
    {
      sourceObservedAt,
      sourceRetrievedAt: sourceObservedAt,
      ...(options.holdoutFraction !== undefined ? { holdoutFraction: options.holdoutFraction } : {}),
      providerRejected: inputs.reduce((sum, input) => sum + input.join.rejectedRows.length, 0),
    },
  );
  if (base.corpus.historicalRecords.length !== rows.length) {
    throw new Error('Promotion corpus materialization changed the admitted joined-row count.');
  }

  const rebound = base.corpus.historicalRecords.map((historical, index) => {
    const entry = rows[index];
    if (!entry) throw new Error(`Missing promotion joined row for historical record index ${index}.`);
    const expectedCandidate = entry.row.prepared.candidate;
    const eventId = historical.record.metadata?.providerEventId;
    const playerId = historical.record.metadata?.providerPlayerId;
    if (typeof eventId !== 'string' || typeof playerId !== 'string'
      || normalize(eventId) !== normalize(expectedCandidate.providerEventId)
      || normalize(playerId) !== normalize(expectedCandidate.providerPlayerId)) {
      throw new Error(`Historical row index ${index} no longer matches its joined evidence identity.`);
    }
    const updatedRecord = {
      ...historical.record,
      metadata: {
        ...(historical.record.metadata ?? {}),
        ...evidenceMetadata(entry),
      },
    };
    return assertHistoricalLearningRecordEligibleV15(createHistoricalLearningRecordV15(
      updatedRecord,
      entry.row.prepared.snapshot,
      historical.outcomeEvidenceProvenance,
    ));
  });

  const learningManifest = buildLearningCorpusManifestV15(rebound.map((record) => record.record), {
    refreshAudit: {
      providerCandidates: rows.length,
      providerRejected: inputs.reduce((sum, input) => sum + input.join.rejectedRows.length, 0),
      ingestionAccepted: rebound.length,
      ingestionRejected: 0,
    },
  });
  const historicalManifest = buildHistoricalLearningCorpusManifestV15(rebound);
  const joinArtifacts = [...new Set(rows.map((entry) => entry.artifactReference))].sort();
  const evidenceLineageHash = digest(rows.map((entry) => ({
    artifactReference: entry.artifactReference,
    providerRecordId: normalize(entry.row.providerRecordId),
    completedResponseContentHash: entry.row.completedResponseContentHash,
    retainedCardDataManifestFingerprint: entry.row.retainedCardDataManifestFingerprint,
    promotionAssessment: entry.row.prepared.assessment,
  })).sort((a, b) => a.providerRecordId.localeCompare(b.providerRecordId)));

  return {
    schemaVersion: TOPDECK_PROMOTION_CORPUS_ADMISSION_SCHEMA_V15,
    joinArtifacts,
    joinArtifactCount: joinArtifacts.length,
    joinedRows: rows.length,
    admittedRows: rebound.length,
    evidenceLineageHash,
    conservativeOutcomeSourceObservedAt: sourceObservedAt,
    linkagePlan: base.linkagePlan,
    partition: base.corpus.partition,
    normalizer: base.corpus.normalizer,
    ingestion: base.corpus.ingestion,
    learningManifest,
    historicalRecords: rebound,
    historicalManifest,
    safeguards: [
      'Joined artifacts must use immutable private GHCR digest references.',
      'Every joined row is re-checked for exact deck identity and internally consistent promotion-grade timing before corpus materialization.',
      'Outcome source observation uses the latest original event-end evidence observation across the admitted batch, which is conservative rather than backdated.',
      'Each historical record is rebound to the immutable joined-evidence artifact and evidence hashes before the promotion corpus manifest is built.',
      'Promotion corpus admission does not authorize a model or stable runtime release.',
    ],
  };
}
