import { writeFile } from 'node:fs/promises';
import { discoverAndCaptureScryfallDefaultCardsForwardV15 } from '../src/services/scryfall-bulk-carddata-source-v15.js';

const RAW_PATH = process.env.SCRYFALL_RETENTION_RAW_PATH?.trim() || 'scryfall-default-cards-retained.jsonl.gz';
const EVIDENCE_PATH = process.env.SCRYFALL_RETENTION_EVIDENCE_PATH?.trim() || 'scryfall-retention-candidate-v15.json';

async function main(): Promise<void> {
  const result = await discoverAndCaptureScryfallDefaultCardsForwardV15({
    timeoutMs: 30_000,
  });
  const acquisition = result.capture.acquisition;

  await writeFile(RAW_PATH, acquisition.bytes);
  const evidence = {
    schemaVersion: 'scryfall-retention-candidate-v15.1',
    discovery: result.discovery,
    capture: {
      schemaVersion: result.capture.schemaVersion,
      sourcePolicy: {
        sourceId: result.capture.sourcePolicy.sourceId,
        nativeFormat: result.capture.sourcePolicy.nativeFormat,
        historicalArchiveVerified: result.capture.sourcePolicy.historicalArchiveVerified,
        forwardCapture: result.capture.sourcePolicy.forwardCapture,
      },
      acquisition: {
        format: acquisition.format,
        byteLength: acquisition.byteLength,
        decodedByteLength: acquisition.decodedByteLength,
        provenance: acquisition.provenance,
        integrity: acquisition.integrity,
      },
    },
  } as const;
  await writeFile(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    schemaVersion: evidence.schemaVersion,
    sourceId: result.discovery.sourceId,
    observedAt: acquisition.provenance.observedAt,
    providerUpdatedAt: result.discovery.providerUpdatedAt,
    compressedBytes: acquisition.byteLength,
    sourceContentHash: acquisition.integrity.actualHash,
    rawPath: RAW_PATH,
    evidencePath: EVIDENCE_PATH,
    cardRecordsDecodedForValidation: acquisition.cards.length,
    historicalArchiveVerified: result.capture.sourcePolicy.historicalArchiveVerified,
  }, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error(`[Scryfall retention capture] ${message}`);
  process.exitCode = 1;
});
