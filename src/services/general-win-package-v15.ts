import type { ScryfallCard } from '../types/scryfall.js';
import {
  describePrintingPolicyV08,
  resolvePrintingPolicyV08,
  selectEligiblePrintingV08,
  type PrintingPolicyInputV08,
} from './printing-policy-v08.js';
import { getCardsByNames, inferCardRoles } from './scryfall.js';
import { searchSpellbookVariantsEvidence } from './spellbook.js';
import {
  assessWinResultClosureV15,
  buildWinPackagePortfolioV15,
  isStrictDeterministicWinResultV15,
  type WinClosureKindV15,
  type WinPackagePortfolioV15,
} from './win-package-verification-v15.js';

export interface GeneralWinPackageOptionsV15 extends PrintingPolicyInputV08 {
  maxUsdPerCard?: number;
  maxPackageCards?: number;
  maxCandidatesToVerify?: number;
  excludedCards?: string[];
}

export interface GeneralWinPackageCandidateV15 {
  comboId: string;
  bracketTag: string | null;
  comboCardNames: string[];
  seedNames: string[];
  results: string[];
  closureKind: WinClosureKindV15;
  closureCaveat: string;
  resourceOutputs: string[];
  exactPrintings: Array<{
    name: string;
    set: string;
    collectorNumber: string;
    finish: string | null;
    priceUsd: number | null;
  }>;
  commanderOverlap: number;
  totalManaValue: number;
  reusableRoleCount: number;
  deadPieceRisk: number;
  score: number;
  popularity: number;
}

interface ParsedCandidateV15 {
  id: string;
  bracketTag: string | null;
  names: string[];
  results: string[];
  popularity: number;
}

const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'] as const;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function canonicalIdentityTokenV15(colors: readonly string[]): string {
  const present = new Set(colors.map((color) => color.trim().toUpperCase()).filter((color) => COLOR_ORDER.includes(color as typeof COLOR_ORDER[number])));
  const ordered = COLOR_ORDER.filter((color) => present.has(color));
  return ordered.length > 0 ? ordered.join('') : 'C';
}

function commanderIdentity(commanders: readonly ScryfallCard[]): string[] {
  const present = new Set(commanders.flatMap((card) => card.color_identity));
  return COLOR_ORDER.filter((color) => present.has(color));
}

function identityToken(commanders: readonly ScryfallCard[]): string {
  return canonicalIdentityTokenV15(commanders.flatMap((card) => card.color_identity));
}

export function buildGeneralWinPackageQueriesV15(maxPackageCards = 3, identity = 'C'): string[] {
  const maxCards = Math.max(2, Math.min(4, Math.trunc(maxPackageCards)));
  const canonicalIdentity = identity.trim().toUpperCase() === 'C'
    ? 'C'
    : canonicalIdentityTokenV15([...identity]);
  const queries = [`card<=2 is:winning legal:commander identity<=${canonicalIdentity}`];
  if (maxCards >= 3) queries.push(`card<=3 is:winning legal:commander identity<=${canonicalIdentity}`);
  if (maxCards >= 4) queries.push(`card<=4 is:winning legal:commander identity<=${canonicalIdentity}`);
  return queries;
}

function parseCandidate(
  value: unknown,
  commanderNames: Set<string>,
  excluded: Set<string>,
  maxPackageCards: number,
): ParsedCandidateV15 | null {
  const variant = record(value);
  const id = String(variant.id ?? '').trim();
  const results = Array.isArray(variant.results) ? variant.results.map(String) : [];
  const requirements = Array.isArray(variant.requirements) ? variant.requirements : [];
  const uses = Array.isArray(variant.cards) ? variant.cards.map(record) : [];
  if (!id || requirements.length > 0 || !isStrictDeterministicWinResultV15(results)) return null;

  const names: string[] = [];
  for (const use of uses) {
    const name = typeof use.name === 'string' ? use.name.trim() : '';
    const quantity = typeof use.quantity === 'number' ? Math.max(1, Math.trunc(use.quantity)) : 1;
    const mustBeCommander = use.mustBeCommander === true;
    if (!name || name === 'Unknown card' || quantity !== 1) return null;
    if (mustBeCommander && !commanderNames.has(normalize(name))) return null;
    if (excluded.has(normalize(name))) return null;
    names.push(name);
  }

  const uniqueNames = [...new Map(names.map((name) => [normalize(name), name])).values()];
  if (uniqueNames.length < 1 || uniqueNames.length > maxPackageCards) return null;
  const popularity = typeof variant.popularity === 'number' && Number.isFinite(variant.popularity)
    ? Math.max(0, variant.popularity)
    : 0;
  return {
    id,
    bracketTag: typeof variant.bracketTag === 'string' ? variant.bracketTag : null,
    names: uniqueNames,
    results,
    popularity,
  };
}

export function rankGeneralWinPackageVariantsV15(
  variants: unknown[],
  commanderNames: string[],
  options: { maxPackageCards?: number; excludedCards?: string[] } = {},
): Array<Record<string, unknown>> {
  const commanders = new Set(commanderNames.map(normalize));
  const excluded = new Set((options.excludedCards ?? []).map(normalize));
  const maxCards = Math.max(2, Math.min(4, Math.trunc(options.maxPackageCards ?? 3)));
  const byPackage = new Map<string, ParsedCandidateV15>();
  for (const variant of variants) {
    const parsed = parseCandidate(variant, commanders, excluded, maxCards);
    if (!parsed) continue;
    const key = parsed.names.map(normalize).sort().join('|');
    const current = byPackage.get(key);
    if (!current || parsed.popularity > current.popularity || (parsed.popularity === current.popularity && parsed.id < current.id)) {
      byPackage.set(key, parsed);
    }
  }
  return [...byPackage.values()]
    .sort((a, b) => a.names.length - b.names.length || b.popularity - a.popularity || a.id.localeCompare(b.id))
    .map((candidate) => ({ ...candidate }));
}

function packageCardUtility(cards: readonly ScryfallCard[], commanderNames: Set<string>): {
  totalManaValue: number;
  reusableRoleCount: number;
  deadPieceRisk: number;
  commanderOverlap: number;
  scoreAdjustment: number;
} {
  const reusableRoles = new Set([
    'fast mana', 'mana acceleration', 'land ramp', 'tutor', 'free interaction', 'countermagic',
    'spot interaction', 'protection', 'repeatable draw', 'card draw', 'card selection',
  ]);
  let totalManaValue = 0;
  let reusableRoleCount = 0;
  let deadPieceRisk = 0;
  let commanderOverlap = 0;
  for (const card of cards) {
    totalManaValue += Math.max(0, card.cmc);
    if (commanderNames.has(normalize(card.name))) commanderOverlap += 1;
    const roles = new Set(inferCardRoles(card));
    if ([...roles].some((role) => reusableRoles.has(role))) reusableRoleCount += 1;
    if (card.cmc >= 5 && !card.type_line.toLocaleLowerCase().includes('land')) deadPieceRisk += 1;
    if (card.cmc >= 4 && roles.size === 0 && !card.type_line.toLocaleLowerCase().includes('land')) deadPieceRisk += 0.5;
  }
  const scoreAdjustment = commanderOverlap * 130
    + reusableRoleCount * 30
    - totalManaValue * 30
    - deadPieceRisk * 90;
  return { totalManaValue, reusableRoleCount, deadPieceRisk, commanderOverlap, scoreAdjustment };
}

export async function discoverGeneralWinPackagesV15(
  commanders: readonly ScryfallCard[],
  options: GeneralWinPackageOptionsV15 = {},
): Promise<{
  status: 'verified-win-packages-found' | 'no-verified-win-package' | 'verification-unavailable';
  sourceCompleteness: 'complete' | 'partial' | 'unavailable';
  selected: GeneralWinPackageCandidateV15 | null;
  candidates: GeneralWinPackageCandidateV15[];
  portfolio: WinPackagePortfolioV15;
  queryAudit: Array<Record<string, unknown>>;
  rejectionAudit: Array<Record<string, unknown>>;
  printingPolicy: Record<string, unknown>;
  source: string;
}> {
  if (commanders.length < 1 || commanders.length > 2) throw new Error('General win-package discovery requires one or two resolved commanders.');
  const maxPackageCards = Math.max(2, Math.min(4, Math.trunc(options.maxPackageCards ?? 3)));
  const maxCandidates = Math.max(1, Math.min(20, Math.trunc(options.maxCandidatesToVerify ?? 12)));
  const policy = await resolvePrintingPolicyV08(options);
  const commanderNames = commanders.map((card) => card.name);
  const commanderSet = new Set(commanderNames.map(normalize));
  const colors = commanderIdentity(commanders);
  const raw: unknown[] = [];
  const queryAudit: Array<Record<string, unknown>> = [];
  let availableQueries = 0;
  let unavailableQueries = 0;
  for (const query of buildGeneralWinPackageQueriesV15(maxPackageCards, identityToken(commanders))) {
    const result = await searchSpellbookVariantsEvidence(query, { limit: 75, ordering: '-popularity' });
    const rows = Array.isArray(result.results) ? result.results : [];
    const available = result.sourceStatus === 'available' && result.verificationComplete === true;
    if (available) {
      availableQueries += 1;
      raw.push(...rows);
    } else {
      unavailableQueries += 1;
    }
    queryAudit.push({
      query,
      returned: rows.length,
      totalMatching: result.count ?? null,
      sourceStatus: result.sourceStatus ?? 'unknown',
      verificationComplete: result.verificationComplete === true,
      ...(result.sourceFailure ? { sourceFailure: result.sourceFailure } : {}),
    });
  }
  const sourceCompleteness: 'complete' | 'partial' | 'unavailable' = unavailableQueries === 0
    ? 'complete'
    : availableQueries === 0
      ? 'unavailable'
      : 'partial';

  const ranked = rankGeneralWinPackageVariantsV15(raw, commanderNames, options).slice(0, maxCandidates).map(record);
  const names = [...new Set(ranked.flatMap((candidate) => Array.isArray(candidate.names) ? candidate.names.map(String) : []))];
  const lookup = names.length > 0 ? await getCardsByNames(names) : { cards: [], notFound: [] };
  const byName = new Map(lookup.cards.map((card) => [normalize(card.name), card]));
  const commanderByName = new Map(commanders.map((card) => [normalize(card.name), card]));
  const printingCache = new Map<string, Awaited<ReturnType<typeof selectEligiblePrintingV08>>>();
  const candidates: GeneralWinPackageCandidateV15[] = [];
  const rejectionAudit: Array<Record<string, unknown>> = [];

  for (const row of ranked) {
    const comboId = String(row.id ?? '');
    const comboNames = Array.isArray(row.names) ? row.names.map(String) : [];
    const results = Array.isArray(row.results) ? row.results.map(String) : [];
    const closure = assessWinResultClosureV15(results);
    if (!closure.verifiedDeterministicWin) {
      rejectionAudit.push({
        comboId,
        status: 'rejected',
        reasons: [`strict closure failed: ${closure.kind}`],
        closure,
      });
      continue;
    }
    const exactPrintings: GeneralWinPackageCandidateV15['exactPrintings'] = [];
    const profiles: ScryfallCard[] = [];
    let valid = true;
    const rejected: string[] = [];
    for (const name of comboNames) {
      const normalized = normalize(name);
      const oracle = commanderByName.get(normalized) ?? byName.get(normalized);
      if (!oracle) {
        valid = false;
        rejected.push(`${name}: unresolved`);
        continue;
      }
      profiles.push(oracle);
      if (commanderSet.has(normalized)) continue;
      if (oracle.legalities.commander !== 'legal' || oracle.color_identity.some((color) => !colors.includes(color))) {
        valid = false;
        rejected.push(`${name}: outside Commander legality/color identity`);
        continue;
      }
      let printing = printingCache.get(normalized);
      if (!printingCache.has(normalized)) {
        printing = await selectEligiblePrintingV08(oracle, policy, options.maxUsdPerCard);
        printingCache.set(normalized, printing ?? null);
      }
      if (!printing) {
        valid = false;
        rejected.push(`${name}: no eligible physical printing`);
        continue;
      }
      exactPrintings.push({
        name: oracle.name,
        set: printing.card.set.toUpperCase(),
        collectorNumber: printing.card.collector_number,
        finish: printing.finish,
        priceUsd: printing.priceUsd,
      });
    }
    if (!valid) {
      rejectionAudit.push({ comboId, status: 'rejected', reasons: rejected });
      continue;
    }
    const seedNames = comboNames.filter((name) => !commanderSet.has(normalize(name)));
    if (seedNames.length === 0) {
      rejectionAudit.push({ comboId, status: 'rejected', reasons: ['package has no library/deck seed cards'] });
      continue;
    }
    const utility = packageCardUtility(profiles, commanderSet);
    const compactness = (maxPackageCards + 1 - comboNames.length) * 150;
    const score = 1000 + compactness + utility.scoreAdjustment;
    candidates.push({
      comboId,
      bracketTag: typeof row.bracketTag === 'string' ? row.bracketTag : null,
      comboCardNames: comboNames,
      seedNames,
      results,
      closureKind: closure.kind,
      closureCaveat: closure.caveat,
      resourceOutputs: closure.resourceOutputs,
      exactPrintings,
      commanderOverlap: utility.commanderOverlap,
      totalManaValue: Math.round(utility.totalManaValue * 100) / 100,
      reusableRoleCount: utility.reusableRoleCount,
      deadPieceRisk: Math.round(utility.deadPieceRisk * 100) / 100,
      score: Math.round(score * 100) / 100,
      popularity: typeof row.popularity === 'number' ? row.popularity : 0,
    });
  }

  candidates.sort((a, b) =>
    b.score - a.score
    || a.seedNames.length - b.seedNames.length
    || a.totalManaValue - b.totalManaValue
    || b.popularity - a.popularity
    || a.comboId.localeCompare(b.comboId));

  const portfolio = buildWinPackagePortfolioV15(candidates);
  const selected = portfolio.primaryComboId
    ? candidates.find((candidate) => candidate.comboId === portfolio.primaryComboId) ?? null
    : null;
  const status = candidates.length > 0
    ? 'verified-win-packages-found'
    : sourceCompleteness === 'complete'
      ? 'no-verified-win-package'
      : 'verification-unavailable';
  return {
    status,
    sourceCompleteness,
    selected,
    candidates,
    portfolio,
    queryAudit,
    rejectionAudit,
    printingPolicy: describePrintingPolicyV08(policy),
    source: 'Commander Spellbook winning variants + strict V0.15 game-ending closure + Scryfall legality/physical-printing verification',
  };
}
