export const TEMPORAL_PROVENANCE_SCHEMA_V15 = 'temporal-provenance-v15.1' as const;

export type TemporalEvidenceDomainV15 =
  | 'printing'
  | 'oracle'
  | 'commander-legality'
  | 'rules'
  | 'tournament-outcome'
  | 'recorded-game'
  | 'source-snapshot'
  | 'other';

export type TemporalEvidenceTruthStatusV15 =
  | 'verified-present'
  | 'verified-absent'
  | 'unavailable'
  | 'present-day-proxy';

export type TemporalEvidenceModeV15 =
  | 'current-truth'
  | 'contemporaneous-snapshot'
  | 'archived-versioned-snapshot'
  | 'retrospective-reconstruction';

interface TemporalEvidenceBaseV15 {
  domain: TemporalEvidenceDomainV15;
  sourceId: string;
  sourceUri: string;
  sourceRecordId?: string;
  sourceVersion?: string;
  sourceContentHash?: string;
  validFrom?: string;
  validUntil?: string;
  truthStatus: TemporalEvidenceTruthStatusV15;
}

export type TemporalEvidenceProvenanceV15 =
  | (TemporalEvidenceBaseV15 & {
      mode: 'current-truth';
      sourceObservedAt: string;
      sourceRetrievedAt: string;
    })
  | (TemporalEvidenceBaseV15 & {
      mode: 'contemporaneous-snapshot';
      sourceObservedAt: string;
      sourceRetrievedAt: string;
    })
  | (TemporalEvidenceBaseV15 & {
      mode: 'archived-versioned-snapshot';
      sourceVersion: string;
      sourceContentHash: string;
      snapshotEffectiveAt: string;
      archivePublishedAt: string;
      sourceRetrievedAt: string;
    })
  | (TemporalEvidenceBaseV15 & {
      mode: 'retrospective-reconstruction';
      sourceObservedAt: string;
      sourceRetrievedAt: string;
      reconstructionBasis: 'historical-sources' | 'mixed' | 'present-day-proxy';
    });

export interface NormalizedTemporalEvidenceProvenanceV15 {
  schemaVersion: typeof TEMPORAL_PROVENANCE_SCHEMA_V15;
  mode: TemporalEvidenceModeV15;
  domain: TemporalEvidenceDomainV15;
  sourceId: string;
  sourceUri: string;
  sourceRecordId: string | null;
  sourceVersion: string | null;
  sourceContentHash: string | null;
  sourceObservedAt: string;
  sourceRetrievedAt: string;
  sourceAvailableAt: string;
  validFrom: string | null;
  validUntil: string | null;
  truthStatus: TemporalEvidenceTruthStatusV15;
  snapshotEffectiveAt: string | null;
  archivePublishedAt: string | null;
  reconstructionBasis: 'historical-sources' | 'mixed' | 'present-day-proxy' | null;
  replayable: boolean;
}

export type HistoricalEvidenceUsabilityV15 =
  | 'usable'
  | 'advisory-only'
  | 'unavailable'
  | 'future-or-out-of-range'
  | 'current-only';

export interface TemporalEvidenceAssessmentV15 {
  provenance: NormalizedTemporalEvidenceProvenanceV15;
  asOf: string | null;
  scope: 'current' | 'historical';
  usableForClaim: boolean;
  historicalUsability: HistoricalEvidenceUsabilityV15;
  confidence: 'high' | 'reduced' | 'none';
  reasons: string[];
  disclosures: string[];
}

export interface TemporalEvidencePartitionV15 {
  verifiedPresent: NormalizedTemporalEvidenceProvenanceV15[];
  verifiedAbsent: NormalizedTemporalEvidenceProvenanceV15[];
  unavailable: NormalizedTemporalEvidenceProvenanceV15[];
  advisoryOnly: NormalizedTemporalEvidenceProvenanceV15[];
  excludedFutureOrOutOfRange: NormalizedTemporalEvidenceProvenanceV15[];
}

const DOMAINS = new Set<TemporalEvidenceDomainV15>([
  'printing',
  'oracle',
  'commander-legality',
  'rules',
  'tournament-outcome',
  'recorded-game',
  'source-snapshot',
  'other',
]);

const TRUTH_STATUSES = new Set<TemporalEvidenceTruthStatusV15>([
  'verified-present',
  'verified-absent',
  'unavailable',
  'present-day-proxy',
]);

function required(name: string, value: unknown, maximum = 2_000): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  const text = value.trim();
  if (text.length > maximum) throw new Error(`${name} must be at most ${maximum} characters.`);
  return text;
}

function optionalText(name: string, value: unknown, maximum = 2_000): string | null {
  if (value === undefined || value === null) return null;
  return required(name, value, maximum);
}

function timestamp(name: string, value: unknown): { iso: string; ms: number } {
  const text = required(name, value, 200);
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) throw new Error(`${name} must be a valid timestamp.`);
  return { iso: new Date(ms).toISOString(), ms };
}

function optionalTimestamp(name: string, value: unknown): { iso: string; ms: number } | null {
  if (value === undefined || value === null) return null;
  return timestamp(name, value);
}

function sourceUri(value: unknown): string {
  const text = required('sourceUri', value);
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error('sourceUri must be an absolute http/https URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('sourceUri must be an absolute http/https URL.');
  }
  return parsed.toString();
}

function contentHash(value: unknown): string | null {
  const text = optionalText('sourceContentHash', value, 128);
  if (text === null) return null;
  const normalized = text.toLocaleLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error('sourceContentHash must be a SHA-256 hex digest when supplied.');
  }
  return normalized;
}

function normalizeValidity(provenance: TemporalEvidenceProvenanceV15): {
  validFrom: string | null;
  validUntil: string | null;
  validFromMs: number | null;
  validUntilMs: number | null;
} {
  const from = optionalTimestamp('validFrom', provenance.validFrom);
  const until = optionalTimestamp('validUntil', provenance.validUntil);
  if (from && until && from.ms > until.ms) {
    throw new Error('validFrom cannot occur after validUntil.');
  }
  return {
    validFrom: from?.iso ?? null,
    validUntil: until?.iso ?? null,
    validFromMs: from?.ms ?? null,
    validUntilMs: until?.ms ?? null,
  };
}

function normalizeBase(provenance: TemporalEvidenceProvenanceV15) {
  if (!provenance || typeof provenance !== 'object') throw new Error('Temporal evidence provenance must be an object.');
  if (!DOMAINS.has(provenance.domain)) throw new Error(`Unsupported temporal evidence domain: ${String(provenance.domain)}.`);
  if (!TRUTH_STATUSES.has(provenance.truthStatus)) {
    throw new Error(`Unsupported temporal truth status: ${String(provenance.truthStatus)}.`);
  }
  const sourceVersion = optionalText('sourceVersion', provenance.sourceVersion, 500);
  const sourceContentHash = contentHash(provenance.sourceContentHash);
  const validity = normalizeValidity(provenance);
  return {
    domain: provenance.domain,
    sourceId: required('sourceId', provenance.sourceId, 500),
    sourceUri: sourceUri(provenance.sourceUri),
    sourceRecordId: optionalText('sourceRecordId', provenance.sourceRecordId, 1_000),
    sourceVersion,
    sourceContentHash,
    truthStatus: provenance.truthStatus,
    ...validity,
  } as const;
}

/**
 * Normalizes one source/fact provenance envelope without deciding whether it is
 * safe for a particular historical date. The returned sourceAvailableAt is the
 * earliest independently claimed time at which this evidence existed in the
 * represented source channel; later retrieval does not move a properly versioned
 * archive backward in time.
 */
export function normalizeTemporalEvidenceProvenanceV15(
  provenance: TemporalEvidenceProvenanceV15,
): NormalizedTemporalEvidenceProvenanceV15 {
  const base = normalizeBase(provenance);

  if (provenance.mode === 'current-truth' || provenance.mode === 'contemporaneous-snapshot') {
    const observed = timestamp('sourceObservedAt', provenance.sourceObservedAt);
    const retrieved = timestamp('sourceRetrievedAt', provenance.sourceRetrievedAt);
    if (retrieved.ms < observed.ms) throw new Error('sourceRetrievedAt cannot occur before sourceObservedAt.');
    return {
      schemaVersion: TEMPORAL_PROVENANCE_SCHEMA_V15,
      mode: provenance.mode,
      ...base,
      sourceObservedAt: observed.iso,
      sourceRetrievedAt: retrieved.iso,
      sourceAvailableAt: observed.iso,
      snapshotEffectiveAt: null,
      archivePublishedAt: null,
      reconstructionBasis: null,
      replayable: Boolean(base.sourceVersion && base.sourceContentHash),
    };
  }

  if (provenance.mode === 'archived-versioned-snapshot') {
    const effective = timestamp('snapshotEffectiveAt', provenance.snapshotEffectiveAt);
    const published = timestamp('archivePublishedAt', provenance.archivePublishedAt);
    const retrieved = timestamp('sourceRetrievedAt', provenance.sourceRetrievedAt);
    if (effective.ms > published.ms) throw new Error('snapshotEffectiveAt cannot occur after archivePublishedAt.');
    if (retrieved.ms < published.ms) throw new Error('sourceRetrievedAt cannot occur before archivePublishedAt.');
    const sourceVersion = required('sourceVersion', provenance.sourceVersion, 500);
    const sourceContentHash = contentHash(provenance.sourceContentHash);
    if (!sourceContentHash) throw new Error('Archived historical evidence requires sourceContentHash.');
    return {
      schemaVersion: TEMPORAL_PROVENANCE_SCHEMA_V15,
      mode: provenance.mode,
      ...base,
      sourceVersion,
      sourceContentHash,
      sourceObservedAt: published.iso,
      sourceRetrievedAt: retrieved.iso,
      sourceAvailableAt: published.iso,
      snapshotEffectiveAt: effective.iso,
      archivePublishedAt: published.iso,
      reconstructionBasis: null,
      replayable: true,
    };
  }

  if (provenance.mode === 'retrospective-reconstruction') {
    const observed = timestamp('sourceObservedAt', provenance.sourceObservedAt);
    const retrieved = timestamp('sourceRetrievedAt', provenance.sourceRetrievedAt);
    if (retrieved.ms < observed.ms) throw new Error('sourceRetrievedAt cannot occur before sourceObservedAt.');
    if (!['historical-sources', 'mixed', 'present-day-proxy'].includes(provenance.reconstructionBasis)) {
      throw new Error(`Unsupported reconstructionBasis: ${String(provenance.reconstructionBasis)}.`);
    }
    return {
      schemaVersion: TEMPORAL_PROVENANCE_SCHEMA_V15,
      mode: provenance.mode,
      ...base,
      sourceObservedAt: observed.iso,
      sourceRetrievedAt: retrieved.iso,
      sourceAvailableAt: observed.iso,
      snapshotEffectiveAt: null,
      archivePublishedAt: null,
      reconstructionBasis: provenance.reconstructionBasis,
      replayable: Boolean(base.sourceVersion && base.sourceContentHash),
    };
  }

  const exhaustive: never = provenance;
  throw new Error(`Unsupported temporal evidence mode: ${String(exhaustive)}.`);
}

function outsideValidity(
  provenance: NormalizedTemporalEvidenceProvenanceV15,
  asOfMs: number,
): string[] {
  const reasons: string[] = [];
  const fromMs = provenance.validFrom ? Date.parse(provenance.validFrom) : null;
  const untilMs = provenance.validUntil ? Date.parse(provenance.validUntil) : null;
  if (fromMs !== null && fromMs > asOfMs) reasons.push('The fact did not become valid until after the requested as-of time.');
  if (untilMs !== null && untilMs < asOfMs) reasons.push('The fact had ceased to be valid before the requested as-of time.');
  return reasons;
}

function unavailableAssessment(
  provenance: NormalizedTemporalEvidenceProvenanceV15,
  asOf: string | null,
  scope: 'current' | 'historical',
  reasons: string[],
  disclosures: string[] = [],
): TemporalEvidenceAssessmentV15 {
  return {
    provenance,
    asOf,
    scope,
    usableForClaim: false,
    historicalUsability: 'unavailable',
    confidence: 'none',
    reasons,
    disclosures,
  };
}

/**
 * Evaluates whether evidence may support a claim at a requested historical time.
 * Verified absence remains distinct from unavailable evidence. A present-day
 * proxy or retrospective reconstruction can be disclosed as advisory context,
 * but never silently upgrades into strict historical truth.
 */
export function assessTemporalEvidenceAsOfV15(
  input: TemporalEvidenceProvenanceV15,
  asOf?: string | null,
): TemporalEvidenceAssessmentV15 {
  const provenance = normalizeTemporalEvidenceProvenanceV15(input);
  const historical = typeof asOf === 'string' && asOf.trim().length > 0;
  const asOfTime = historical ? timestamp('asOf', asOf) : null;
  const normalizedAsOf = asOfTime?.iso ?? null;

  if (!historical) {
    if (provenance.truthStatus === 'unavailable') {
      return unavailableAssessment(provenance, null, 'current', ['The source explicitly reports that the requested truth is unavailable.']);
    }
    if (provenance.truthStatus === 'present-day-proxy') {
      return {
        provenance,
        asOf: null,
        scope: 'current',
        usableForClaim: false,
        historicalUsability: 'advisory-only',
        confidence: 'reduced',
        reasons: ['A present-day proxy is advisory context rather than verified truth.'],
        disclosures: ['This evidence is a present-day proxy and must not be represented as directly verified source truth.'],
      };
    }
    return {
      provenance,
      asOf: null,
      scope: 'current',
      usableForClaim: true,
      historicalUsability: 'current-only',
      confidence: 'high',
      reasons: [],
      disclosures: [],
    };
  }

  const asOfMs = asOfTime?.ms ?? 0;
  if (provenance.truthStatus === 'unavailable') {
    return unavailableAssessment(
      provenance,
      normalizedAsOf,
      'historical',
      ['Historical truth is unavailable from this source; unavailable evidence is not verified absence.'],
    );
  }

  if (provenance.mode === 'current-truth') {
    return {
      provenance,
      asOf: normalizedAsOf,
      scope: 'historical',
      usableForClaim: false,
      historicalUsability: 'current-only',
      confidence: 'none',
      reasons: ['Current-truth evidence cannot establish what was true at an earlier requested as-of time.'],
      disclosures: ['Present-day truth was available, but it was not substituted for historical state.'],
    };
  }

  const validityReasons = outsideValidity(provenance, asOfMs);
  const availableMs = Date.parse(provenance.sourceAvailableAt);
  if (availableMs > asOfMs || validityReasons.length > 0) {
    return {
      provenance,
      asOf: normalizedAsOf,
      scope: 'historical',
      usableForClaim: false,
      historicalUsability: 'future-or-out-of-range',
      confidence: 'none',
      reasons: [
        ...(availableMs > asOfMs ? ['The source evidence became available only after the requested as-of time.'] : []),
        ...validityReasons,
      ],
      disclosures: [],
    };
  }

  if (provenance.mode === 'archived-versioned-snapshot') {
    const effectiveMs = Date.parse(provenance.snapshotEffectiveAt ?? provenance.sourceAvailableAt);
    if (effectiveMs > asOfMs) {
      return {
        provenance,
        asOf: normalizedAsOf,
        scope: 'historical',
        usableForClaim: false,
        historicalUsability: 'future-or-out-of-range',
        confidence: 'none',
        reasons: ['The archived snapshot became effective only after the requested as-of time.'],
        disclosures: [],
      };
    }
  }

  if (provenance.mode === 'retrospective-reconstruction') {
    const proxy = provenance.truthStatus === 'present-day-proxy'
      || provenance.reconstructionBasis === 'present-day-proxy'
      || provenance.reconstructionBasis === 'mixed';
    return {
      provenance,
      asOf: normalizedAsOf,
      scope: 'historical',
      usableForClaim: false,
      historicalUsability: 'advisory-only',
      confidence: 'reduced',
      reasons: [
        'Retrospective reconstruction is advisory and cannot satisfy a strict historical truth gate without a contemporaneous or independently versioned snapshot.',
      ],
      disclosures: [
        proxy
          ? 'The reconstruction contains present-day proxy information and is not equivalent to contemporaneous historical evidence.'
          : 'The reconstruction was assembled later from historical sources and is disclosed separately from a contemporaneous snapshot.',
      ],
    };
  }

  if (provenance.truthStatus === 'present-day-proxy') {
    return {
      provenance,
      asOf: normalizedAsOf,
      scope: 'historical',
      usableForClaim: false,
      historicalUsability: 'advisory-only',
      confidence: 'reduced',
      reasons: ['Present-day proxy information cannot satisfy a strict historical truth gate.'],
      disclosures: ['The proxy may be shown as advisory context only and was not counted as historical evidence.'],
    };
  }

  return {
    provenance,
    asOf: normalizedAsOf,
    scope: 'historical',
    usableForClaim: true,
    historicalUsability: 'usable',
    confidence: provenance.replayable ? 'high' : 'reduced',
    reasons: provenance.replayable ? [] : ['Historical timing is verified, but the source is not fully content-addressed/versioned for deterministic replay.'],
    disclosures: provenance.replayable ? [] : ['Historical evidence is usable but has reduced provenance completeness because source version/content hash is incomplete.'],
  };
}

export function assertHistoricalEvidenceUsableV15(
  provenance: TemporalEvidenceProvenanceV15,
  asOf: string,
  options: { requireReplayable?: boolean } = {},
): NormalizedTemporalEvidenceProvenanceV15 {
  const assessment = assessTemporalEvidenceAsOfV15(provenance, asOf);
  if (!assessment.usableForClaim || assessment.historicalUsability !== 'usable') {
    throw new Error(`Historical evidence is not usable as of ${assessment.asOf ?? asOf}: ${assessment.reasons.join(' ')}`);
  }
  if (options.requireReplayable && !assessment.provenance.replayable) {
    throw new Error('Historical evidence must include both sourceVersion and sourceContentHash for deterministic replay.');
  }
  return assessment.provenance;
}

export function partitionTemporalEvidenceAsOfV15(
  evidence: TemporalEvidenceProvenanceV15[],
  asOf: string,
): TemporalEvidencePartitionV15 {
  if (!Array.isArray(evidence)) throw new Error('evidence must be an array.');
  const output: TemporalEvidencePartitionV15 = {
    verifiedPresent: [],
    verifiedAbsent: [],
    unavailable: [],
    advisoryOnly: [],
    excludedFutureOrOutOfRange: [],
  };

  for (const item of evidence) {
    const assessment = assessTemporalEvidenceAsOfV15(item, asOf);
    if (assessment.usableForClaim && assessment.provenance.truthStatus === 'verified-present') {
      output.verifiedPresent.push(assessment.provenance);
    } else if (assessment.usableForClaim && assessment.provenance.truthStatus === 'verified-absent') {
      output.verifiedAbsent.push(assessment.provenance);
    } else if (assessment.historicalUsability === 'unavailable') {
      output.unavailable.push(assessment.provenance);
    } else if (assessment.historicalUsability === 'advisory-only' || assessment.historicalUsability === 'current-only') {
      output.advisoryOnly.push(assessment.provenance);
    } else {
      output.excludedFutureOrOutOfRange.push(assessment.provenance);
    }
  }

  return output;
}
