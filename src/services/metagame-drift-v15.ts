import {
  deduplicateLearningCorpusV15,
  type LearningOutcomeRecordV15,
} from './learning-corpus-v15.js';
import { LEARNING_FEATURES_V15, type LearningFeatureV15 } from './research-learning-v15.js';

export type MetagameDriftSeverityV15 = 'insufficient' | 'stable' | 'moderate' | 'severe';

export interface MetagameDriftReportV15 {
  severity: MetagameDriftSeverityV15;
  usableRecords: number;
  referenceRecords: number;
  recentRecords: number;
  referenceRange: { start: string | null; end: string | null };
  recentRange: { start: string | null; end: string | null };
  referencePositiveRate: number | null;
  recentPositiveRate: number | null;
  positiveRateShift: number | null;
  featureMeanShift: Partial<Record<LearningFeatureV15, {
    referenceMean: number;
    recentMean: number;
    absoluteShift: number;
  }>>;
  maximumFeatureShift: number | null;
  commanderDistributionShift: number | null;
  evidenceClassDistributionShift: number | null;
  reasons: string[];
  recommendation: 'gather-more-data' | 'continue-monitoring' | 'retest-models' | 'block-promotion-and-retrain';
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function round(value: number, digits = 4): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function timestampMs(record: LearningOutcomeRecordV15): number {
  const parsed = Date.parse(record.observedAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function range(records: LearningOutcomeRecordV15[]): { start: string | null; end: string | null } {
  if (records.length === 0) return { start: null, end: null };
  return {
    start: records[0]?.observedAt ?? null,
    end: records[records.length - 1]?.observedAt ?? null,
  };
}

function positiveRate(records: LearningOutcomeRecordV15[]): number | null {
  if (records.length === 0) return null;
  return records.filter((record) => record.label === 1).length / records.length;
}

function featureMean(records: LearningOutcomeRecordV15[], feature: LearningFeatureV15): number {
  if (records.length === 0) return 0;
  let sum = 0;
  for (const record of records) {
    const value = record.features[feature];
    sum += typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
  return sum / records.length;
}

function distribution(records: LearningOutcomeRecordV15[], key: (record: LearningOutcomeRecordV15) => string): Map<string, number> {
  const counts = new Map<string, number>();
  if (records.length === 0) return counts;
  for (const record of records) {
    const normalized = normalize(key(record));
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  for (const [name, count] of counts) counts.set(name, count / records.length);
  return counts;
}

function commanderKey(record: LearningOutcomeRecordV15): string {
  return record.commanderNames.map(normalize).sort().join(' + ');
}

/** Jensen-Shannon divergence with log base 2. Bounded from 0 to 1. */
function jensenShannon(left: Map<string, number>, right: Map<string, number>): number | null {
  if (left.size === 0 || right.size === 0) return null;
  const keys = new Set([...left.keys(), ...right.keys()]);
  let divergence = 0;
  for (const key of keys) {
    const p = left.get(key) ?? 0;
    const q = right.get(key) ?? 0;
    const m = (p + q) / 2;
    if (p > 0 && m > 0) divergence += 0.5 * p * Math.log2(p / m);
    if (q > 0 && m > 0) divergence += 0.5 * q * Math.log2(q / m);
  }
  return round(Math.min(1, Math.max(0, divergence)));
}

export function detectMetagameDriftV15(
  records: LearningOutcomeRecordV15[],
  options: { recentFraction?: number; minimumWindowRecords?: number } = {},
): MetagameDriftReportV15 {
  const usable = deduplicateLearningCorpusV15(records).records
    .slice()
    .sort((a, b) => timestampMs(a) - timestampMs(b));
  const recentFraction = Number.isFinite(options.recentFraction)
    ? Math.min(0.5, Math.max(0.1, options.recentFraction ?? 0.25))
    : 0.25;
  const minimumWindowRecords = Number.isFinite(options.minimumWindowRecords)
    ? Math.max(10, Math.trunc(options.minimumWindowRecords ?? 40))
    : 40;
  const recentCount = Math.max(1, Math.ceil(usable.length * recentFraction));
  const cut = Math.max(0, usable.length - recentCount);
  const reference = usable.slice(0, cut);
  const recent = usable.slice(cut);

  const referencePositiveRate = positiveRate(reference);
  const recentPositiveRate = positiveRate(recent);
  const positiveRateShift = referencePositiveRate === null || recentPositiveRate === null
    ? null
    : round(Math.abs(recentPositiveRate - referencePositiveRate));

  const featureMeanShift: MetagameDriftReportV15['featureMeanShift'] = {};
  let maximumFeatureShift: number | null = null;
  for (const feature of LEARNING_FEATURES_V15) {
    const referenceMean = featureMean(reference, feature);
    const recentMean = featureMean(recent, feature);
    const absoluteShift = Math.abs(recentMean - referenceMean);
    featureMeanShift[feature] = {
      referenceMean: round(referenceMean),
      recentMean: round(recentMean),
      absoluteShift: round(absoluteShift),
    };
    maximumFeatureShift = maximumFeatureShift === null ? absoluteShift : Math.max(maximumFeatureShift, absoluteShift);
  }
  if (maximumFeatureShift !== null) maximumFeatureShift = round(maximumFeatureShift);

  const commanderDistributionShift = jensenShannon(
    distribution(reference, commanderKey),
    distribution(recent, commanderKey),
  );
  const evidenceClassDistributionShift = jensenShannon(
    distribution(reference, (record) => record.evidenceClass),
    distribution(recent, (record) => record.evidenceClass),
  );

  const reasons: string[] = [];
  let severity: MetagameDriftSeverityV15 = 'stable';
  if (reference.length < minimumWindowRecords || recent.length < minimumWindowRecords) {
    severity = 'insufficient';
    reasons.push(`Need at least ${minimumWindowRecords} leakage-clean records in both reference and recent windows before drift can be trusted.`);
  } else {
    const severe = (positiveRateShift ?? 0) >= 0.25
      || (maximumFeatureShift ?? 0) >= 0.5
      || (commanderDistributionShift ?? 0) >= 0.35;
    const moderate = (positiveRateShift ?? 0) >= 0.12
      || (maximumFeatureShift ?? 0) >= 0.25
      || (commanderDistributionShift ?? 0) >= 0.18
      || (evidenceClassDistributionShift ?? 0) >= 0.2;

    if (severe) severity = 'severe';
    else if (moderate) severity = 'moderate';

    if ((positiveRateShift ?? 0) >= 0.12) reasons.push(`Outcome rate shifted by ${round((positiveRateShift ?? 0) * 100, 1)} percentage points.`);
    if ((maximumFeatureShift ?? 0) >= 0.25) reasons.push(`At least one learned feature mean shifted by ${round(maximumFeatureShift ?? 0, 3)} on the normalized [-1, 1] scale.`);
    if ((commanderDistributionShift ?? 0) >= 0.18) reasons.push(`Commander distribution changed materially (Jensen-Shannon divergence ${commanderDistributionShift}).`);
    if ((evidenceClassDistributionShift ?? 0) >= 0.2) reasons.push(`Evidence-source mix changed materially (Jensen-Shannon divergence ${evidenceClassDistributionShift}).`);
    if (reasons.length === 0) reasons.push('No material recent shift was detected across outcomes, learned features, commanders, or evidence-class mix.');
  }

  const recommendation: MetagameDriftReportV15['recommendation'] = severity === 'insufficient'
    ? 'gather-more-data'
    : severity === 'severe'
      ? 'block-promotion-and-retrain'
      : severity === 'moderate'
        ? 'retest-models'
        : 'continue-monitoring';

  return {
    severity,
    usableRecords: usable.length,
    referenceRecords: reference.length,
    recentRecords: recent.length,
    referenceRange: range(reference),
    recentRange: range(recent),
    referencePositiveRate: referencePositiveRate === null ? null : round(referencePositiveRate),
    recentPositiveRate: recentPositiveRate === null ? null : round(recentPositiveRate),
    positiveRateShift,
    featureMeanShift,
    maximumFeatureShift,
    commanderDistributionShift,
    evidenceClassDistributionShift,
    reasons,
    recommendation,
  };
}
