import type { ScryfallCard } from '../types/scryfall.js';
import { buildDeckMetrics, type ParsedDeck } from './deck.js';
import { inferCardRoles, searchCards, summarizeCard } from './scryfall.js';

export interface UpgradeOptions {
  targetBracket?: number;
  maxUsdPerCard?: number;
  allowedSets?: string[];
  themeQuery?: string;
  excludedCards?: string[];
  maxCandidatesPerRole?: number;
}

interface StructuralTarget {
  ramp: number;
  draw: number;
  interaction: number;
  protection: number;
  tutors: number;
  earlyPlays: number;
}

const TARGETS: Record<number, StructuralTarget> = {
  1: { ramp: 6, draw: 6, interaction: 5, protection: 2, tutors: 0, earlyPlays: 8 },
  2: { ramp: 8, draw: 8, interaction: 8, protection: 3, tutors: 1, earlyPlays: 10 },
  3: { ramp: 10, draw: 10, interaction: 10, protection: 4, tutors: 3, earlyPlays: 12 },
  4: { ramp: 12, draw: 12, interaction: 14, protection: 6, tutors: 6, earlyPlays: 16 },
  5: { ramp: 14, draw: 14, interaction: 18, protection: 8, tutors: 10, earlyPlays: 20 },
};

function clampBracket(value: number | undefined): number {
  return Math.max(1, Math.min(5, Math.trunc(value ?? 4)));
}

function identityQuery(identity: string[]): string {
  if (identity.length === 0) return 'id:c';
  return `id<=${identity.join('').toLowerCase()}`;
}

function setQuery(sets: string[] | undefined): string {
  const normalized = [...new Set((sets ?? []).map((set) => set.trim().toLowerCase()).filter(Boolean))];
  if (normalized.length === 0) return '';
  return `(${normalized.map((set) => `set:${set}`).join(' OR ')})`;
}

function roleSearchQuery(role: string, identity: string[], options: UpgradeOptions): string {
  const roleClause: Record<string, string> = {
    ramp: '(o:"add" OR o:"search your library for" OR o:"costs" )',
    draw: '(o:"draw" OR o:"scry" OR o:"surveil" OR o:"look at the top")',
    interaction: '(o:"counter target spell" OR o:"destroy target" OR o:"exile target" OR o:"return target")',
    protection: '(o:"hexproof" OR o:"indestructible" OR o:"protection from" OR o:"phase out")',
    tutor: 'o:"search your library for"',
    early: 'mv<=2',
  };
  return [
    'f:commander',
    identityQuery(identity),
    roleClause[role] ?? '',
    setQuery(options.allowedSets),
    options.themeQuery?.trim() ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

function usdPrice(card: ScryfallCard): number | null {
  const value = card.prices?.usd;
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cardMatchesRole(card: ScryfallCard, role: string): boolean {
  const roles = new Set(inferCardRoles(card));
  if (role === 'ramp') return roles.has('mana acceleration') || roles.has('land ramp') || roles.has('cost reduction');
  if (role === 'draw') return roles.has('card draw') || roles.has('repeatable draw') || roles.has('card selection');
  if (role === 'interaction') return roles.has('spot interaction') || roles.has('countermagic') || roles.has('board wipe') || roles.has('free interaction');
  if (role === 'protection') return roles.has('protection') || roles.has('board protection');
  if (role === 'tutor') return roles.has('tutor');
  if (role === 'early') return !card.type_line.toLowerCase().includes('land') && card.cmc <= 2;
  return false;
}

function candidateScore(card: ScryfallCard, role: string): number {
  let score = cardMatchesRole(card, role) ? 100 : 0;
  score += Math.max(0, 8 - card.cmc) * 3;
  if (inferCardRoles(card).includes('fast mana')) score += 20;
  if (inferCardRoles(card).includes('free interaction')) score += 20;
  if (card.edhrec_rank !== undefined) score += Math.max(0, 20 - Math.log10(card.edhrec_rank + 1) * 5);
  return score;
}

function cutCandidates(parsed: ParsedDeck, cards: ScryfallCard[]): Array<Record<string, unknown>> {
  const mainNames = new Set(parsed.main.map((entry) => entry.name.toLocaleLowerCase()));
  return cards
    .filter((card) => mainNames.has(card.name.toLocaleLowerCase()) && !card.type_line.toLowerCase().includes('land'))
    .map((card) => {
      const roles = inferCardRoles(card).filter((role) => !['creature', 'equipment', 'etb synergy'].includes(role));
      let cutPressure = Math.max(0, card.cmc - 3) * 2;
      if (roles.length === 0) cutPressure += 5;
      if (card.cmc >= 6) cutPressure += 4;
      if (roles.includes('card draw') || roles.includes('tutor') || roles.includes('spot interaction') || roles.includes('countermagic') || roles.includes('protection')) cutPressure -= 4;
      const reasons: string[] = [];
      if (card.cmc >= 6) reasons.push('high mana value');
      if (roles.length === 0) reasons.push('few detected utility roles');
      if (card.cmc >= 4 && roles.length <= 1) reasons.push('expensive relative to detected flexibility');
      return {
        card: summarizeCard(card),
        heuristicCutPressure: Number(cutPressure.toFixed(1)),
        reasons: reasons.length > 0 ? reasons : ['no strong structural cut signal; only consider if it underperforms in actual games'],
      };
    })
    .filter((item) => Number(item.heuristicCutPressure) > 0)
    .sort((a, b) => Number(b.heuristicCutPressure) - Number(a.heuristicCutPressure))
    .slice(0, 15);
}

export async function suggestDeckUpgrades(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  allowedIdentity: string[],
  options: UpgradeOptions = {},
): Promise<Record<string, unknown>> {
  const targetBracket = clampBracket(options.targetBracket);
  const targets = TARGETS[targetBracket] as StructuralTarget;
  const metrics = buildDeckMetrics(parsed, cards);
  const deficits = [
    { role: 'ramp', current: metrics.rampCount, target: targets.ramp },
    { role: 'draw', current: metrics.drawCount, target: targets.draw },
    { role: 'interaction', current: metrics.interactionCount, target: targets.interaction },
    { role: 'protection', current: metrics.protectionCount, target: targets.protection },
    { role: 'tutor', current: metrics.tutorCount, target: targets.tutors },
    { role: 'early', current: metrics.earlyPlayCount, target: targets.earlyPlays },
  ]
    .map((item) => ({ ...item, deficit: Math.max(0, item.target - item.current) }))
    .filter((item) => item.deficit > 0)
    .sort((a, b) => b.deficit - a.deficit);

  const existing = new Set([...parsed.commanders, ...parsed.main].map((entry) => entry.name.toLocaleLowerCase()));
  const excluded = new Set((options.excludedCards ?? []).map((name) => name.toLocaleLowerCase()));
  const maxCandidates = Math.max(1, Math.min(10, Math.trunc(options.maxCandidatesPerRole ?? 5)));
  const candidateGroups: Array<Record<string, unknown>> = [];

  for (const deficit of deficits.slice(0, 5)) {
    const query = roleSearchQuery(deficit.role, allowedIdentity, options);
    let results: ScryfallCard[] = [];
    try {
      results = await searchCards(query, 40);
    } catch {
      continue;
    }
    const candidates = results
      .filter((card) => !existing.has(card.name.toLocaleLowerCase()))
      .filter((card) => !excluded.has(card.name.toLocaleLowerCase()))
      .filter((card) => card.legalities.commander === 'legal')
      .filter((card) => cardMatchesRole(card, deficit.role))
      .filter((card) => {
        if (options.maxUsdPerCard === undefined) return true;
        const price = usdPrice(card);
        return price !== null && price <= options.maxUsdPerCard;
      })
      .sort((a, b) => candidateScore(b, deficit.role) - candidateScore(a, deficit.role))
      .slice(0, maxCandidates)
      .map((card) => ({
        card: summarizeCard(card),
        score: Number(candidateScore(card, deficit.role).toFixed(1)),
        whyItFits: `Addresses the detected ${deficit.role} deficit; final inclusion still depends on commander synergy, theme, combo plan, and cards being removed.`,
      }));
    candidateGroups.push({ ...deficit, searchQuery: query, candidates });
  }

  return {
    targetBracket,
    currentMetrics: metrics,
    structuralTargets: targets,
    structuralDeficits: deficits,
    candidateAddsByDeficit: candidateGroups,
    candidateCuts: cutCandidates(parsed, cards),
    constraints: {
      maxUsdPerCard: options.maxUsdPerCard ?? null,
      allowedSets: options.allowedSets ?? [],
      themeQuery: options.themeQuery ?? null,
      excludedCards: options.excludedCards ?? [],
    },
    caveats: [
      'These role-count targets are engineering heuristics for deck consistency and are not the official Commander bracket definitions.',
      'Candidate ordering combines role fit, mana efficiency, and EDHREC-rank/community-adoption signal; popularity is not proof of optimality.',
      'Cut suggestions deliberately avoid claiming thematic/high-mana cards are bad; validate them against simulations, actual games, and reference-deck evidence.',
      'Scryfall USD prices are reference values rather than guaranteed store checkout prices, and this version does not yet convert them to NZD.',
    ],
  };
}
