import type { ScryfallCard } from '../types/scryfall.js';
import {
  printingMatchesPolicyV08,
  resolvePrintingPolicyV08,
  type PrintingPolicyInputV08,
} from './printing-policy-v08.js';
import { getCardOracleText, inferCardRoles, searchCards } from './scryfall.js';

export interface AutoCommanderCandidateV15 {
  commanderNames: string[];
  label: string;
  kind: 'single' | 'partner-pair';
  score: number;
  colorIdentity: string[];
  averageManaValue: number;
  signals: string[];
}

export interface DiscoverAutoCommanderOptionsV15 extends PrintingPolicyInputV08 {
  maxCandidates?: number;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function oracle(card: ScryfallCard): string {
  return getCardOracleText(card).replace(/\s+/g, ' ').trim();
}

function standaloneCommander(card: ScryfallCard): boolean {
  if (card.legalities.commander !== 'legal') return false;
  if (/legendary creature/i.test(card.type_line)) return true;
  return /can be your commander/i.test(oracle(card));
}

function unrestrictedPartner(card: ScryfallCard): boolean {
  if (!standaloneCommander(card)) return false;
  const text = oracle(card);
  const keywordPartner = card.keywords.some((keyword) => normalize(keyword) === 'partner');
  const plainPartnerText = /(?:^|\n|\.)\s*Partner\s*(?:\(|$|\.)/i.test(getCardOracleText(card));
  const restrictedPartner = /partner with|doctor's companion|friends forever|choose a background/i.test(text);
  return (keywordPartner || plainPartnerText) && !restrictedPartner;
}

function colorIdentity(cards: readonly ScryfallCard[]): string[] {
  return [...new Set(cards.flatMap((card) => card.color_identity))].sort();
}

function roleSignals(cards: readonly ScryfallCard[]): { score: number; signals: string[] } {
  const roles = new Set(cards.flatMap((card) => inferCardRoles(card)));
  const weights: Array<[string, number]> = [
    ['tutor', 13],
    ['repeatable draw', 11],
    ['mana acceleration', 9],
    ['cost reduction', 8],
    ['extra combat', 7],
    ['untap engine', 6],
    ['stax/control', 6],
    ['card draw', 5],
    ['token production', 5],
    ['protection', 4],
    ['treasure', 4],
    ['card selection', 3],
    ['haste', 2],
  ];
  let score = 0;
  const signals: string[] = [];
  for (const [role, weight] of weights) {
    if (!roles.has(role)) continue;
    score += weight;
    signals.push(`${role} +${weight}`);
  }
  return { score, signals };
}

function oracleSignals(cards: readonly ScryfallCard[]): { score: number; signals: string[] } {
  const text = cards.map(oracle).join(' // ');
  let score = 0;
  const signals: string[] = [];
  const add = (condition: boolean, points: number, label: string): void => {
    if (!condition) return;
    score += points;
    signals.push(`${label} +${points}`);
  };

  add(/additional combat phase/i.test(text) && /untap all attacking creatures/i.test(text), 12, 'repeatable-combat text');
  add(/whenever [^.]* attacks/i.test(text), 5, 'attack-trigger engine');
  add(/whenever [^.]* casts? a spell|whenever [^.]* cast a spell/i.test(text), 5, 'cast-trigger engine');
  add(/whenever [^.]* deals? combat damage/i.test(text), 4, 'combat-damage engine');
  add(/you may cast|you may play/i.test(text), 4, 'card-access text');
  add(/add (?:one|two|three|four|five|\{)/i.test(text), 3, 'mana text');
  add(/search your library/i.test(text), 6, 'tutor text');
  add(/draw (?:a|one|two|three|four|five|\d+) cards?/i.test(text), 4, 'draw text');

  return { score, signals };
}

function scoreCommanderGroup(cards: readonly ScryfallCard[], kind: AutoCommanderCandidateV15['kind']): AutoCommanderCandidateV15 {
  const colors = colorIdentity(cards);
  const averageManaValue = cards.reduce((sum, card) => sum + card.cmc, 0) / cards.length;
  const role = roleSignals(cards);
  const text = oracleSignals(cards);
  const commandZoneEfficiency = Math.max(0, 30 - averageManaValue * 6);
  const colorAccess = colors.length * 11;
  const pairTax = kind === 'partner-pair' ? -5 : 0;
  const score = Number((commandZoneEfficiency + colorAccess + role.score + text.score + pairTax).toFixed(3));
  const commanderNames = cards.map((card) => card.name).sort((a, b) => a.localeCompare(b));

  return {
    commanderNames,
    label: commanderNames.join(' + '),
    kind,
    score,
    colorIdentity: colors,
    averageManaValue: Number(averageManaValue.toFixed(3)),
    signals: [
      `color-access +${colorAccess}`,
      `command-zone-efficiency +${Number(commandZoneEfficiency.toFixed(3))}`,
      ...role.signals,
      ...text.signals,
      ...(pairTax ? [`partner-pair-tax ${pairTax}`] : []),
    ],
  };
}

/**
 * Pure deterministic ranking. Card names are used only as a final tie-breaker and never
 * award power points. This makes the selector testable against renamed lookalikes and
 * prevents a famous commander name from becoming hidden hand-authored preference.
 */
export function rankAutoCommanderCandidatesV15(
  cards: readonly ScryfallCard[],
  maxCandidates = 12,
): AutoCommanderCandidateV15[] {
  const byOracle = new Map<string, ScryfallCard>();
  for (const card of cards) {
    if (!standaloneCommander(card)) continue;
    const key = card.oracle_id ?? normalize(card.name);
    const current = byOracle.get(key);
    if (!current || `${card.set}|${card.collector_number}`.localeCompare(`${current.set}|${current.collector_number}`) < 0) {
      byOracle.set(key, card);
    }
  }
  const commanders = [...byOracle.values()];
  const singles = commanders.map((card) => scoreCommanderGroup([card], 'single'));
  const partnerCards = commanders.filter(unrestrictedPartner);
  const partnerPairs: AutoCommanderCandidateV15[] = [];
  for (let left = 0; left < partnerCards.length; left += 1) {
    for (let right = left + 1; right < partnerCards.length; right += 1) {
      partnerPairs.push(scoreCommanderGroup([partnerCards[left]!, partnerCards[right]!], 'partner-pair'));
    }
  }

  return [...singles, ...partnerPairs]
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, Math.max(1, Math.min(50, Math.trunc(maxCandidates))));
}

export async function discoverAutoCommanderCandidatesV15(
  options: DiscoverAutoCommanderOptionsV15 = {},
): Promise<{
  policy: Awaited<ReturnType<typeof resolvePrintingPolicyV08>>;
  discoveredCardCount: number;
  discoveryBuckets: Array<{ filter: string; count: number }>;
  candidates: AutoCommanderCandidateV15[];
}> {
  const policy = await resolvePrintingPolicyV08(options);
  if (!policy.searchClause) throw new Error('Automatic commander discovery requires a bounded printing policy.');

  // searchCards intentionally caps one query at 50 records. Partition first by mana
  // value, then by a mutually exclusive color class. This avoids silent page-2 loss while
  // keeping every query bounded. If any partition still hits 50, fail closed and split again.
  const manaFilters = [
    'cmc=0',
    'cmc=1',
    'cmc=2',
    'cmc=3',
    'cmc=4',
    'cmc=5',
    'cmc=6',
    'cmc=7',
    'cmc>=8',
  ];
  const colorFilters = ['is:multicolored', 'is:monocolored', 'is:colorless'];
  const discovered: ScryfallCard[] = [];
  const discoveryBuckets: Array<{ filter: string; count: number }> = [];
  for (const manaFilter of manaFilters) {
    for (const colorFilter of colorFilters) {
      const filter = `${manaFilter} ${colorFilter}`;
      const query = `${policy.searchClause} is:commander game:paper ${filter}`;
      try {
        const cards = await searchCards(query, 50);
        discoveryBuckets.push({ filter, count: cards.length });
        if (cards.length >= 50) {
          throw new Error(`Automatic commander discovery bucket ${filter} reached the 50-card query ceiling; split the bucket further before claiming exhaustive discovery.`);
        }
        discovered.push(...cards);
      } catch (error) {
        if (error instanceof Error && /50-card query ceiling/.test(error.message)) throw error;
        discoveryBuckets.push({ filter, count: 0 });
      }
    }
  }

  const eligible = discovered.filter((card) => printingMatchesPolicyV08(card, policy));
  const unique = [...new Map(eligible.map((card) => [card.oracle_id ?? normalize(card.name), card])).values()];
  const candidates = rankAutoCommanderCandidatesV15(unique, options.maxCandidates ?? 12);
  if (candidates.length === 0) throw new Error('No eligible standalone Commander candidates were discovered under the printing policy.');

  return {
    policy,
    discoveredCardCount: unique.length,
    discoveryBuckets,
    candidates,
  };
}
