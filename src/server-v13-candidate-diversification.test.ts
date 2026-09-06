import assert from 'node:assert/strict';
import test from 'node:test';
import { candidatePackagesPerRoundForProfileV13 } from './server-v13.js';

test('custom precon refinement preserves omitted candidate breadth for adaptive optimizer defaults', () => {
  assert.equal(candidatePackagesPerRoundForProfileV13(undefined, 'custom'), undefined);
});

test('explicit candidate breadth remains caller-controlled for custom refinement', () => {
  assert.equal(candidatePackagesPerRoundForProfileV13(3, 'custom'), 3);
  assert.equal(candidatePackagesPerRoundForProfileV13(6, 'custom'), 6);
});

test('named precon profiles retain their intentional fixed candidate breadth', () => {
  assert.equal(candidatePackagesPerRoundForProfileV13(undefined, 'light'), 2);
  assert.equal(candidatePackagesPerRoundForProfileV13(undefined, 'balanced'), 3);
  assert.equal(candidatePackagesPerRoundForProfileV13(undefined, 'strong'), 4);
  assert.equal(candidatePackagesPerRoundForProfileV13(undefined, 'optimized'), 5);
});
