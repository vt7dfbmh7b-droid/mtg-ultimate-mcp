import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HISTORICAL_CARD_DATA_SOURCE_INVENTORY_V15,
  assertSourceCannotBackfillWithoutVerifiedArchiveV15,
  historicalCardDataSourceByIdV15,
  historicalCardDataSourceInventoryV15,
  sourceCanBackfillHistoricalRichFeaturesV15,
  sourceCanCaptureForwardRichFeaturesV15,
} from './historical-carddata-source-inventory-v15.js';

test('current card-data sources are explicitly blocked from retrospective rich-feature backfill', () => {
  assert.equal(HISTORICAL_CARD_DATA_SOURCE_INVENTORY_V15.length, 2);
  for (const source of HISTORICAL_CARD_DATA_SOURCE_INVENTORY_V15) {
    assert.equal(source.historicalArchiveVerified, false);
    assert.equal(source.retrospectiveRichFeatures, 'blocked-no-verified-replayable-archive');
    assert.equal(sourceCanBackfillHistoricalRichFeaturesV15(source.sourceId), false);
  }
});

test('Scryfall current bulk data is forward-capture enabled without becoming a historical archive', () => {
  const source = historicalCardDataSourceByIdV15('scryfall-default-cards');
  if (!source) throw new Error('Expected Scryfall source inventory entry.');
  assert.equal(source.nativeFormat, 'scryfall-card-array');
  assert.equal(source.forwardCapture, 'enabled-contemporaneous-capture');
  assert.equal(sourceCanCaptureForwardRichFeaturesV15(source.sourceId), true);
  assert.equal(sourceCanBackfillHistoricalRichFeaturesV15(source.sourceId), false);
  assert.deepEqual(assertSourceCannotBackfillWithoutVerifiedArchiveV15(source.sourceId), source);
});

test('MTGJSON remains a forward adapter candidate and cannot be used as retrospective proof', () => {
  const source = historicalCardDataSourceByIdV15('mtgjson-all-printings');
  if (!source) throw new Error('Expected MTGJSON source inventory entry.');
  assert.equal(source.nativeFormat, 'mtgjson-v5-json');
  assert.equal(source.forwardCapture, 'candidate-adapter-required');
  assert.equal(source.providerIntegritySurface, 'provider-sha256-plus-capture-sha256');
  assert.equal(sourceCanCaptureForwardRichFeaturesV15(source.sourceId), false);
  assert.equal(sourceCanBackfillHistoricalRichFeaturesV15(source.sourceId), false);
});

test('inventory reads are deterministic, case-normalized, and returned as copies', () => {
  const first = historicalCardDataSourceInventoryV15();
  const second = historicalCardDataSourceInventoryV15();
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.equal(historicalCardDataSourceByIdV15(' SCRYFALL-DEFAULT-CARDS ')?.sourceId, 'scryfall-default-cards');
  assert.equal(historicalCardDataSourceByIdV15('unknown'), null);
  assert.throws(() => assertSourceCannotBackfillWithoutVerifiedArchiveV15('unknown'), /Unknown historical card-data source/i);
});
