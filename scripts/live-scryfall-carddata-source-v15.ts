import { writeFile } from 'node:fs/promises';
import {
  ScryfallBulkDiscoveryErrorV15,
  discoverScryfallDefaultCardsV15,
} from '../src/services/scryfall-bulk-carddata-source-v15.js';
import {
  historicalCardDataSourceByIdV15,
  sourceCanBackfillHistoricalRichFeaturesV15,
  sourceCanCaptureForwardRichFeaturesV15,
} from '../src/services/historical-carddata-source-inventory-v15.js';

const RESULT_PATH = 'scryfall-carddata-source-live-result.json';
const FAILURE_PATH = 'scryfall-carddata-source-live-failure.txt';

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function ageMinutes(earlier: string, later: string): number {
  return Math.round(((Date.parse(later) - Date.parse(earlier)) / 60_000) * 100) / 100;
}

async function main(): Promise<void> {
  const source = historicalCardDataSourceByIdV15('scryfall-default-cards');
  requireCondition(source, 'Scryfall default-cards must exist in the historical card-data source inventory.');
  requireCondition(source.historicalArchiveVerified === false, 'Scryfall must not be marked as a verified historical archive.');
  requireCondition(sourceCanBackfillHistoricalRichFeaturesV15(source.sourceId) === false, 'Current Scryfall bulk data must not be allowed to backfill historical rich features.');
  requireCondition(sourceCanCaptureForwardRichFeaturesV15(source.sourceId), 'Scryfall forward contemporaneous capture must remain enabled.');

  const discovery = await discoverScryfallDefaultCardsV15({ timeoutMs: 30_000 });
  const providerAgeMinutes = ageMinutes(discovery.providerUpdatedAt, discovery.discoveredAt);
  requireCondition(
    providerAgeMinutes >= -10,
    `Scryfall default_cards updated_at is unexpectedly more than 10 minutes after discovery time (${providerAgeMinutes} minutes).`,
  );

  const staticHost = new URL(discovery.downloadUri).hostname;
  const audit = {
    schemaVersion: 'scryfall-carddata-source-live-control-v15.1',
    checkedAt: discovery.discoveredAt,
    provider: 'scryfall',
    sourceId: discovery.sourceId,
    manifestUri: discovery.manifestUri,
    providerObjectIdPresent: discovery.providerObjectId !== null,
    providerUpdatedAt: discovery.providerUpdatedAt,
    providerAgeMinutes,
    providerSizeBytes: discovery.providerSizeBytes,
    providerContentType: discovery.providerContentType,
    providerContentEncoding: discovery.providerContentEncoding,
    staticDownloadHost: staticHost,
    requestPolicy: discovery.requestPolicy,
    temporalPolicy: discovery.temporalPolicy,
    sourcePolicy: {
      accessMode: source.accessMode,
      nativeFormat: source.nativeFormat,
      retrospectiveRichFeatures: source.retrospectiveRichFeatures,
      forwardCapture: source.forwardCapture,
      historicalArchiveVerified: source.historicalArchiveVerified,
      retrospectiveBackfillAllowed: sourceCanBackfillHistoricalRichFeaturesV15(source.sourceId),
      forwardCaptureAllowed: sourceCanCaptureForwardRichFeaturesV15(source.sourceId),
    },
    privacy: {
      bulkFileDownloaded: false,
      cardDataPersisted: false,
      cardNamesPersisted: false,
      downloadPathPersisted: false,
      manifestMetadataOnly: true,
    },
  } as const;

  await writeFile(RESULT_PATH, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(audit, null, 2));

  requireCondition(staticHost.endsWith('.scryfall.io'), 'Scryfall default_cards static download host drifted outside *.scryfall.io.');
  requireCondition(discovery.temporalPolicy === 'current-provider-metadata-only-not-historical-proof', 'Scryfall discovery temporal policy unexpectedly changed.');
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const classification = error instanceof ScryfallBulkDiscoveryErrorV15
    ? error.code === 'source-timeout' || error.code === 'source-request-failed'
      ? 'provider-unavailable'
      : 'provider-contract-drift'
    : 'source-policy-or-control-failure';
  await writeFile(
    FAILURE_PATH,
    `${JSON.stringify({ schemaVersion: 'scryfall-carddata-source-live-failure-v15.1', classification, message }, null, 2)}\n`,
    'utf8',
  ).catch(() => undefined);
  console.error(`[Scryfall card-data source live] ${classification}: ${message}`);
  process.exitCode = 1;
});
