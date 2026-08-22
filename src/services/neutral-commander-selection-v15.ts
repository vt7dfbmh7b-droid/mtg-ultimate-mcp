import type { ScryfallCard } from '../types/scryfall.js';
import {
  printingMatchesPolicyV08,
  resolvePrintingPolicyV08,
  type PrintingPolicyInputV08,
} from './printing-policy-v08.js';
import { boundedScryfallSearchV15 } from './scryfall-paged-search-v15.js';
import { getCardOracleText, getCardsByIdentifiers, inferCardRoles } from './scryfall.js';

export type NeutralArchetypeV15 =
  | 'combat-tokens'
  | 'equipment-voltron'
  | 'counters'
  | 'graveyard-reanimator'
  | 'aristocrats'
  | 'food-lifegain'
  | 'spells-control'
  | 'value-engine'
  | 'big-mana';

export interface NeutralStrategyScoreV15 {
  archetype: NeutralArchetypeV15;
  score: number;
  evidence: string[];
}

export interface NeutralCommanderCandidateV15 {
  commanderNames: string[];
  label: string;
  kind: 'single' | 'partner-pair';
  colorIdentity: string[];
  strategy: NeutralStrategyScoreV15;
  alternativeStrategies: NeutralStrategyScoreV15[];
  coherenceScore: number;
  selectionSignals: string[];
}

export interface DiscoverNeutralCommanderOptionsV15 extends PrintingPolicyInputV08 {
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

function addSignal(
  table: Map<NeutralArchetypeV15, { score: number; evidence: string[] }>,
  archetype: NeutralArchetypeV15,
  condition: boolean,
  points: number,
  evidence: string,
): void {
  if (!condition) return;
  const current = table.get(archetype);
  if (!current) return;
  current.score += points;
  current.evidence.push(`${evidence} +${points}`);
}

/**
 * Infer deck identity from command-zone rules text and generic card roles only.
 * Card names, EDHREC rank, colour count, mana value, and prior bracket reputation do not
 * contribute to the score. Names are reserved for deterministic final tie-breaking.
 */
export function inferNeutralStrategyV15(cards: readonly ScryfallCard[]): NeutralStrategyScoreV15[] {
  if (cards.length < 1 || cards.length > 2) throw new Error('Neutral strategy inference requires one or two commander cards.');
  const archetypes: NeutralArchetypeV15[] = [
    'combat-tokens',
    'equipment-voltron',
    'counters',
    'graveyard-reanimator',
    'aristocrats',
    'food-lifegain',
    'spells-control',
    'value-engine',
    'big-mana',
  ];
  const table = new Map(archetypes.map((archetype) => [archetype, { score: 0, evidence: [] as string[] }]));
  const roles = new Set(cards.flatMap((card) => inferCardRoles(card)));
  const text = cards.map(oracle).join(' // ');
  const repeatableOrPayoffLifeGain = /whenever [^.]*\byou gain(?:ed)?\b[^.]*\blife\b/i.test(text)
    || /\bif you gained\b[^.]*\blife\b/i.test(text)
    || /\bamount of life you gained\b/i.test(text)
    || /\bfor each\b[^.]*,\s*you gain\b[^.]*\blife\b/i.test(text);
  const convertsLifeGainToPressure = repeatableOrPayoffLifeGain
    && /\b(?:target|each|an) opponent\b[^.]*\bloses?\b[^.]*\blife\b/i.test(text);
  const recoversMilledCardsToHand = /\bcards? milled (?:this way )?[^.]{0,120}\binto your hand\b/i.test(text);

  addSignal(table, 'combat-tokens', roles.has('token production'), 6, 'token production');
  addSignal(table, 'combat-tokens', roles.has('extra combat'), 8, 'extra combat');
  addSignal(table, 'combat-tokens', roles.has('untap engine'), 4, 'combat untap potential');
  addSignal(table, 'combat-tokens', roles.has('haste'), 2, 'haste');
  addSignal(table, 'combat-tokens', /whenever [^.]* attacks|whenever [^.]* attack/i.test(text), 3, 'attack trigger');
  addSignal(table, 'combat-tokens', /tapped and attacking/i.test(text), 6, 'attacking-token text');
  addSignal(table, 'combat-tokens', /combat damage to a player/i.test(text), 3, 'combat-damage trigger');

  addSignal(table, 'equipment-voltron', roles.has('equipment'), 8, 'equipment role');
  addSignal(table, 'equipment-voltron', roles.has('protection'), 3, 'protection');
  addSignal(table, 'equipment-voltron', /equip |equipped creature|attach target|attach it/i.test(text), 7, 'equip/attach text');
  addSignal(table, 'equipment-voltron', /double strike|commander damage|power and toughness/i.test(text), 3, 'combat scaling');

  addSignal(table, 'counters', roles.has('+1/+1 counters'), 9, '+1/+1 counters');
  addSignal(table, 'counters', /proliferate/i.test(text), 7, 'proliferate');
  addSignal(table, 'counters', /move (?:a|any number of) .*counter|move .* counters/i.test(text), 6, 'counter movement');
  addSignal(table, 'counters', /counter is put|counters? (?:are|is) put|with .* counters?/i.test(text), 3, 'counter placement');

  addSignal(table, 'graveyard-reanimator', roles.has('graveyard recursion'), 9, 'graveyard recursion');
  addSignal(table, 'graveyard-reanimator', /from your graveyard|from a graveyard/i.test(text), 6, 'graveyard access');
  addSignal(table, 'graveyard-reanimator', /mill|surveil|discard/i.test(text), 5, 'graveyard setup');
  addSignal(table, 'graveyard-reanimator', recoversMilledCardsToHand, 7, 'milled-card recovery');
  addSignal(table, 'graveyard-reanimator', /return .* graveyard .* battlefield|put .* graveyard .* battlefield/i.test(text), 6, 'reanimation text');

  addSignal(table, 'aristocrats', roles.has('sacrifice synergy'), 7, 'sacrifice synergy');
  addSignal(table, 'aristocrats', roles.has('sacrifice outlet'), 8, 'sacrifice outlet');
  addSignal(table, 'aristocrats', roles.has('life drain'), 7, 'opponent drain');
  addSignal(table, 'aristocrats', /whenever .* dies|when .* dies/i.test(text), 6, 'death trigger');
  addSignal(table, 'aristocrats', /sacrifice (?:a|another) creature|sacrifice (?:a|another) permanent/i.test(text), 5, 'sacrifice text');

  addSignal(table, 'food-lifegain', /\bfoods?\b/i.test(text), 8, 'Food engine/payoff text');
  addSignal(table, 'food-lifegain', repeatableOrPayoffLifeGain, 7, 'repeatable life-gain engine/payoff');
  addSignal(table, 'food-lifegain', convertsLifeGainToPressure, 6, 'life-gain conversion to opponent pressure');

  addSignal(table, 'spells-control', roles.has('countermagic'), 8, 'countermagic');
  addSignal(table, 'spells-control', roles.has('stax/control'), 7, 'control restriction');
  addSignal(table, 'spells-control', roles.has('copy effect'), 6, 'copy effect');
  addSignal(table, 'spells-control', /whenever .* casts? .* spell|whenever you cast/i.test(text), 7, 'cast trigger');
  addSignal(table, 'spells-control', /instant or sorcery|instant and sorcery|noncreature spell/i.test(text), 5, 'spell-type payoff');

  addSignal(table, 'value-engine', roles.has('repeatable draw'), 9, 'repeatable draw');
  addSignal(table, 'value-engine', roles.has('card draw'), 5, 'card draw');
  addSignal(table, 'value-engine', roles.has('card selection'), 4, 'card selection');
  addSignal(table, 'value-engine', roles.has('treasure'), 5, 'Treasure production');
  addSignal(table, 'value-engine', roles.has('etb synergy'), 4, 'ETB engine');
  addSignal(table, 'value-engine', /you may cast|you may play|exile the top/i.test(text), 6, 'repeatable card access');

  addSignal(table, 'big-mana', roles.has('mana acceleration'), 8, 'mana acceleration');
  addSignal(table, 'big-mana', roles.has('cost reduction'), 8, 'cost reduction');
  addSignal(table, 'big-mana', roles.has('untap engine'), 4, 'untap engine');
  addSignal(table, 'big-mana', /add (?:one|two|three|four|five|\{).*mana|for each .* add/i.test(text), 5, 'mana-generation text');
  addSignal(table, 'big-mana', /costs? .* less to cast/i.test(text), 6, 'cost-reduction text');

  const ranked = archetypes.map((archetype) => {
    const value = table.get(archetype)!;
    return { archetype, score: value.score, evidence: [...value.evidence] };
  }).sort((a, b) => b.score - a.score || a.archetype.localeCompare(b.archetype));

  if ((ranked[0]?.score ?? 0) === 0) {
    const fallback = ranked.find((entry) => entry.archetype === 'value-engine');
    if (fallback) {
      fallback.score = 1;
      fallback.evidence.push('generic command-zone value fallback +1');
      ranked.sort((a, b) => b.score - a.score || a.archetype.localeCompare(b.archetype));
    }
  }
  return ranked;
}

function candidateFor(cards: readonly ScryfallCard[], kind: NeutralCommanderCandidateV15['kind']): NeutralCommanderCandidateV15 {
  const strategies = inferNeutralStrategyV15(cards);
  const strategy = strategies[0]!;
  const commanderNames = cards.map((card) => card.name).sort((a, b) => a.localeCompare(b));
  const individualTopScores = cards.map((card) => inferNeutralStrategyV15([card]).find((entry) => entry.archetype === strategy.archetype)?.score ?? 0);
  const sharedStrategyBonus = cards.length === 2 && individualTopScores.every((score) => score > 0) ? 4 : 0;
  const coherenceScore = strategy.score + sharedStrategyBonus;
  return {
    commanderNames,
    label: commanderNames.join(' + '),
    kind,
    colorIdentity: colorIdentity(cards),
    strategy,
    alternativeStrategies: strategies.slice(1, 4),
    coherenceScore,
    selectionSignals: [
      ...strategy.evidence,
      ...(sharedStrategyBonus > 0 ? [`both partners support ${strategy.archetype} +${sharedStrategyBonus}`] : []),
      'no commander-name, EDHREC, mana-value, colour-count, bracket, or cEDH bonus applied',
    ],
  };
}

export function rankNeutralCommanderCandidatesV15(
  cards: readonly ScryfallCard[],
  maxCandidates = 20,
): NeutralCommanderCandidateV15[] {
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
  const singles = commanders.map((card) => candidateFor([card], 'single'));
  const partnerCards = commanders.filter(unrestrictedPartner);
  if (partnerCards.length > 100) throw new Error('Neutral commander discovery found too many unrestricted Partner cards for bounded pair enumeration.');
  const pairs: NeutralCommanderCandidateV15[] = [];
  for (let left = 0; left < partnerCards.length; left += 1) {
    for (let right = left + 1; right < partnerCards.length; right += 1) {
      pairs.push(candidateFor([partnerCards[left]!, partnerCards[right]!], 'partner-pair'));
    }
  }
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(maxCandidates)));
  return [...singles, ...pairs]
    .sort((a, b) => b.coherenceScore - a.coherenceScore || a.label.localeCompare(b.label))
    .slice(0, safeLimit);
}

function exactPrintingKey(set: string, collectorNumber: string): string {
  return `${set.trim().toLocaleLowerCase()}|${collectorNumber.replace(/^0+/, '') || '0'}`;
}

/**
 * Exhaustive-within-bounds themed commander discovery for the neutral lane.
 * Unlike the older auto-commander control, the discovery result is ranked by semantic deck
 * identity/coherence rather than command-zone efficiency or power proxies.
 */
export async function discoverNeutralCommanderCandidatesV15(
  options: DiscoverNeutralCommanderOptionsV15 = {},
): Promise<{
  discoveredCardCount: number;
  discoveryBuckets: Array<{ filter: string; count: number }>;
  candidates: NeutralCommanderCandidateV15[];
}> {
  const policy = await resolvePrintingPolicyV08(options);
  if (!policy.family && policy.allowedSetCodes.length === 0 && policy.exactSpecialPrintings.length === 0) {
    throw new Error('Neutral automatic commander discovery requires a bounded printing policy.');
  }
  if (policy.family && policy.familyMatchedSetCodes.length === 0) {
    throw new Error(`Printing-family discovery for ${policy.family} returned no matching physical set codes; refusing to claim exhaustive neutral commander discovery.`);
  }

  const discovered: ScryfallCard[] = [];
  const discoveryBuckets: Array<{ filter: string; count: number }> = [];
  if (policy.allowedSetCodes.length > 0) {
    const setClause = `(${policy.allowedSetCodes.map((set) => `set:${set}`).join(' OR ')})`;
    const familySearch = await boundedScryfallSearchV15(`${setClause} is:commander game:paper`, {
      maxCards: 1_000,
      maxPages: 20,
      minRequestGapMs: 300,
    });
    discovered.push(...familySearch.cards);
    discoveryBuckets.push({ filter: `family-sets-paginated:${familySearch.pagesFetched}-pages`, count: familySearch.cards.length });
  }

  const specialSelectors = [...new Map(
    policy.exactSpecialPrintings.map((entry) => [exactPrintingKey(entry.set, entry.collectorNumber), entry]),
  ).values()];
  if (specialSelectors.length > 0) {
    const specials = await getCardsByIdentifiers(specialSelectors.map((entry) => ({
      name: entry.oracleName,
      set: entry.set,
      collectorNumber: entry.collectorNumber,
    })));
    if (specials.notFound.length > 0) {
      throw new Error(`One or more curated special printing selectors could not be resolved during neutral commander discovery: ${specials.notFound.join(', ')}`);
    }
    const specialCommanders = specials.cards.filter(standaloneCommander);
    discovered.push(...specialCommanders);
    discoveryBuckets.push({ filter: 'curated-special-printings-exact', count: specialCommanders.length });
  }

  const eligible = discovered.filter((card) => printingMatchesPolicyV08(card, policy));
  const unique = [...new Map(eligible.map((card) => [card.oracle_id ?? normalize(card.name), card])).values()];
  const candidates = rankNeutralCommanderCandidatesV15(unique, options.maxCandidates ?? 30);
  if (candidates.length === 0) throw new Error('No eligible standalone Commander candidates were discovered under the neutral printing policy.');
  return { discoveredCardCount: unique.length, discoveryBuckets, candidates };
}
