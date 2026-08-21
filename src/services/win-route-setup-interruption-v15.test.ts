import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { auditWinRouteSetupInterruptionV15 } from './win-route-setup-interruption-v15.js';

function card(name: string, typeLine: string, oracleText = '', manaCost = '{2}', cmc = 2): ScryfallCard {
  return {
    id: `id-${name}`,
    oracle_id: `oracle-${name}`,
    name,
    lang: 'en',
    mana_cost: manaCost,
    cmc,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test Set',
    collector_number: '1',
    rarity: 'rare',
    scryfall_uri: `https://scryfall.com/card/tst/1/${encodeURIComponent(name)}`,
  };
}

test('setup audit preserves provider mana/prerequisite evidence and explicit zone mentions', () => {
  const commander = card('Commander Engine', 'Legendary Creature — Wizard', 'Whenever you cast a spell, draw a card.');
  const piece = card('Artifact Piece', 'Artifact', '{T}: Add {U}.');
  const audit = auditWinRouteSetupInterruptionV15({
    route: {
      comboId: 'combo-1',
      comboCardNames: ['Commander Engine', 'Artifact Piece'],
      seedNames: ['Artifact Piece'],
      requirementNames: ['A creature card in your graveyard'],
      manaNeeded: { generic: 2, blue: 1 },
      otherPrerequisites: ['Artifact Piece on the battlefield', 'A creature card in your graveyard'],
      description: 'Resolve the loop with both permanents on the battlefield.',
      closureTiming: 'immediate',
    },
    resolvedCards: [commander, piece],
  });

  assert.equal(audit.providerSetupStatus, 'provider-explicit');
  assert.deepEqual(audit.manaEvidence, ['blue: 1', 'generic: 2']);
  assert.ok(audit.prerequisiteEvidence.some((value) => value.includes('graveyard')));
  assert.deepEqual(audit.explicitZoneMentions, ['battlefield', 'graveyard']);
  assert.equal(audit.commanderDependent, true);
  assert.deepEqual(audit.commanderDependencyNames, ['Commander Engine']);
  assert.deepEqual(audit.templateRequirementNames, ['A creature card in your graveyard']);
  assert.ok(audit.setupFlags.includes('commander-dependent'));
  assert.ok(audit.setupFlags.includes('template-requirement-unresolved-to-exact-card'));
  assert.ok(audit.interruptionSurfaces.some((entry) => entry.surface === 'creature-removal'));
  assert.ok(audit.interruptionSurfaces.some((entry) => entry.surface === 'artifact-removal'));
  assert.ok(audit.interruptionSurfaces.some((entry) => entry.surface === 'graveyard-interaction'));
  assert.ok(audit.interruptionSurfaces.some((entry) => entry.surface === 'triggered-ability-interaction'));
});

test('missing provider setup fields stay unknown rather than becoming proof of trivial setup', () => {
  const pieceA = card('Piece A', 'Artifact');
  const pieceB = card('Piece B', 'Enchantment');
  const audit = auditWinRouteSetupInterruptionV15({
    route: {
      comboId: 'combo-unknown-setup',
      comboCardNames: ['Piece A', 'Piece B'],
      seedNames: ['Piece A', 'Piece B'],
      closureTiming: 'immediate',
    },
    resolvedCards: [pieceA, pieceB],
  });

  assert.equal(audit.providerSetupStatus, 'provider-absent');
  assert.deepEqual(audit.manaEvidence, []);
  assert.deepEqual(audit.prerequisiteEvidence, []);
  assert.match(audit.providerCaveat, /unknown setup detail/i);
  assert.ok(audit.interruptionSurfaces.some((entry) => entry.surface === 'artifact-removal'));
  assert.ok(audit.interruptionSurfaces.some((entry) => entry.surface === 'enchantment-removal'));
});

test('instant or sorcery pieces expose stack interaction while delayed wins expose an extra response window', () => {
  const spell = card('Combo Spell', 'Instant', 'Copy target spell.', '{U}');
  const audit = auditWinRouteSetupInterruptionV15({
    route: {
      comboId: 'combo-delayed',
      comboCardNames: ['Combo Spell'],
      seedNames: ['Combo Spell'],
      otherPrerequisites: 'Cast Combo Spell while the winning trigger is on the stack.',
      closureTiming: 'delayed',
    },
    resolvedCards: [spell],
  });

  assert.deepEqual(audit.explicitZoneMentions, ['stack']);
  assert.ok(audit.interruptionSurfaces.some((entry) => entry.surface === 'stack-interaction'));
  assert.ok(audit.interruptionSurfaces.some((entry) => entry.surface === 'delayed-win-window'));
  assert.ok(audit.setupFlags.includes('delayed-closure'));
});

test('deck support is role-level advisory and does not claim exact tutor or recovery coverage', () => {
  const comboPiece = card('Combo Piece', 'Artifact');
  const tutor = card('Broad Tutor', 'Sorcery', 'Search your library for a card, put that card into your hand, then shuffle.', '{1}{B}');
  const protection = card('Protection Spell', 'Instant', 'Target creature gains hexproof until end of turn.', '{G}');
  const recursion = card('Recursion Spell', 'Sorcery', 'Return target creature card from your graveyard to your hand.', '{1}{B}');
  const counter = card('Counter Spell', 'Instant', 'Counter target spell.', '{U}{U}');
  const freeCounter = card('Free Counter', 'Instant', 'Counter target spell.', '{0}', 0);

  const audit = auditWinRouteSetupInterruptionV15({
    route: {
      comboId: 'combo-support',
      comboCardNames: ['Combo Piece'],
      seedNames: ['Combo Piece'],
      closureTiming: 'immediate',
    },
    resolvedCards: [comboPiece, tutor, protection, recursion, counter, freeCounter],
  });

  assert.equal(audit.deckSupport.evidenceClass, 'role-level-advisory');
  assert.equal(audit.deckSupport.genericTutorCount, 1);
  assert.equal(audit.deckSupport.protectionCount, 1);
  assert.equal(audit.deckSupport.graveyardRecursionCount, 1);
  assert.equal(audit.deckSupport.countermagicCount, 2);
  assert.equal(audit.deckSupport.freeInteractionCount, 1);
  assert.match(audit.deckSupport.caveat, /do not prove/i);
});

test('unresolved combo-piece profiles are surfaced instead of silently omitted', () => {
  const audit = auditWinRouteSetupInterruptionV15({
    route: {
      comboId: 'combo-unresolved',
      comboCardNames: ['Known Piece', 'Missing Piece'],
      seedNames: ['Known Piece', 'Missing Piece'],
      closureTiming: 'immediate',
    },
    resolvedCards: [card('Known Piece', 'Creature — Human')],
  });

  assert.equal(audit.resolvedComboPieceCount, 1);
  assert.deepEqual(audit.unresolvedComboPieceNames, ['Missing Piece']);
  assert.ok(audit.setupFlags.includes('unresolved-combo-piece-profile'));
});
