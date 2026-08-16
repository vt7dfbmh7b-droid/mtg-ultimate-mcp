import type { ScryfallCard } from '../types/scryfall.js';
import {
  describePrintingPolicyV08,
  resolvePrintingPolicyV08,
  selectEligiblePrintingV08,
} from './printing-policy-v08.js';
import { getCardsByNames } from './scryfall.js';
import { searchSpellbookVariants } from './spellbook.js';
import { isWinResultV14 } from './cedh-win-package-v14.js';

export interface CedhSeedPackageOptionsV14 {
  printingFamily?: string;
  allowedSets?: string[];
  includePromos?: boolean;
  includeSpecialReleases?: boolean;
  maxUsdPerCard?: number;
  maxPackageCards?: number;
  maxCandidatesToVerify?: number;
}

interface SeedCardUseV14 {
  name: string;
  quantity: number;
  mustBeCommander: boolean;
}

interface SeedCandidateV14 {
  id: string;
  bracketTag: string | null;
  cards: SeedCardUseV14[];
  results: string[];
  requirements: unknown[];
  popularity: number;
  score: number;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function commanderIdentity(commanders: ScryfallCard[]): string[] {
  return [...new Set(commanders.flatMap((card) => card.color_identity))].sort();
}

export function buildCedhSeedQueriesV14(maxPackageCards = 3): string[] {
  const maxCards = Math.max(2, Math.min(4, Math.trunc(maxPackageCards)));
  const queries = [`bracket:ruthless card<=2 is:winning legal:commander`];
  if (maxCards >= 3) queries.push(`bracket:ruthless card<=3 is:winning legal:commander`);
  if (maxCards >= 4) queries.push(`bracket:ruthless card<=4 is:winning legal:commander`);
  return queries;
}

function parseCandidate(value: unknown, commanderNames: Set<string>, maxPackageCards: number): SeedCandidateV14 | null {
  const variant = record(value);
  const id = String(variant.id ?? '').trim();
  const bracketTag = typeof variant.bracketTag === 'string' ? variant.bracketTag : null;
  const results = Array.isArray(variant.results) ? variant.results.map(String) : [];
  const requirements = Array.isArray(variant.requirements) ? variant.requirements : [];
  const uses = Array.isArray(variant.cards) ? variant.cards.map(record) : [];
  if (!id || bracketTag !== 'R' || requirements.length > 0 || !isWinResultV14(results)) return null;

  const cards: SeedCardUseV14[] = [];
  for (const use of uses) {
    const name = typeof use.name === 'string' ? use.name.trim() : '';
    const quantity = typeof use.quantity === 'number' ? Math.max(1, Math.trunc(use.quantity)) : 1;
    const mustBeCommander = use.mustBeCommander === true;
    if (!name || name === 'Unknown card' || quantity !== 1) return null;
    if (mustBeCommander && !commanderNames.has(normalize(name))) return null;
    cards.push({ name, quantity, mustBeCommander });
  }

  const uniqueNames = [...new Set(cards.map((card) => normalize(card.name)))];
  if (uniqueNames.length < 1 || uniqueNames.length > maxPackageCards) return null;
  const popularity = typeof variant.popularity === 'number' && Number.isFinite(variant.popularity) ? variant.popularity : 0;
  const commanderOverlap = cards.filter((card) => commanderNames.has(normalize(card.name))).length;
  const compactness = (maxPackageCards + 1 - uniqueNames.length) * 160;
  const score = 1000 + compactness + commanderOverlap * 220 + Math.min(180, Math.log10(popularity + 1) * 50);

  return { id, bracketTag, cards, results, requirements, popularity, score };
}

export function rankCedhSeedCandidatesV14(
  variants: unknown[],
  commanderNames: string[],
  maxPackageCards = 3,
): Array<Record<string, unknown>> {
  const normalizedCommanders = new Set(commanderNames.map(normalize));
  const maxCards = Math.max(2, Math.min(4, Math.trunc(maxPackageCards)));
  const seen = new Set<string>();
  const candidates: SeedCandidateV14[] = [];

  for (const variant of variants) {
    const candidate = parseCandidate(variant, normalizedCommanders, maxCards);
    if (!candidate) continue;
    const key = candidate.cards.map((card) => normalize(card.name)).sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(candidate);
  }

  return candidates
    .sort((a, b) => b.score - a.score || a.cards.length - b.cards.length || b.popularity - a.popularity)
    .map((candidate) => ({ ...candidate }));
}

export async function discoverCedhSeedWinPackageV14(
  commanders: ScryfallCard[],
  options: CedhSeedPackageOptionsV14 = {},
): Promise<Record<string, unknown>> {
  if (commanders.length < 1 || commanders.length > 2) throw new Error('Provide one or two resolved commanders.');
  const maxPackageCards = Math.max(2, Math.min(4, Math.trunc(options.maxPackageCards ?? 3)));
  const maxCandidatesToVerify = Math.max(1, Math.min(20, Math.trunc(options.maxCandidatesToVerify ?? 10)));
  const policy = await resolvePrintingPolicyV08({
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
  });
  const commanderNames = commanders.map((card) => card.name);
  const normalizedCommanders = new Set(commanderNames.map(normalize));
  const identity = commanderIdentity(commanders);

  const rawVariants: unknown[] = [];
  const queryAudit: Array<Record<string, unknown>> = [];
  for (const query of buildCedhSeedQueriesV14(maxPackageCards)) {
    const search = await searchSpellbookVariants(query, { limit: 30, ordering: '-popularity' });
    const results = Array.isArray(search.results) ? search.results : [];
    rawVariants.push(...results);
    queryAudit.push({ query, returned: results.length, totalMatching: search.count ?? null });
  }

  const ranked = rankCedhSeedCandidatesV14(rawVariants, commanderNames, maxPackageCards);
  const candidates = ranked.slice(0, maxCandidatesToVerify).map(record);
  const allNames = [...new Set(candidates.flatMap((candidate) =>
    Array.isArray(candidate.cards)
      ? candidate.cards.map(record).map((card) => String(card.name ?? '')).filter(Boolean)
      : [],
  ))];
  const oracleLookup = allNames.length > 0 ? await getCardsByNames(allNames) : { cards: [], notFound: [] };
  const oracleByName = new Map(oracleLookup.cards.map((card) => [normalize(card.name), card]));
  const audit: Array<Record<string, unknown>> = [];

  for (const candidate of candidates) {
    const uses = Array.isArray(candidate.cards) ? candidate.cards.map(record) : [];
    const exactPrintings: Array<Record<string, unknown>> = [];
    const unavailable: string[] = [];
    let legal = true;

    for (const use of uses) {
      const name = String(use.name ?? '').trim();
      if (!name) {
        legal = false;
        continue;
      }
      if (normalizedCommanders.has(normalize(name))) continue;
      const oracle = oracleByName.get(normalize(name));
      if (!oracle || oracle.legalities.commander !== 'legal' || oracle.color_identity.some((color) => !identity.includes(color))) {
        legal = false;
        unavailable.push(name);
        continue;
      }
      const printing = await selectEligiblePrintingV08(oracle, policy, options.maxUsdPerCard);
      if (!printing) {
        legal = false;
        unavailable.push(name);
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

    if (!legal) {
      audit.push({ comboId: candidate.id, status: 'ineligible-package', unavailable });
      continue;
    }

    const comboCardNames = uses.map((use) => String(use.name ?? '')).filter(Boolean);
    const seedNames = comboCardNames.filter((name) => !normalizedCommanders.has(normalize(name)));
    if (seedNames.length < 1) {
      audit.push({ comboId: candidate.id, status: 'commander-only-or-empty-package' });
      continue;
    }

    return {
      status: 'eligible-winning-seed-package-found',
      commanderNames,
      commanderIdentity: identity,
      comboId: candidate.id,
      bracketTag: candidate.bracketTag,
      results: candidate.results,
      popularity: candidate.popularity,
      comboCardNames,
      seedNames,
      exactPrintings,
      printingPolicy: describePrintingPolicyV08(policy),
      queryAudit,
      audit,
      source: 'Commander Spellbook + Scryfall exact-printing verification',
      guidance: 'The package is only a construction seed. The finished 100-card deck must still independently resolve, pass Commander legality and printing policy, and reproduce the winning combo through find-my-combos before it can satisfy the cEDH win-package gate.',
    };
  }

  return {
    status: 'no-eligible-winning-seed-package',
    commanderNames,
    commanderIdentity: identity,
    checkedCandidates: candidates.length,
    printingPolicy: describePrintingPolicyV08(policy),
    queryAudit,
    audit,
    source: 'Commander Spellbook + Scryfall exact-printing verification',
  };
}
