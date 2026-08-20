import type { ScryfallCard } from '../types/scryfall.js';
import type { ParsedDeck } from './deck.js';
import {
  inferNeutralStrategyV15,
  type NeutralArchetypeV15,
  type NeutralStrategyScoreV15,
} from './neutral-commander-selection-v15.js';

export interface CommanderStrategyContextV15 {
  commanderNames: string[];
  strategies: NeutralStrategyScoreV15[];
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

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase();
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
    return { commanderNames, strategies: [] };
  }

  return {
    commanderNames,
    strategies: inferNeutralStrategyV15(commanders)
      .filter((strategy) => strategy.score > 0)
      .slice(0, 3),
  };
}

/**
 * Compare one card with an already-derived commander strategy context.
 *
 * The overlap score is intentionally built only from the existing V0.15 strategy scores:
 * for each shared archetype, count the smaller of the commander score and card score. This
 * prevents a candidate from receiving more affinity for an archetype than either side
 * actually demonstrated and avoids inventing a second weighting system.
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
    const cardStrategy = cardStrategies.get(commanderStrategy.archetype);
    if (!cardStrategy || cardStrategy.score <= 0) continue;
    const overlapScore = Math.min(commanderStrategy.score, cardStrategy.score);
    if (overlapScore <= 0) continue;
    matches.push({
      archetype: commanderStrategy.archetype,
      commanderScore: commanderStrategy.score,
      cardScore: cardStrategy.score,
      overlapScore,
    });
  }

  return {
    score: matches.reduce((sum, match) => sum + match.overlapScore, 0),
    matches,
  };
}
