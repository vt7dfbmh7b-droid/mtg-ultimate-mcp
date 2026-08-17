import { createHash } from 'node:crypto';

export const MAX_OUTCOME_LINKAGE_RECORDS_V15 = 10_000;

export interface OutcomeLinkEvidenceV15 {
  sourceId: string;
  sourceRecordId: string;
  eventName: string;
  outcomeOccurredAt: string;
  fieldSize: number;
  standing: number;
  commanderNames: string[];
  deckFingerprint?: string | undefined;
  entrantIdentityKey?: string | undefined;
  explicitEventIdentityKey?: string | undefined;
}

export interface OutcomeLinkAssignmentV15 {
  sourceId: string;
  sourceRecordId: string;
  canonicalOutcomeId: string;
  independenceKey: string;
  leakageKey: string;
  linkageStatus: 'unique' | 'linked';
  proof: 'source-unique' | 'exact-deck-fingerprint' | 'explicit-entrant-identity';
}

export interface OutcomeLinkQuarantineV15 {
  eventGroupKey: string;
  standing: number;
  status: 'ambiguous' | 'conflict';
  reason: string;
  records: Array<{ sourceId: string; sourceRecordId: string }>;
}

export interface ConservativeOutcomeLinkageV15 {
  assignments: OutcomeLinkAssignmentV15[];
  quarantined: OutcomeLinkQuarantineV15[];
  eventGroupCount: number;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function required(name: string, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  return value.trim();
}

function timestamp(name: string, value: unknown): { iso: string; date: string } {
  const text = required(name, value);
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) throw new Error(`${name} must be a valid timestamp.`);
  const iso = new Date(ms).toISOString();
  return { iso, date: iso.slice(0, 10) };
}

function commanderKey(names: string[]): string {
  if (!Array.isArray(names) || names.length < 1 || names.length > 2 || names.some((name) => typeof name !== 'string' || !name.trim())) {
    throw new Error('commanderNames must contain one or two non-empty commander names.');
  }
  return names.map(normalize).sort().join('|');
}

function validateEvidence(record: OutcomeLinkEvidenceV15): void {
  if (!record || typeof record !== 'object') throw new Error('Each outcome linkage record must be an object.');
  required('sourceId', record.sourceId);
  required('sourceRecordId', record.sourceRecordId);
  required('eventName', record.eventName);
  timestamp('outcomeOccurredAt', record.outcomeOccurredAt);
  if (!Number.isInteger(record.fieldSize) || record.fieldSize < 2) throw new Error('fieldSize must be an integer of at least 2.');
  if (!Number.isInteger(record.standing) || record.standing < 1 || record.standing > record.fieldSize) {
    throw new Error('standing must be a positive integer no greater than fieldSize.');
  }
  commanderKey(record.commanderNames);
  if (record.deckFingerprint !== undefined && !/^[a-f0-9]{64}$/i.test(record.deckFingerprint.trim())) {
    throw new Error('deckFingerprint must be a SHA-256 hex digest when supplied.');
  }
  if (record.entrantIdentityKey !== undefined) required('entrantIdentityKey', record.entrantIdentityKey);
  if (record.explicitEventIdentityKey !== undefined) required('explicitEventIdentityKey', record.explicitEventIdentityKey);
}

function eventSignature(record: OutcomeLinkEvidenceV15): string {
  if (record.explicitEventIdentityKey !== undefined) {
    return `explicit|${normalize(record.explicitEventIdentityKey)}`;
  }
  const occurred = timestamp('outcomeOccurredAt', record.outcomeOccurredAt);
  return `fallback|${normalize(record.eventName)}|${occurred.date}|${record.fieldSize}`;
}

function eventGroupKey(record: OutcomeLinkEvidenceV15): string {
  return `event:${sha256(eventSignature(record))}`;
}

function recordRef(record: OutcomeLinkEvidenceV15): string {
  return `${normalize(record.sourceId)}|${normalize(record.sourceRecordId)}`;
}

function recordCompare(a: OutcomeLinkEvidenceV15, b: OutcomeLinkEvidenceV15): number {
  const source = normalize(a.sourceId).localeCompare(normalize(b.sourceId));
  if (source !== 0) return source;
  return normalize(a.sourceRecordId).localeCompare(normalize(b.sourceRecordId));
}

function quarantine(
  eventKey: string,
  standing: number,
  status: OutcomeLinkQuarantineV15['status'],
  reason: string,
  records: OutcomeLinkEvidenceV15[],
): OutcomeLinkQuarantineV15 {
  return {
    eventGroupKey: eventKey,
    standing,
    status,
    reason,
    records: [...records].sort(recordCompare).map((record) => ({
      sourceId: record.sourceId,
      sourceRecordId: record.sourceRecordId,
    })),
  };
}

function uniqueAssignment(eventKey: string, record: OutcomeLinkEvidenceV15): OutcomeLinkAssignmentV15 {
  const commander = commanderKey(record.commanderNames);
  return {
    sourceId: record.sourceId,
    sourceRecordId: record.sourceRecordId,
    canonicalOutcomeId: `outcome:${sha256(`${eventKey}|${record.standing}|${commander}|${recordRef(record)}`)}`,
    independenceKey: eventKey,
    leakageKey: eventKey,
    linkageStatus: 'unique',
    proof: 'source-unique',
  };
}

function commonNormalizedValues(
  records: OutcomeLinkEvidenceV15[],
  getter: (record: OutcomeLinkEvidenceV15) => string | undefined,
): { present: number; values: string[] } {
  const values = records.flatMap((record) => {
    const value = getter(record);
    return value === undefined ? [] : [normalize(value)];
  });
  return { present: values.length, values: [...new Set(values)].sort() };
}

function linkedAssignments(
  eventKey: string,
  records: OutcomeLinkEvidenceV15[],
  proof: 'exact-deck-fingerprint' | 'explicit-entrant-identity',
  proofValue: string,
): OutcomeLinkAssignmentV15[] {
  const first = records[0];
  if (!first) return [];
  const commander = commanderKey(first.commanderNames);
  const canonicalOutcomeId = `outcome:${sha256(`${eventKey}|${first.standing}|${commander}|${proof}|${proofValue}`)}`;
  return [...records].sort(recordCompare).map((record) => ({
    sourceId: record.sourceId,
    sourceRecordId: record.sourceRecordId,
    canonicalOutcomeId,
    independenceKey: eventKey,
    leakageKey: eventKey,
    linkageStatus: 'linked' as const,
    proof,
  }));
}

function resolveStandingGroup(
  eventKey: string,
  records: OutcomeLinkEvidenceV15[],
): { assignments: OutcomeLinkAssignmentV15[]; quarantine: OutcomeLinkQuarantineV15 | null } {
  const first = records[0];
  if (!first) return { assignments: [], quarantine: null };
  if (records.length === 1) return { assignments: [uniqueAssignment(eventKey, first)], quarantine: null };

  const sources = records.map((record) => normalize(record.sourceId));
  if (new Set(sources).size !== sources.length) {
    return {
      assignments: [],
      quarantine: quarantine(
        eventKey,
        first.standing,
        'conflict',
        'Multiple records from the same source occupy the same event standing; same-source duplicates are not cross-source corroboration.',
        records,
      ),
    };
  }

  const commanders = [...new Set(records.map((record) => commanderKey(record.commanderNames)))];
  if (commanders.length !== 1) {
    return {
      assignments: [],
      quarantine: quarantine(
        eventKey,
        first.standing,
        'conflict',
        'Cross-source records disagree on commander identity for the same event standing.',
        records,
      ),
    };
  }

  const fingerprints = commonNormalizedValues(records, (record) => record.deckFingerprint);
  if (fingerprints.values.length > 1) {
    return {
      assignments: [],
      quarantine: quarantine(
        eventKey,
        first.standing,
        'conflict',
        'Cross-source records disagree on exact deck fingerprint for the same event standing.',
        records,
      ),
    };
  }

  const entrants = commonNormalizedValues(records, (record) => record.entrantIdentityKey);
  if (entrants.values.length > 1) {
    return {
      assignments: [],
      quarantine: quarantine(
        eventKey,
        first.standing,
        'conflict',
        'Cross-source records disagree on explicit entrant identity for the same event standing.',
        records,
      ),
    };
  }

  if (fingerprints.present === records.length && fingerprints.values.length === 1) {
    const proofValue = fingerprints.values[0];
    if (!proofValue) throw new Error('Exact deck-fingerprint linkage proof unexpectedly disappeared.');
    return {
      assignments: linkedAssignments(eventKey, records, 'exact-deck-fingerprint', proofValue),
      quarantine: null,
    };
  }
  if (entrants.present === records.length && entrants.values.length === 1) {
    const proofValue = entrants.values[0];
    if (!proofValue) throw new Error('Entrant-identity linkage proof unexpectedly disappeared.');
    return {
      assignments: linkedAssignments(eventKey, records, 'explicit-entrant-identity', proofValue),
      quarantine: null,
    };
  }

  return {
    assignments: [],
    quarantine: quarantine(
      eventKey,
      first.standing,
      'ambiguous',
      'Cross-source records share event, standing, and commander evidence but lack one strong proof present on every mirror (exact deck fingerprint or explicit entrant identity).',
      records,
    ),
  };
}

/**
 * Conservatively links source records that appear to describe the same event
 * entrant outcome. False negatives are preferred over false-positive merging.
 *
 * Event grouping is exact: either an explicit caller-provided event identity is
 * present, or normalized event name + UTC event date + exact field size must
 * match. Within one event standing, mirrors are linked only when every source
 * agrees on commander identity and shares either the same exact 100-card deck
 * fingerprint or the same explicit cross-source entrant identity key.
 */
export function buildConservativeOutcomeLinkageV15(
  records: OutcomeLinkEvidenceV15[],
): ConservativeOutcomeLinkageV15 {
  if (!Array.isArray(records)) throw new Error('records must be an array.');
  if (records.length > MAX_OUTCOME_LINKAGE_RECORDS_V15) {
    throw new Error(`At most ${MAX_OUTCOME_LINKAGE_RECORDS_V15} outcome records may be linked at once.`);
  }

  const seenRefs = new Set<string>();
  for (const record of records) {
    validateEvidence(record);
    const ref = recordRef(record);
    if (seenRefs.has(ref)) throw new Error(`Duplicate source record identity: ${record.sourceId}/${record.sourceRecordId}.`);
    seenRefs.add(ref);
  }

  const eventGroups = new Map<string, OutcomeLinkEvidenceV15[]>();
  for (const record of records) {
    const key = eventGroupKey(record);
    const group = eventGroups.get(key) ?? [];
    group.push(record);
    eventGroups.set(key, group);
  }

  const assignments: OutcomeLinkAssignmentV15[] = [];
  const quarantined: OutcomeLinkQuarantineV15[] = [];
  for (const eventKey of [...eventGroups.keys()].sort()) {
    const eventRecords = eventGroups.get(eventKey) ?? [];
    const standings = new Map<number, OutcomeLinkEvidenceV15[]>();
    for (const record of eventRecords) {
      const group = standings.get(record.standing) ?? [];
      group.push(record);
      standings.set(record.standing, group);
    }
    for (const standing of [...standings.keys()].sort((a, b) => a - b)) {
      const resolved = resolveStandingGroup(eventKey, standings.get(standing) ?? []);
      assignments.push(...resolved.assignments);
      if (resolved.quarantine) quarantined.push(resolved.quarantine);
    }
  }

  assignments.sort((a, b) =>
    a.independenceKey.localeCompare(b.independenceKey)
    || a.canonicalOutcomeId.localeCompare(b.canonicalOutcomeId)
    || normalize(a.sourceId).localeCompare(normalize(b.sourceId))
    || normalize(a.sourceRecordId).localeCompare(normalize(b.sourceRecordId)));
  quarantined.sort((a, b) =>
    a.eventGroupKey.localeCompare(b.eventGroupKey)
    || a.standing - b.standing
    || a.status.localeCompare(b.status));

  return {
    assignments,
    quarantined,
    eventGroupCount: eventGroups.size,
  };
}
