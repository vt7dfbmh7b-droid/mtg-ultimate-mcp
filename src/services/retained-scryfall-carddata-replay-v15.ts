import {
  captureScryfallDefaultCardsForwardV15,
  type ScryfallForwardCardDataCaptureV15,
} from './scryfall-forward-carddata-capture-v15.js';
import {
  assertRetainedScryfallCardDataBytesV15,
  assertRetainedScryfallCardDataSnapshotManifestV15,
  type RetainedScryfallCardDataSnapshotManifestV15,
} from './retained-scryfall-carddata-snapshot-v15.js';

export const RETAINED_SCRYFALL_CARD_DATA_REPLAY_SCHEMA_V15 = 'retained-scryfall-carddata-replay-v15.1' as const;

export interface RetainedScryfallCardDataReplayV15 {
  schemaVersion: typeof RETAINED_SCRYFALL_CARD_DATA_REPLAY_SCHEMA_V15;
  manifestFingerprint: string;
  capture: ScryfallForwardCardDataCaptureV15;
  replayVerified: true;
}

/**
 * Replays exact retained provider bytes through the same bounded gzip/JSONL/card
 * validator used for live forward capture. No network request is made and the
 * original contemporaneous observation time is preserved.
 */
export async function replayRetainedScryfallCardDataSnapshotV15(
  manifest: RetainedScryfallCardDataSnapshotManifestV15,
  bytes: Uint8Array,
): Promise<RetainedScryfallCardDataReplayV15> {
  assertRetainedScryfallCardDataSnapshotManifestV15(manifest);
  assertRetainedScryfallCardDataBytesV15(manifest, bytes);

  const capture = await captureScryfallDefaultCardsForwardV15(manifest.sourceUri, {
    expectedCompressedBytes: manifest.sourceCompressedBytes,
    now: manifest.observedAt,
    fetchImpl: async () => new Response(Uint8Array.from(bytes), {
      status: 200,
      headers: {
        'content-length': String(bytes.byteLength),
      },
    }),
  });

  if (capture.acquisition.integrity.actualHash !== manifest.sourceContentHash) {
    throw new Error('Retained replay source hash does not match the retained snapshot manifest.');
  }
  if (capture.acquisition.integrity.decodedContentHash !== manifest.decodedContentHash) {
    throw new Error('Retained replay decoded-content hash does not match the retained snapshot manifest.');
  }
  if (capture.acquisition.provenance.observedAt !== manifest.observedAt
    || capture.acquisition.provenance.retrievedAt !== manifest.retrievedAt) {
    throw new Error('Retained replay changed the contemporaneous capture timestamp.');
  }
  if (capture.acquisition.provenance.sourceUri !== manifest.sourceUri) {
    throw new Error('Retained replay changed the captured Scryfall source URI.');
  }

  return {
    schemaVersion: RETAINED_SCRYFALL_CARD_DATA_REPLAY_SCHEMA_V15,
    manifestFingerprint: manifest.manifestFingerprint,
    capture,
    replayVerified: true,
  };
}
