import {
  type DeckFeatureNormalizerV15,
} from './deck-feature-snapshot-v15.js';
import {
  assertFutureHoldoutSealV15,
  assertTrainingRecordsMatchFutureHoldoutSealV15,
  type FutureHoldoutSealV15,
} from './future-holdout-seal-v15.js';
import {
  assertHistoricalLearningRecordEligibleV15,
  buildHistoricalLearningCorpusManifestV15,
  createHistoricalLearningRecordV15,
  type HistoricalLearningCorpusManifestV15,
  type HistoricalLearningRecordV15,
} from './historical-learning-corpus-v15.js';
import { ingestObservedLearningRecordsV15, type LearningIngestionResultV15 } from './learning-corpus-ingestion-v15.js';
import { fingerprintExactDeckV15 } from './learning-corpus-v15.js';
import { planTopDeckLeakageLinkagesV15, type TopDeckLeakageLinkagePlanV15 } from './topdeck-leakage-linkage-v15.js';
import { materializeTopDeckLearningCandidateV15 } from './topdeck-learning-materializer-v15.js';
import type {
  TopDeckPromotionJoinArtifactInputV15,
} from './topdeck-promotion-corpus-admission-v15.js';
import type {
  TopDeckProspectivePromotionJoinedRowV15,
} from './topdeck-prospective-promotion-join-v15.js';
import { topDeckOutcomeTemporalProvenanceV15 } from './topdeck-temporal-corpus-v15.js';

export const TOPDECK_SEALED_FUTURE_HOLDOUT_SCHEMA_V15 = 'topdeck-sealed-future-holdout-v15.1' as const;

export interface TopDeckSealedFutureHoldoutV15 {
  schemaVersion: typeof TOPDECK_SEALED_FUTURE_HOLDOUT_SCHEMA_V15;
  sealHash: string;
  sealedAt: string;
  evidenceArtifactCount: number;
  evidenceRows: number;
  conservativeOutcomeSourceObservedAt: string;
  linkagePlan: TopDeckLeakageLinkagePlanV15;
  ingestion: LearningIngestionResultV15;
  historicalRecords: HistoricalLearningRecordV15[];
  historicalManifest: HistoricalLearningCorpusManifestV15;
  safeguards: readonly [
    'The exact training corpus must still match the immutable future-holdout seal.',
    'Future predictor snapshots and event-start cutoffs must occur strictly after the seal.',
    'Future outcomes and their source evidence must occur strictly after the seal.',
    'Future predictors are projected with the sealed training normalizer; no future normalizer fitting or temporal repartitioning occurs.',
    'Training and future provider events, pilots, exact deck fingerprints, and leakage groups must be disjoint.',
    'Joined evidence artifacts must be immutable private GHCR digest references and retain exact promotion-grade timing/identity checks.'
  ];
}

interface ValidatedFutureRowV15 {
  artifactReference: string;
  row: TopDeckProspectivePromotionJoinedRowV15;
}

function required(name: string, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  return value.trim();
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
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

function immutableTopDeckArtifactReference(value: unknown): string {
  const text = required('artifactReference', value).toLocaleLowerCase();
  if (!/^ghcr\.io\/[^/\s]+\/mtg-ultimate-mcp-topdeck-evidence@sha256:[a-f0-9]{64}$/.test(text)) {
    throw new Error('Future holdout joined evidence must use an immutable private TopDeck GHCR digest reference.');
  }
  return text;
}

function allAssessmentSafeguardsPass(row: TopDeckProspectivePromotionJoinedRowV15): boolean {
  return Object.values(row.prepared.assessment.safeguards).every((value) => value === true);
}

function validateFutureJoinedEvidence(
  inputs: TopDeckPromotionJoinArtifactInputV15[],
  seal: FutureHoldoutSealV15,
): ValidatedFutureRowV15[] {
  if (!Array.isArray(inputs) || inputs.length === 0) throw new Error('At least one future joined-evidence artifact is required.');
  const sealedAt = timestamp('seal.sealedAt', seal.sealedAt);
  const artifacts = new Set<string>();
  const providerRecords = new Set<string>();
  const rows: ValidatedFutureRowV15[] = [];

  for (const input of inputs) {
    if (!input || typeof input !== 'object') throw new Error('Each future joined-evidence input must be an object.');
    const artifactReference = immutableTopDeckArtifactReference(input.artifactReference);
    if (artifacts.has(artifactReference)) throw new Error(`Duplicate future joined-evidence artifact reference: ${artifactReference}.`);
    artifacts.add(artifactReference);
    if (!input.join || input.join.schemaVersion !== 'topdeck-prospective-promotion-join-v15.1') {
      throw new Error('Unsupported future prospective promotion join schema.');
    }
    for (const row of input.join.joinedRows) {
      if (!row || typeof row !== 'object' || !row.prepared || typeof row.prepared !== 'object') {
        throw new Error('Future joined evidence contains a malformed promotion row.');
      }
      const candidate = row.prepared.candidate;
      const snapshot = row.prepared.snapshot;
      const assessment = row.prepared.assessment;
      if (!assessment.eligibleForPromotionGradeTraining || assessment.reasons.length !== 0 || !allAssessmentSafeguardsPass(row)) {
        throw new Error(`Future joined row ${row.providerRecordId} does not contain a fully passing promotion-grade assessment.`);
      }
      if (normalize(input.join.providerEventId) !== normalize(row.providerEventId)
        || normalize(row.providerEventId) !== normalize(candidate.providerEventId)
        || normalize(row.providerPlayerId) !== normalize(candidate.providerPlayerId)
        || normalize(row.providerRecordId) !== normalize(candidate.providerRecordId)) {
        throw new Error(`Future joined row ${row.providerRecordId} has inconsistent provider identity.`);
      }
      const recordId = normalize(row.providerRecordId);
      if (providerRecords.has(recordId)) throw new Error(`Duplicate future providerRecordId: ${row.providerRecordId}.`);
      providerRecords.add(recordId);
      const deckFingerprint = fingerprintExactDeckV15(candidate.decklist).toLocaleLowerCase();
      if (deckFingerprint !== snapshot.deckFingerprint.toLocaleLowerCase()) {
        throw new Error(`Future joined row ${row.providerRecordId} candidate/snapshot fingerprint changed after joining.`);
      }
      if (candidate.outcomeOccurredAt !== assessment.outcomeOccurredAt
        || candidate.metadata.eventStartAt !== assessment.predictionCutoff
        || candidate.metadata.preEventDecklistObservedAt !== assessment.decklistObservedAt
        || snapshot.availableAt !== assessment.snapshotAvailableAt
        || snapshot.cardDataObservedAt !== assessment.cardDataObservedAt
        || input.join.predictionCutoff !== assessment.predictionCutoff
        || input.join.eventEndedAt !== assessment.outcomeOccurredAt) {
        throw new Error(`Future joined row ${row.providerRecordId} temporal fields no longer match its promotion-grade assessment.`);
      }
      sha256('completedResponseContentHash', row.completedResponseContentHash);
      sha256('retainedCardDataManifestFingerprint', row.retainedCardDataManifestFingerprint);
      sha256('preEventDecklistSourceContentHash', candidate.metadata.preEventDecklistSourceContentHash);
      sha256('eventEndEvidenceSourceContentHash', candidate.metadata.eventEndEvidenceSourceContentHash);
      const cutoff = timestamp('future.assessment.predictionCutoff', assessment.predictionCutoff);
      const snapshotAt = timestamp('future.assessment.snapshotAvailableAt', assessment.snapshotAvailableAt);
      const outcome = timestamp('future.assessment.outcomeOccurredAt', assessment.outcomeOccurredAt);
      const outcomeEvidence = timestamp('future.assessment.outcomeEvidenceObservedAt', assessment.outcomeEvidenceObservedAt);
      if (cutoff.ms <= sealedAt.ms || snapshotAt.ms <= sealedAt.ms) {
        throw new Error(`Future joined row ${row.providerRecordId} predictor state was not genuinely future relative to the seal.`);
      }
      if (outcome.ms <= sealedAt.ms || outcomeEvidence.ms <= sealedAt.ms) {
        throw new Error(`Future joined row ${row.providerRecordId} outcome evidence was not genuinely future relative to the seal.`);
      }
      rows.push({ artifactReference, row });
    }
  }
  if (rows.length === 0) throw new Error('Future joined-evidence artifacts contain no promotion-grade rows.');
  return rows;
}

function metadataString(record: HistoricalLearningRecordV15, key: string): string {
  const value = record.record.metadata?.[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Sealed training record ${record.record.outcomeId} is missing ${key}.`);
  }
  return normalize(value);
}

function disjointTrainingFuture(
  trainingRecords: HistoricalLearningRecordV15[],
  futureRows: ValidatedFutureRowV15[],
  futureLinkage: TopDeckLeakageLinkagePlanV15,
): void {
  const trainingEvents = new Set(trainingRecords.map((record) => metadataString(record, 'providerEventId')));
  const trainingPilots = new Set(trainingRecords.map((record) => metadataString(record, 'providerPlayerId')));
  const trainingDecks = new Set(trainingRecords.map((record) => record.record.deckFingerprint.toLocaleLowerCase()));
  const trainingLeakage = new Set(trainingRecords.map((record) => normalize(record.record.leakageGroup)));

  for (const { row } of futureRows) {
    const candidate = row.prepared.candidate;
    if (trainingEvents.has(normalize(candidate.providerEventId))) {
      throw new Error(`Future holdout reuses sealed training event ${candidate.providerEventId}.`);
    }
    if (trainingPilots.has(normalize(candidate.providerPlayerId))) {
      throw new Error(`Future holdout reuses sealed training pilot ${candidate.providerPlayerId}.`);
    }
    const deck = fingerprintExactDeckV15(candidate.decklist).toLocaleLowerCase();
    if (trainingDecks.has(deck)) throw new Error(`Future holdout reuses a sealed training exact deck fingerprint (${row.providerRecordId}).`);
    const linkage = futureLinkage.linkagesByProviderRecordId[candidate.providerRecordId];
    if (!linkage) throw new Error(`Missing future leakage linkage for ${candidate.providerRecordId}.`);
    if (trainingLeakage.has(normalize(linkage.leakageKey))) {
      throw new Error(`Future holdout leakage group overlaps sealed training data (${row.providerRecordId}).`);
    }
  }
}

function conservativeSourceObservedAt(rows: ValidatedFutureRowV15[]): string {
  const observations = rows.map(({ row }) => timestamp(
    `future ${row.providerRecordId} outcomeEvidenceObservedAt`,
    row.prepared.assessment.outcomeEvidenceObservedAt,
  ));
  return new Date(Math.max(...observations.map((entry) => entry.ms))).toISOString();
}

function promotionMetadata(entry: ValidatedFutureRowV15): Record<string, string> {
  const { artifactReference, row } = entry;
  return {
    promotionEvidenceJoinArtifactReference: artifactReference,
    promotionEvidenceCompletedSourceContentHash: sha256('completedResponseContentHash', row.completedResponseContentHash),
    promotionEvidenceRetainedCardDataManifestFingerprint: sha256('retainedCardDataManifestFingerprint', row.retainedCardDataManifestFingerprint),
    promotionEvidencePredictionCutoff: timestamp('predictionCutoff', row.prepared.assessment.predictionCutoff).iso,
    promotionEvidenceFeatureAvailableAt: timestamp('snapshotAvailableAt', row.prepared.assessment.snapshotAvailableAt).iso,
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
  };
}

/**
 * Builds genuinely future holdout records against one immutable training seal.
 * No normalizer is fitted here. The supplied normalizer must be the exact sealed
 * training fit, and every future feature vector is projected through that fit.
 */
export function materializeTopDeckSealedFutureHoldoutV15(input: {
  seal: FutureHoldoutSealV15;
  trainingRecords: HistoricalLearningRecordV15[];
  trainingNormalizer: DeckFeatureNormalizerV15;
  futureJoinedEvidence: TopDeckPromotionJoinArtifactInputV15[];
}): TopDeckSealedFutureHoldoutV15 {
  const seal = assertFutureHoldoutSealV15(input.seal);
  assertTrainingRecordsMatchFutureHoldoutSealV15(seal, input.trainingRecords);
  if (!input.trainingNormalizer || typeof input.trainingNormalizer !== 'object') throw new Error('Sealed training normalizer must be an object.');
  if (input.trainingNormalizer.fitFingerprint.toLocaleLowerCase() !== seal.featureNormalizerFitFingerprint.toLocaleLowerCase()) {
    throw new Error('Supplied training normalizer does not match the future-holdout seal fingerprint.');
  }

  const rows = validateFutureJoinedEvidence(input.futureJoinedEvidence, seal);
  const sourceObservedAt = conservativeSourceObservedAt(rows);
  const candidates = rows.map(({ row }) => row.prepared.candidate);
  const linkagePlan = planTopDeckLeakageLinkagesV15(candidates, {
    sourceObservedAt,
    sourceRetrievedAt: sourceObservedAt,
  });
  disjointTrainingFuture(input.trainingRecords, rows, linkagePlan);

  const observed = rows.map((entry) => {
    const candidate = entry.row.prepared.candidate;
    const linkage = linkagePlan.linkagesByProviderRecordId[candidate.providerRecordId];
    if (!linkage) throw new Error(`Missing planned future linkage for ${candidate.providerRecordId}.`);
    const materialized = materializeTopDeckLearningCandidateV15(
      candidate,
      entry.row.prepared.snapshot,
      input.trainingNormalizer,
      linkage,
    );
    return {
      ...materialized,
      metadata: {
        ...(materialized.metadata ?? {}),
        ...promotionMetadata(entry),
        sourceRetrievedAt: sourceObservedAt,
        sealedTrainingManifestHash: seal.trainingHistoricalManifestHash,
        sealedTrainingCorpusContentHash: seal.trainingHistoricalCorpusContentHash,
        sealedTrainingNormalizerFitFingerprint: seal.featureNormalizerFitFingerprint,
        futureHoldoutSealHash: seal.sealHash,
      },
    };
  });
  const ingestion = ingestObservedLearningRecordsV15(observed);
  if (ingestion.rejected.length > 0) {
    const reasons = [...new Set(ingestion.rejected.map((entry) => `${entry.code}: ${entry.reason}`))];
    throw new Error(`Sealed future holdout ingestion rejected ${ingestion.rejected.length} record(s): ${reasons.join('; ')}`);
  }
  if (ingestion.accepted.length !== rows.length) throw new Error('Sealed future holdout accepted count changed after ingestion.');

  const historicalRecords = ingestion.accepted.map((record, index) => {
    const entry = rows[index];
    if (!entry) throw new Error(`Missing future joined evidence for accepted record index ${index}.`);
    const candidate = entry.row.prepared.candidate;
    const linkage = linkagePlan.linkagesByProviderRecordId[candidate.providerRecordId];
    if (!linkage) throw new Error(`Missing future linkage for accepted record ${candidate.providerRecordId}.`);
    if (record.outcomeId !== linkage.canonicalOutcomeId) throw new Error('Future accepted-record identity changed before historical provenance binding.');
    const provenance = topDeckOutcomeTemporalProvenanceV15({
      candidate,
      snapshot: entry.row.prepared.snapshot,
      linkage,
    });
    return assertHistoricalLearningRecordEligibleV15(createHistoricalLearningRecordV15(
      record,
      entry.row.prepared.snapshot,
      provenance,
    ));
  });

  for (const historical of historicalRecords) {
    if (historical.record.metadata?.featureNormalizerFitFingerprint !== seal.featureNormalizerFitFingerprint) {
      throw new Error(`Future holdout record ${historical.record.outcomeId} did not preserve the sealed training normalizer fingerprint.`);
    }
    if (timestamp('future record outcome', historical.record.observedAt).ms <= timestamp('seal.sealedAt', seal.sealedAt).ms) {
      throw new Error(`Future holdout record ${historical.record.outcomeId} outcome is not strictly after the seal.`);
    }
    if (timestamp('future outcome source availability', historical.outcomeEvidence.sourceAvailableAt).ms <= timestamp('seal.sealedAt', seal.sealedAt).ms) {
      throw new Error(`Future holdout record ${historical.record.outcomeId} source evidence is not strictly after the seal.`);
    }
  }

  return {
    schemaVersion: TOPDECK_SEALED_FUTURE_HOLDOUT_SCHEMA_V15,
    sealHash: seal.sealHash,
    sealedAt: seal.sealedAt,
    evidenceArtifactCount: new Set(rows.map((entry) => entry.artifactReference)).size,
    evidenceRows: rows.length,
    conservativeOutcomeSourceObservedAt: sourceObservedAt,
    linkagePlan,
    ingestion,
    historicalRecords,
    historicalManifest: buildHistoricalLearningCorpusManifestV15(historicalRecords),
    safeguards: [
      'The exact training corpus must still match the immutable future-holdout seal.',
      'Future predictor snapshots and event-start cutoffs must occur strictly after the seal.',
      'Future outcomes and their source evidence must occur strictly after the seal.',
      'Future predictors are projected with the sealed training normalizer; no future normalizer fitting or temporal repartitioning occurs.',
      'Training and future provider events, pilots, exact deck fingerprints, and leakage groups must be disjoint.',
      'Joined evidence artifacts must be immutable private GHCR digest references and retain exact promotion-grade timing/identity checks.',
    ],
  };
}
