import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import {
  auditRefinementPackageAcceptanceV15,
  packageAcceptanceGateV15,
  type RefinementPackageAcceptanceContractV15,
} from './refinement-acceptance-v15.js';

function card(
  name: string,
  typeLine: string,
  oracleText: string,
  cmc = 2,
  manaCost = '{2}',
): ScryfallCard {
  return {
    id: name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-'),
    oracle_id: name + '-oracle',
    lang: 'en',
    name,
    set: 'tst',
    set_name: 'Test Set',
    collector_number: String(Math.max(1, name.length)),
    released_at: '2026-01-01',
    type_line: typeLine,
    oracle_text: oracleText,
    mana_cost: manaCost,
    cmc,
    colors: [],
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    rarity: 'rare',
    prices: { usd: '1.00', usd_foil: null, usd_etched: null, eur: null, eur_foil: null, tix: null },
    finishes: ['nonfoil'],
    foil: false,
    nonfoil: true,
    promo: false,
    digital: false,
    full_art: false,
    scryfall_uri: 'https://scryfall.com/search?q=' + encodeURIComponent(name),
  } as ScryfallCard;
}

function parsed(mainNames: string[]): ReturnType<typeof parseDecklist> {
  return parseDecklist([
    '// COMMANDER',
    '1 Test Acceptance Commander',
    '',
    '// MAIN',
    ...mainNames.map((name) => '1 ' + name),
  ].join('\n'));
}

function contract(
  strategyFuel: RefinementPackageAcceptanceContractV15['strategyFuel'] = [],
  structuralFloors: RefinementPackageAcceptanceContractV15['structuralFloors'] = [],
): RefinementPackageAcceptanceContractV15 {
  return { strategyFuel, structuralFloors };
}

const commander = card(
  'Test Acceptance Commander',
  'Legendary Creature — Wizard',
  'Whenever you cast a noncreature spell with mana value 3 or greater, draw a card.',
  3,
  '{1}{U}{U}',
);

test('caller-declared strategy fuel counts ordinary and X noncreature spells', () => {
  const highValue = card('Three Mana Spell', 'Instant', 'Draw two cards.', 3, '{2}{U}');
  const xSpell = card('Variable Spell', 'Sorcery', 'Each opponent loses X life.', 1, '{X}{B}');
  const cheapSpell = card('Cheap Spell', 'Instant', 'Draw a card.', 1, '{U}');
  const before = parsed([highValue.name, xSpell.name, cheapSpell.name]);
  const after = parsed([highValue.name, xSpell.name, cheapSpell.name]);
  const cards = [commander, highValue, xSpell, cheapSpell];

  const audit = auditRefinementPackageAcceptanceV15({
    beforeParsed: before,
    beforeCards: cards,
    afterParsed: after,
    afterCards: cards,
    contract: contract([{
      id: 'noncreature-mv3-plus-or-x-spells',
      minimumCount: 2,
      matcher: {
        requireNonland: true,
        requireNoncreature: true,
        minManaValue: 3,
        countXAsAtLeastManaValue: 3,
      },
    }]),
  });

  assert.ok(audit);
  assert.equal(audit.evidenceComplete, true);
  assert.equal(audit.preserved, true);
  assert.equal(audit.strategyFuel[0]?.beforeCount, 2);
  assert.equal(audit.strategyFuel[0]?.afterCount, 2);
  assert.equal(audit.strategyFuel[0]?.delta, 0);
  assert.equal(packageAcceptanceGateV15(audit).reason, 'caller-declared-package-acceptance-preserved');
});

test('package gate rejects cumulative strategy-fuel loss even when the descriptor is otherwise valid', () => {
  const firstFuel = card('First Trigger Spell', 'Instant', 'Draw two cards.', 3, '{2}{U}');
  const secondFuel = card('Second Trigger Spell', 'Sorcery', 'Create a token.', 3, '{2}{U}');
  const replacement = card('Cheap Replacement', 'Instant', 'Counter target spell.', 1, '{U}');
  const before = parsed([firstFuel.name, secondFuel.name]);
  const after = parsed([firstFuel.name, replacement.name]);
  const allCards = [commander, firstFuel, secondFuel, replacement];

  const audit = auditRefinementPackageAcceptanceV15({
    beforeParsed: before,
    beforeCards: allCards,
    afterParsed: after,
    afterCards: allCards,
    contract: contract([{
      id: 'trigger-fuel',
      minimumCount: 2,
      matcher: {
        requireNonland: true,
        requireNoncreature: true,
        minManaValue: 3,
        countXAsAtLeastManaValue: 3,
      },
    }]),
  });

  assert.ok(audit);
  assert.equal(audit.status, 'strategy-fuel-loss');
  assert.equal(audit.preserved, false);
  assert.equal(audit.strategyFuel[0]?.beforeCount, 2);
  assert.equal(audit.strategyFuel[0]?.afterCount, 1);
  assert.equal(audit.strategyFuel[0]?.delta, -1);
  assert.equal(packageAcceptanceGateV15(audit).eligible, false);
  assert.equal(packageAcceptanceGateV15(audit).reason, 'package-reduces-declared-strategy-fuel');
});

test('package gate rejects multiple structural floors without relying on card names', () => {
  const wipe = card('Board Wipe', 'Sorcery', 'Destroy all creatures.', 4, '{3}{B}');
  const fastMana = card('Fast Mana', 'Artifact', '{T}: Add {C}{C}.', 1, '{1}');
  const removal = card('Target Removal', 'Instant', 'Exile target creature.', 1, '{B}');
  const slowRock = card('Slow Rock', 'Artifact', '{T}: Add {C}.', 3, '{3}');
  const before = parsed([wipe.name, fastMana.name]);
  const after = parsed([removal.name, slowRock.name]);
  const allCards = [commander, wipe, fastMana, removal, slowRock];

  const audit = auditRefinementPackageAcceptanceV15({
    beforeParsed: before,
    beforeCards: allCards,
    afterParsed: after,
    afterCards: allCards,
    contract: contract([], [
      { id: 'board-wipes', minimumCount: 1, matcher: { requiredRoles: ['board wipe'] } },
      { id: 'premium-fast-mana', minimumCount: 1, matcher: { requiredRoles: ['fast mana'] } },
    ]),
  });

  assert.ok(audit);
  assert.equal(audit.status, 'structural-floor-loss');
  assert.equal(audit.structuralFloors.every((floor) => floor.preserved), false);
  assert.equal(audit.losses.length, 2);
  assert.equal(packageAcceptanceGateV15(audit).reason, 'package-breaks-declared-structural-floor');
});

test('package gate reports combined strategy-fuel and structural-floor loss', () => {
  const fuel = card('Fuel Spell', 'Sorcery', 'Draw two cards.', 3, '{2}{U}');
  const wipe = card('Mass Removal', 'Sorcery', 'Destroy all creatures.', 4, '{3}{B}');
  const cheap = card('Cheap Spell', 'Instant', 'Draw a card.', 1, '{U}');
  const spot = card('Spot Removal', 'Instant', 'Exile target creature.', 1, '{B}');
  const before = parsed([fuel.name, wipe.name]);
  const after = parsed([cheap.name, spot.name]);
  const allCards = [commander, fuel, wipe, cheap, spot];

  const audit = auditRefinementPackageAcceptanceV15({
    beforeParsed: before,
    beforeCards: allCards,
    afterParsed: after,
    afterCards: allCards,
    contract: contract(
      [{
        id: 'trigger-fuel',
        minimumCount: 1,
        matcher: { requireNoncreature: true, minManaValue: 3, countXAsAtLeastManaValue: 3 },
      }],
      [{ id: 'board-wipes', minimumCount: 1, matcher: { requiredRoles: ['board wipe'] } }],
    ),
  });

  assert.ok(audit);
  assert.equal(audit.status, 'strategy-fuel-and-structural-floor-loss');
  assert.equal(packageAcceptanceGateV15(audit).reason, 'package-reduces-declared-strategy-fuel-and-structural-floor');
});

test('package gate fails closed when a required card is unresolved or the contract is malformed', () => {
  const fuel = card('Unresolved Fuel', 'Sorcery', 'Draw two cards.', 3, '{2}{U}');
  const before = parsed([fuel.name]);
  const after = parsed([fuel.name]);

  const unresolved = auditRefinementPackageAcceptanceV15({
    beforeParsed: before,
    beforeCards: [commander, fuel],
    afterParsed: after,
    afterCards: [commander],
    contract: contract([{
      id: 'trigger-fuel',
      minimumCount: 1,
      matcher: { requireNoncreature: true, minManaValue: 3 },
    }]),
  });
  assert.ok(unresolved);
  assert.equal(unresolved.evidenceComplete, false);
  assert.equal(unresolved.status, 'evidence-incomplete');
  assert.equal(packageAcceptanceGateV15(unresolved).reason, 'package-acceptance-evidence-incomplete');

  const malformed = auditRefinementPackageAcceptanceV15({
    beforeParsed: before,
    beforeCards: [commander, fuel],
    afterParsed: after,
    afterCards: [commander, fuel],
    contract: { structuralFloors: [] },
  });
  assert.ok(malformed);
  assert.equal(malformed.evidenceComplete, false);
  assert.equal(packageAcceptanceGateV15(malformed).eligible, false);

  const malformedEntry = auditRefinementPackageAcceptanceV15({
    beforeParsed: before,
    beforeCards: [commander, fuel],
    afterParsed: after,
    afterCards: [commander, fuel],
    contract: {
      strategyFuel: [null as unknown as NonNullable<RefinementPackageAcceptanceContractV15['strategyFuel']>[number]],
    },
  });
  assert.ok(malformedEntry);
  assert.equal(malformedEntry.evidenceComplete, false);
  assert.equal(packageAcceptanceGateV15(malformedEntry).reason, 'package-acceptance-evidence-incomplete');

  const malformedContract = auditRefinementPackageAcceptanceV15({
    beforeParsed: before,
    beforeCards: [commander, fuel],
    afterParsed: after,
    afterCards: [commander, fuel],
    contract: null as unknown as RefinementPackageAcceptanceContractV15,
  });
  assert.ok(malformedContract);
  assert.equal(malformedContract.evidenceComplete, false);
  assert.equal(packageAcceptanceGateV15(malformedContract).reason, 'package-acceptance-evidence-incomplete');
});

test('an omitted package contract preserves existing refinement behavior', () => {
  assert.equal(auditRefinementPackageAcceptanceV15({
    beforeParsed: parsed([]),
    beforeCards: [commander],
    afterParsed: parsed([]),
    afterCards: [commander],
  }), null);
  assert.deepEqual(packageAcceptanceGateV15(null), {
    eligible: true,
    reason: 'package-acceptance-contract-not-configured',
  });
});
