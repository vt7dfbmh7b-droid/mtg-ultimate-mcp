import assert from 'node:assert/strict';
import test from 'node:test';
import { annotatePricingNzdV13, formatNzdV13, nzdToUsdV13, usdToNzdV13 } from './currency-v13.js';

test('USD and NZD conversion helpers round currency values', () => {
  assert.equal(usdToNzdV13(10, 1.7), 17);
  assert.equal(nzdToUsdV13(17, 1.7), 10);
  assert.match(formatNzdV13(17), /17\.00/);
});

test('NZD annotation makes converted values primary while preserving USD reference values', () => {
  const converted = annotatePricingNzdV13({
    estimatedUpgradeSpendUsd: 10,
    maxTotalUsd: 20,
    swaps: [{ recommendedPrinting: { priceUsd: 2.5 } }],
  }, 1.6) as Record<string, unknown>;

  assert.equal(converted.estimatedUpgradeSpendNzd, 16);
  assert.equal(converted.estimatedUpgradeSpendUsdReference, 10);
  assert.equal(converted.maxTotalNzd, 32);
  const swaps = converted.swaps as Array<Record<string, unknown>>;
  const printing = swaps[0]?.recommendedPrinting as Record<string, unknown>;
  assert.equal(printing.priceNzd, 4);
  assert.equal(printing.priceUsdReference, 2.5);
});
