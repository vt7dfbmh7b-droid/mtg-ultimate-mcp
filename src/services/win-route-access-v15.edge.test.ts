import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDecklist } from './deck.js';
import {
  auditWinRouteAccessPortfolioV15,
  auditWinRouteAccessV15,
} from './win-route-access-v15.js';

const parsed = parseDecklist('// COMMANDER\n1 Commander\n// MAIN\n99 Filler');

test('provider absence can remain an empty route portfolio without fabricating route failure', () => {
  const result = auditWinRouteAccessPortfolioV15({ routes: [], parsed, resolvedCards: [] });
  assert.deepEqual(result, []);
});

test('a verified route with no explicit card components remains unknown rather than zero access', () => {
  const result = auditWinRouteAccessV15({
    route: { comboId: 'provider-card-data-absent', comboCardNames: [] },
    parsed,
    resolvedCards: [],
  });

  assert.equal(result.status, 'no-card-components');
  assert.equal(result.exactAccess, null);
  assert.equal(result.missingPieces.length, 0);
  assert.ok(result.guidance.includes('unknown rather than zero'));
});
