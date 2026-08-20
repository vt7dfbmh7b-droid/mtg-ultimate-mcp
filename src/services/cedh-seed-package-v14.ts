import type { ScryfallCard } from '../types/scryfall.js';
import {
  describePrintingPolicyV08,
  resolvePrintingPolicyV08,
  selectEligiblePrintingV08,
} from './printing-policy-v08.js';
import { getCardsByNames, inferCardRoles } from './scryfall.js';
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

export interface CedhSeedCardProfileV14 {
  name: string;
  cmc: number;
  typeLine: string;
  oracleText?: string;
  roles?: string[];
}

export interface CedhSeedPracticalityV14 {
  scoreAdjustment: number;
  totalManaValue: number;
  maxManaValue: number;
  lowCostCount: number;
  highCostCount: number;
  reusableRoleCount: number;
  deadPieceRisk: number;
  commanderOverlap: number;
  reasons: string[];
}

interface VerifiedSeedCandidateV14 {
  candidate: Record<string, unknown>;
  comboCardNames: string[];
  seedNames: string[];
  exactPrintings: Array<Record<string, unknown>>;
  practicality: CedhSeedPracticalityV14;
  finalScore: number;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function commanderIdentity(commanders: ScryfallCard[]): string[] {
  const present = new Set(commanders.flatMap((card) => card.color_identity));
  return ['W', 'U', 'B', 'R', 'G'].filter((color) => present.has(color));
}

function normalizeIdentityQuery(identity?: string): string | null {
  if (!identity) return null;
  const upper = identity.trim().toUpperCase();
  if (upper === 'C') return 'C';
  const present = new Set([...upper].filter((color) => 'WUBRG'.includes(color)));
  const normalized = ['W', 'U', 'B', 'R', 'G'].filter((color) => present.has(color)).join('');
  return normalized || null;
}

export function buildCedhSeedQueriesV14(maxPackageCards = 3, identity?: string): string[] {
  const maxCards = Math.max(2, Math.min(4, Math.trunc(maxPackageCards)));
  const identityToken = normalizeIdentityQuery(identity);
  const identityClause = identityToken ? ` identity<=${identityToken}` : '';
  const queries = [`bracket:ruthless card<=2 is:winning legal:commander${identityClause}`];
  if (maxCards >= 3) queries.push(`bracket:ruthless card<=3 is:winning legal:commander${identityClause}`);
  if (maxCards >= 4) queries.push(`bracket:ruthless card<=4 is:winning legal:commander${identityClause}`);
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
  const bestByPackage = new Map<string, SeedCandidateV14>();

  for (const variant of variants) {
    const candidate = parseCandidate(variant, normalizedCommanders, maxCards);
    if (!candidate) continue;
    const key = candidate.cards.map((card) => normalize(card.name)).sort().join('|');
    const existing = bestByPackage.get(key);
    if (!existing || candidate.score > existing.score || (candidate.score === existing.score && candidate.popularity > existing.popularity)) {
      bestByPackage.set(key, candidate);
    }
  }

  return [...bestByPackage.values()]
    .sort((a, b) => b.score - a.score || a.cards.length - b.cards.length || b.popularity - a.popularity)
    .map((candidate) => ({ ...candidate }));
}

export function scoreCedhSeedPracticalityV14(
  cards: CedhSeedCardProfileV14[],
  commanderNames: string[],
): CedhSeedPracticalityV14 {
  const commanders = new Set(commanderNames.map(normalize));
  const reusableRoles = new Set([
    'fast mana',
    'mana acceleration',
    'land ramp',
    'tutor',
    'free interaction',
    'countermagic',
    'spot interaction',
    'protection',
    'repeatable draw',
    'card draw',
  ]);
  let totalManaValue = 0;
  let maxManaValue = 0;
  let lowCostCount = 0;
  let highCostCount = 0;
  let reusableRoleCount = 0;
  let deadPieceRisk = 0;
  let commanderOverlap = 0;
  const reasons: string[] = [];

  for (const card of cards) {
    const mv = Math.max(0, Number.isFinite(card.cmc) ? card.cmc : 0);
    totalManaValue += mv;
    maxManaValue = Math.max(maxManaValue, mv);
    if (mv <= 2) lowCostCount += 1;
    if (mv >= 4) highCostCount += 1;
    if (commanders.has(normalize(card.name))) commanderOverlap += 1;

    const roles = new Set((card.roles ?? []).map(normalize));
    if ([...roles].some((role) => reusableRoles.has(role))) reusableRoleCount += 1;

    const oracle = (card.oracleText ?? '').toLocaleLowerCase();
    const typeLine = card.typeLine.toLocaleLowerCase();
    if (mv >= 5 && !typeLine.includes('land')) deadPieceRisk += 1;
    if (mv >= 4 && roles.size === 0 && !typeLine.includes('land')) deadPieceRisk += 0.65;
    if (/exile (?:all cards from|your) (?:your )?library|exile your library/.test(oracle)) deadPieceRisk += 2;
    if (typeLine.includes('planeswalker') && mv >= 4) deadPieceRisk += 0.35;
  }

  let scoreAdjustment = 0;
  scoreAdjustment -= totalManaValue * 35;
  scoreAdjustment -= highCostCount * 70;
  scoreAdjustment += lowCostCount * 45;
  scoreAdjustment += reusableRoleCount * 35;
  scoreAdjustment -= deadPieceRisk * 105;
  scoreAdjustment += commanderOverlap * 180;

  if (totalManaValue <= 5) reasons.push('Compact execution mana supports a faster competitive line.');
  if (commanderOverlap > 0) reasons.push('The package uses a commander already available from the command zone.');
  if (reusableRoleCount > 0) reasons.push('At least one combo card has utility outside the deterministic win line.');
  if (highCostCount > 0) reasons.push('High-mana combo pieces increase setup and dead-draw risk.');
  if (deadPieceRisk > 0) reasons.push('One or more pieces carry meaningful dead-card or all-in setup risk outside the combo.');

  return {
    scoreAdjustment: Math.round(scoreAdjustment * 100) / 100,
    totalManaValue: Math.round(totalManaValue * 100) / 100,
    maxManaValue: Math.round(maxManaValue * 100) / 100,
    lowCostCount,
    highCostCount,
    reusableRoleCount,
    deadPieceRisk: Math.round(deadPieceRisk * 100) / 100,
    commanderOverlap,
    reasons,
  };
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
  const identityToken = identity.length > 0 ? identity.join('') : 'C';

  const rawVariants: unknown[] = [];
  const queryAudit: Array<Record<string, unknown>> = [];
  for (const query of buildCedhSeedQueriesV14(maxPackageCards, identityToken)) {
    const search = await searchSpellbookVariants(query, { limit: 50, ordering: '-popularity' });
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
  const commanderByName = new Map(commanders.map((card) => [normalize(card.name), card]));
  const audit: Array<Record<string, unknown>> = [];
  const verifiedCandidates: VerifiedSeedCandidateV14[] = [];

  for (const candidate of candidates) {
    const uses = Array.isArray(candidate.cards) ? candidate.cards.map(record) : [];
    const exactPrintings: Array<Record<string, unknown>> = [];
    const unavailable: string[] = [];
    const practicalityCards: CedhSeedCardProfileV14[] = [];
    let legal = true;

    for (const use of uses) {
      const name = String(use.name ?? '').trim();
      if (!name) {
        legal = false;
        continue;
      }
      const normalizedName = normalize(name);
      const oracle = commanderByName.get(normalizedName) ?? oracleByName.get(normalizedName);
      if (!oracle) {
        legal = false;
        unavailable.push(name);
        continue;
      }
      practicalityCards.push({
        name: oracle.name,
        cmc: oracle.cmc,
        typeLine: oracle.type_line,
        ...(oracle.oracle_text ? { oracleText: oracle.oracle_text } : {}),
        roles: inferCardRoles(oracle),
      });
      if (normalizedCommanders.has(normalizedName)) continue;
      if (oracle.legalities.commander !== 'legal' || oracle.color_identity.some((color) => !identity.includes(color))) {
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

    const practicality = scoreCedhSeedPracticalityV14(practicalityCards, commanderNames);
    const structuralScore = typeof candidate.score === 'number' && Number.isFinite(candidate.score) ? candidate.score : 0;
    const finalScore = structuralScore + practicality.scoreAdjustment;
    verifiedCandidates.push({ candidate, comboCardNames, seedNames, exactPrintings, practicality, finalScore });
    audit.push({
      comboId: candidate.id,
      status: 'eligible-package-scored',
      structuralScore,
      practicalAdjustment: practicality.scoreAdjustment,
      finalScore: Math.round(finalScore * 100) / 100,
      totalManaValue: practicality.totalManaValue,
      deadPieceRisk: practicality.deadPieceRisk,
    });
  }

  verifiedCandidates.sort((a, b) =>
    b.finalScore - a.finalScore
    || a.practicality.totalManaValue - b.practicality.totalManaValue
    || Number(b.candidate.popularity ?? 0) - Number(a.candidate.popularity ?? 0));

  const winning = verifiedCandidates[0];
  if (winning) {
    return {
      status: 'eligible-winning-seed-package-found',
      commanderNames,
      commanderIdentity: identity,
      spellbookIdentityFilter: identityToken,
      comboId: winning.candidate.id,
      bracketTag: winning.candidate.bracketTag,
      results: winning.candidate.results,
      popularity: winning.candidate.popularity,
      comboCardNames: winning.comboCardNames,
      seedNames: winning.seedNames,
      exactPrintings: winning.exactPrintings,
      selectionScore: Math.round(winning.finalScore * 100) / 100,
      practicality: winning.practicality,
      printingPolicy: describePrintingPolicyV08(policy),
      queryAudit,
      audit,
      source: 'Commander Spellbook + Scryfall exact-printing verification',
      guidance: 'The package is only a construction seed. Candidate selection now prefers compact, lower-mana, commander-centric lines with useful cards outside the combo instead of popularity alone. The finished 100-card deck must still independently resolve, pass Commander legality and printing policy, and reproduce the winning combo through find-my-combos before it can satisfy the cEDH win-package gate.',
    };
  }

  return {
    status: 'no-eligible-winning-seed-package',
    commanderNames,
    commanderIdentity: identity,
    spellbookIdentityFilter: identityToken,
    checkedCandidates: candidates.length,
    printingPolicy: describePrintingPolicyV08(policy),
    queryAudit,
    audit,
    source: 'Commander Spellbook + Scryfall exact-printing verification',
  };
}
