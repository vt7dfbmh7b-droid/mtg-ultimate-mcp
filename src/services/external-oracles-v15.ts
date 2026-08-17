export type ExternalOracleIdV15 =
  | 'j4th-mtg-mcp'
  | 'nccurry-mtg-mcp'
  | 'forge'
  | 'manabrew';

export type ExternalBenchmarkDomainV15 =
  | 'card-data'
  | 'deck-workflows'
  | 'statistics'
  | 'rules'
  | 'simulation'
  | 'commander-analysis';

export interface ExternalOracleDefinitionV15 {
  id: ExternalOracleIdV15;
  repository: string;
  license: string;
  independenceGroup: string;
  domains: ExternalBenchmarkDomainV15[];
  defaultUseMode: 'behavioral-reference' | 'architecture-reference' | 'implementation-reference';
  strengths: string[];
  cautions: string[];
}

/**
 * External projects are test/reference oracles, never hidden sources of truth.
 * The independenceGroup field prevents related projects from being double-counted.
 * In particular, Manabrew explicitly treats Forge as its reference implementation.
 */
export const EXTERNAL_ORACLES_V15: ExternalOracleDefinitionV15[] = [
  {
    id: 'j4th-mtg-mcp',
    repository: 'j4th/mtg-mcp-server',
    license: 'MIT',
    independenceGroup: 'j4th-mtg-mcp',
    domains: ['card-data', 'deck-workflows', 'rules', 'commander-analysis'],
    defaultUseMode: 'implementation-reference',
    strengths: [
      'Broad MCP surface spanning cards, Commander workflows, deck analysis, combos, rules, and metagame integrations.',
      'Useful independent comparison target for tool schemas, deck workflows, and user-facing MTG behavior.',
    ],
    cautions: [
      'A matching recommendation is corroboration, not proof that either implementation is optimal.',
      'Any source reuse must preserve applicable license notices and attribution.',
    ],
  },
  {
    id: 'nccurry-mtg-mcp',
    repository: 'nccurry/mtg-mcp',
    license: 'AGPL-3.0-or-later',
    independenceGroup: 'nccurry-mtg-mcp',
    domains: ['card-data', 'deck-workflows', 'statistics', 'commander-analysis'],
    defaultUseMode: 'architecture-reference',
    strengths: [
      'Evidence-first architecture with explicit evidence classes and exact statistical calculations.',
      'Strong deterministic/offline testing, provider pacing, deck revision safety, and reproducibility patterns.',
    ],
    cautions: [
      'Use as a behavioral/architecture benchmark by default rather than silently copying source into Ultimate MTG.',
      'Its deliberate non-advisor philosophy differs from Ultimate MTG strategic goals.',
    ],
  },
  {
    id: 'forge',
    repository: 'Card-Forge/forge',
    license: 'GPL-3.0',
    independenceGroup: 'forge-family',
    domains: ['rules', 'simulation'],
    defaultUseMode: 'behavioral-reference',
    strengths: [
      'Long-running MTG rules engine with broad card/mechanic coverage and Commander-capable AI play.',
      'High-value external oracle for deterministic rules and simulation differential tests.',
    ],
    cautions: [
      'Use process/snapshot parity by default; do not silently embed Forge implementation code into the core.',
      'A disagreement requires investigation because either engine, scenario adapter, or normalization layer may be wrong.',
    ],
  },
  {
    id: 'manabrew',
    repository: 'witchesofthehill/manabrew',
    license: 'AGPL-3.0-or-later (with Forge-derived GPL components)',
    independenceGroup: 'forge-family',
    domains: ['rules', 'simulation'],
    defaultUseMode: 'architecture-reference',
    strengths: [
      'Parity-harness methodology: same decks, seeds, and deterministic choices compared against Forge traces.',
      'Excellent reference for differential testing, trace normalization, and first-mismatch reporting.',
    ],
    cautions: [
      'Manabrew is not independent confirmation from Forge because Forge is its reference implementation.',
      'Use its testing methodology as inspiration/reference while keeping Ultimate MTG implementation independent.',
    ],
  },
];

export function externalOraclesForDomainV15(domain: ExternalBenchmarkDomainV15): ExternalOracleDefinitionV15[] {
  return EXTERNAL_ORACLES_V15.filter((oracle) => oracle.domains.includes(domain));
}

export type ExternalBenchmarkJsonV15 =
  | null
  | boolean
  | number
  | string
  | ExternalBenchmarkJsonV15[]
  | { [key: string]: ExternalBenchmarkJsonV15 };

export interface ExternalBenchmarkSnapshotV15 {
  oracleId: ExternalOracleIdV15;
  caseId: string;
  domain: ExternalBenchmarkDomainV15;
  oracleVersion: string;
  deterministicSeed?: number | null;
  normalizedResult: ExternalBenchmarkJsonV15;
}

export interface ExternalBenchmarkComparisonV15 {
  oracleId: ExternalOracleIdV15;
  caseId: string;
  domain: ExternalBenchmarkDomainV15;
  oracleVersion: string;
  deterministicSeed: number | null;
  independenceGroup: string;
  agreement: 'exact' | 'mismatch';
  differencePaths: string[];
  guidance: string;
}

function oracleById(id: ExternalOracleIdV15): ExternalOracleDefinitionV15 {
  const oracle = EXTERNAL_ORACLES_V15.find((entry) => entry.id === id);
  if (!oracle) throw new Error(`Unknown external oracle: ${String(id)}`);
  return oracle;
}

function isObject(value: ExternalBenchmarkJsonV15): value is { [key: string]: ExternalBenchmarkJsonV15 } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareJson(
  left: ExternalBenchmarkJsonV15,
  right: ExternalBenchmarkJsonV15,
  path: string,
  differences: string[],
): void {
  if (Object.is(left, right)) return;

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) differences.push(`${path}.length`);
    const limit = Math.min(left.length, right.length);
    for (let index = 0; index < limit; index += 1) {
      compareJson(left[index] ?? null, right[index] ?? null, `${path}[${index}]`, differences);
    }
    return;
  }

  if (isObject(left) && isObject(right)) {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    for (const key of keys) {
      if (!(key in left) || !(key in right)) {
        differences.push(`${path}.${key}`);
        continue;
      }
      compareJson(left[key] ?? null, right[key] ?? null, `${path}.${key}`, differences);
    }
    return;
  }

  differences.push(path);
}

function normalizedSeed(seed: number | null | undefined): number | null {
  return typeof seed === 'number' && Number.isFinite(seed) ? Math.trunc(seed) : null;
}

/** Compare normalized Ultimate MTG output against one pinned external snapshot. */
export function compareExternalOracleSnapshotV15(
  ultimateResult: ExternalBenchmarkJsonV15,
  snapshot: ExternalBenchmarkSnapshotV15,
): ExternalBenchmarkComparisonV15 {
  const oracle = oracleById(snapshot.oracleId);
  if (!oracle.domains.includes(snapshot.domain)) {
    throw new Error(`${oracle.repository} is not registered for ${String(snapshot.domain)} benchmarks.`);
  }
  if (!snapshot.caseId.trim()) throw new Error('External benchmark caseId must be non-empty.');
  if (!snapshot.oracleVersion.trim()) throw new Error('External benchmark oracleVersion must be non-empty.');

  const differencePaths: string[] = [];
  compareJson(ultimateResult, snapshot.normalizedResult, '$', differencePaths);
  const agreement = differencePaths.length === 0 ? 'exact' : 'mismatch';
  return {
    oracleId: snapshot.oracleId,
    caseId: snapshot.caseId,
    domain: snapshot.domain,
    oracleVersion: snapshot.oracleVersion,
    deterministicSeed: normalizedSeed(snapshot.deterministicSeed),
    independenceGroup: oracle.independenceGroup,
    agreement,
    differencePaths,
    guidance: agreement === 'exact'
      ? 'External parity is corroborating evidence only; keep Ultimate MTG legality, source provenance, and internal regression gates independent.'
      : 'Investigate the first mismatch. Do not automatically assume either Ultimate MTG or the external oracle is correct until the scenario adapter and rules/data provenance are checked.',
  };
}

export interface ExternalBenchmarkSummaryV15 {
  comparisonCount: number;
  exactComparisons: number;
  mismatchComparisons: number;
  independentExactGroups: number;
  exactGroups: string[];
  mismatchGroups: string[];
  caseIds: string[];
  domains: ExternalBenchmarkDomainV15[];
  deterministicSeeds: Array<number | null>;
  comparableCase: boolean;
  boundaryProblems: string[];
  corroboration: 'none' | 'single-family' | 'multi-source';
  guidance: string;
}

/**
 * Summarize parity without double-counting related implementations.
 * Forge + Manabrew agreeing is one family, not two independent confirmations.
 * Corroboration is only valid when every comparison describes the same case,
 * domain, and deterministic seed. Different experiments must never be pooled.
 */
export function summarizeExternalBenchmarkComparisonsV15(
  comparisons: ExternalBenchmarkComparisonV15[],
): ExternalBenchmarkSummaryV15 {
  const exact = comparisons.filter((comparison) => comparison.agreement === 'exact');
  const mismatches = comparisons.filter((comparison) => comparison.agreement === 'mismatch');
  const caseIds = [...new Set(comparisons.map((comparison) => comparison.caseId))].sort();
  const domains = [...new Set(comparisons.map((comparison) => comparison.domain))].sort() as ExternalBenchmarkDomainV15[];
  const deterministicSeeds = [...new Set(comparisons.map((comparison) => comparison.deterministicSeed))]
    .sort((a, b) => (a ?? Number.MIN_SAFE_INTEGER) - (b ?? Number.MIN_SAFE_INTEGER));
  const boundaryProblems: string[] = [];
  if (caseIds.length > 1) boundaryProblems.push(`Mixed benchmark caseIds: ${caseIds.join(', ')}.`);
  if (domains.length > 1) boundaryProblems.push(`Mixed benchmark domains: ${domains.join(', ')}.`);
  if (deterministicSeeds.length > 1) {
    boundaryProblems.push(`Mixed deterministic seeds: ${deterministicSeeds.map((seed) => seed === null ? 'none' : String(seed)).join(', ')}.`);
  }
  const comparableCase = comparisons.length > 0 && boundaryProblems.length === 0;

  const exactGroups = [...new Set(exact.map((comparison) => comparison.independenceGroup))].sort();
  const mismatchGroups = [...new Set(mismatches.map((comparison) => comparison.independenceGroup))].sort();
  const unresolved = new Set(mismatchGroups);
  const cleanExactGroups = comparableCase
    ? exactGroups.filter((group) => !unresolved.has(group))
    : [];
  const corroboration: ExternalBenchmarkSummaryV15['corroboration'] = cleanExactGroups.length >= 2
    ? 'multi-source'
    : cleanExactGroups.length === 1
      ? 'single-family'
      : 'none';

  return {
    comparisonCount: comparisons.length,
    exactComparisons: exact.length,
    mismatchComparisons: mismatches.length,
    independentExactGroups: cleanExactGroups.length,
    exactGroups: cleanExactGroups,
    mismatchGroups,
    caseIds,
    domains,
    deterministicSeeds,
    comparableCase,
    boundaryProblems,
    corroboration,
    guidance: boundaryProblems.length > 0
      ? 'Do not pool unrelated external benchmark experiments. Compare the same case, domain, and deterministic seed before claiming corroboration.'
      : mismatches.length > 0
        ? 'At least one external oracle family disagrees. Treat the case as unresolved until the mismatch is explained and converted into a regression fixture.'
        : corroboration === 'multi-source'
          ? 'Multiple independent oracle families agree after lineage deduplication. This strengthens confidence but does not override primary MTG facts or internal hard gates.'
          : 'External agreement is useful corroboration, but broader independent coverage is still needed before treating the behavior as strongly cross-validated.',
  };
}
