import type { ScryfallCard } from '../types/scryfall.js';
import type { ParsedDeck } from './deck.js';
import {
  inferNeutralStrategyV15,
  type NeutralArchetypeV15,
  type NeutralStrategyScoreV15,
} from './neutral-commander-selection-v15.js';
import { getCardOracleText } from './scryfall.js';

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

export interface UpgradeDeckStrategySupportV15 {
  archetype: NeutralArchetypeV15;
  commanderScore: number;
  supportCount: number;
  affinityTotal: number;
}

export interface UpgradeDeckStrategyRetentionV15 {
  status: 'preserved' | 'strategy-density-loss' | 'evidence-incomplete';
  evidenceComplete: boolean;
  preserved: boolean;
  unresolvedBefore: string[];
  unresolvedAfter: string[];
  strategies: Array<{
    archetype: NeutralArchetypeV15;
    commanderScore: number;
    beforeSupportCount: number;
    afterSupportCount: number;
    supportDelta: number;
    beforeAffinityTotal: number;
    afterAffinityTotal: number;
    affinityDelta: number;
    preserved: boolean;
  }>;
  losses: Array<{
    archetype: NeutralArchetypeV15;
    supportDelta: number;
    affinityDelta: number;
  }>;
  acceptanceRule: string;
}

export const SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15 = 6;
const DECK_SUPPORTED_STRATEGY_MIN_SUPPORT_V15 = 6;
const DECK_SUPPORTED_STRATEGY_MIN_BRIDGE_SUPPORT_V15 = 3;
const DECK_SUPPORTED_STRATEGY_MIN_AFFINITY_V15 = 72;
const MULTIPLAYER_SCOPE_QUALITY_BONUS_V15 = 2;

export function substantiveCommanderStrategyAffinityScoreV15(
  affinity: CardCommanderStrategyAffinityV15,
): number {
  const substantiveOverlap = affinity.matches
    .filter((match) => match.commanderScore >= SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15)
    .reduce((sum, match) => sum + match.overlapScore, 0);
  if (substantiveOverlap < SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15) return substantiveOverlap;

  // Aggregate affinity may contain a quality premium, but it can never manufacture substantive
  // strategy support. Only add the premium after the raw substantive overlap already clears the
  // shared threshold, and exclude any base overlap from non-substantive context matches.
  const allBaseOverlap = affinity.matches.reduce((sum, match) => sum + match.overlapScore, 0);
  const qualityPremium = Math.max(0, affinity.score - allBaseOverlap);
  return substantiveOverlap + qualityPremium;
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function repeatableTablewideOpponentPressureV15(card: ScryfallCard): boolean {
  const oracle = getCardOracleText(card).toLocaleLowerCase();
  const trigger = '\\b(?:when|whenever|at the beginning of|at the start of)\\b[^.\\n]{0,260}';
  const activation = ':\\s*[^.\\n]{0,220}';
  const tablewideLoss = '\\beach opponent\\b[^.\\n]{0,120}\\bloses? (?:\\d+|one|two|three|four|five|that much) life\\b';
  const tablewideDamage = '\\bdeals? [^.\\n]{0,120} damage to each opponent\\b';
  return new RegExp(`${trigger}(?:${tablewideLoss}|${tablewideDamage})`).test(oracle)
    || new RegExp(`${activation}(?:${tablewideLoss}|${tablewideDamage})`).test(oracle);
}

function multiplayerStrategyQualityBonusV15(
  card: ScryfallCard,
  archetype: NeutralArchetypeV15,
): number {
  if (archetype !== 'aristocrats' && archetype !== 'food-lifegain') return 0;
  return repeatableTablewideOpponentPressureV15(card) ? MULTIPLAYER_SCOPE_QUALITY_BONUS_V15 : 0;
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

  const resolvedContext = deriveCommanderStrategyContextFromCommandersV15(commanders);
  return {
    commanderNames,
    strategies: resolvedContext.strategies,
  };
}

/**
 * Preserve the strongest strategy that is evidenced by the whole starting deck even when the
 * face commander does not spell that secondary plan out. Precons commonly do this: a commander
 * may create tokens while the 99 supplies the sacrifice outlets and death payoffs.
 *
 * Promotion is deliberately narrow. A secondary strategy needs at least six independently
 * substantive support cards, three cards that also bridge to a substantive command-zone plan,
 * and seventy-two aggregate affinity points. Only the strongest qualifying strategy is promoted,
 * and the final context remains capped at three identities.
 */
export function deriveUpgradeStrategyContextV15(
  parsed: ParsedDeck,
  cards: readonly ScryfallCard[],
): CommanderStrategyContextV15 {
  const commanderContext = deriveCommanderStrategyContextV15(parsed, cards);
  const substantiveCommanderStrategies = commanderContext.strategies
    .filter((strategy) => strategy.score >= SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15);
  if (substantiveCommanderStrategies.length === 0) return commanderContext;

  const substantiveCommanderArchetypes = new Set(
    substantiveCommanderStrategies.map((strategy) => strategy.archetype),
  );
  const cardByName = new Map(cards.map((card) => [normalizeName(card.name), card] as const));
  const evidence = new Map<NeutralArchetypeV15, {
    supportCount: number;
    bridgeSupportCount: number;
    affinityTotal: number;
  }>();

  for (const entry of parsed.main) {
    const card = cardByName.get(normalizeName(entry.name));
    if (!card) continue;
    const strategies = inferNeutralStrategyV15([card])
      .filter((strategy) => strategy.score >= SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15);
    const bridgesToCommander = strategies.some((strategy) => (
      substantiveCommanderArchetypes.has(strategy.archetype)
    ));
    for (const strategy of strategies) {
      if (substantiveCommanderArchetypes.has(strategy.archetype)) continue;
      const current = evidence.get(strategy.archetype) ?? {
        supportCount: 0,
        bridgeSupportCount: 0,
        affinityTotal: 0,
      };
      current.supportCount += entry.quantity;
      current.affinityTotal += Math.min(12, strategy.score) * entry.quantity;
      if (bridgesToCommander) current.bridgeSupportCount += entry.quantity;
      evidence.set(strategy.archetype, current);
    }
  }

  const promoted = [...evidence.entries()]
    .filter(([, value]) => (
      value.supportCount >= DECK_SUPPORTED_STRATEGY_MIN_SUPPORT_V15
      && value.bridgeSupportCount >= DECK_SUPPORTED_STRATEGY_MIN_BRIDGE_SUPPORT_V15
      && value.affinityTotal >= DECK_SUPPORTED_STRATEGY_MIN_AFFINITY_V15
    ))
    .sort((left, right) => (
      right[1].affinityTotal - left[1].affinityTotal
      || right[1].bridgeSupportCount - left[1].bridgeSupportCount
      || right[1].supportCount - left[1].supportCount
      || left[0].localeCompare(right[0])
    ))[0];

  const strategies = [...substantiveCommanderStrategies];
  if (promoted && strategies.length < 3) {
    const [archetype, value] = promoted;
    strategies.push({
      archetype,
      score: SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15,
      evidence: [
        `whole-deck support: ${value.supportCount} substantive card(s), ${value.bridgeSupportCount} bridge card(s), ${value.affinityTotal} affinity +${SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15}`,
      ],
    });
  }

  return {
    commanderNames: commanderContext.commanderNames,
    strategies,
  };
}

/**
 * Compare one card with an already-derived commander strategy context.
 *
 * Per-archetype overlap remains built only from the existing V0.15 strategy scores: for each
 * shared archetype, count the smaller of the commander score and card score. The aggregate score
 * may then carry the same small multiplayer-scope quality premium used by whole-deck retention,
 * but only for substantive commander/deck strategies. This improves tie-breaking among cards that
 * already satisfy the same structural gate without changing substantive thresholds or overlap math.
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

  const baseScore = matches.reduce((sum, match) => sum + match.overlapScore, 0);
  const multiplayerQualityBonus = matches
    .filter((match) => match.commanderScore >= SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15)
    .reduce((sum, match) => sum + multiplayerStrategyQualityBonusV15(card, match.archetype), 0);

  return {
    score: baseScore + multiplayerQualityBonus,
    matches,
  };
}

/**
 * Measure whole-deck support against one anchored upgrade context. Keeping the same context on
 * both sides prevents a cut package from making a strategy disappear from the model and then
 * treating that missing identity as evidence that nothing was lost.
 *
 * For drain-centric Commander strategies, aggregate affinity also preserves a small, explicit
 * multiplayer-scope premium for repeatable effects that pressure every opponent at once. A
 * single-target drain effect can still replace one when the rest of the package compensates for
 * that lost table-wide reach; it is no longer treated as automatically equivalent by the audit.
 */
export function measureUpgradeDeckStrategySupportV15(
  parsed: ParsedDeck,
  cards: readonly ScryfallCard[],
  context: CommanderStrategyContextV15,
): { evidenceComplete: boolean; unresolved: string[]; strategies: UpgradeDeckStrategySupportV15[] } {
  const cardByName = new Map(cards.map((card) => [normalizeName(card.name), card] as const));
  const unresolved = new Set<string>();
  const substantive = context.strategies
    .filter((strategy) => strategy.score >= SUBSTANTIVE_COMMANDER_STRATEGY_SCORE_V15);
  const strategies = substantive.map((strategy) => {
    let supportCount = 0;
    let affinityTotal = 0;
    for (const entry of parsed.main) {
      const card = cardByName.get(normalizeName(entry.name));
      if (!card) {
        unresolved.add(entry.name);
        continue;
      }
      const match = cardCommanderStrategyAffinityV15(card, context).matches
        .find((candidate) => candidate.archetype === strategy.archetype);
      if (!match || match.overlapScore <= 0) continue;
      supportCount += entry.quantity;
      affinityTotal += (
        match.overlapScore + multiplayerStrategyQualityBonusV15(card, strategy.archetype)
      ) * entry.quantity;
    }
    return {
      archetype: strategy.archetype,
      commanderScore: strategy.score,
      supportCount,
      affinityTotal,
    };
  });
  return {
    evidenceComplete: unresolved.size === 0,
    unresolved: [...unresolved].sort((left, right) => left.localeCompare(right)),
    strategies,
  };
}

/**
 * Fail closed when an autonomous upgrade package reduces either the support-card density or the
 * aggregate affinity of any substantive starting strategy. A stronger package can freely replace
 * individual cards, but it must compensate within the same accepted package rather than spending
 * deck identity to satisfy generic role counts. Aggregate affinity includes multiplayer-scope
 * quality for repeatable table-wide drain in drain-centric strategies.
 */
export function auditUpgradeDeckStrategyRetentionV15(
  beforeParsed: ParsedDeck,
  beforeCards: readonly ScryfallCard[],
  afterParsed: ParsedDeck,
  afterCards: readonly ScryfallCard[],
): UpgradeDeckStrategyRetentionV15 {
  const context = deriveUpgradeStrategyContextV15(beforeParsed, beforeCards);
  const before = measureUpgradeDeckStrategySupportV15(beforeParsed, beforeCards, context);
  const after = measureUpgradeDeckStrategySupportV15(afterParsed, afterCards, context);
  const afterByArchetype = new Map(after.strategies.map((strategy) => [strategy.archetype, strategy] as const));
  const strategies = before.strategies.map((prior) => {
    const next = afterByArchetype.get(prior.archetype) ?? {
      archetype: prior.archetype,
      commanderScore: prior.commanderScore,
      supportCount: 0,
      affinityTotal: 0,
    };
    const supportDelta = next.supportCount - prior.supportCount;
    const affinityDelta = next.affinityTotal - prior.affinityTotal;
    return {
      archetype: prior.archetype,
      commanderScore: prior.commanderScore,
      beforeSupportCount: prior.supportCount,
      afterSupportCount: next.supportCount,
      supportDelta,
      beforeAffinityTotal: prior.affinityTotal,
      afterAffinityTotal: next.affinityTotal,
      affinityDelta,
      preserved: supportDelta >= 0 && affinityDelta >= 0,
    };
  });
  const evidenceComplete = before.evidenceComplete && after.evidenceComplete;
  const losses = strategies
    .filter((strategy) => !strategy.preserved)
    .map((strategy) => ({
      archetype: strategy.archetype,
      supportDelta: strategy.supportDelta,
      affinityDelta: strategy.affinityDelta,
    }));
  const preserved = evidenceComplete && losses.length === 0;
  return {
    status: !evidenceComplete ? 'evidence-incomplete' : preserved ? 'preserved' : 'strategy-density-loss',
    evidenceComplete,
    preserved,
    unresolvedBefore: before.unresolved,
    unresolvedAfter: after.unresolved,
    strategies,
    losses,
    acceptanceRule: 'Every substantive starting deck strategy must retain or improve both whole-deck support-card density and aggregate affinity, including multiplayer-scope quality for repeatable table-wide drain in drain-centric strategies, within each accepted autonomous package.',
  };
}
