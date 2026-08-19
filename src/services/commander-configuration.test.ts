import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { buildCardIntelligenceV05 } from './card-intelligence-v05.js';
import { assessCommanderConfiguration } from './commander-configuration.js';

function card(options: {
  name: string;
  typeLine: string;
  oracleText?: string;
  power?: string;
  toughness?: string;
  legality?: string;
  colorIdentity?: string[];
}): ScryfallCard {
  return {
    id: `id-${options.name}`,
    oracle_id: `oracle-${options.name}`,
    name: options.name,
    lang: 'en',
    released_at: '2025-08-01',
    mana_cost: '{2}',
    cmc: 2,
    type_line: options.typeLine,
    ...(options.oracleText !== undefined ? { oracle_text: options.oracleText } : {}),
    color_identity: options.colorIdentity ?? [],
    keywords: [],
    legalities: { commander: options.legality ?? 'legal' },
    set: 'tst',
    set_name: 'Commander Configuration Test',
    collector_number: '1',
    rarity: 'rare',
    scryfall_uri: `https://scryfall.com/card/tst/1/${encodeURIComponent(options.name)}`,
    ...(options.power !== undefined ? { power: options.power } : {}),
    ...(options.toughness !== undefined ? { toughness: options.toughness } : {}),
  };
}

const ordinaryCommander = card({
  name: 'Ordinary Commander',
  typeLine: 'Legendary Creature — Human',
  power: '2',
  toughness: '2',
  colorIdentity: ['G'],
});

const currentVehicleCommander = card({
  name: 'Vehicle Commander',
  typeLine: 'Legendary Artifact — Vehicle',
  power: '5',
  toughness: '5',
});

const invalidPlaneswalker = card({
  name: 'Invalid Planeswalker',
  typeLine: 'Legendary Planeswalker — Test',
});

const bannedCommander = card({
  name: 'Banned Commander',
  typeLine: 'Legendary Creature — Test',
  power: '3',
  toughness: '3',
  legality: 'banned',
});

test('shared commander configuration accepts ordinary and current Vehicle commanders', () => {
  const ordinary = assessCommanderConfiguration([ordinaryCommander]);
  assert.equal(ordinary.pairingLegal, true);
  assert.equal(ordinary.eligibilityAndFormatLegal, true);
  assert.equal(ordinary.legal, true);
  assert.deepEqual(ordinary.combinedColorIdentity, ['G']);

  const vehicle = assessCommanderConfiguration([currentVehicleCommander]);
  assert.equal(vehicle.legal, true);
  assert.equal(vehicle.commanderChecks[0]?.eligible, true);
});

test('shared commander configuration rejects ineligible or Commander-banned commanders', () => {
  const ineligible = assessCommanderConfiguration([invalidPlaneswalker]);
  assert.equal(ineligible.pairingLegal, true);
  assert.equal(ineligible.eligibilityAndFormatLegal, false);
  assert.equal(ineligible.legal, false);
  assert.equal(ineligible.commanderChecks[0]?.eligible, false);

  const banned = assessCommanderConfiguration([bannedCommander]);
  assert.equal(banned.pairingLegal, true);
  assert.equal(banned.eligibilityAndFormatLegal, false);
  assert.equal(banned.legal, false);
  assert.equal(banned.commanderChecks[0]?.commanderFormatLegality, 'banned');
});

test('shared commander configuration rejects an arbitrary two-commander pair', () => {
  const first = card({
    name: 'First Unpaired Legend',
    typeLine: 'Legendary Creature — Human',
    power: '2',
    toughness: '2',
  });
  const second = card({
    name: 'Second Unpaired Legend',
    typeLine: 'Legendary Creature — Elf',
    power: '2',
    toughness: '2',
  });
  const result = assessCommanderConfiguration([first, second]);
  assert.equal(result.pairingLegal, false);
  assert.equal(result.eligibilityAndFormatLegal, true);
  assert.equal(result.legal, false);
  assert.equal(result.pairing.method, 'none');
});

test('shared commander configuration accepts a valid original Partner pair', () => {
  const first = card({
    name: 'First Partner',
    typeLine: 'Legendary Creature — Human',
    oracleText: 'Partner',
    power: '2',
    toughness: '2',
  });
  const second = card({
    name: 'Second Partner',
    typeLine: 'Legendary Creature — Elf',
    oracleText: 'Partner',
    power: '2',
    toughness: '2',
  });
  const result = assessCommanderConfiguration([first, second]);
  assert.equal(result.pairingLegal, true);
  assert.equal(result.eligibilityAndFormatLegal, true);
  assert.equal(result.legal, true);
  assert.equal(result.pairing.method, 'Partner');
});

test('card intelligence refuses to call a candidate legal when the supplied commander is invalid', () => {
  const candidate = card({
    name: 'Green Candidate',
    typeLine: 'Creature — Elf',
    power: '2',
    toughness: '2',
    colorIdentity: [],
  });
  const report = buildCardIntelligenceV05(candidate, [invalidPlaneswalker]);
  assert.ok(report.commanderFit);
  assert.equal(report.commanderFit.commanderConfigurationLegal, false);
  assert.equal(report.commanderFit.formatLegal, true);
  assert.equal(report.commanderFit.colorIdentityLegal, true);
  assert.equal(report.commanderFit.legalForCommanders, false);
  assert.match(report.commanderFit.explanation, /not a legal current Commander configuration/i);
});

test('commander configuration helper rejects zero or more than two commanders', () => {
  assert.throws(() => assessCommanderConfiguration([]), /one or two resolved commander cards/i);
  assert.throws(
    () => assessCommanderConfiguration([ordinaryCommander, currentVehicleCommander, ordinaryCommander]),
    /one or two resolved commander cards/i,
  );
});
