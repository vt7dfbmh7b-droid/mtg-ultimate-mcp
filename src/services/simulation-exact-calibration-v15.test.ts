import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import { calculateExactAccessCurveV15 } from './exact-access-curve-v15.js';
import type { ExactFractionV15 } from './exact-statistics-v15.js';
import { simulateDeckConsistencyV04 } from './simulation-v04.js';
import {
  calibrateSimulationRateAgainstExactV15,
  DEFAULT_SIMULATION_CALIBRATION_FAILURE_BUDGET_V15,
} from './simulation-exact-calibration-v15.js';

let collector = 1;
function card(
  name: string,
  cmc: number,
  typeLine: string,
  oracleText = '',
  manaCost = '',
  colorIdentity: string[] = [],
  producedMana: string[] = [],
): ScryfallCard {
  return {
    id: `${name}-${collector}`,
    name,
    lang: 'en',
    mana_cost: manaCost,
    cmc,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: colorIdentity,
    keywords: [],
    legalities: { commander: 'legal' },
    ...(producedMana.length > 0 ? { produced_mana: producedMana } : {}),
    set: 'tst',
    set_name: 'Test',
    collector_number: String(collector++),
    rarity: 'common',
    prices: { usd: '1.00' },
    scryfall_uri: 'https://scryfall.com',
  };
}

const oracleCards = [
  card('Oracle Commander', 3, 'Legendary Creature — Wizard', '', '{3}', []),
  card('Island', 0, 'Basic Land — Island', '{T}: Add {U}.', '', ['U'], ['U']),
  card('Target', 20, 'Artifact'),
  card('Combo A', 20, 'Artifact'),
  card('Combo B', 20, 'Artifact'),
];

const oracleDeck = parseDecklist(`
// COMMANDER
1 Oracle Commander
// MAIN
96 Island
1 Target
1 Combo A
1 Combo B
`);

function exactTargetCurve() {
  return calculateExactAccessCurveV15({
    deckSize: 100,
    throughTurn: 4,
    naturalDrawContext: 'multiplayer',
    commandZoneCards: [{ name: 'Oracle Commander', roles: [] }],
    routes: [{ name: 'target', requirements: [{ role: 'target', minimum: 1 }] }],
    libraryCategories: [{ name: 'Target', count: 1, roles: ['target'] }],
  });
}

function exactTwoPieceCurve() {
  return calculateExactAccessCurveV15({
    deckSize: 100,
    throughTurn: 4,
    naturalDrawContext: 'multiplayer',
    commandZoneCards: [{ name: 'Oracle Commander', roles: [] }],
    routes: [{
      name: 'a+b',
      requirements: [
        { role: 'a', minimum: 1 },
        { role: 'b', minimum: 1 },
      ],
    }],
    libraryCategories: [
      { name: 'Combo A', count: 1, roles: ['a'] },
      { name: 'Combo B', count: 1, roles: ['b'] },
    ],
  });
}

function comboPercent(
  simulation: Record<string, unknown>,
  comboIndex: number,
  turn: number,
): number {
  const combos = simulation.combos as Array<{
    naturalAssemblyByTurn: Record<string, number>;
  }>;
  const percent = combos[comboIndex]?.naturalAssemblyByTurn[`turn${turn}`];
  if (typeof percent !== 'number') throw new Error(`Missing simulated combo percentage for combo ${comboIndex}, turn ${turn}.`);
  return percent;
}

test('existing V0.4 natural-draw simulation stays inside exact singleton and two-piece probability bands', () => {
  const iterations = 12_000;
  const simulation = simulateDeckConsistencyV04(oracleDeck, oracleCards, {
    iterations,
    turns: 4,
    seed: 20_260_817,
    maxMulligans: 0,
    opponents: 3,
    comboPieces: [
      ['Target'],
      ['Combo A', 'Combo B'],
    ],
  });

  const targetCurve = exactTargetCurve();
  const twoPieceCurve = exactTwoPieceCurve();
  for (const turn of [1, 2, 4]) {
    const targetOracle = targetCurve.checkpoints[turn]!.probability;
    const targetCalibration = calibrateSimulationRateAgainstExactV15({
      exactProbability: targetOracle,
      observedProbability: comboPercent(simulation, 0, turn) / 100,
      sampleCount: iterations,
      reportingResolution: 0.001,
    });
    assert.equal(targetCalibration.passed, true, `singleton turn ${turn}: ${JSON.stringify(targetCalibration)}`);

    const twoPieceOracle = twoPieceCurve.checkpoints[turn]!.probability;
    const twoPieceCalibration = calibrateSimulationRateAgainstExactV15({
      exactProbability: twoPieceOracle,
      observedProbability: comboPercent(simulation, 1, turn) / 100,
      sampleCount: iterations,
      reportingResolution: 0.001,
    });
    assert.equal(twoPieceCalibration.passed, true, `two-piece turn ${turn}: ${JSON.stringify(twoPieceCalibration)}`);
  }
});

test('calibration is deterministic and recomputes the exact fraction instead of trusting its display decimal', () => {
  const exact: ExactFractionV15 = { numerator: '1', denominator: '10', decimal: 0.999 };
  const first = calibrateSimulationRateAgainstExactV15({
    exactProbability: exact,
    observedProbability: 0.101,
    sampleCount: 10_000,
  });
  const second = calibrateSimulationRateAgainstExactV15({
    exactProbability: exact,
    observedProbability: 0.101,
    sampleCount: 10_000,
  });

  assert.deepEqual(first, second);
  assert.equal(first.exactDecimal, 0.1);
  assert.equal(first.exactProbability.decimal, 0.1);
  assert.equal(first.failureBudget, DEFAULT_SIMULATION_CALIBRATION_FAILURE_BUDGET_V15);
  assert.equal(first.passed, true);
});

test('Bernstein statistical tolerance shrinks as the Monte Carlo sample grows', () => {
  const exact: ExactFractionV15 = { numerator: '1', denominator: '2', decimal: 0.5 };
  const small = calibrateSimulationRateAgainstExactV15({
    exactProbability: exact,
    observedProbability: 0.5,
    sampleCount: 1_000,
  });
  const large = calibrateSimulationRateAgainstExactV15({
    exactProbability: exact,
    observedProbability: 0.5,
    sampleCount: 100_000,
  });

  assert.ok(large.statisticalHalfWidth < small.statisticalHalfWidth);
  assert.ok(large.statisticalHalfWidth < small.statisticalHalfWidth / 2);
});

test('rare exact events get a probability-aware band rather than a fixed percentage margin', () => {
  const rare = calibrateSimulationRateAgainstExactV15({
    exactProbability: { numerator: '1', denominator: '1000', decimal: 0.001 },
    observedProbability: 0.0012,
    sampleCount: 20_000,
  });
  const middle = calibrateSimulationRateAgainstExactV15({
    exactProbability: { numerator: '1', denominator: '2', decimal: 0.5 },
    observedProbability: 0.5002,
    sampleCount: 20_000,
  });

  assert.equal(rare.passed, true);
  assert.equal(middle.passed, true);
  assert.ok(rare.bernoulliVariance < middle.bernoulliVariance);
  assert.ok(rare.statisticalHalfWidth < middle.statisticalHalfWidth);
});

test('a materially biased Monte Carlo result is rejected', () => {
  const calibration = calibrateSimulationRateAgainstExactV15({
    exactProbability: { numerator: '1', denominator: '10', decimal: 0.1 },
    observedProbability: 0.2,
    sampleCount: 10_000,
  });

  assert.equal(calibration.passed, false);
  assert.ok(calibration.absoluteError > calibration.acceptedHalfWidth);
});

test('p=0 and p=1 are deterministic boundaries, with only declared reporting quantization allowed', () => {
  const zero = calibrateSimulationRateAgainstExactV15({
    exactProbability: { numerator: '0', denominator: '1', decimal: 0 },
    observedProbability: 0,
    sampleCount: 100,
  });
  const one = calibrateSimulationRateAgainstExactV15({
    exactProbability: { numerator: '1', denominator: '1', decimal: 1 },
    observedProbability: 1,
    sampleCount: 100,
  });
  const impossibleLeak = calibrateSimulationRateAgainstExactV15({
    exactProbability: { numerator: '0', denominator: '1', decimal: 0 },
    observedProbability: 0.01,
    sampleCount: 100,
  });

  assert.equal(zero.statisticalHalfWidth, 0);
  assert.equal(one.statisticalHalfWidth, 0);
  assert.equal(zero.passed, true);
  assert.equal(one.passed, true);
  assert.equal(impossibleLeak.passed, false);
});

test('known simulator percentage rounding is accounted for explicitly and only by half its resolution', () => {
  const calibration = calibrateSimulationRateAgainstExactV15({
    exactProbability: { numerator: '1', denominator: '10', decimal: 0.1 },
    observedProbability: 0.1005,
    sampleCount: 1_000_000,
    reportingResolution: 0.001,
  });

  assert.equal(calibration.reportingHalfWidth, 0.0005);
  assert.equal(calibration.passed, true);
});

test('malformed calibration requests fail closed', () => {
  assert.throws(
    () => calibrateSimulationRateAgainstExactV15({
      exactProbability: { numerator: '2', denominator: '1', decimal: 2 },
      observedProbability: 0.5,
      sampleCount: 100,
    }),
    /between zero and one/,
  );
  assert.throws(
    () => calibrateSimulationRateAgainstExactV15({
      exactProbability: { numerator: '1', denominator: '0', decimal: 0 },
      observedProbability: 0.5,
      sampleCount: 100,
    }),
    /denominator cannot be zero/,
  );
  assert.throws(
    () => calibrateSimulationRateAgainstExactV15({
      exactProbability: { numerator: '1', denominator: '2', decimal: 0.5 },
      observedProbability: 1.1,
      sampleCount: 100,
    }),
    /observedProbability must be at most 1/,
  );
  assert.throws(
    () => calibrateSimulationRateAgainstExactV15({
      exactProbability: { numerator: '1', denominator: '2', decimal: 0.5 },
      observedProbability: 0.5,
      sampleCount: 0,
    }),
    /sampleCount must be at least 1/,
  );
  assert.throws(
    () => calibrateSimulationRateAgainstExactV15({
      exactProbability: { numerator: '1', denominator: '2', decimal: 0.5 },
      observedProbability: 0.5,
      sampleCount: 100,
      failureBudget: 0.6,
    }),
    /failureBudget must be at most 0.5/,
  );
});
