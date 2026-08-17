import { createHash } from 'node:crypto';
import type { CombatBoardV07 } from './combat-v07.js';
import type { ExternalBenchmarkJsonV15 } from './external-oracles-v15.js';

function canonicalize(value: ExternalBenchmarkJsonV15): ExternalBenchmarkJsonV15 {
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry));
  if (typeof value !== 'object' || value === null) return value;
  const output: Record<string, ExternalBenchmarkJsonV15> = {};
  for (const key of Object.keys(value).sort()) output[key] = canonicalize(value[key] ?? null);
  return output;
}

/**
 * Stable input/result fingerprint for benchmark fixtures. Object key ordering is
 * intentionally ignored; array ordering remains meaningful.
 */
export function fingerprintExternalBenchmarkJsonV15(value: ExternalBenchmarkJsonV15): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

/**
 * Normalize V0.7 combat-board evaluation into a small semantic surface suitable
 * for differential testing. Explanatory notes, raw modifier sentences, and other
 * implementation-specific prose are intentionally excluded.
 */
export function normalizeCombatBoardForExternalOracleV15(board: CombatBoardV07): ExternalBenchmarkJsonV15 {
  const commanderPower = Object.fromEntries(
    Object.entries(board.commanderPower)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, power]) => [name, power]),
  ) as Record<string, number | null>;

  const creatures = board.creatures
    .map((creature, originalIndex) => ({
      originalIndex,
      name: creature.name,
      effectivePower: creature.effectivePower,
      effectiveToughness: creature.effectiveToughness,
      keywords: [...new Set(creature.keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean))].sort(),
      commander: creature.commander,
      unresolved: [...new Set(creature.unresolved.map((reason) => reason.trim()).filter(Boolean))].sort(),
    }))
    .sort((left, right) => left.name.localeCompare(right.name) || left.originalIndex - right.originalIndex)
    .map(({ originalIndex: _originalIndex, ...creature }) => creature);

  return canonicalize({
    totalEffectivePower: board.totalEffectivePower,
    commanderPower,
    creatures,
  });
}
