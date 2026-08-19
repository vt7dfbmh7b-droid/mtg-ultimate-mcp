import {
  SCRYFALL_CARD_ARRAY_FORMAT_V15,
  captureCurrentCardDataV15,
  type AcquiredHistoricalCardDataV15,
  type HistoricalCardDataAcquisitionOptionsV15,
} from './historical-carddata-acquisition-v15.js';
import {
  historicalCardDataSourceByIdV15,
  sourceCanCaptureForwardRichFeaturesV15,
  type HistoricalCardDataSourceInventoryEntryV15,
} from './historical-carddata-source-inventory-v15.js';
import type { HistoricalCardDataProvenanceV15 } from './historical-carddata-provenance-v15.js';

export const SCRYFALL_FORWARD_CARD_DATA_CAPTURE_SCHEMA_V15 = 'scryfall-forward-carddata-capture-v15.1' as const;
export const SCRYFALL_DEFAULT_CARDS_SOURCE_ID_V15 = 'scryfall-default-cards' as const;

type ContemporaneousProvenanceV15 = Extract<HistoricalCardDataProvenanceV15, { method: 'contemporaneous-capture' }>;

export interface ScryfallForwardCardDataCaptureV15 {
  schemaVersion: typeof SCRYFALL_FORWARD_CARD_DATA_CAPTURE_SCHEMA_V15;
  sourcePolicy: HistoricalCardDataSourceInventoryEntryV15;
  acquisition: AcquiredHistoricalCardDataV15<ContemporaneousProvenanceV15>;
  safeguards: readonly [
    'Only current Scryfall bulk bytes from an HTTPS *.scryfall.io static-file origin are accepted.',
    'The observation timestamp is assigned at capture time and cannot be supplied by the source descriptor.',
    'The exact received bytes are SHA-256 hashed locally before they can feed rich feature extraction.',
    'This forward capture does not make Scryfall a verified retrospective historical archive.'
  ];
}

function approvedScryfallStaticUri(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Scryfall forward capture requires an absolute HTTPS *.scryfall.io bulk download URI.');
  }
  const hostname = parsed.hostname.toLocaleLowerCase();
  if (parsed.protocol !== 'https:' || !hostname.endsWith('.scryfall.io')) {
    throw new Error('Scryfall forward capture requires an absolute HTTPS *.scryfall.io bulk download URI.');
  }
  return parsed.toString();
}

/**
 * Capture the current Scryfall default-card bulk file for future predictor use.
 *
 * Discovery of the current download URI remains a separate live-source concern.
 * This boundary accepts only the concrete static-file URI returned by an audited
 * caller, then applies the source inventory policy and the generic byte/hash/time
 * acquisition gate. It cannot turn today's bulk file into a historical snapshot.
 */
export async function captureScryfallDefaultCardsForwardV15(
  sourceUri: string,
  options: HistoricalCardDataAcquisitionOptionsV15 = {},
): Promise<ScryfallForwardCardDataCaptureV15> {
  const sourcePolicy = historicalCardDataSourceByIdV15(SCRYFALL_DEFAULT_CARDS_SOURCE_ID_V15);
  if (!sourcePolicy) throw new Error('Missing Scryfall default-cards source policy.');
  if (!sourceCanCaptureForwardRichFeaturesV15(sourcePolicy.sourceId)) {
    throw new Error('Scryfall default-cards source policy does not permit forward contemporaneous capture.');
  }
  if (sourcePolicy.nativeFormat !== 'scryfall-card-array') {
    throw new Error(`Scryfall default-cards source policy has unsupported native format ${sourcePolicy.nativeFormat}.`);
  }

  const acquisition = await captureCurrentCardDataV15({
    sourceId: sourcePolicy.sourceId,
    sourceUri: approvedScryfallStaticUri(sourceUri),
    format: SCRYFALL_CARD_ARRAY_FORMAT_V15,
  }, options);

  return {
    schemaVersion: SCRYFALL_FORWARD_CARD_DATA_CAPTURE_SCHEMA_V15,
    sourcePolicy,
    acquisition,
    safeguards: [
      'Only current Scryfall bulk bytes from an HTTPS *.scryfall.io static-file origin are accepted.',
      'The observation timestamp is assigned at capture time and cannot be supplied by the source descriptor.',
      'The exact received bytes are SHA-256 hashed locally before they can feed rich feature extraction.',
      'This forward capture does not make Scryfall a verified retrospective historical archive.',
    ],
  };
}
