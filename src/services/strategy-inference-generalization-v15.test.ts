import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { inferNeutralStrategyV15 } from './neutral-commander-selection-v15.js';
import { neutralUnrestrictedStrataV15 } from './neutral-unrestricted-pool-v15.js';
import { deriveNeutralWinRoutesV15 } from './neutral-win-routes-v15.js';

function card(input: {
  name: string;
  typeLine: string;
  oracleText: string;
}): ScryfallCard {
  return {
    id: input.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-'),
    oracle_id: `${input.name}-oracle`,
    name: input.name,
    lang: 'en',
    cmc: 4,
    type_line: input.typeLine,
    oracle_text: input.oracleText,
    color_identity: ['B'],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: '1',
    rarity: 'rare',
    scryfall_uri: 'https://scryfall.com/card/tst/1/test',
  } as ScryfallCard;
}

test('self-mill recovery outranks an incidental attack trigger without commander-name shortcuts', () => {
  const ranked = inferNeutralStrategyV15([card({
    name: 'Unnamed Self-Mill Recycler',
    typeLine: 'Legendary Artifact Creature — Test Construct',
    oracleText: 'Flying\nWhenever this creature attacks, mill three cards. You may put an artifact creature card from among the cards milled this way into your hand.',
  })]);

  const graveyard = ranked.find((strategy) => strategy.archetype === 'graveyard-reanimator');
  const artifacts = ranked.find((strategy) => strategy.archetype === 'artifact-engine');
  const combat = ranked.find((strategy) => strategy.archetype === 'combat-tokens');

  assert.equal(ranked[0]?.archetype, 'graveyard-reanimator');
  assert.ok((graveyard?.score ?? 0) >= 6, 'self-mill plus recovery must be a substantive graveyard strategy signal');
  assert.ok((artifacts?.score ?? 0) >= 6, 'explicit artifact selection must expose a substantive artifact-engine signal');
  assert.ok((combat?.score ?? 0) < 6, 'a generic attack trigger alone must not become a substantive combat-token identity');
  assert.ok(graveyard?.evidence.some((entry) => entry.includes('milled-card recovery')));
});

test('artifact permanents retain generic affinity inside a substantive artifact engine', () => {
  const artifact = inferNeutralStrategyV15([card({
    name: 'Unnamed Utility Engine',
    typeLine: 'Artifact',
    oracleText: '{T}: Add {C}.',
  })]).find((strategy) => strategy.archetype === 'artifact-engine');

  assert.ok((artifact?.score ?? 0) > 0, 'artifact permanents must retain nonzero artifact-engine affinity');
});

test('mass graveyard exchange text is recognized as graveyard-reanimator support', () => {
  const ranked = inferNeutralStrategyV15([card({
    name: 'Unnamed Graveyard Exchange',
    typeLine: 'Sorcery',
    oracleText: 'Each player exiles all creature cards from their graveyard, then sacrifices all creatures they control, then puts all cards they exiled this way onto the battlefield.',
  })]);
  const graveyard = ranked.find((strategy) => strategy.archetype === 'graveyard-reanimator');

  assert.equal(ranked[0]?.archetype, 'graveyard-reanimator');
  assert.ok((graveyard?.score ?? 0) >= 6);
  assert.ok(graveyard?.evidence.some((entry) => entry.includes('mass graveyard return')));
});

test('artifact-engine unrestricted discovery includes a dedicated artifact stratum', () => {
  const strata = neutralUnrestrictedStrataV15(['B'], 'artifact-engine');
  const artifactQueries = strata.filter((stratum) => stratum.family === 'archetype').map((stratum) => stratum.query);

  assert.equal(artifactQueries.length, 3);
  assert.ok(artifactQueries.every((query) => query.includes('t:artifact OR o:artifact OR o:Vehicle')));
});

test('artifact-engine win-route reporting describes artifact pressure rather than generic combat', () => {
  const engine = card({
    name: 'Unnamed Artifact Engine',
    typeLine: 'Artifact Creature — Construct',
    oracleText: 'When this creature enters, return target artifact card from your graveyard to your hand.',
  });
  const routes = deriveNeutralWinRoutesV15({
    archetype: 'artifact-engine',
    cards: [engine],
    verifiedWinningCombos: 0,
    efficientWinPlanSupported: false,
  });

  assert.equal(routes.primary.kind, 'control-value');
  assert.match(routes.primary.label, /Artifact engine/i);
  assert.ok(routes.primary.evidence.some((entry) => entry.includes('artifact cards')));
});
