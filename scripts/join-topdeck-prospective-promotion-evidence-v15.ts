import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { replayRetainedScryfallCardDataSnapshotV15 } from '../src/services/retained-scryfall-carddata-replay-v15.js';
import type { RetainedScryfallCardDataSnapshotManifestV15 } from '../src/services/retained-scryfall-carddata-snapshot-v15.js';
import type { TopDeckProspectiveCompletedCaptureV15 } from '../src/services/topdeck-prospective-completed-capture-v15.js';
import type { TopDeckProspectivePreEventCaptureResultV15 } from '../src/services/topdeck-prospective-capture-v15.js';
import { joinTopDeckProspectivePromotionEvidenceV15 } from '../src/services/topdeck-prospective-promotion-join-v15.js';

const PRE_EVENT_PATH = process.env.TOPDECK_PRE_EVENT_PRIVATE_PATH?.trim() || 'pre-event/topdeck-prospective-private-evidence-v15.json';
const COMPLETED_PATH = process.env.TOPDECK_COMPLETED_PRIVATE_PATH?.trim() || 'completed-event/topdeck-prospective-private-evidence-v15.json';
const SCRYFALL_RAW_PATH = process.env.SCRYFALL_RETAINED_RAW_PATH?.trim() || 'scryfall-raw/scryfall-default-cards-retained.jsonl.gz';
const SCRYFALL_MANIFEST_PATH = process.env.SCRYFALL_RETAINED_MANIFEST_PATH?.trim() || 'scryfall-manifest/scryfall-retained-snapshot-manifest-v15.json';
const PRIVATE_JOIN_PATH = process.env.TOPDECK_PROMOTION_JOIN_PRIVATE_PATH?.trim() || 'topdeck-promotion-joined-private-v15.json';
const AUDIT_PATH = process.env.TOPDECK_PROMOTION_JOIN_AUDIT_PATH?.trim() || 'topdeck-promotion-join-audit-v15.json';

function required(name: string, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  return value.trim();
}

function record(name: string, value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object.`);
  return value as Record<string, unknown>;
}

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function eventFingerprint(providerEventId: string): string {
  return sha256(providerEventId);
}

async function jsonFile(path: string): Promise<unknown> {
  const text = await readFile(path, 'utf8');
  return JSON.parse(text) as unknown;
}

function privateTopDeckResult<T>(value: unknown, expectedPhase: string): T {
  const wrapper = record(`${expectedPhase} private evidence`, value);
  const schemaVersion = required(`${expectedPhase}.schemaVersion`, wrapper.schemaVersion);
  if (schemaVersion !== 'topdeck-prospective-private-evidence-v15.1'
    && schemaVersion !== 'topdeck-prospective-private-evidence-v15.2') {
    throw new Error(`Unsupported ${expectedPhase} private evidence schema ${schemaVersion}.`);
  }
  if (wrapper.phase !== expectedPhase) throw new Error(`Expected TopDeck private evidence phase ${expectedPhase}.`);
  return wrapper.result as T;
}

function rejectionCounts(rejected: Array<{ code: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const rejection of rejected) counts[rejection.code] = (counts[rejection.code] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

async function main(): Promise<void> {
  const preEventArtifactReference = required('TOPDECK_PRE_EVENT_ARTIFACT_REFERENCE', process.env.TOPDECK_PRE_EVENT_ARTIFACT_REFERENCE);
  const completedArtifactReference = required('TOPDECK_COMPLETED_ARTIFACT_REFERENCE', process.env.TOPDECK_COMPLETED_ARTIFACT_REFERENCE);
  const scryfallRawArtifactReference = required('SCRYFALL_RAW_ARTIFACT_REFERENCE', process.env.SCRYFALL_RAW_ARTIFACT_REFERENCE);
  const scryfallManifestArtifactReference = required('SCRYFALL_MANIFEST_ARTIFACT_REFERENCE', process.env.SCRYFALL_MANIFEST_ARTIFACT_REFERENCE);

  const preEvent = privateTopDeckResult<Extract<TopDeckProspectivePreEventCaptureResultV15, { status: 'captured' }>>(
    await jsonFile(PRE_EVENT_PATH),
    'pre-event',
  );
  if (preEvent.status !== 'captured') throw new Error('Pre-event private evidence is not a captured result.');

  const completed = privateTopDeckResult<TopDeckProspectiveCompletedCaptureV15>(
    await jsonFile(COMPLETED_PATH),
    'completed-event',
  );
  if (completed.schemaVersion !== 'topdeck-prospective-completed-capture-v15.1') {
    throw new Error('Unsupported completed-event capture schema.');
  }

  const manifest = await jsonFile(SCRYFALL_MANIFEST_PATH) as RetainedScryfallCardDataSnapshotManifestV15;
  if (manifest.storage?.artifactReference !== scryfallRawArtifactReference) {
    throw new Error('Pulled Scryfall raw artifact reference does not match the retained manifest storage reference.');
  }
  const rawBytes = new Uint8Array(await readFile(SCRYFALL_RAW_PATH));
  const retainedCardData = await replayRetainedScryfallCardDataSnapshotV15(manifest, rawBytes);
  const joined = joinTopDeckProspectivePromotionEvidenceV15({ preEvent, completed, retainedCardData });

  const privateEvidence = {
    schemaVersion: 'topdeck-prospective-promotion-joined-private-v15.1',
    evidenceArtifacts: {
      preEvent: preEventArtifactReference,
      completedEvent: completedArtifactReference,
      scryfallRaw: scryfallRawArtifactReference,
      scryfallManifest: scryfallManifestArtifactReference,
    },
    join: joined,
  } as const;
  const privateText = `${JSON.stringify(privateEvidence, null, 2)}\n`;
  await writeFile(PRIVATE_JOIN_PATH, privateText, 'utf8');

  const audit = {
    schemaVersion: 'topdeck-prospective-promotion-join-audit-v15.1',
    status: joined.joinedRows.length > 0 ? 'promotion-grade-rows-joined' : 'no-promotion-grade-rows',
    providerEventFingerprint: eventFingerprint(joined.providerEventId),
    predictionCutoff: joined.predictionCutoff,
    eventEndedAt: joined.eventEndedAt,
    featureAvailableAt: joined.featureAvailableAt,
    finalCandidates: joined.finalCandidates,
    joinedRows: joined.joinedRows.length,
    rejectedRows: joined.rejectedRows.length,
    rejectionCounts: rejectionCounts(joined.rejectedRows),
    retainedCardDataManifestFingerprint: retainedCardData.manifestFingerprint,
    completedSourceContentHash: completed.sourceContentHash,
    privateEvidenceContentHash: sha256(privateText),
    privateEvidenceWritten: true,
    releaseAuthorization: {
      modelPromotionAuthorized: false,
      stableRuntimePromotionAuthorized: false,
      purpose: 'evidence-collection-only',
    },
    privacy: {
      tournamentIdPersistedInAudit: false,
      playerIdentifiersPersistedInAudit: false,
      decklistsPersistedInAudit: false,
      cardNamesPersistedInAudit: false,
      privateArtifactReferencesPersistedInAudit: false,
    },
  } as const;
  await writeFile(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(audit, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error(`[TopDeck prospective promotion join] ${message}`);
  process.exitCode = 1;
});