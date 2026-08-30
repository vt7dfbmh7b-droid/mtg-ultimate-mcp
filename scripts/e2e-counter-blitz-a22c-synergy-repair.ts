import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { comboAccessQualityV15 } from '../src/services/combo-access-quality-v15.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06, type PodPressureV06 } from '../src/services/simulation-v06.js';
import { BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15, BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15, minimumPersistentColoredManaSourcesV15 } from '../src/services/upgrade.js';

const A21 = 'test-results/exploratory/counter-blitz-a21-final-deck.txt';
const A22C = 'test-results/exploratory/counter-blitz-a22c-synergy-repair-deck.txt';
const SWAPS = [
  ['Sram, Senior Edificer', 'The Destined White Mage'],
  ['Puresteel Paladin', "Tromell, Seymour's Butler"],
  ['Lunatic Pandora', 'Rikku, Resourceful Guardian'],
  ['Champions from Beyond', "Dovin's Veto"],
] as const;
const LEGACY_COMBOS = [
  ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista'],
  ['Gatta and Luzzu', 'The Earth Crystal', 'Walking Ballista'],
] as const;
const ALL_COMBOS = [
  ['The Destined White Mage', 'Walking Ballista'],
  ...LEGACY_COMBOS,
] as const;
const PIECES = ['The Destined White Mage', 'Walking Ballista', 'Gatta and Luzzu', 'Hardened Scales', 'The Earth Crystal'] as const;
const SCENARIOS: Array<{ pressure: PodPressureV06; turns: number; seed: number }> = [
  { pressure: 'upgraded', turns: 5, seed: 20260830 },
  { pressure: 'upgraded', turns: 7, seed: 20260905 },
  { pressure: 'optimized', turns: 5, seed: 20260919 },
  { pressure: 'optimized', turns: 7, seed: 20261011 },
  { pressure: 'cedh', turns: 5, seed: 20261107 },
  { pressure: 'cedh', turns: 7, seed: 20261213 },
  { pressure: 'cedh', turns: 9, seed: 20270123 },
];

const norm = (v: string) => v.trim().toLocaleLowerCase();
const rec = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : 0;
const avg = (v: readonly number[]) => v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;

function ids(parsed: ParsedDeck): CardIdentifierInput[] {
  return [...parsed.commanders, ...parsed.main].map((e) => ({ name: e.name, ...(e.set ? { set: e.set } : {}), ...(e.collectorNumber ? { collectorNumber: e.collectorNumber } : {}) }));
}
async function resolve(text: string) {
  const parsed = parseDecklist(text);
  const result = await getCardsByIdentifiers(ids(parsed));
  return { parsed, cards: result.cards, notFound: result.notFound };
}
function identity(parsed: ParsedDeck, cards: readonly ScryfallCard[]): string[] {
  const names = new Set(parsed.commanders.map((e) => norm(e.name)));
  return [...new Set(cards.filter((c) => names.has(norm(c.name))).flatMap((c) => c.color_identity))].sort();
}
function structural(metrics: ReturnType<typeof buildDeckMetrics>, colors: number): string[] {
  const f: string[] = [];
  if (metrics.averageNonlandManaValue > BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15) f.push('average-nonland-mv');
  if (metrics.earlyPlayCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.earlyPlays) f.push('early-plays');
  if (metrics.cheapInteractionCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.cheapInteraction) f.push('cheap-interaction');
  if (metrics.fastManaCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.fastMana) f.push('fast-mana');
  if (Number(metrics.roleCounts['free interaction'] ?? 0) < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.freeInteraction) f.push('free-interaction');
  if (metrics.persistentColoredManaSourceCount < minimumPersistentColoredManaSourcesV15(colors)) f.push('persistent-colored-mana');
  return f;
}
interface Signal { keep: number; uptime: number; protection: number; spells: number; draws: number; route1: number; route2: number; }
function signal(result: Record<string, unknown>, turns: number): Signal {
  const b = rec(result.baseline), a = rec(result.advanced), combos = Array.isArray(a.combos) ? a.combos.map(rec) : [], key = `turn${turns}`;
  const ready = combos.map((c) => num(rec(c.allNamedPiecesInHandOrBattlefieldByTurn)[key]));
  return {
    keep: num(rec(b.openingHands).functionalKeepRate),
    uptime: num(rec(a.commanderPressure).battlefieldUptimePercent),
    protection: num(rec(a.interactionPressure).protectionWinRateWhenChallenged),
    spells: num(rec(a.cardFlow).averageSpellsCast),
    draws: num(rec(a.cardFlow).averageCardsDrawnByEffects),
    route1: ready[0] ?? 0,
    route2: ready[1] ?? 0,
  };
}
function delta(b: Signal, a: Signal): Signal { return { keep:a.keep-b.keep, uptime:a.uptime-b.uptime, protection:a.protection-b.protection, spells:a.spells-b.spells, draws:a.draws-b.draws, route1:a.route1-b.route1, route2:a.route2-b.route2 }; }
function mean(rows: readonly Signal[]): Signal { return { keep:avg(rows.map(r=>r.keep)), uptime:avg(rows.map(r=>r.uptime)), protection:avg(rows.map(r=>r.protection)), spells:avg(rows.map(r=>r.spells)), draws:avg(rows.map(r=>r.draws)), route1:avg(rows.map(r=>r.route1)), route2:avg(rows.map(r=>r.route2)) }; }
function sim(parsed: ParsedDeck, cards: ScryfallCard[], s: { pressure: PodPressureV06; turns:number; seed:number }, combos: readonly (readonly string[])[]): Record<string, unknown> {
  return simulateDeckGameplayV06(parsed, cards, { iterations: 1400, advancedIterations: 1400, turns:s.turns, seed:s.seed, pressure:s.pressure, comboPieces:combos }) as unknown as Record<string, unknown>;
}

async function main(): Promise<void> {
  console.log('COUNTER BLITZ A22C SYNERGY REPAIR');
  const [baseText, nextText] = await Promise.all([readFile(A21,'utf8'), readFile(A22C,'utf8')]);
  const [base,next] = await Promise.all([resolve(baseText),resolve(nextText)]);
  const policy = await resolvePrintingPolicyV08({ printingFamily:'Final Fantasy', includePromos:true, includeSpecialReleases:true });
  const failures:string[] = [];
  for (const [label,state] of [['A21',base],['A22c',next]] as const) {
    if (state.notFound.length) failures.push(`${label}: unresolved`);
    if (state.parsed.totalCards !== 100) failures.push(`${label}: not exact 100`);
    if (!validateCommanderDeck(state.parsed,state.cards).isLegal) failures.push(`${label}: illegal`);
    if (!state.cards.every(c=>printingMatchesPolicyV08(c,policy))) failures.push(`${label}: FF policy`);
  }
  const before = new Set(base.parsed.main.map(e=>norm(e.name))), after = new Set(next.parsed.main.map(e=>norm(e.name)));
  for (const [cut,add] of SWAPS) {
    if (!before.has(norm(cut)) || after.has(norm(cut))) failures.push(`bad cut ${cut}`);
    if (before.has(norm(add)) || !after.has(norm(add))) failures.push(`bad add ${add}`);
  }
  const m0 = buildDeckMetrics(base.parsed,base.cards), m1 = buildDeckMetrics(next.parsed,next.cards);
  failures.push(...structural(m1,identity(next.parsed,next.cards).length).map(f=>`structural:${f}`));
  if (m1.rampCount < m0.rampCount) failures.push('ramp regression');
  if (m1.persistentColoredManaSourceCount < m0.persistentColoredManaSourceCount) failures.push('colored mana regression');

  const pieces = PIECES.map(n=>next.cards.find(c=>norm(c.name)===norm(n))).filter((c): c is ScryfallCard=>Boolean(c));
  assert.equal(pieces.length,PIECES.length);
  const comboAccess = comboAccessQualityV15(next.cards,pieces);
  const deltas:Signal[]=[]; const scenarios:Array<Record<string,unknown>>=[]; const whiteMage:Array<Record<string,unknown>>=[];
  for (const s of SCENARIOS) {
    const b=signal(sim(base.parsed,base.cards,s,LEGACY_COMBOS),s.turns), a=signal(sim(next.parsed,next.cards,s,LEGACY_COMBOS),s.turns), d=delta(b,a);
    deltas.push(d); scenarios.push({...s,before:b,after:a,delta:d});
    const all=rec(sim(next.parsed,next.cards,s,ALL_COMBOS).advanced), cs=Array.isArray(all.combos)?all.combos.map(rec):[], w=cs[0]??{}, key=`turn${s.turns}`;
    whiteMage.push({...s,ready:num(rec(w.allNamedPiecesInHandOrBattlefieldByTurn)[key]),seen:num(rec(w.allNamedPiecesSeenByTurn)[key])});
  }
  const d=mean(deltas);
  if (d.keep < -2.5) failures.push('sim:keep');
  if (d.uptime < -4) failures.push('sim:uptime');
  if (d.protection < -8) failures.push('sim:protection');
  if (d.spells < -0.25) failures.push('sim:spells');
  if (d.draws < -0.45) failures.push('sim:draws');
  if (d.route1 < -3.5 || d.route2 < -3.5) failures.push('sim:legacy-combo');

  const report={status:failures.length?'REVIEW':'PASS',swaps:SWAPS.map(([cut,add])=>({cut,add})),failures,metrics:{a21:{mv:m0.averageNonlandManaValue,early:m0.earlyPlayCount,ramp:m0.rampCount,cheapInteraction:m0.cheapInteractionCount,colored:m0.persistentColoredManaSourceCount},a22c:{mv:m1.averageNonlandManaValue,early:m1.earlyPlayCount,ramp:m1.rampCount,cheapInteraction:m1.cheapInteractionCount,colored:m1.persistentColoredManaSourceCount}},comboAccess,meanDelta:d,scenarios,whiteMageRoute:whiteMage,boundary:'Simulation is a regression guard; manual Tidus/counter synergy audit remains required.'};
  await writeFile('counter-blitz-a22c-synergy-repair.json',JSON.stringify(report,null,2));
  const md=[
    '# Counter Blitz A22c — Synergy Repair','',...SWAPS.map(([cut,add])=>`- ${cut} -> ${add}`),'',
    `- Result: **${report.status}**`,`- Failures: ${failures.length?failures.join('; '):'none'}`,
    `- Average nonland MV: ${m0.averageNonlandManaValue.toFixed(3)} -> ${m1.averageNonlandManaValue.toFixed(3)}`,
    `- Early plays: ${m0.earlyPlayCount} -> ${m1.earlyPlayCount}`,
    `- Ramp: ${m0.rampCount} -> ${m1.rampCount}`,
    `- Cheap interaction metric: ${m0.cheapInteractionCount} -> ${m1.cheapInteractionCount}`,
    `- Persistent colored mana: ${m0.persistentColoredManaSourceCount} -> ${m1.persistentColoredManaSourceCount}`,
    `- Combo access score: ${comboAccess.weightedScore}`,
    `- Mean Δ spells: ${d.spells.toFixed(3)}`,
    `- Mean Δ draws: ${d.draws.toFixed(3)}`,
    `- Mean Δ commander uptime: ${d.uptime.toFixed(3)}`,
    `- Mean Δ protection: ${d.protection.toFixed(3)}`,'',
    'A21 cheap-interaction count included Lunatic Pandora despite its removal activation costing six mana. A22c replaces that false cheap-interaction slot with an actual two-mana Dovin\'s Veto while also adding White Mage, Tromell and Rikku.',''
  ].join('\n');
  await writeFile('counter-blitz-a22c-synergy-repair.md',md); console.log(md);
  if (failures.length) process.exitCode=1;
}
await main();
