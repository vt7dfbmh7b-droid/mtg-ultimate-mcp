import { parseDecklist } from './deck.js';
import { EVIDENCE_SOURCES_V09, type EvidenceSourceV09 } from './evidence-sources-v09.js';
import {
  fingerprintExactDeckV15,
  type LearningOutcomeRecordV15,
  type LearningTargetV15,
} from './learning-corpus-v15.js';
import {
  LEARNING_FEATURES_V15,
  type LearningFeatureV15,
} from './research-learning-v15.js';

export const MAX_LEARNING_INGEST_BATCH_V15 = 5_000;
export const MAX_LEARNING_SOURCE_ID_LENGTH_V15 = 200;
export const MAX_LEARNING_DECKLIST_LENGTH_V15 = 200_000;
export const MAX_LEARNING_METADATA_FIELDS_V15 = 64;

export type ObservedOutcomeV15 =
  | {
      kind: 'match-win';
      won: boolean;
    }
  | {
      kind: 'event-top-cut';
      standing: number;
      fieldSize: number;
      topCutSize: number;
    };

export interface ObservedLearningSourceRecordV15 {
  sourceId: string;
  sourceRecordId: string;
  sourceUrl: string;
  canonicalOutcomeId: string;
  independenceKey: string;
  leakageKey: string;
  outcomeOccurredAt: string;
  sourceObservedAt: string;
  decklist: string;
  expectedCommanderNames?: readonly string[];
  featureExtractorId: string;
  features: Partial<Record<LearningFeatureV15, number>>;
  outcome: ObservedOutcomeV15;
  importance?: number;
  metadata?: Record<string, string | number | boolean | null>;
}

export type LearningIngestionRejectionCodeV15 =
  | 'malformed-record'
  | 'duplicate-source-record'
  | 'unknown-source'
  | 'wrong-evidence-class'
  | 'source-url-mismatch'
  | 'invalid-timestamp-order'
  | 'invalid-decklist'
  | 'invalid-commander-identity'
  | 'invalid-features'
  | 'invalid-outcome';

export interface LearningIngestionRejectionV15 {
  index: number;
  sourceId: string | null;
  sourceRecordId: string | null;
  code: LearningIngestionRejectionCodeV15;
  reason: string;
}

export interface LearningIngestionAuditV15 {
  inputRecords: number;
  acceptedRecords: number;
  rejectedRecords: number;
  rejectionCounts: Record<LearningIngestionRejectionCodeV15, number>;
  sourceCounts: Record<string, number>;
  learningTargetCounts: Partial<Record<LearningTargetV15, number>>;
}

export interface LearningIngestionResultV15 {
  accepted: LearningOutcomeRecordV15[];
  rejected: LearningIngestionRejectionV15[];
  audit: LearningIngestionAuditV15;
}

const FEATURE_SET = new Set<string>(LEARNING_FEATURES_V15);
const SOURCE_BY_ID = new Map(EVIDENCE_SOURCES_V09.map((source) => [source.id, source] as const));
const REJECTION_CODES: LearningIngestionRejectionCodeV15[] = [
  'malformed-record',
  'duplicate-source-record',
  'unknown-source',
  'wrong-evidence-class',
  'source-url-mismatch',
  'invalid-timestamp-order',
  'invalid-decklist',
  'invalid-commander-identity',
  'invalid-features',
  'invalid-outcome',
];

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function requiredString(name: string, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  const trimmed = value.trim();
  if (trimmed.length > MAX_LEARNING_SOURCE_ID_LENGTH_V15) {
    throw new Error(`${name} must be at most ${MAX_LEARNING_SOURCE_ID_LENGTH_V15} characters.`);
  }
  return trimmed;
}

function timestampMs(name: string, value: unknown): { value: string; ms: number } {
  const text = requiredString(name, value);
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) throw new Error(`${name} must be a valid timestamp.`);
  return { value: new Date(ms).toISOString(), ms };
}

function normalizedHostname(value: string): string {
  const hostname = new URL(value).hostname.toLocaleLowerCase();
  return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
}

function validateSourceUrl(source: EvidenceSourceV09, value: unknown): string {
  const text = requiredString('sourceUrl', value);
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error('sourceUrl must be a valid URL.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('sourceUrl must use http or https.');
  }
  const expectedHost = normalizedHostname(source.url);
  const actualHost = normalizedHostname(text);
  if (actualHost !== expectedHost && !actualHost.endsWith(`.${expectedHost}`)) {
    throw new Error(`sourceUrl host ${actualHost} does not match registered source ${expectedHost}.`);
  }
  return text;
}

function validFeatures(features: unknown): features is Partial<Record<LearningFeatureV15, number>> {
  if (!features || typeof features !== 'object' || Array.isArray(features)) return false;
  const entries = Object.entries(features as Record<string, unknown>);
  if (entries.length === 0) return false;
  return entries.every(([key, value]) =>
    FEATURE_SET.has(key)
    && typeof value === 'number'
    && Number.isFinite(value)
    && value >= -1
    && value <= 1);
}

function validMetadata(metadata: unknown): metadata is Record<string, string | number | boolean | null> | undefined {
  if (metadata === undefined) return true;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
  const entries = Object.entries(metadata as Record<string, unknown>);
  if (entries.length > MAX_LEARNING_METADATA_FIELDS_V15) return false;
  return entries.every(([key, value]) =>
    key.trim().length > 0
    && key.length <= 120
    && (value === null || typeof value === 'string' || typeof value === 'boolean'
      || (typeof value === 'number' && Number.isFinite(value))));
}

function learningTargetAndLabel(outcome: unknown): {
  learningTarget: Extract<LearningTargetV15, 'match-win' | 'event-top-cut'>;
  label: 0 | 1;
  metadata: Record<string, number | boolean | string>;
} {
  if (!outcome || typeof outcome !== 'object') throw new Error('outcome must be an object.');
  const value = outcome as Partial<ObservedOutcomeV15> & Record<string, unknown>;
  if (value.kind === 'match-win') {
    if (typeof value.won !== 'boolean') throw new Error('match-win outcome.won must be boolean.');
    return {
      learningTarget: 'match-win',
      label: value.won ? 1 : 0,
      metadata: { outcomeKind: 'match-win', won: value.won },
    };
  }
  if (value.kind === 'event-top-cut') {
    const standing = value.standing;
    const fieldSize = value.fieldSize;
    const topCutSize = value.topCutSize;
    if (![standing, fieldSize, topCutSize].every((entry) => typeof entry === 'number' && Number.isInteger(entry))) {
      throw new Error('event-top-cut standing, fieldSize and topCutSize must be integers.');
    }
    if ((fieldSize as number) < 1 || (fieldSize as number) > 100_000) throw new Error('event-top-cut fieldSize is outside supported bounds.');
    if ((standing as number) < 1 || (standing as number) > (fieldSize as number)) throw new Error('event-top-cut standing must be within the event field.');
    if ((topCutSize as number) < 1 || (topCutSize as number) > (fieldSize as number)) throw new Error('event-top-cut topCutSize must be within the event field.');
    return {
      learningTarget: 'event-top-cut',
      label: (standing as number) <= (topCutSize as number) ? 1 : 0,
      metadata: {
        outcomeKind: 'event-top-cut',
        standing: standing as number,
        fieldSize: fieldSize as number,
        topCutSize: topCutSize as number,
      },
    };
  }
  throw new Error('outcome.kind must be match-win or event-top-cut.');
}

function rejection(
  index: number,
  record: unknown,
  code: LearningIngestionRejectionCodeV15,
  reason: string,
): LearningIngestionRejectionV15 {
  const candidate = record && typeof record === 'object' ? record as Record<string, unknown> : {};
  return {
    index,
    sourceId: typeof candidate.sourceId === 'string' ? candidate.sourceId : null,
    sourceRecordId: typeof candidate.sourceRecordId === 'string' ? candidate.sourceRecordId : null,
    code,
    reason,
  };
}

function sourceErrorCode(error: Error): LearningIngestionRejectionCodeV15 {
  if (/unknown source/i.test(error.message)) return 'unknown-source';
  if (/evidence class/i.test(error.message)) return 'wrong-evidence-class';
  if (/sourceUrl/i.test(error.message) || /registered source/i.test(error.message)) return 'source-url-mismatch';
  if (/timestamp|occurred after/i.test(error.message)) return 'invalid-timestamp-order';
  if (/deck|100 cards|commander section/i.test(error.message)) return 'invalid-decklist';
  if (/commander identity/i.test(error.message)) return 'invalid-commander-identity';
  if (/feature/i.test(error.message)) return 'invalid-features';
  if (/outcome|standing|fieldSize|topCutSize|won/i.test(error.message)) return 'invalid-outcome';
  return 'malformed-record';
}

/**
 * Quarantine-first ingestion boundary for real observed Commander outcomes.
 *
 * It intentionally accepts only registered `observed-results` sources, requires a
 * complete 100-card Commander decklist, derives evidence class and labels rather
 * than trusting caller-supplied labels, and keeps source-observation time separate
 * from the outcome date used by temporal training splits.
 *
 * The caller must provide cross-source `canonicalOutcomeId`, `independenceKey`,
 * and `leakageKey`. Mirrors of the same underlying event/outcome should therefore
 * share those keys and will be deduplicated by the corpus layer rather than being
 * multiplied as independent evidence.
 */
export function ingestObservedLearningRecordsV15(
  records: readonly ObservedLearningSourceRecordV15[],
): LearningIngestionResultV15 {
  if (!Array.isArray(records)) throw new Error('records must be an array.');
  if (records.length > MAX_LEARNING_INGEST_BATCH_V15) {
    throw new Error(`records must contain at most ${MAX_LEARNING_INGEST_BATCH_V15} entries.`);
  }

  const accepted: LearningOutcomeRecordV15[] = [];
  const rejected: LearningIngestionRejectionV15[] = [];
  const seenSourceRecords = new Set<string>();

  for (let index = 0; index < records.length; index += 1) {
    const raw = records[index];
    try {
      if (!raw || typeof raw !== 'object') throw new Error('record must be an object.');
      const sourceId = requiredString('sourceId', raw.sourceId);
      const source = SOURCE_BY_ID.get(sourceId);
      if (!source) throw new Error(`Unknown source: ${sourceId}.`);
      if (source.evidenceClass !== 'observed-results') {
        throw new Error(`Source ${sourceId} has evidence class ${source.evidenceClass}; observed outcome training requires observed-results evidence.`);
      }
      const sourceRecordId = requiredString('sourceRecordId', raw.sourceRecordId);
      const sourceRowKey = `${normalize(sourceId)}|${normalize(sourceRecordId)}`;
      if (seenSourceRecords.has(sourceRowKey)) {
        rejected.push(rejection(index, raw, 'duplicate-source-record', `Duplicate source record ${sourceId}:${sourceRecordId}.`));
        continue;
      }
      seenSourceRecords.add(sourceRowKey);

      const sourceUrl = validateSourceUrl(source, raw.sourceUrl);
      const canonicalOutcomeId = requiredString('canonicalOutcomeId', raw.canonicalOutcomeId);
      const independenceKey = requiredString('independenceKey', raw.independenceKey);
      const leakageKey = requiredString('leakageKey', raw.leakageKey);
      const outcomeOccurredAt = timestampMs('outcomeOccurredAt', raw.outcomeOccurredAt);
      const sourceObservedAt = timestampMs('sourceObservedAt', raw.sourceObservedAt);
      if (outcomeOccurredAt.ms > sourceObservedAt.ms) {
        throw new Error('outcomeOccurredAt cannot occur after sourceObservedAt.');
      }

      if (typeof raw.decklist !== 'string' || !raw.decklist.trim()) throw new Error('decklist must be a non-empty string.');
      if (raw.decklist.length > MAX_LEARNING_DECKLIST_LENGTH_V15) throw new Error(`decklist exceeds ${MAX_LEARNING_DECKLIST_LENGTH_V15} characters.`);
      const parsed = parseDecklist(raw.decklist);
      if (parsed.totalCards !== 100) throw new Error(`Observed Commander training deck must contain exactly 100 cards; found ${parsed.totalCards}.`);
      if (parsed.commanders.length < 1 || parsed.commanders.length > 2) {
        throw new Error('Observed Commander training deck must contain one or two commander entries.');
      }
      if (parsed.commanders.some((entry) => entry.quantity !== 1)) {
        throw new Error('Each commander section entry must represent exactly one physical card.');
      }
      const commanderNames = parsed.commanders.map((entry) => entry.name.trim());
      if (raw.expectedCommanderNames !== undefined) {
        if (!Array.isArray(raw.expectedCommanderNames) || raw.expectedCommanderNames.length < 1 || raw.expectedCommanderNames.length > 2) {
          throw new Error('expectedCommanderNames must contain one or two commander names.');
        }
        const expected = raw.expectedCommanderNames.map((name) => requiredString('expectedCommanderNames entry', name)).map(normalize).sort();
        const actual = commanderNames.map(normalize).sort();
        if (expected.join('|') !== actual.join('|')) {
          throw new Error(`Commander identity mismatch: source expected ${expected.join(' / ')}, decklist contains ${actual.join(' / ')}.`);
        }
      }

      const featureExtractorId = requiredString('featureExtractorId', raw.featureExtractorId);
      if (!validFeatures(raw.features)) throw new Error('features must contain only known finite V0.15 learning features in [-1, 1].');
      if (!validMetadata(raw.metadata)) throw new Error('metadata must contain at most 64 scalar fields.');
      if (raw.importance !== undefined && (!Number.isFinite(raw.importance) || raw.importance < 0.1 || raw.importance > 5)) {
        throw new Error('importance must be finite and between 0.1 and 5 when supplied.');
      }
      const derived = learningTargetAndLabel(raw.outcome);
      const deckFingerprint = fingerprintExactDeckV15(raw.decklist);

      accepted.push({
        outcomeId: canonicalOutcomeId,
        observedAt: outcomeOccurredAt.value,
        sourceId,
        evidenceClass: source.evidenceClass,
        independentGroup: independenceKey,
        leakageGroup: leakageKey,
        deckFingerprint,
        commanderNames,
        features: { ...raw.features },
        label: derived.label,
        learningTarget: derived.learningTarget,
        ...(raw.importance !== undefined ? { importance: raw.importance } : {}),
        metadata: {
          ...(raw.metadata ?? {}),
          sourceRecordId,
          sourceUrl,
          sourceObservedAt: sourceObservedAt.value,
          outcomeOccurredAt: outcomeOccurredAt.value,
          featureExtractorId,
          ...derived.metadata,
        },
      });
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      rejected.push(rejection(index, raw, sourceErrorCode(normalizedError), normalizedError.message));
    }
  }

  const rejectionCounts = Object.fromEntries(REJECTION_CODES.map((code) => [code, 0])) as Record<LearningIngestionRejectionCodeV15, number>;
  for (const entry of rejected) rejectionCounts[entry.code] += 1;
  const sourceCounts: Record<string, number> = {};
  const learningTargetCounts: Partial<Record<LearningTargetV15, number>> = {};
  for (const record of accepted) {
    sourceCounts[record.sourceId] = (sourceCounts[record.sourceId] ?? 0) + 1;
    const target = record.learningTarget ?? 'legacy-unspecified';
    learningTargetCounts[target] = (learningTargetCounts[target] ?? 0) + 1;
  }

  return {
    accepted,
    rejected,
    audit: {
      inputRecords: records.length,
      acceptedRecords: accepted.length,
      rejectedRecords: rejected.length,
      rejectionCounts,
      sourceCounts,
      learningTargetCounts,
    },
  };
}
