import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertHistoricalEvidenceUsableV15,
  assessTemporalEvidenceAsOfV15,
  normalizeTemporalEvidenceProvenanceV15,
  partitionTemporalEvidenceAsOfV15,
  type TemporalEvidenceDomainV15,
  type TemporalEvidenceProvenanceV15,
} from './temporal-provenance-v15.js';

const HASH = 'a'.repeat(64);

function contemporaneous(
  domain: TemporalEvidenceDomainV15,
  overrides: Partial<Extract<TemporalEvidenceProvenanceV15, { mode: 'contemporaneous-snapshot' }>> = {},
): TemporalEvidenceProvenanceV15 {
  return {
    mode: 'contemporaneous-snapshot',
    domain,
    sourceId: 'fixture-source',
    sourceUri: 'https://example.test/history/fact.json',
    sourceRecordId: `${domain}-1`,
    sourceVersion: 'fixture-v1',
    sourceContentHash: HASH,
    sourceObservedAt: '2026-01-09T12:00:00.000Z',
    sourceRetrievedAt: '2026-01-09T12:05:00.000Z',
    validFrom: '2025-01-01T00:00:00.000Z',
    truthStatus: 'verified-present',
    ...overrides,
  };
}

test('current truth remains the default when no historical as-of time is requested', () => {
  const current: TemporalEvidenceProvenanceV15 = {
    mode: 'current-truth',
    domain: 'commander-legality',
    sourceId: 'current-rules-source',
    sourceUri: 'https://example.test/current/commander-legality',
    sourceObservedAt: '2026-08-19T00:00:00.000Z',
    sourceRetrievedAt: '2026-08-19T00:01:00.000Z',
    truthStatus: 'verified-present',
  };

  const now = assessTemporalEvidenceAsOfV15(current);
  assert.equal(now.scope, 'current');
  assert.equal(now.usableForClaim, true);
  assert.equal(now.historicalUsability, 'current-only');

  const historical = assessTemporalEvidenceAsOfV15(current, '2025-01-01T00:00:00.000Z');
  assert.equal(historical.usableForClaim, false);
  assert.equal(historical.historicalUsability, 'current-only');
  assert.match(historical.reasons.join(' '), /current-truth.*earlier|cannot establish/i);
});

test('future printings cannot leak backward into an earlier as-of evaluation', () => {
  const futurePrinting = contemporaneous('printing', {
    sourceObservedAt: '2026-06-01T00:00:00.000Z',
    sourceRetrievedAt: '2026-06-01T00:05:00.000Z',
    validFrom: '2026-06-01T00:00:00.000Z',
  });
  const result = assessTemporalEvidenceAsOfV15(futurePrinting, '2026-01-10T00:00:00.000Z');
  assert.equal(result.usableForClaim, false);
  assert.equal(result.historicalUsability, 'future-or-out-of-range');
  assert.match(result.reasons.join(' '), /after.*as-of|did not become valid/i);
});

test('later Oracle, Commander legality, rules, and tournament evidence are all excluded from an earlier date', () => {
  const domains: TemporalEvidenceDomainV15[] = [
    'oracle',
    'commander-legality',
    'rules',
    'tournament-outcome',
  ];
  for (const domain of domains) {
    const result = assessTemporalEvidenceAsOfV15(
      contemporaneous(domain, {
        sourceObservedAt: '2026-02-01T00:00:00.000Z',
        sourceRetrievedAt: '2026-02-01T01:00:00.000Z',
        validFrom: '2026-02-01T00:00:00.000Z',
      }),
      '2026-01-15T00:00:00.000Z',
    );
    assert.equal(result.usableForClaim, false, `${domain} must not leak backward`);
    assert.equal(result.historicalUsability, 'future-or-out-of-range');
  }
});

test('verified historical absence is usable negative evidence while unavailable truth remains unavailable', () => {
  const absent = assessTemporalEvidenceAsOfV15(
    contemporaneous('printing', { truthStatus: 'verified-absent' }),
    '2026-01-10T00:00:00.000Z',
  );
  const unavailable = assessTemporalEvidenceAsOfV15(
    contemporaneous('printing', { truthStatus: 'unavailable' }),
    '2026-01-10T00:00:00.000Z',
  );

  assert.equal(absent.usableForClaim, true);
  assert.equal(absent.provenance.truthStatus, 'verified-absent');
  assert.equal(unavailable.usableForClaim, false);
  assert.equal(unavailable.historicalUsability, 'unavailable');
  assert.match(unavailable.reasons.join(' '), /not verified absence|unavailable/i);
});

test('a versioned archive published before the as-of date may be retrieved later', () => {
  const archive: TemporalEvidenceProvenanceV15 = {
    mode: 'archived-versioned-snapshot',
    domain: 'rules',
    sourceId: 'rules-archive',
    sourceUri: 'https://example.test/archive/rules-v1.json',
    sourceVersion: 'rules-v1',
    sourceContentHash: HASH,
    snapshotEffectiveAt: '2025-12-01T00:00:00.000Z',
    archivePublishedAt: '2025-12-02T00:00:00.000Z',
    sourceRetrievedAt: '2026-08-19T00:00:00.000Z',
    validFrom: '2025-12-01T00:00:00.000Z',
    truthStatus: 'verified-present',
  };

  const result = assessTemporalEvidenceAsOfV15(archive, '2026-01-10T00:00:00.000Z');
  assert.equal(result.usableForClaim, true);
  assert.equal(result.provenance.replayable, true);
  assert.equal(result.confidence, 'high');
  assert.equal(result.provenance.sourceRetrievedAt, '2026-08-19T00:00:00.000Z');
});

test('an archive published after the historical date cannot backdate itself with an older effective date', () => {
  const archive: TemporalEvidenceProvenanceV15 = {
    mode: 'archived-versioned-snapshot',
    domain: 'oracle',
    sourceId: 'oracle-archive',
    sourceUri: 'https://example.test/archive/oracle-v1.json',
    sourceVersion: 'oracle-v1',
    sourceContentHash: HASH,
    snapshotEffectiveAt: '2025-01-01T00:00:00.000Z',
    archivePublishedAt: '2026-02-01T00:00:00.000Z',
    sourceRetrievedAt: '2026-08-19T00:00:00.000Z',
    truthStatus: 'verified-present',
  };

  const result = assessTemporalEvidenceAsOfV15(archive, '2026-01-10T00:00:00.000Z');
  assert.equal(result.usableForClaim, false);
  assert.equal(result.historicalUsability, 'future-or-out-of-range');
  assert.match(result.reasons.join(' '), /became available.*after|after.*as-of/i);
});

test('retrospective reconstruction is disclosed and cannot satisfy a strict historical truth gate', () => {
  const reconstruction: TemporalEvidenceProvenanceV15 = {
    mode: 'retrospective-reconstruction',
    domain: 'commander-legality',
    sourceId: 'reconstruction',
    sourceUri: 'https://example.test/reconstruction/legality',
    sourceObservedAt: '2026-01-01T00:00:00.000Z',
    sourceRetrievedAt: '2026-08-19T00:00:00.000Z',
    reconstructionBasis: 'mixed',
    truthStatus: 'present-day-proxy',
    validFrom: '2025-01-01T00:00:00.000Z',
  };

  const result = assessTemporalEvidenceAsOfV15(reconstruction, '2026-01-10T00:00:00.000Z');
  assert.equal(result.usableForClaim, false);
  assert.equal(result.historicalUsability, 'advisory-only');
  assert.equal(result.confidence, 'reduced');
  assert.match(result.disclosures.join(' '), /present-day proxy|not equivalent/i);
  assert.throws(
    () => assertHistoricalEvidenceUsableV15(reconstruction, '2026-01-10T00:00:00.000Z'),
    /not usable|retrospective/i,
  );
});

test('strict replayable historical evidence requires both source version and content hash', () => {
  const incomplete: TemporalEvidenceProvenanceV15 = {
    mode: 'contemporaneous-snapshot',
    domain: 'source-snapshot',
    sourceId: 'fixture-source',
    sourceUri: 'https://example.test/history/incomplete.json',
    sourceObservedAt: '2026-01-09T12:00:00.000Z',
    sourceRetrievedAt: '2026-01-09T12:05:00.000Z',
    validFrom: '2025-01-01T00:00:00.000Z',
    truthStatus: 'verified-present',
  };
  const ordinary = assessTemporalEvidenceAsOfV15(incomplete, '2026-01-10T00:00:00.000Z');
  assert.equal(ordinary.usableForClaim, true);
  assert.equal(ordinary.confidence, 'reduced');
  assert.equal(ordinary.provenance.replayable, false);
  assert.throws(
    () => assertHistoricalEvidenceUsableV15(incomplete, '2026-01-10T00:00:00.000Z', { requireReplayable: true }),
    /sourceVersion.*sourceContentHash|deterministic replay/i,
  );
});

test('partition preserves verified absence separately from unavailable and future evidence', () => {
  const partition = partitionTemporalEvidenceAsOfV15([
    contemporaneous('printing'),
    contemporaneous('printing', { sourceRecordId: 'absent', truthStatus: 'verified-absent' }),
    contemporaneous('printing', { sourceRecordId: 'unknown', truthStatus: 'unavailable' }),
    contemporaneous('printing', {
      sourceRecordId: 'future',
      sourceObservedAt: '2027-01-01T00:00:00Z',
      sourceRetrievedAt: '2027-01-01T00:05:00Z',
    }),
  ], '2026-01-10T00:00:00.000Z');

  assert.equal(partition.verifiedPresent.length, 1);
  assert.equal(partition.verifiedAbsent.length, 1);
  assert.equal(partition.unavailable.length, 1);
  assert.equal(partition.excludedFutureOrOutOfRange.length, 1);
});

test('timestamp ordering, validity windows, source URL, and content hashes fail closed', () => {
  assert.throws(
    () => normalizeTemporalEvidenceProvenanceV15(contemporaneous('rules', {
      sourceRetrievedAt: '2026-01-01T00:00:00Z',
    })),
    /retrieved.*before.*observed/i,
  );
  assert.throws(
    () => normalizeTemporalEvidenceProvenanceV15(contemporaneous('rules', {
      validFrom: '2026-02-01T00:00:00Z',
      validUntil: '2026-01-01T00:00:00Z',
    })),
    /validFrom.*after.*validUntil/i,
  );
  assert.throws(
    () => normalizeTemporalEvidenceProvenanceV15(contemporaneous('rules', {
      sourceUri: 'not a url',
    })),
    /sourceUri.*http/i,
  );
  assert.throws(
    () => normalizeTemporalEvidenceProvenanceV15(contemporaneous('rules', {
      sourceContentHash: 'not-a-sha',
    })),
    /sourceContentHash.*SHA-256/i,
  );
});
