import assert from 'node:assert/strict';
import test from 'node:test';
import { buildResearchLinksV09, evidenceSourcesForV09, evidenceWeightingGuideV09, fetchEdhTop16CommanderEntriesV09 } from './evidence-sources-v09.js';

test('competitive evidence includes structured, public-reference and curated sources', () => {
  const sources = evidenceSourcesForV09(['competitive']);
  const ids = new Set(sources.map((source) => source.id));
  assert.equal(ids.has('topdeck'), true);
  assert.equal(ids.has('edhtop16'), true);
  assert.equal(ids.has('cedh-ddb'), true);
  assert.equal(sources.find((source) => source.id === 'edhtop16')?.access, 'public-reference');
});

test('EDHTop16 compatibility helper returns an explicit reference packet instead of fabricated structured rows', async () => {
  const result = await fetchEdhTop16CommanderEntriesV09({ commanders: ['Najeela, the Blade-Blossom'] });
  assert.equal(result.sourceMode, 'public-reference');
  assert.equal(result.structuredDataAvailable, false);
  assert.deepEqual(result.entries, []);
});

test('NZ pricing evidence includes TCGfind and exact printing identity support', () => {
  const sources = evidenceSourcesForV09(['nz-availability', 'pricing']);
  assert.equal(sources.some((source) => source.id === 'tcgfind-nz'), true);
  assert.equal(sources.some((source) => source.id === 'scryfall'), true);
});

test('research links preserve paired commanders and card lookup intent', () => {
  const links = buildResearchLinksV09(['Kraum, Ludevic\'s Opus', 'Tymna the Weaver'], ['Cyclonic Rift']);
  const edhTop16 = links.find((link) => link.source === 'EDHTop16');
  const tcgFind = links.find((link) => link.source === 'TCGfind NZ');
  assert.match(String(edhTop16?.query), /Kraum/);
  assert.match(String(edhTop16?.query), /Tymna/);
  assert.equal(tcgFind?.query, 'Cyclonic Rift');
});

test('weighting guide does not equate popularity with optimality', () => {
  const guide = evidenceWeightingGuideV09();
  assert.match(String(guide.principle), /Never convert community popularity/i);
});
