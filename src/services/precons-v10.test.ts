import assert from 'node:assert/strict';
import test from 'node:test';
import {
  edhrecPreconUrlV10,
  isCommanderPreconEntryV10,
  mtgJsonCardLineV10,
  mtgJsonDeckToDecklistV10,
  preconUpgradeProfilesV10,
  summarizePreconEntryV10,
  type MtgJsonDeckListEntryV10,
  type MtgJsonDeckV10,
} from './precons-v10.js';

const commanderEntry: MtgJsonDeckListEntryV10 = {
  code: 'C17',
  fileName: 'VampiricBloodlust_C17',
  name: 'Vampiric Bloodlust',
  releaseDate: '2017-08-25',
  type: 'Commander Deck',
};

test('catalog recognizes Commander precons and excludes ordinary intro decks', () => {
  assert.equal(isCommanderPreconEntryV10(commanderEntry), true);
  assert.equal(isCommanderPreconEntryV10({ ...commanderEntry, type: 'Intro Pack' }), false);
});

test('stock lines preserve set code collector number and finish', () => {
  assert.equal(
    mtgJsonCardLineV10({ count: 1, isFoil: true, name: 'Edgar Markov', number: '36', setCode: 'C17' }),
    '1 Edgar Markov (C17) 36 *F*',
  );
  assert.equal(
    mtgJsonCardLineV10({ count: 3, isFoil: false, name: 'Swamp', number: '311', setCode: 'C17' }),
    '3 Swamp (C17) 311 *N*',
  );
});

test('stock deck formatter keeps commander and main sections separate', () => {
  const deck: MtgJsonDeckV10 = {
    code: 'C17',
    name: 'Vampiric Bloodlust',
    releaseDate: '2017-08-25',
    type: 'Commander Deck',
    commander: [{ count: 1, isFoil: true, name: 'Edgar Markov', number: '36', setCode: 'C17' }],
    mainBoard: [{ count: 1, isFoil: false, name: 'Blood Artist', number: '99', setCode: 'C17' }],
    sideBoard: [],
  };
  const list = mtgJsonDeckToDecklistV10(deck);
  assert.match(list, /\/\/ COMMANDER\n1 Edgar Markov \(C17\) 36 \*F\*/);
  assert.match(list, /\/\/ MAIN\n1 Blood Artist \(C17\) 99 \*N\*/);
});

test('precon summary keeps exact product variant identity', () => {
  const summary = summarizePreconEntryV10({
    code: 'FIC',
    fileName: 'LimitBreakCollectorsEditionFinalFantasyVii_FIC',
    name: "Limit Break Collector's Edition - Final Fantasy VII",
    releaseDate: '2025-06-13',
    type: 'Commander Deck',
  });
  assert.equal(summary.productVariant, 'collector-edition');
  assert.equal(summary.code, 'FIC');
});

test('EDHREC precon route uses stable precon slug form', () => {
  assert.equal(edhrecPreconUrlV10('Vampiric Bloodlust'), 'https://edhrec.com/precon/vampiric-bloodlust');
  assert.equal(edhrecPreconUrlV10('Endless Punishment'), 'https://edhrec.com/precon/endless-punishment');
});

test('upgrade profiles expose light through optimized paths', () => {
  const profiles = preconUpgradeProfilesV10() as Record<string, unknown>;
  assert.ok(profiles.light);
  assert.ok(profiles.balanced);
  assert.ok(profiles.strong);
  assert.ok(profiles.optimized);
});
