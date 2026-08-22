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

const directDamageInteraction = card({
  name: 'Direct Damage Interaction',
  typeLine: 'Instant',
  oracleText: 'Direct Damage Interaction deals 3 damage to any target.',
  cmc: 1,
  manaCost: '{R}',
});

const conditionalTapExile = card({
  name: 'Conditional Tap Exile',
  typeLine: 'Instant',
  oracleText: 'Tap target creature. Metalcraft — If you control three or more artifacts, exile that creature.',
  cmc: 1,
  manaCost: '{W}',
});

const anyGraveyardReanimation = card({
  name: 'Any Graveyard Reanimation',
  typeLine: 'Sorcery',
  oracleText: "Put target creature card from a graveyard onto the battlefield under your control. You lose life equal to that card's mana value.",
  cmc: 1,
  manaCost: '{B}',
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

const selfProtectedManaDork = card({
  name: 'Self-Protected Mana Dork',
  typeLine: 'Creature — Elf Druid',
  oracleText: 'Self-Protected Mana Dork has hexproof as long as it is untapped.\n{T}: Add one mana of any color.',
  cmc: 2,
  manaCost: '{1}{G}',
});

const targetedProtection = card({
  name: 'Targeted Protection',
  typeLine: 'Instant',
  oracleText: 'Target permanent you control gains hexproof and indestructible until end of turn.',
  cmc: 1,
  manaCost: '{G}',
});

const boardProtection = card({
  name: 'Board Protection',
  typeLine: 'Instant',
  oracleText: 'Permanents you control gain hexproof and indestructible until end of turn.',
  cmc: 2,
  manaCost: '{1}{G}',
});

const conditionalGroupProtection = card({
  name: 'Conditional Group Protection',
  typeLine: 'Instant',
  oracleText: 'Creatures you control with power 4 or greater gain hexproof and indestructible until end of turn.',
  cmc: 1,
  manaCost: '{G}',
});

const massMinusWipe = card({
  name: 'Mass Minus Wipe',
  typeLine: 'Sorcery',
  oracleText: 'As an additional cost to cast this spell, pay X life. All creatures get -X/-X until end of turn.',
  cmc: 3,
  manaCost: '{2}{B}',
});

const qualifiedMassWipe = card({
  name: 'Qualified Mass Wipe',
  typeLine: 'Sorcery',
  oracleText: 'Destroy all nonartifact creatures.',
  cmc: 6,
  manaCost: '{3}{B}{B}{B}',
});

const graveyardExchange = card({
  name: 'Graveyard Exchange',
  typeLine: 'Sorcery',
  oracleText: 'Each player exiles all creature cards from their graveyard, then sacrifices all creatures they control, then puts all cards they exiled this way onto the battlefield.',
  cmc: 5,
  manaCost: '{3}{B}{B}',
});

const delayedEquippedReturn = card({
  name: 'Generic Delayed Equipment Return',
  typeLine: 'Artifact — Equipment',
  oracleText: "Equipped creature has lifelink. Whenever equipped creature dies, return that card to the battlefield under its owner's control at the beginning of the next end step.",
  cmc: 2,
  manaCost: '{2}',
});

const delayedArtifactCreatureReturn = card({
  name: 'Generic Delayed Artifact Return',
  typeLine: 'Artifact Creature — Construct Wizard',
  oracleText: '{1}{B}, {T}: Choose another target artifact creature you control. When that creature dies this turn, return it to the battlefield tapped under your control.',
  cmc: 4,
  manaCost: '{3}{B}',
});

const tokenMultiplier = card({
  name: 'Generic Token Multiplier',
  typeLine: 'Creature — Test Warrior',
  oracleText: 'If one or more tokens would be created under your control, those tokens plus that many 1/1 green creature tokens are created instead.',
  cmc: 3,
  manaCost: '{2}{G}',
});

const teamAnthem = card({
  name: 'Generic Team Anthem',
  typeLine: 'Enchantment',
  oracleText: 'Whenever a creature you control attacks, put a quest counter on this permanent. Creatures you control get +5/+5 as long as it has seven or more quest counters on it.',
  cmc: 3,
  manaCost: '{2}{G}',
});

const typalAnthem = card({
  name: 'Generic Typal Anthem',
  typeLine: 'Creature — Test Noble',
  oracleText: 'Other Squirrels you control get +1/+1.',
  cmc: 2,
  manaCost: '{1}{G}',
});

const boardScalingEquipment = card({
  name: 'Generic Board-Scaling Equipment',
  typeLine: 'Artifact — Equipment',
  oracleText: 'Equipped creature gets +1/+1 for each creature you control with base power and toughness 1/1. Whenever a Mouse or Squirrel you control enters, you may attach this Equipment to that creature.',
  cmc: 2,
  manaCost: '{2}',
});

const persistentRainbowRock = card({
  name: 'Persistent Rainbow Rock',
  typeLine: 'Artifact',
  oracleText: '{T}: Add one mana of any color.',
  cmc: 2,
  manaCost: '{2}',
  producedMana: ['W', 'U', 'B', 'R', 'G'],
});

const oneShotColorFilter = card({
  name: 'One-Shot Color Filter',
  typeLine: 'Instant',
  oracleText: 'Add two mana in any combination of colors. Draw a card.',
  cmc: 2,
  manaCost: '{1}{G}',
  producedMana: ['W', 'U', 'B', 'R', 'G'],
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

test('self-only, targeted, conditional-group, and board-wide protection stay distinct', () => {
  const targetedRoles = inferCardRoles(targetedProtection);
  const boardRoles = inferCardRoles(boardProtection);
  const conditionalRoles = inferCardRoles(conditionalGroupProtection);

  assert.equal(inferCardRoles(selfProtectedManaDork).includes('protection'), false);
  assert.equal(targetedRoles.includes('protection'), true);
  assert.equal(targetedRoles.includes('board protection'), false);
  assert.equal(boardRoles.includes('protection'), true);
  assert.equal(boardRoles.includes('board protection'), true);
  assert.equal(conditionalRoles.includes('protection'), false);
  assert.equal(conditionalRoles.includes('board protection'), false);
  assert.equal(conditionalRoles.includes('conditional protection'), true);
});

test('mass negative-power removal is recognized as a board wipe', () => {
  assert.equal(inferCardRoles(massMinusWipe).includes('board wipe'), true);
});

test('qualified mass destruction and graveyard exchanges retain wipe and recursion truth', () => {
  assert.equal(inferCardRoles(qualifiedMassWipe).includes('board wipe'), true);
  assert.equal(inferCardRoles(graveyardExchange).includes('board wipe'), true);
  assert.equal(inferCardRoles(graveyardExchange).includes('graveyard recursion'), true);
});

test('delayed death returns count as graveyard recursion even when Oracle text omits the word graveyard', () => {
  assert.equal(inferCardRoles(delayedEquippedReturn).includes('graveyard recursion'), true);
  assert.equal(inferCardRoles(delayedArtifactCreatureReturn).includes('graveyard recursion'), true);
});

test('token multipliers, team-wide payoffs, and board-scaling Equipment retain combat-engine truth', () => {
  assert.ok(inferCardRoles(tokenMultiplier).includes('token production'));
  assert.ok(inferCardRoles(teamAnthem).includes('go-wide payoff'));
  assert.ok(inferCardRoles(typalAnthem).includes('go-wide payoff'));
  assert.ok(inferCardRoles(boardScalingEquipment).includes('go-wide payoff'));
});

test('direct damage and conditional tap-exile cards count as spot interaction', () => {
  assert.equal(inferCardRoles(directDamageInteraction).includes('spot interaction'), true);
  assert.equal(inferCardRoles(conditionalTapExile).includes('spot interaction'), true);
});

test('putting a target creature from any graveyard onto the battlefield counts as recursion', () => {
  assert.equal(inferCardRoles(anyGraveyardReanimation).includes('graveyard recursion'), true);
});

test('persistent colored mana excludes one-shot color filtering', () => {
  assert.equal(inferCardRoles(persistentRainbowRock).includes('persistent colored mana source'), true);
  assert.equal(inferCardRoles(oneShotColorFilter).includes('persistent colored mana source'), false);
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
