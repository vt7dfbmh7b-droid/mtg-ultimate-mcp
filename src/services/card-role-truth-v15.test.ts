import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { buildDeckMetrics, parseDecklist } from './deck.js';
import { inferCardRoles, normalizeScryfallSearchQueryV15 } from './scryfall.js';

function card(input: {
  name: string;
  typeLine: string;
  oracleText: string;
  cmc?: number;
  manaCost?: string;
  producedMana?: string[];
}): ScryfallCard {
  return {
    id: input.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-'),
    oracle_id: `${input.name}-oracle`,
    lang: 'en',
    name: input.name,
    set: 'tst',
    set_name: 'Test Set',
    collector_number: '1',
    released_at: '2026-01-01',
    type_line: input.typeLine,
    oracle_text: input.oracleText,
    mana_cost: input.manaCost ?? '',
    cmc: input.cmc ?? 0,
    colors: [],
    color_identity: [],
    keywords: [],
    legalities: { commander: 'legal' },
    rarity: 'common',
    prices: { usd: null, usd_foil: null, usd_etched: null, eur: null, eur_foil: null, tix: null },
    finishes: ['nonfoil'],
    foil: false,
    nonfoil: true,
    promo: false,
    digital: false,
    full_art: false,
    scryfall_uri: 'https://scryfall.com',
    ...(input.producedMana ? { produced_mana: input.producedMana } : {}),
  } as ScryfallCard;
}

const forest = card({
  name: 'Forest',
  typeLine: 'Basic Land — Forest',
  oracleText: '({T}: Add {G}.)',
  producedMana: ['G'],
});

const ancientTomb = card({
  name: 'Ancient Tomb',
  typeLine: 'Land',
  oracleText: '{T}: Add {C}{C}. Ancient Tomb deals 2 damage to you.',
  producedMana: ['C'],
});

const farseek = card({
  name: 'Farseek',
  typeLine: 'Sorcery',
  oracleText: 'Search your library for a Plains, Island, Swamp, or Mountain card, put it onto the battlefield tapped, then shuffle.',
  cmc: 2,
  manaCost: '{1}{G}',
});

const cultivate = card({
  name: 'Cultivate',
  typeLine: 'Sorcery',
  oracleText: 'Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.',
  cmc: 3,
  manaCost: '{2}{G}',
});

const cropRotation = card({
  name: 'Crop Rotation',
  typeLine: 'Instant',
  oracleText: 'As an additional cost to cast this spell, sacrifice a land. Search your library for a land card, put that card onto the battlefield, then shuffle.',
  cmc: 1,
  manaCost: '{G}',
});

const demonicTutor = card({
  name: 'Demonic Tutor',
  typeLine: 'Sorcery',
  oracleText: 'Search your library for a card, put that card into your hand, then shuffle.',
  cmc: 2,
  manaCost: '{1}{B}',
});

const deadlyRollick = card({
  name: 'Deadly Rollick',
  typeLine: 'Instant',
  oracleText: 'If you control a commander, you may cast this spell without paying its mana cost. Exile target creature.',
  cmc: 4,
  manaCost: '{3}{B}',
});

const fierceGuardianship = card({
  name: 'Fierce Guardianship',
  typeLine: 'Instant',
  oracleText: 'If you control a commander, you may cast this spell without paying its mana cost. Counter target noncreature spell.',
  cmc: 3,
  manaCost: '{2}{U}',
});

const deflectingSwat = card({
  name: 'Deflecting Swat',
  typeLine: 'Instant',
  oracleText: 'If you control a commander, you may cast this spell without paying its mana cost. You may choose new targets for target spell or ability.',
  cmc: 3,
  manaCost: '{2}{R}',
});

const submerge = card({
  name: 'Submerge',
  typeLine: 'Instant',
  oracleText: "If an opponent controls a Forest and you control an Island, you may cast this spell without paying its mana cost. Put target creature on top of its owner's library.",
  cmc: 5,
  manaCost: '{4}{U}',
});

const forceOfWill = card({
  name: 'Force of Will',
  typeLine: 'Instant',
  oracleText: "You may pay 1 life and exile a blue card from your hand rather than pay this spell's mana cost. Counter target spell.",
  cmc: 5,
  manaCost: '{3}{U}{U}',
});

const solitude = card({
  name: 'Solitude',
  typeLine: 'Creature — Elemental Incarnation',
  oracleText: "Flash\nLifelink\nWhen Solitude enters, exile up to one other target creature. That creature's controller gains life equal to its power.\nEvoke—Exile a white card from your hand.",
  cmc: 5,
  manaCost: '{3}{W}{W}',
});

const mentalMisstep = card({
  name: 'Mental Misstep',
  typeLine: 'Instant',
  oracleText: 'Counter target spell with mana value 1.',
  cmc: 1,
  manaCost: '{U/P}',
});

const phyrexianButNotFree = card({
  name: 'Phyrexian But Not Free',
  typeLine: 'Instant',
  oracleText: 'Destroy target creature.',
  cmc: 3,
  manaCost: '{1}{B/P}{B/P}',
});

const counterspell = card({
  name: 'Counterspell',
  typeLine: 'Instant',
  oracleText: 'Counter target spell.',
  cmc: 2,
  manaCost: '{U}{U}',
});

test('ordinary lands are mana sources, not mana acceleration, while true multi-mana lands remain acceleration', () => {
  assert.equal(inferCardRoles(forest).includes('mana acceleration'), false);
  assert.equal(inferCardRoles(forest).includes('land'), true);
  assert.equal(inferCardRoles(ancientTomb).includes('mana acceleration'), true);
});

test('basic-land ramp is not promoted to strategic tutor while unrestricted land and card tutors remain tutors', () => {
  const farseekRoles = inferCardRoles(farseek);
  assert.equal(farseekRoles.includes('land ramp'), true);
  assert.equal(farseekRoles.includes('land tutor'), true);
  assert.equal(farseekRoles.includes('tutor'), false);

  const cultivateRoles = inferCardRoles(cultivate);
  assert.equal(cultivateRoles.includes('land ramp'), true);
  assert.equal(cultivateRoles.includes('land tutor'), true);
  assert.equal(cultivateRoles.includes('tutor'), false);

  const cropRoles = inferCardRoles(cropRotation);
  assert.equal(cropRoles.includes('land tutor'), true);
  assert.equal(cropRoles.includes('tutor'), true);

  assert.equal(inferCardRoles(demonicTutor).includes('tutor'), true);
});

test('free interaction recognizes commander-enabled, pitch, evoke, retarget, library-top, and zero-mana Phyrexian lines', () => {
  assert.equal(inferCardRoles(deadlyRollick).includes('free interaction'), true);
  assert.equal(inferCardRoles(fierceGuardianship).includes('free interaction'), true);
  assert.equal(inferCardRoles(deflectingSwat).includes('free interaction'), true);
  assert.equal(inferCardRoles(submerge).includes('free interaction'), true);
  assert.equal(inferCardRoles(forceOfWill).includes('free interaction'), true);
  assert.equal(inferCardRoles(solitude).includes('free interaction'), true);
  assert.equal(inferCardRoles(mentalMisstep).includes('free interaction'), true);
  assert.equal(inferCardRoles(phyrexianButNotFree).includes('free interaction'), false);
  assert.equal(inferCardRoles(counterspell).includes('free interaction'), false);
});

// This shared-query regression intentionally exercises the exact legacy clause still emitted by
// both targeted Build and unrestricted Upgrade so their discovery semantics cannot drift again.
test('legacy Build and Upgrade free-interaction searches are expanded to the shared semantics before Scryfall lookup', () => {
  const legacy = 'f:commander id<=ubr -t:land ((mv=0 OR o:"rather than pay") (o:"counter target" OR o:"destroy target" OR o:"exile target"))';
  const normalized = normalizeScryfallSearchQueryV15(legacy);
  assert.match(normalized, /o:"without paying"/);
  assert.match(normalized, /kw:evoke/);
  assert.match(normalized, /is:phyrexian/);
  assert.match(normalized, /o:"choose new targets"/);
  assert.match(normalized, /o:"puts it on the top"/);
  assert.doesNotMatch(normalized, /\(\(mv=0 OR o:"rather than pay"\) \(o:"counter target"/);
});

test('deck metrics no longer let basic lands or Farseek-style ramp satisfy ramp and tutor targets simultaneously', () => {
  const parsed = parseDecklist('31 Forest\n1 Farseek\n1 Demonic Tutor');
  const metrics = buildDeckMetrics(parsed, [forest, farseek, demonicTutor]);
  assert.equal(metrics.landCount, 31);
  assert.equal(metrics.rampCount, 1);
  assert.equal(metrics.tutorCount, 1);
  assert.equal(metrics.roleCounts['mana acceleration'] ?? 0, 0);
  assert.equal(metrics.roleCounts['land ramp'] ?? 0, 1);
});
