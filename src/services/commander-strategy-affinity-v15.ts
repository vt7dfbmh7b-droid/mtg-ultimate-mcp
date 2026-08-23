import type { ScryfallCard } from '../types/scryfall.js';
import type { ParsedDeck } from './deck.js';
import {
  inferNeutralStrategyV15,
  type NeutralArchetypeV15,
  type NeutralStrategyScoreV15,
} from './neutral-commander-selection-v15.js';
import { getCardOracleText } from './scryfall.js';

export interface CommanderDirectSupportRuleV15 {
  kind: 'cast-noncreature-min-mv';
  archetype: 'spells-control';
  minManaValue: number;
  score: number;
  evidence: string;
}

export interface CommanderStrategyContextV15 {
  commanderNames: string[];
  strategies: NeutralStrategyScoreV15[];
  /**
   * Explicit command-zone mechanics that make otherwise generic cards direct strategy fuel.
   * Optional for backward compatibility with older callers/tests that construct a context literal.
   */
  directSupportRules?: CommanderDirectSupportRuleV15[];
}

export interface CommanderStrategyMatchV15 {
  archetype: NeutralArchetypeV15;
  commanderScore: number;
  cardScore: number;
  overlapScore: number;
}

export interface CardCommanderStrategyAffinityV15 {
  score: number;
  matches: CommanderStrategyMatchV15[];
}

export const SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15 = 6;
const DIRECT_COMMANDER_MECHANIC_SUPPORT_SCORE_V15 = 4;

export function substantiveCommanderStrategyAffinityScoreV15(
  affinity: CardCommanderStrategyAffinityV15,
): number {
  return affinity.matches
    .filter((match) => match.commanderScore >= SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15)
    .reduce((sum, match) => sum + match.overlapScore, 0);
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function deriveDirectSupportRulesV15(
  commanders: readonly ScryfallCard[],
  strategies: readonly NeutralStrategyScoreV15[],
): CommanderDirectSupportRuleV15[] {
  const spellsControl = strategies.find((strategy) => strategy.archetype === 'spells-control');
  if (!spellsControl || spellsControl.score < SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15) return [];

  const rules: CommanderDirectSupportRuleV15[] = [];
  for (const commander of commanders) {
    const text = getCardOracleText(commander).replace(/\s+/g, ' ').trim();
    const match = text.match(/whenever you cast (?:a |an )?noncreature spell with mana value (\d+) or greater/i);
    const minimum = match?.[1] ? Number.parseInt(match[1], 10) : Number.NaN;
    if (!Number.isFinite(minimum) || minimum < 0) continue;
    rules.push({
      kind: 'cast-noncreature-min-mv',
      archetype: 'spells-control',
      minManaValue: minimum,
      score: DIRECT_COMMANDER_MECHANIC_SUPPORT_SCORE_V15,
      evidence: `explicit command-zone trigger rewards noncreature spells with mana value ${minimum} or greater`,
    });
  }

  return rules.filter((rule, index, all) => (
    all.findIndex((candidate) => candidate.kind === rule.kind
      && candidate.archetype === rule.archetype
      && candidate.minManaValue === rule.minManaValue) === index
  ));
}

function cardSatisfiesDirectSupportRuleV15(
  card: ScryfallCard,
  rule: CommanderDirectSupportRuleV15,
): boolean {
  if (rule.kind !== 'cast-noncreature-min-mv') return false;
  const typeLine = card.type_line.toLocaleLowerCase();
  if (typeLine.includes('land') || typeLine.includes('creature')) return false;
  if (card.cmc >= rule.minManaValue) return true;

  // X contributes to a spell's mana value while it is on the stack. A noncreature X spell whose
  // printed/base CMC is below the threshold can therefore still deliberately satisfy the trigger.
  return /\{X\}/i.test(card.mana_cost ?? '');
}

function directSupportScoreForArchetypeV15(
  card: ScryfallCard,
  context: CommanderStrategyContextV15,
  archetype: NeutralArchetypeV15,
): number {
  return Math.max(0, ...(context.directSupportRules ?? [])
    .filter((rule) => rule.archetype === archetype && cardSatisfiesDirectSupportRuleV15(card, rule))
    .map((rule) => rule.score));
}

/**
 * Reuse the existing V0.15 command-zone strategy inference when the commander cards are
 * already resolved, including during construction before a full ParsedDeck exists.
 */
export function deriveCommanderStrategyContextFromCommandersV15(
  commanders: readonly ScryfallCard[],
): CommanderStrategyContextV15 {
  const commanderNames = commanders.map((card) => card.name);
  if (commanders.length < 1 || commanders.length > 2) {
    return { commanderNames, strategies: [], directSupportRules: [] };
  }

  const strategies = inferNeutralStrategyV15(commanders)
    .filter((strategy) => strategy.score > 0)
    .slice(0, 3);
  return {
    commanderNames,
    strategies,
    directSupportRules: deriveDirectSupportRulesV15(commanders, strategies),
  };
}

/**
 * Bridge existing V0.15 commander strategy inference into card-selection callers.
 *
 * This does not define another strategy model. It preserves the top three already-inferred
 * command-zone strategies so build/upgrade code can prefer cards that support the deck's
 * existing primary and secondary identities instead of looking only at generic role counts.
 */
export function deriveCommanderStrategyContextV15(
  parsed: ParsedDeck,
  cards: readonly ScryfallCard[],
): CommanderStrategyContextV15 {
  const commanderNames = parsed.commanders.map((entry) => entry.name);
  const wanted = new Set(commanderNames.map(normalizeName));
  const commanders = cards.filter((card) => wanted.has(normalizeName(card.name)));
  if (commanders.length !== commanderNames.length || commanders.length < 1 || commanders.length > 2) {
    return { commanderNames, strategies: [], directSupportRules: [] };
  }

  const resolvedContext = deriveCommanderStrategyContextFromCommandersV15(commanders);
  return {
    commanderNames,
    strategies: resolvedContext.strategies,
    directSupportRules: resolvedContext.directSupportRules ?? [],
  };
}

/**
 * Compare one card with an already-derived commander strategy context.
 *
 * The overlap score starts with the existing V0.15 archetype score. Explicit command-zone
 * mechanics may add bounded evidence that an otherwise generic card is direct fuel for that
 * same already-inferred archetype. This closes the gap where an optimizer could cut the exact
 * class of spell a commander explicitly rewards merely because the spell itself has no generic
 * archetype keyword. The commander's own strategy score remains the ceiling.
 */
export function cardCommanderStrategyAffinityV15(
  card: ScryfallCard,
  context: CommanderStrategyContextV15,
): CardCommanderStrategyAffinityV15 {
  if (context.strategies.length === 0) return { score: 0, matches: [] };

  const cardStrategies = new Map(
    inferNeutralStrategyV15([card]).map((strategy) => [strategy.archetype, strategy] as const),
  );
  const matches: CommanderStrategyMatchV15[] = [];

  for (const commanderStrategy of context.strategies) {
    const genericCardScore = cardStrategies.get(commanderStrategy.archetype)?.score ?? 0;
    const directSupportScore = directSupportScoreForArchetypeV15(card, context, commanderStrategy.archetype);
    const cardScore = Math.max(genericCardScore, directSupportScore);
    if (cardScore <= 0) continue;
    const overlapScore = Math.min(commanderStrategy.score, cardScore);
    if (overlapScore <= 0) continue;
    matches.push({
      archetype: commanderStrategy.archetype,
      commanderScore: commanderStrategy.score,
      cardScore,
      overlapScore,
    });
  }

  return {
    score: matches.reduce((sum, match) => sum + match.overlapScore, 0),
    matches,
  };
}