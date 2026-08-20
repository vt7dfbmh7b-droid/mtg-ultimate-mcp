import type { ExactFractionV15 } from './exact-statistics-v15.js';

export const DEFAULT_SIMULATION_CALIBRATION_FAILURE_BUDGET_V15 = 1e-6;
export const MAX_SIMULATION_CALIBRATION_SAMPLES_V15 = 10_000_000;

export interface ExactSimulationCalibrationV15 {
  exactProbability: ExactFractionV15;
  exactDecimal: number;
  observedProbability: number;
  sampleCount: number;
  failureBudget: number;
  reportingResolution: number;
  reportingHalfWidth: number;
  bernoulliVariance: number;
  statisticalHalfWidth: number;
  acceptedHalfWidth: number;
  absoluteError: number;
  lowerAccepted: number;
  upperAccepted: number;
  standardizedError: number | null;
  passed: boolean;
  method: 'bernstein-bernoulli-exact-oracle-v15';
  note: string;
}

function requireFinite(name: string, value: number, minimum: number, maximum?: number): number {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite.`);
  if (value < minimum) throw new Error(`${name} must be at least ${minimum}.`);
  if (maximum !== undefined && value > maximum) throw new Error(`${name} must be at most ${maximum}.`);
  return value;
}

function requireInteger(name: string, value: number, minimum: number, maximum?: number): number {
  requireFinite(name, value, minimum, maximum);
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer.`);
  return value;
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function normalizeExactFraction(value: ExactFractionV15): { numerator: bigint; denominator: bigint; decimal: number } {
  if (!value || typeof value !== 'object') throw new Error('exactProbability must be an exact fraction object.');
  let numerator: bigint;
  let denominator: bigint;
  try {
    numerator = BigInt(value.numerator);
    denominator = BigInt(value.denominator);
  } catch {
    throw new Error('exactProbability numerator and denominator must be valid integers.');
  }
  if (denominator === 0n) throw new Error('exactProbability denominator cannot be zero.');
  if (denominator < 0n) {
    numerator = -numerator;
    denominator = -denominator;
  }
  if (numerator < 0n || numerator > denominator) {
    throw new Error('exactProbability must lie between zero and one inclusive.');
  }
  const divisor = gcd(numerator, denominator);
  numerator /= divisor;
  denominator /= divisor;
  const decimal = Number(numerator) / Number(denominator);
  if (!Number.isFinite(decimal)) throw new Error('exactProbability decimal presentation exceeded the supported finite range.');
  return { numerator, denominator, decimal };
}

/**
 * A finite-sample Bernstein concentration half-width for an independent
 * Bernoulli sample mean when the true probability p is known from the exact
 * oracle. For 0 < p < 1, the two-sided failure probability is bounded by alpha:
 *
 *   P(|p_hat - p| > epsilon) <= 2 exp(-n epsilon^2 / (2 p(1-p) + 2 epsilon / 3))
 *
 * We solve the quadratic equality for epsilon. At p=0 or p=1 the Bernoulli
 * outcome is deterministic, so the statistical half-width is exactly zero.
 */
function bernsteinHalfWidth(probability: number, sampleCount: number, failureBudget: number): number {
  if (probability === 0 || probability === 1) return 0;
  const variance = probability * (1 - probability);
  const logTerm = Math.log(2 / failureBudget);
  const linear = (2 * logTerm) / 3;
  const discriminant = linear * linear + 8 * sampleCount * logTerm * variance;
  return (linear + Math.sqrt(discriminant)) / (2 * sampleCount);
}

/**
 * Compare a Monte Carlo Bernoulli rate with an exact probability oracle.
 *
 * `reportingResolution` represents deterministic output quantization in
 * probability units. For example, a simulator rounded to 0.1 percentage point
 * has resolution 0.001 and therefore contributes at most 0.0005 extra error.
 *
 * The calibration intentionally does not use an arbitrary fixed percentage
 * tolerance. Its statistical component shrinks with sample count and adapts to
 * the exact Bernoulli variance; the explicit reporting component only accounts
 * for known presentation rounding.
 */
export function calibrateSimulationRateAgainstExactV15(input: {
  exactProbability: ExactFractionV15;
  observedProbability: number;
  sampleCount: number;
  failureBudget?: number;
  reportingResolution?: number;
}): ExactSimulationCalibrationV15 {
  const exact = normalizeExactFraction(input.exactProbability);
  const observedProbability = requireFinite('observedProbability', input.observedProbability, 0, 1);
  const sampleCount = requireInteger('sampleCount', input.sampleCount, 1, MAX_SIMULATION_CALIBRATION_SAMPLES_V15);
  const failureBudget = requireFinite(
    'failureBudget',
    input.failureBudget ?? DEFAULT_SIMULATION_CALIBRATION_FAILURE_BUDGET_V15,
    Number.MIN_VALUE,
    0.5,
  );
  const reportingResolution = requireFinite('reportingResolution', input.reportingResolution ?? 0, 0, 1);
  const reportingHalfWidth = reportingResolution / 2;
  const bernoulliVariance = exact.decimal * (1 - exact.decimal);
  const statisticalHalfWidth = bernsteinHalfWidth(exact.decimal, sampleCount, failureBudget);
  const acceptedHalfWidth = statisticalHalfWidth + reportingHalfWidth;
  const absoluteError = Math.abs(observedProbability - exact.decimal);
  const lowerAccepted = Math.max(0, exact.decimal - acceptedHalfWidth);
  const upperAccepted = Math.min(1, exact.decimal + acceptedHalfWidth);
  const standardError = Math.sqrt(bernoulliVariance / sampleCount);
  const standardizedError = standardError > 0 ? absoluteError / standardError : null;

  return {
    exactProbability: {
      numerator: exact.numerator.toString(),
      denominator: exact.denominator.toString(),
      decimal: exact.decimal,
    },
    exactDecimal: exact.decimal,
    observedProbability,
    sampleCount,
    failureBudget,
    reportingResolution,
    reportingHalfWidth,
    bernoulliVariance,
    statisticalHalfWidth,
    acceptedHalfWidth,
    absoluteError,
    lowerAccepted,
    upperAccepted,
    standardizedError,
    passed: absoluteError <= acceptedHalfWidth + Number.EPSILON,
    method: 'bernstein-bernoulli-exact-oracle-v15',
    note: 'Acceptance uses a finite-sample two-sided Bernstein bound for the Bernoulli sample mean plus only the explicitly declared reporting quantization allowance.',
  };
}
