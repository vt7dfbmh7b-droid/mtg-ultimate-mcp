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

test('own-graveyard engines are substantive while graveyard hate is not reanimator support', () => {
  const ownGraveyardTexts = [
    'As long as this creature is on the battlefield, it has all activated abilities of all artifact cards in your graveyard.',
    'Whenever this creature attacks, you may cast an artifact spell from your hand or graveyard by paying life rather than paying its mana cost.',
    'Whenever this Vehicle becomes crewed, each artifact creature card in your graveyard gains unearth {3} until end of turn.',
  ];
  for (const oracleText of ownGraveyardTexts) {
    const graveyard = inferNeutralStrategyV15([card({
      name: `Unnamed Own-Graveyard Engine ${oracleText.length}`,
      typeLine: 'Artifact Creature — Test Construct',
      oracleText,
    })]).find((strategy) => strategy.archetype === 'graveyard-reanimator');
    assert.ok((graveyard?.score ?? 0) >= 6, `own-graveyard engine was missed: ${oracleText}`);
  }

  const hate = inferNeutralStrategyV15([card({
    name: 'Unnamed Graveyard Lantern',
    typeLine: 'Artifact',
    oracleText: 'When this artifact enters, exile a card from a graveyard. {T}, Sacrifice this artifact: Exile each opponent\'s graveyard. Draw a card.',
  })]).find((strategy) => strategy.archetype === 'graveyard-reanimator');
  assert.equal(hate?.score ?? 0, 0, 'graveyard hate must not masquerade as reanimator support');

  const genericArtifact = inferNeutralStrategyV15([card({
    name: 'Unnamed Utility Rock',
    typeLine: 'Artifact',
    oracleText: '{T}: Add {C}.',
  })]).find((strategy) => strategy.archetype === 'artifact-engine');
  assert.ok((genericArtifact?.score ?? 0) > 0, 'generic artifacts retain relevant nonzero affinity');
  assert.ok((genericArtifact?.score ?? 0) < 6, 'a generic artifact alone must not masquerade as a substantive engine');
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

test('token multipliers and team-wide payoffs are substantive combat-token support', () => {
  const supportCards = [
    card({
      name: 'Unnamed Token Multiplier',
      typeLine: 'Creature — Test Warrior',
      oracleText: 'If one or more tokens would be created under your control, those tokens plus that many 1/1 green creature tokens are created instead.',
    }),
    card({
      name: 'Unnamed Team Anthem',
      typeLine: 'Enchantment',
      oracleText: 'Creatures you control get +5/+5 as long as this permanent has seven or more quest counters on it.',
    }),
    card({
      name: 'Unnamed Typal Anthem',
      typeLine: 'Creature — Test Noble',
      oracleText: 'Other Squirrels you control get +1/+1.',
    }),
  ];
  for (const support of supportCards) {
    const combat = inferNeutralStrategyV15([support])
      .find((strategy) => strategy.archetype === 'combat-tokens');
    assert.ok((combat?.score ?? 0) >= 6, `${support.name} was not protected as substantive go-wide support`);
  }
});

test('artifact-engine construction and route reporting have dedicated generic boundaries', () => {
  const strata = neutralUnrestrictedStrataV15(['B'], 'artifact-engine');
  const artifactQueries = strata.filter((stratum) => stratum.family === 'archetype').map((stratum) => stratum.query);
  assert.equal(artifactQueries.length, 3);
  assert.ok(artifactQueries.every((query) => query.includes('t:artifact OR o:artifact OR o:Vehicle')));

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
