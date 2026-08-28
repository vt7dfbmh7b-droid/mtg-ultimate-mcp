import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { discoverEligiblePoolV15 } from '../src/services/neutral-deck-builder-v15.js';
import { resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, getCardOracleText, type CardIdentifierInput } from '../src/services/scryfall.js';

const PIECES = ['Walking Ballista', 'Gatta and Luzzu', 'Hardened Scales', 'The Earth Crystal'];
function norm(v: string): string { return v.trim().toLocaleLowerCase(); }
function extractA2(markdown: string): string {
  const m = markdown.match(/## Final corrected decklist[\s\S]*?```text\n([\s\S]*?)\n```/);
  assert.ok(m?.[1], 'could not extract A2 deck');
  return m[1].trim().replace('1 Archmage Emeritus (FIC) 261', '1 The Earth Crystal (FIN) 184');
}
function ids(parsed: ParsedDeck): CardIdentifierInput[] { return [...parsed.commanders, ...parsed.main].map((e) => ({ name: e.name, ...(e.set ? { set: e.set } : {}), ...(e.collectorNumber ? { collectorNumber: e.collectorNumber } : {}) })); }
async function resolveDeck(decklist: string) { const parsed = parseDecklist(decklist); const r = await getCardsByIdentifiers(ids(parsed)); return { parsed, cards: r.cards, notFound: r.notFound }; }
function typeHas(card: ScryfallCard, token: string): boolean { return card.type_line.toLocaleLowerCase().includes(token); }
function selectionMatches(text: string, piece: ScryfallCard): { matched: boolean; depth: number | null; reason: string } {
  const t = text.toLocaleLowerCase();
  const numberWord: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const match = t.match(/(?:look at|reveal) the top (one|two|three|four|five|six|seven|eight|nine|ten|\d+) cards?/);
  if (!match) return { matched: false, depth: null, reason: 'no bounded top-of-library selection clause' };
  const depth = /^\d+$/.test(match[1]!) ? Number(match[1]) : numberWord[match[1]!] ?? null;
  if (!depth) return { matched: false, depth: null, reason: 'selection depth unresolved' };
  if (!/(?:put|choose|reveal)[^.]{0,180}(?:into your hand|put it into your hand|put that card into your hand)/.test(t)) return { matched: false, depth, reason: 'does not move selected card to hand' };
  const restrictions: Array<[RegExp, string]> = [
    [/artifact, creature, or land card|artifact, creature, and\/or land card/, 'artifact-creature-land'],
    [/legendary creature card/, 'legendary-creature'],
    [/creature card/, 'creature'],
    [/artifact card/, 'artifact'],
    [/enchantment card/, 'enchantment'],
    [/land card/, 'land'],
  ];
  const restriction = restrictions.find(([r]) => r.test(t))?.[1] ?? 'unrestricted';
  const legendary = typeHas(piece, 'legendary');
  const allowed = restriction === 'unrestricted'
    || (restriction === 'artifact-creature-land' && (typeHas(piece, 'artifact') || typeHas(piece, 'creature') || typeHas(piece, 'land')))
    || (restriction === 'legendary-creature' && legendary && typeHas(piece, 'creature'))
    || (restriction === 'creature' && typeHas(piece, 'creature'))
    || (restriction === 'artifact' && typeHas(piece, 'artifact'))
    || (restriction === 'enchantment' && typeHas(piece, 'enchantment'))
    || (restriction === 'land' && typeHas(piece, 'land'));
  return { matched: allowed, depth, reason: allowed ? restriction : `fails ${restriction}` };
}

const source = await readFile('test-results/exploratory/counter-blitz-ff-tidus-2026-08-29.md', 'utf8');
const base = await resolveDeck(extractA2(source)); assert.equal(base.notFound.length, 0);
const commander = base.cards.find((c) => norm(c.name) === norm("Tidus, Yuna's Guardian")); assert.ok(commander);
const policy = await resolvePrintingPolicyV08({ printingFamily: 'Final Fantasy', includePromos: true, includeSpecialReleases: true });
const pool = await discoverEligiblePoolV15([...new Set(commander.color_identity)].sort(), policy, undefined);
const pieceCards = PIECES.map((name) => base.cards.find((c) => norm(c.name) === norm(name))).filter((c): c is ScryfallCard => Boolean(c));
assert.equal(pieceCards.length, PIECES.length);
const current = new Set(base.cards.map((c) => norm(c.name)));

const candidates = pool.map((card) => {
  const text = getCardOracleText(card).replace(/\s+/g, ' ').trim();
  const access = pieceCards.map((piece) => ({ piece: piece.name, ...selectionMatches(text, piece) }));
  const hits = access.filter((x) => x.matched);
  return { name: card.name, set: card.set.toUpperCase(), collectorNumber: card.collector_number, manaValue: card.cmc, typeLine: card.type_line, current: current.has(norm(card.name)), hitCount: hits.length, maxDepth: Math.max(0, ...hits.map((x) => x.depth ?? 0)), hits: hits.map((x) => x.piece), access, oracleText: text };
}).filter((x) => x.hitCount > 0).sort((a, b) => Number(b.current) - Number(a.current) || b.hitCount - a.hitCount || b.maxDepth - a.maxDepth || a.manaValue - b.manaValue || a.name.localeCompare(b.name));

const missing = candidates.filter((x) => !x.current);
const result = { schema: 'counter-blitz-a15-combo-selection-v1', pieces: PIECES, candidates, missingCandidates: missing, note: 'Bounded top-of-library selection only. This is not deterministic tutoring and does not imply a card is automatically worth a slot.' };
await writeFile('counter-blitz-a15-selection.json', `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ current: candidates.filter((x) => x.current).map((x) => ({ name: x.name, hits: x.hits, depth: x.maxDepth, mv: x.manaValue })), missing: missing.slice(0, 30).map((x) => ({ name: x.name, set: x.set, collectorNumber: x.collectorNumber, hits: x.hits, depth: x.maxDepth, mv: x.manaValue, oracleText: x.oracleText })) }, null, 2));
