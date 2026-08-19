import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import {
  captureTopDeckEventEndEvidenceV15,
  captureTopDeckPreEventDecklistsV15,
} from '../src/services/topdeck-prospective-capture-v15.js';

const PRIVATE_PATH = process.env.TOPDECK_PROSPECTIVE_PRIVATE_PATH?.trim() || 'topdeck-prospective-private-evidence-v15.json';
const AUDIT_PATH = process.env.TOPDECK_PROSPECTIVE_AUDIT_PATH?.trim() || 'topdeck-prospective-audit-v15.json';

function required(name: string, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  return value.trim();
}

function eventFingerprint(tournamentId: string): string {
  return createHash('sha256').update(tournamentId, 'utf8').digest('hex');
}

async function main(): Promise<void> {
  const tournamentId = required('TOPDECK_TOURNAMENT_ID', process.env.TOPDECK_TOURNAMENT_ID);
  const phase = required('TOPDECK_CAPTURE_PHASE', process.env.TOPDECK_CAPTURE_PHASE);
  const providerEventFingerprint = eventFingerprint(tournamentId);

  if (phase === 'pre-event') {
    const result = await captureTopDeckPreEventDecklistsV15({ tournamentId });
    if (result.status === 'unavailable') {
      const audit = {
        schemaVersion: 'topdeck-prospective-audit-v15.1',
        phase,
        status: 'unavailable',
        providerEventFingerprint,
        eventStartAt: result.eventStartAt,
        capturedAt: result.capturedAt,
        reason: result.reason,
        acceptedDecks: 0,
        rejectedStandingRows: result.rejectedStandingRows,
        privateEvidenceWritten: false,
        privacy: {
          tournamentIdPersistedInAudit: false,
          playerIdentifiersPersistedInAudit: false,
          decklistsPersistedInAudit: false,
          cardNamesPersistedInAudit: false,
          apiKeyPersisted: false,
        },
      } as const;
      await writeFile(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
      console.log(JSON.stringify(audit, null, 2));
      return;
    }

    const privateEvidence = {
      schemaVersion: 'topdeck-prospective-private-evidence-v15.1',
      phase,
      result,
    } as const;
    await writeFile(PRIVATE_PATH, `${JSON.stringify(privateEvidence, null, 2)}\n`, 'utf8');
    const audit = {
      schemaVersion: 'topdeck-prospective-audit-v15.1',
      phase,
      status: 'captured',
      providerEventFingerprint,
      eventStartAt: result.eventStartAt,
      capturedAt: result.capturedAt,
      acceptedDecks: result.decks.length,
      rejectedStandingRows: result.rejectedStandingRows,
      uniqueDeckFingerprints: new Set(result.decks.map((deck) => deck.deckFingerprint)).size,
      standingsSourceContentHash: result.standingsSourceContentHash,
      infoSourceContentHash: result.infoSourceContentHash,
      privateEvidenceWritten: true,
      privacy: {
        tournamentIdPersistedInAudit: false,
        playerIdentifiersPersistedInAudit: false,
        decklistsPersistedInAudit: false,
        cardNamesPersistedInAudit: false,
        apiKeyPersisted: false,
      },
    } as const;
    await writeFile(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(audit, null, 2));
    return;
  }

  if (phase === 'event-end') {
    const result = await captureTopDeckEventEndEvidenceV15({ tournamentId });
    const privateEvidence = {
      schemaVersion: 'topdeck-prospective-private-evidence-v15.1',
      phase,
      result,
    } as const;
    await writeFile(PRIVATE_PATH, `${JSON.stringify(privateEvidence, null, 2)}\n`, 'utf8');
    const audit = {
      schemaVersion: 'topdeck-prospective-audit-v15.1',
      phase,
      status: 'captured',
      providerEventFingerprint,
      eventStartedAt: result.evidence.eventStartedAt,
      eventEndedAt: result.evidence.eventEndedAt,
      capturedAt: result.evidence.observedAt,
      eventEndSourceContentHash: result.evidence.sourceContentHash,
      privateEvidenceWritten: true,
      privacy: {
        tournamentIdPersistedInAudit: false,
        playerIdentifiersPersistedInAudit: false,
        decklistsPersistedInAudit: false,
        cardNamesPersistedInAudit: false,
        apiKeyPersisted: false,
      },
    } as const;
    await writeFile(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(audit, null, 2));
    return;
  }

  throw new Error('TOPDECK_CAPTURE_PHASE must be pre-event or event-end.');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error(`[TopDeck prospective evidence capture] ${message}`);
  process.exitCode = 1;
});
