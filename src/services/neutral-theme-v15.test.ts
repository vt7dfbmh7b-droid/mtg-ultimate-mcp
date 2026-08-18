import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import {
  auditNeutralThemeV15,
  cardMatchesNeutralThemeV15,
  resolveNeutralThemeIntentV15,
  type NeutralThemeIntentV15,
} from './neutral-theme-v15.js';

function card(name: string, overrides: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    id: name.toLocaleLowerCase().replace(/\s+/g, '-'),
    oracle_id: `oracle-${name.toLocaleLowerCase().replace(/\s+/g, '-')}`,
    name,
    lang: 'en',
    cmc: 2,
    type_line: 'Creature — Human',
    oracle_text: '',
    color_identity: ['B'],
    keywords: [],
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test',
    collector_number: '1',
    rarity: 'common',
    prices: {},
    scryfall_uri: `https://scryfall.com/card/tst/1/${encodeURIComponent(name)}`,
    ...overrides,
  };
}

test('mechanical themes normalize to controlled clauses instead of executing user text', async () => {
  const tokens = await resolveNeutralThemeIntentV15('Token theme', { creatureTypes: [] });
  assert.equal(tokens.kind, 'mechanic');
  assert.equal(tokens.canonicalLabel, 'Tokens');
  assert.equal(tokens.queryClause, 'o:token');
  assert.equal(tokens.minimumMainMatches, 15);

  const counters = await resolveNeutralThemeIntentV15('+1/+1 counters', { creatureTypes: [] });
  assert.equal(counters.kind, 'mechanic');
  assert.equal(counters.queryClause, 'o:"+1/+1 counter"');
});

test('creature-type themes are catalog verified, plural aware, and emitted as quoted type clauses', async () => {
  const vampire = await resolveNeutralThemeIntentV15('Vampires tribal', { creatureTypes: ['Vampire', 'Elf'] });
  assert.equal(vampire.kind, 'creature-type');
  assert.equal(vampire.canonicalLabel, 'Vampire typal');
  assert.equal(vampire.queryClause, 't:"Vampire"');
  assert.equal(vampire.minimumMainMatches, 20);

  const elf = await resolveNeutralThemeIntentV15('Elves commander deck', { creatureTypes: ['Vampire', 'Elf'] });
  assert.equal(elf.kind, 'creature-type');
  assert.equal(elf.canonicalLabel, 'Elf typal');
});

test('creature-type source outage is verification-unavailable, not unsupported or verified absence', async () => {
  const unavailable = await resolveNeutralThemeIntentV15('Vampires', {
    creatureTypeProvider: async () => { throw new Error('HTTP 503 from creature-type catalog'); },
  });
  assert.equal(unavailable.kind, 'unresolved');
  assert.equal(unavailable.enforceability, 'verification-unavailable');
  assert.match(unavailable.explanation, /503/);
  const audit = auditNeutralThemeV15([], unavailable);
  assert.equal(audit.status, 'verification-unavailable');
  assert.equal(audit.satisfied, false);
});

test('catalog mismatch and raw query-like input fail closed instead of becoming Scryfall grammar', async () => {
  const injected = await resolveNeutralThemeIntentV15('Vampire) OR order:edhrec', { creatureTypes: ['Vampire'] });
  assert.equal(injected.kind, 'unsupported');
  assert.equal(injected.enforceability, 'unsupported');
  assert.equal(injected.queryClause, null);

  const vague = await resolveNeutralThemeIntentV15('dark gothic spooky vibes', { creatureTypes: ['Vampire'] });
  assert.equal(vague.kind, 'unsupported');
  assert.equal(vague.queryClause, null);
});

test('compound free-form themes fail closed instead of silently choosing one half', async () => {
  const compound = await resolveNeutralThemeIntentV15('Vampires and sacrifice', { creatureTypes: ['Vampire'] });
  assert.equal(compound.kind, 'unsupported');
  assert.match(compound.explanation, /compound/i);
});

test('explicit Oracle-text themes are bounded literal phrases and reject query grammar characters', async () => {
  const oracle = await resolveNeutralThemeIntentV15('oracle text: "draw a card"', { creatureTypes: [] });
  assert.equal(oracle.kind, 'oracle-text');
  assert.equal(oracle.queryClause, 'o:"draw a card"');

  const injected = await resolveNeutralThemeIntentV15('oracle text: "draw a card: order=edhrec"', { creatureTypes: [] });
  assert.equal(injected.kind, 'unsupported');
  assert.equal(injected.queryClause, null);
});

test('supported card-type themes use fixed type clauses', async () => {
  const artifacts = await resolveNeutralThemeIntentV15('Artifacts themed', { creatureTypes: [] });
  assert.equal(artifacts.kind, 'card-type');
  assert.equal(artifacts.queryClause, 't:artifact');
  assert.equal(artifacts.minimumMainMatches, 18);

  const lands = await resolveNeutralThemeIntentV15('lands', { creatureTypes: [] });
  assert.equal(lands.kind, 'unsupported');
  assert.match(lands.explanation, /land-plan/i);
});

test('Final Fantasy free-form theme delegates to exact physical-printing policy', async () => {
  const ff = await resolveNeutralThemeIntentV15('Final Fantasy cards', { creatureTypes: [] });
  assert.equal(ff.kind, 'printing-family');
  assert.equal(ff.enforceability, 'delegated-printing-policy');
  assert.equal(ff.printingFamily, 'Final Fantasy');
  assert.equal(ff.queryClause, null);
});

test('creature-type matcher checks exact subtype words and Changeling rules identity', async () => {
  const intent = await resolveNeutralThemeIntentV15('Vampires', { creatureTypes: ['Vampire'] });
  assert.equal(cardMatchesNeutralThemeV15(card('Vampire', { type_line: 'Creature — Vampire Knight' }), intent), true);
  assert.equal(cardMatchesNeutralThemeV15(card('Not Vampire', { type_line: 'Creature — Vampirefish' }), intent), false);
  assert.equal(cardMatchesNeutralThemeV15(card('Changeling', { type_line: 'Creature — Shapeshifter', keywords: ['Changeling'] }), intent), true);
});

test('mechanic and card-type matchers are independent of candidate ordering/popularity', async () => {
  const tokenIntent = await resolveNeutralThemeIntentV15('tokens', { creatureTypes: [] });
  assert.equal(cardMatchesNeutralThemeV15(card('Maker', { oracle_text: 'Create two 1/1 white Soldier creature tokens.' }), tokenIntent), true);
  assert.equal(cardMatchesNeutralThemeV15(card('Vanilla', { oracle_text: 'Vigilance' }), tokenIntent), false);

  const artifactIntent = await resolveNeutralThemeIntentV15('artifacts', { creatureTypes: [] });
  assert.equal(cardMatchesNeutralThemeV15(card('Rock', { type_line: 'Artifact' }), artifactIntent), true);
  assert.equal(cardMatchesNeutralThemeV15(card('Mage', { type_line: 'Creature — Human Wizard' }), artifactIntent), false);
});

test('theme audit counts main-deck quantities, excludes commander from density, and fails below minimum', async () => {
  const baseIntent = await resolveNeutralThemeIntentV15('oracle text: "draw a card"', { creatureTypes: [] });
  const intent: NeutralThemeIntentV15 = { ...baseIntent, minimumMainMatches: 3 };
  const draw = card('Draw', { oracle_text: 'Draw a card.' });
  const blank = card('Blank', { oracle_text: 'Vigilance' });
  const audit = auditNeutralThemeV15([
    { card: draw, quantity: 1, zone: 'commander' },
    { card: draw, quantity: 2, zone: 'main' },
    { card: blank, quantity: 2, zone: 'main' },
  ], intent);
  assert.equal(audit.status, 'under-minimum');
  assert.equal(audit.matchedMainCards, 2);
  assert.equal(audit.totalMainCards, 4);
  assert.equal(audit.mainCoverage, 0.5);

  const passed = auditNeutralThemeV15([
    { card: draw, quantity: 3, zone: 'main' },
    { card: blank, quantity: 1, zone: 'main' },
  ], intent);
  assert.equal(passed.status, 'satisfied');
  assert.equal(passed.satisfied, true);
});

test('printing-family audit succeeds only when the matching exact-printing policy independently passed', async () => {
  const intent = await resolveNeutralThemeIntentV15('Final Fantasy', { creatureTypes: [] });
  const entry = { card: card('FF Card'), quantity: 99, zone: 'main' as const };
  const pass = auditNeutralThemeV15([entry], intent, { printingPolicySatisfied: true, activePrintingFamily: 'Final Fantasy' });
  assert.equal(pass.status, 'satisfied');
  assert.equal(pass.mainCoverage, 1);

  const fail = auditNeutralThemeV15([entry], intent, { printingPolicySatisfied: false, activePrintingFamily: 'Final Fantasy' });
  assert.equal(fail.status, 'printing-policy-failed');
  assert.equal(fail.satisfied, false);
});
