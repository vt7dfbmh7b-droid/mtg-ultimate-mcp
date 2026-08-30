import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06, type PodPressureV06 } from '../src/services/simulation-v06.js';
import { BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15, BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15, minimumPersistentColoredManaSourcesV15 } from '../src/services/upgrade.js';

const BASE = 'test-results/exploratory/counter-blitz-a22d-synergy-repair-deck.txt';
const ROUTES = [
  ['The Destined White Mage', 'Walking Ballista'],
  ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista'],
  ['Gatta and Luzzu', 'The Earth Crystal', 'Walking Ballista'],
] as const;

const CANDIDATES = [
  {
    key: 'yuna',
    add: 'Yuna, Grand Summoner',
    line: '1 Yuna, Grand Summoner (FIC) 8',
    cuts: ['Staff of the Storyteller', 'Tome of Legends', "Smuggler's Copter"],
    rationale: 'counter seeding + mana + counter preservation',
  },
  {
    key: 'defense',
    add: 'Resourceful Defense',
    line: '1 Resourceful Defense (FIC) 251',
    cuts: ['Tome of Legends', 'Staff of the Storyteller', 'Buster Sword'],
    rationale: 'counter preservation + counter movement',
  },
  {
    key: 'apparition',
    add: 'Grateful Apparition',
    line: '1 Grateful Apparition (FIC) 244',
    cuts: ["Smuggler's Copter", 'Mask of Memory', 'Tome of Legends'],
    rationale: 'evasive repeatable proliferate',
  },
  {
    key: 'ixion',
    add: 'Summon: Ixion',
    line: '1 Summon: Ixion (FIC) 27',
    cuts: ['Buster Sword', 'Campsite Cuisine', 'Collective Effort'],
    rationale: 'lore-counter bridge + removal + counter seeding + lifegain',
  },
] as const;

const SCENARIOS: Array<{ pressure: PodPressureV06; turns: number; seed: number }> = [
  { pressure: 'upgraded', turns: 5, seed: 20260831 },
  { pressure: 'upgraded', turns: 7, seed: 20260907 },
  { pressure: 'optimized', turns: 5, seed: 20260921 },
  { pressure: 'optimized', turns: 7, seed: 20261013 },
  { pressure: 'cedh', turns: 5, seed: 20261109 },
  { pressure: 'cedh', turns: 7, seed: 20261215 },
  { pressure: 'cedh', turns: 9, seed: 20270125 },
];

const norm = (v: string) => v.trim().toLocaleLowerCase();
const rec = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : 0;
const avg = (v: readonly number[]) => v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;

function ids(p: ParsedDeck): CardIdentifierInput[] {
  return [...p.commanders, ...p.main].map(e => ({
    name: e.name,
    ...(e.set ? { set: e.set } : {}),
    ...(e.collectorNumber ? { collectorNumber: e.collectorNumber } : {}),
  }));
}

function identity(p: ParsedDeck, cards: readonly ScryfallCard[]): string[] {
  const commanders = new Set(p.commanders.map(e => norm(e.name)));
  return [...new Set(cards.filter(c => commanders.has(norm(c.name))).flatMap(c => c.color_identity))].sort();
}

function replaceLine(text: string, cut: string, addLine: string): string {
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex(line => line.startsWith(`1 ${cut} (`));
  if (index < 0) throw new Error(`Cut not found in A22d: ${cut}`);
  lines[index] = addLine;
  return lines.join('\n');
}

interface Signal {
  keep: number;
  uptime: number;
  protection: number;
  spells: number;
  draws: number;
  white: number;
  gattaScales: number;
  gattaCrystal: number;
}

function signal(report: Record<string, unknown>, turns: number): Signal {
  const b = rec(report.baseline);
  const a = rec(report.advanced);
  const combos = Array.isArray(a.combos) ? a.combos.map(rec) : [];
  const key = `turn${turns}`;
  const ready = combos.map(c => num(rec(c.allNamedPiecesInHandOrBattlefieldByTurn)[key]));
  return {
    keep: num(rec(b.openingHands).functionalKeepRate),
    uptime: num(rec(a.commanderPressure).battlefieldUptimePercent),
    protection: num(rec(a.interactionPressure).protectionWinRateWhenChallenged),
    spells: num(rec(a.cardFlow).averageSpellsCast),
    draws: num(rec(a.cardFlow).averageCardsDrawnByEffects),
    white: ready[0] ?? 0,
    gattaScales: ready[1] ?? 0,
    gattaCrystal: ready[2] ?? 0,
  };
}

function delta(base: Signal, next: Signal): Signal {
  return {
    keep: next.keep - base.keep,
    uptime: next.uptime - base.uptime,
    protection: next.protection - base.protection,
    spells: next.spells - base.spells,
    draws: next.draws - base.draws,
    white: next.white - base.white,
    gattaScales: next.gattaScales - base.gattaScales,
    gattaCrystal: next.gattaCrystal - base.gattaCrystal,
  };
}

function mean(values: readonly Signal[]): Signal {
  const keys: Array<keyof Signal> = ['keep', 'uptime', 'protection', 'spells', 'draws', 'white', 'gattaScales', 'gattaCrystal'];
  return Object.fromEntries(keys.map(k => [k, avg(values.map(v => v[k]))])) as unknown as Signal;
}

function sim(parsed: ParsedDeck, cards: ScryfallCard[], scenario: { pressure: PodPressureV06; turns: number; seed: number }): Record<string, unknown> {
  return simulateDeckGameplayV06(parsed, cards, {
    iterations: 800,
    advancedIterations: 800,
    turns: scenario.turns,
    seed: scenario.seed,
    pressure: scenario.pressure,
    comboPieces: ROUTES,
  }) as unknown as Record<string, unknown>;
}

async function main(): Promise<void> {
  console.log('COUNTER BLITZ A23 STOCK-SYNERGY PRESSURE');
  const baseText = await readFile(BASE, 'utf8');
  const baseParsed = parseDecklist(baseText);
  const baseResolved = await getCardsByIdentifiers(ids(baseParsed));
  if (baseResolved.notFound.length) throw new Error(`A22d unresolved: ${JSON.stringify(baseResolved.notFound)}`);
  const baseCards = baseResolved.cards;
  const baseMetrics = buildDeckMetrics(baseParsed, baseCards);
  const colors = identity(baseParsed, baseCards).length;
  const policy = await resolvePrintingPolicyV08({ printingFamily: 'Final Fantasy', includePromos: true, includeSpecialReleases: true });

  const addIds: CardIdentifierInput[] = CANDIDATES.map(c => {
    const match = c.line.match(/^1 (.+) \(([^)]+)\) (.+)$/);
    if (!match) throw new Error(`Bad add line: ${c.line}`);
    return { name: c.add, set: match[2], collectorNumber: match[3] };
  });
  const addResolved = await getCardsByIdentifiers(addIds);
  if (addResolved.notFound.length) throw new Error(`Candidate additions unresolved: ${JSON.stringify(addResolved.notFound)}`);
  const addByName = new Map(addResolved.cards.map(c => [norm(c.name), c]));

  const baseSignals = new Map<string, Signal>();
  for (const s of SCENARIOS) {
    const key = `${s.pressure}-${s.turns}-${s.seed}`;
    baseSignals.set(key, signal(sim(baseParsed, baseCards, s), s.turns));
  }

  const results: Array<Record<string, unknown>> = [];
  for (const candidate of CANDIDATES) {
    const addCard = addByName.get(norm(candidate.add));
    if (!addCard) throw new Error(`Missing resolved addition: ${candidate.add}`);
    for (const cut of candidate.cuts) {
      const text = replaceLine(baseText, cut, candidate.line);
      const parsed = parseDecklist(text);
      const cards = baseCards.filter(c => norm(c.name) !== norm(cut)).concat(addCard);
      const failures: string[] = [];

      if (parsed.totalCards !== 100) failures.push('count');
      if (!validateCommanderDeck(parsed, cards).isLegal) failures.push('illegal');
      if (!cards.every(c => printingMatchesPolicyV08(c, policy))) failures.push('FF-policy');

      const metrics = buildDeckMetrics(parsed, cards);
      if (metrics.averageNonlandManaValue > BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15) failures.push('structural:mv');
      if (metrics.earlyPlayCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.earlyPlays) failures.push('structural:early');
      if (metrics.fastManaCount < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.fastMana) failures.push('structural:fast-mana');
      if (Number(metrics.roleCounts['free interaction'] ?? 0) < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.freeInteraction) failures.push('structural:free-interaction');
      if (metrics.persistentColoredManaSourceCount < minimumPersistentColoredManaSourcesV15(colors)) failures.push('structural:colored-mana');
      if (metrics.rampCount < baseMetrics.rampCount) failures.push('ramp-regression');
      const correctedCheapInteraction = metrics.cheapInteractionCount + (parsed.main.some(e => norm(e.name) === norm("Dovin's Veto")) ? 1 : 0);
      if (correctedCheapInteraction < BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.cheapInteraction) failures.push('structural:cheap-interaction');

      const deltas: Signal[] = [];
      const scenarioRows: Array<Record<string, unknown>> = [];
      for (const s of SCENARIOS) {
        const key = `${s.pressure}-${s.turns}-${s.seed}`;
        const b = baseSignals.get(key);
        if (!b) throw new Error(`Missing baseline signal ${key}`);
        const n = signal(sim(parsed, cards, s), s.turns);
        const d = delta(b, n);
        deltas.push(d);
        scenarioRows.push({ ...s, before: b, after: n, delta: d });
      }
      const d = mean(deltas);
      if (d.keep < -2.0) failures.push('sim:keep');
      if (d.uptime < -3.0) failures.push('sim:uptime');
      if (d.protection < -7.0) failures.push('sim:protection');
      if (d.spells < -0.18) failures.push('sim:spells');
      if (d.draws < -0.35) failures.push('sim:draws');
      if (d.white < -2.5 || d.gattaScales < -2.5 || d.gattaCrystal < -2.5) failures.push('sim:combo-route');

      results.push({
        candidate: candidate.add,
        cut,
        rationale: candidate.rationale,
        status: failures.length ? 'REVIEW' : 'PASS',
        failures,
        metrics: {
          mv: metrics.averageNonlandManaValue,
          early: metrics.earlyPlayCount,
          ramp: metrics.rampCount,
          correctedCheapInteraction,
          colored: metrics.persistentColoredManaSourceCount,
        },
        meanDelta: d,
        scenarios: scenarioRows,
      });
    }
  }

  const passes = results.filter(r => r.status === 'PASS');
  const report = {
    baseline: 'A22d accepted exploratory checkpoint',
    boundary: 'Simulation is a regression guard only; Tidus/counter/lore synergy remains a manual strategic judgment.',
    candidateCount: results.length,
    passCount: passes.length,
    results,
  };
  await writeFile('counter-blitz-a23-stock-synergy-pressure.json', JSON.stringify(report, null, 2));

  const lines = [
    '# Counter Blitz A23 — Stock Synergy Pressure',
    '',
    `- Variants tested: ${results.length}`,
    `- Variants passing regression guard: ${passes.length}`,
    '',
    '| Candidate | Cut | Result | Δ spells | Δ draws | Δ commander uptime | Δ protection |',
    '|---|---|---:|---:|---:|---:|---:|',
    ...results.map(r => {
      const d = r.meanDelta as Signal;
      return `| ${r.candidate} | ${r.cut} | ${r.status} | ${d.spells.toFixed(3)} | ${d.draws.toFixed(3)} | ${d.uptime.toFixed(3)} | ${d.protection.toFixed(3)} |`;
    }),
    '',
    'Boundary: passing means the swap did not violate the bounded regression guard. It is not automatic acceptance; manual Counter Blitz synergy review is required.',
    '',
  ];
  await writeFile('counter-blitz-a23-stock-synergy-pressure.md', lines.join('\n'));
  console.log(lines.join('\n'));
}

await main();
