export const HISTORICAL_CARD_DATA_SOURCE_INVENTORY_SCHEMA_V15 = 'historical-carddata-source-inventory-v15.1' as const;
export const HISTORICAL_CARD_DATA_SOURCE_INVENTORY_VERIFIED_AT_V15 = '2026-08-20' as const;

export type HistoricalCardDataAccessModeV15 =
  | 'official-current-bulk'
  | 'official-current-daily-build';

export type HistoricalCardDataNativeFormatV15 =
  | 'scryfall-jsonl-gzip'
  | 'mtgjson-v5-json';

export type HistoricalCardDataRetrospectiveStatusV15 =
  | 'blocked-no-verified-replayable-archive';

export type HistoricalCardDataForwardCaptureStatusV15 =
  | 'enabled-contemporaneous-capture'
  | 'candidate-adapter-required';

export interface HistoricalCardDataSourceInventoryEntryV15 {
  sourceId: string;
  name: string;
  sourceUrl: string;
  documentationUrl: string;
  manifestUrl: string;
  verifiedAt: typeof HISTORICAL_CARD_DATA_SOURCE_INVENTORY_VERIFIED_AT_V15;
  accessMode: HistoricalCardDataAccessModeV15;
  nativeFormat: HistoricalCardDataNativeFormatV15;
  retrospectiveRichFeatures: HistoricalCardDataRetrospectiveStatusV15;
  forwardCapture: HistoricalCardDataForwardCaptureStatusV15;
  providerIntegritySurface: 'none-relied-upon-capture-sha256-required' | 'provider-sha256-plus-capture-sha256';
  historicalArchiveVerified: boolean;
  temporalNotes: string;
  usageNotes: string;
}

/**
 * Source-policy inventory for predictor/card-data provenance.
 *
 * A source being authoritative or current does not make today's bytes safe for
 * a historical prediction cutoff. No source in this inventory currently has a
 * verified replayable historical archive, so retrospective rich-feature use is
 * blocked across the board. Forward capture is a separate capability: current
 * source bytes can be observed, hashed and retained now for future cutoffs
 * without pretending they existed earlier.
 */
export const HISTORICAL_CARD_DATA_SOURCE_INVENTORY_V15: readonly HistoricalCardDataSourceInventoryEntryV15[] = [
  {
    sourceId: 'scryfall-default-cards',
    name: 'Scryfall Default Cards bulk data',
    sourceUrl: 'https://scryfall.com/',
    documentationUrl: 'https://scryfall.com/docs/api/bulk-data',
    manifestUrl: 'https://api.scryfall.com/bulk-data',
    verifiedAt: HISTORICAL_CARD_DATA_SOURCE_INVENTORY_VERIFIED_AT_V15,
    accessMode: 'official-current-bulk',
    nativeFormat: 'scryfall-jsonl-gzip',
    retrospectiveRichFeatures: 'blocked-no-verified-replayable-archive',
    forwardCapture: 'enabled-contemporaneous-capture',
    providerIntegritySurface: 'none-relied-upon-capture-sha256-required',
    historicalArchiveVerified: false,
    temporalNotes: 'Current bulk data may be captured prospectively. No official replayable daily historical archive has been verified for arbitrary past predictor cutoffs.',
    usageNotes: 'The live 2026-08-20 provider audit exposes default_cards through jsonl_download_uri as a gzip-compressed JSON Lines file. Preserve the exact compressed source bytes, observation time, source URI and locally computed SHA-256; provider updated_at is current metadata only, not historical proof.',
  },
  {
    sourceId: 'mtgjson-all-printings',
    name: 'MTGJSON AllPrintings current build',
    sourceUrl: 'https://mtgjson.com/',
    documentationUrl: 'https://mtgjson.com/data-models/meta/',
    manifestUrl: 'https://mtgjson.com/api/v5/Meta.json',
    verifiedAt: HISTORICAL_CARD_DATA_SOURCE_INVENTORY_VERIFIED_AT_V15,
    accessMode: 'official-current-daily-build',
    nativeFormat: 'mtgjson-v5-json',
    retrospectiveRichFeatures: 'blocked-no-verified-replayable-archive',
    forwardCapture: 'candidate-adapter-required',
    providerIntegritySurface: 'provider-sha256-plus-capture-sha256',
    historicalArchiveVerified: false,
    temporalNotes: 'The current daily build exposes build metadata, but the documented current file service is not treated as a replayable daily historical archive.',
    usageNotes: 'MTGJSON publishes file-validation hashes, but a native MTGJSON-to-feature adapter would still be required. Provider hashes do not authorize backdating current contents.',
  },
] as const;

const SOURCE_BY_ID = new Map(HISTORICAL_CARD_DATA_SOURCE_INVENTORY_V15.map((source) => [source.sourceId, source] as const));

function cloneSource(source: HistoricalCardDataSourceInventoryEntryV15): HistoricalCardDataSourceInventoryEntryV15 {
  return { ...source };
}

export function historicalCardDataSourceInventoryV15(): HistoricalCardDataSourceInventoryEntryV15[] {
  return HISTORICAL_CARD_DATA_SOURCE_INVENTORY_V15.map(cloneSource);
}

export function historicalCardDataSourceByIdV15(sourceId: string): HistoricalCardDataSourceInventoryEntryV15 | null {
  if (typeof sourceId !== 'string' || !sourceId.trim()) return null;
  const source = SOURCE_BY_ID.get(sourceId.trim().toLocaleLowerCase());
  return source ? cloneSource(source) : null;
}

export function sourceCanBackfillHistoricalRichFeaturesV15(sourceId: string): boolean {
  const source = historicalCardDataSourceByIdV15(sourceId);
  return source?.historicalArchiveVerified === true;
}

export function sourceCanCaptureForwardRichFeaturesV15(sourceId: string): boolean {
  const source = historicalCardDataSourceByIdV15(sourceId);
  return source?.forwardCapture === 'enabled-contemporaneous-capture';
}

export function assertSourceCannotBackfillWithoutVerifiedArchiveV15(sourceId: string): HistoricalCardDataSourceInventoryEntryV15 {
  const source = historicalCardDataSourceByIdV15(sourceId);
  if (!source) throw new Error(`Unknown historical card-data source: ${sourceId}.`);
  if (sourceCanBackfillHistoricalRichFeaturesV15(sourceId)) {
    throw new Error(`Historical source ${source.sourceId} unexpectedly reports a verified replayable archive; update the V0.15 source contract before using this guard.`);
  }
  return source;
}
