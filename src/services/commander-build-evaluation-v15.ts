import type { ScryfallCard } from '../types/scryfall.js';
import { assessActualBracketV15, type ActualBracketAssessmentV15 } from './actual-bracket-assessment-v15.js';
import type { BracketAssessmentSignalsV15 } from './bracket-ceiling-v15.js';
import { validateCommanderDeck } from './commander-rules.js';
import { buildDeckMetrics, parseDecklist, resolveEntryCard, type ParsedDeck } from './deck.js';
import { deriveEfficientCommanderWinPlanV15 } from './efficient-win-plan-v15.js';
import { auditExactPerCardBudgetV15, type ExactPerCardBudgetAuditV15 } from './exact-printing-budget-v15.js';
import {
  describePrintingPolicyV08,
  printingMatchesPolicyV08,
  resolvePrintingPolicyV08,
  type PrintingPolicyInputV08,
} from './printing-policy-v08.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from './scryfall.js';
import { estimateCommanderBracket, findDeckCombosEvidence } from './spellbook.js';
import { isStrictDeterministicWinResultV15 } from './win-package-verification-v15.js';

export interface CommanderBuildEvaluationOptionsV15 extends PrintingPolicyInputV08 {
  constraintDescriptions?: string[];
  maxUsdPerCard?: number;
  cedhIntent?: boolean;
  competitiveMetagameEvidence?: boolean;
  optimizedPlanEvidence?: boolean;
  exhibitionIntent?: boolean;
  maxComboResults?: number;
}

export interface PostBuildEvidenceInputV15 {
  commanderLegal: boolean;
  exactCardCount: boolean;
  fullyResolved: boolean;
  printingPolicyCompliant: boolean;
  averageNonlandManaValue: number;
  earlyPlayCount: number;
  fastManaCount: number;
  freeInteractionCount: number;
  cheapInteractionCount: number;
  tutorCount: number;
  gameChangerNames: string[];
  spellbookBracket: Record<string, unknown>;
  combos: Record<string, unknown>;
  efficientWinPlanSupported: boolean;
  cedhIntent?: boolean;
  competitiveMetagameEvidence?: boolean;
  optimizedPlanEvidence?: boolean;
  exhibitionIntent?: boolean;
}

export interface PostBuildEvidenceV15 {
  signals: BracketAssessmentSignalsV15;
  spellbookTag: string | null;
  spellbookBracketSourceStatus: 'available' | 'unavailable' | 'unknown';
  spellbookBracketSourceFailure: Record<string, unknown> | null;
  spellbookComboSourceStatus: 'available' | 'unavailable' | 'unknown';
  spellbookComboSourceFailure: Record<string, unknown> | null;
  comboVerificationComplete: boolean;
  completeComboCount: number;
  verifiedWinningCombos: number;
  verifiedWinningComboIds: string[];
  ruthlessWinningCombos: number;
  strategicallyRelevantCombos: number;
  gameChangerNames: string[];
}

export interface CommanderBuildEvaluationV15 {
  decklist: string;
  parsed: ParsedDeck;
  resolvedCards: ScryfallCard[];
  unresolvedCards: string[];
  commanderRules: ReturnType<typeof validateCommanderDeck>;
  printingPolicy: Record<string, unknown>;
  printingPolicySatisfied: boolean;
  offPolicyCards: string[];
  perCardBudgetAudit: ExactPerCardBudgetAuditV15;
  hardGatesPassed: boolean;
  metrics: ReturnType<typeof buildDeckMetrics>;
  postBuildEvidence: PostBuildEvidenceV15;
  actualBracket: ActualBracketAssessmentV15;
  externalEvidenceChecked: boolean;
  externalEvidenceComplete: boolean;
  efficientWinPlan: ReturnType<typeof deriveEfficientCommanderWinPlanV15> | null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function finiteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function sourceStatus(value: unknown): PostBuildEvidenceV15['spellbookBracketSourceStatus'] {
  return value === 'available' ? 'available' : value === 'unavailable' ? 'unavailable' : 'unknown';
}

function identifiers(parsed: ParsedDeck): CardIdentifierInput[] {
  return [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
}

export function derivePostBuildEvidenceV15(input: PostBuildEvidenceInputV15): PostBuildEvidenceV15 {
  const bracket = record(input.spellbookBracket);
  const combos = record(input.combos);
  const included = Array.isArray(combos.included) ? combos.included.map(record) : [];
  const counts = record(combos.counts);
  const winningIncluded = included.filter((combo) =>
    Array.isArray(combo.results) && isStrictDeterministicWinResultV15(combo.results.map(String)));
  const verifiedWinningComboIds = [...new Set(winningIncluded
    .map((combo) => String(combo.id ?? '').trim())
    .filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const verifiedWinningCombos = verifiedWinningComboIds.length;
  const ruthlessWinningCombos = winningIncluded
    .filter((combo) => String(combo.bracketTag ?? '') === 'R')
    .map((combo) => String(combo.id ?? '').trim())
    .filter(Boolean)
    .filter((id, index, ids) => ids.indexOf(id) === index)
    .length;
  const strategicallyRelevantCombos = Array.isArray(bracket.strategicallyRelevantCombos) ? bracket.strategicallyRelevantCombos.length : 0;
  const spellbookTag = typeof bracket.bracketTag === 'string' ? bracket.bracketTag : null;
  const spellbookBracketSourceStatus = sourceStatus(bracket.sourceStatus);
  const bracketFailure = record(bracket.sourceFailure);
  const spellbookComboSourceStatus = sourceStatus(combos.sourceStatus);
  const comboFailure = record(combos.sourceFailure);
  const comboVerificationComplete = combos.verificationComplete === true || spellbookComboSourceStatus === 'available';
  const gameChangerNames = [...new Set(input.gameChangerNames)].sort((a, b) => a.localeCompare(b));
  return {
    signals: {
      commanderLegal: input.commanderLegal,
      exactCardCount: input.exactCardCount,
      fullyResolved: input.fullyResolved,
      printingPolicyCompliant: input.printingPolicyCompliant,
      spellbookTag,
      verifiedWinningCombos,
      ruthlessWinningCombos,
      strategicallyRelevantCombos,
      averageNonlandManaValue: input.averageNonlandManaValue,
      earlyPlayCount: input.earlyPlayCount,
      fastManaCount: input.fastManaCount,
      freeInteractionCount: input.freeInteractionCount,
      cheapInteractionCount: input.cheapInteractionCount,
      tutorCount: input.tutorCount,
      gameChangerCount: gameChangerNames.length,
      efficientWinConditionEvidence: input.efficientWinPlanSupported,
      cedhIntent: input.cedhIntent === true,
      competitiveMetagameEvidence: input.competitiveMetagameEvidence === true,
      optimizedPlanEvidence: input.optimizedPlanEvidence === true,
      exhibitionIntent: input.exhibitionIntent === true,
    },
    spellbookTag,
    spellbookBracketSourceStatus,
    spellbookBracketSourceFailure: Object.keys(bracketFailure).length > 0 ? bracketFailure : null,
    spellbookComboSourceStatus,
    spellbookComboSourceFailure: Object.keys(comboFailure).length > 0 ? comboFailure : null,
    comboVerificationComplete,
    completeComboCount: finiteNumber(counts.included),
    verifiedWinningCombos,
    verifiedWinningComboIds,
    ruthlessWinningCombos,
    strategicallyRelevantCombos,
    gameChangerNames,
  };
}

export async function evaluateCommanderBuildV15(
  decklist: string,
  options: CommanderBuildEvaluationOptionsV15 = {},
): Promise<CommanderBuildEvaluationV15> {
  if (options.maxUsdPerCard !== undefined && (!Number.isFinite(options.maxUsdPerCard) || options.maxUsdPerCard <= 0)) {
    throw new Error('maxUsdPerCard must be positive and finite when supplied to post-build evaluation.');
  }
  const parsed = parseDecklist(decklist);
  const resolved = await getCardsByIdentifiers(identifiers(parsed));
  const rules = validateCommanderDeck(parsed, resolved.cards);
  const policy = await resolvePrintingPolicyV08(options);
  const offPolicy = resolved.cards.filter((card) => !printingMatchesPolicyV08(card, policy));
  const printingPolicySatisfied = offPolicy.length === 0 && resolved.notFound.length === 0;
  const perCardBudgetAudit = auditExactPerCardBudgetV15(parsed, resolved.cards, options.maxUsdPerCard);
  const metrics = buildDeckMetrics(parsed, resolved.cards);
  const hardGatesPassed = parsed.totalCards === 100
    && rules.isLegal
    && resolved.notFound.length === 0
    && printingPolicySatisfied
    && perCardBudgetAudit.satisfied;

  let spellbookBracket: Record<string, unknown> = {};
  let combos: Record<string, unknown> = {
    counts: { included: 0 },
    included: [],
    sourceStatus: 'unknown',
    verificationComplete: false,
  };
  let efficientWinPlan: ReturnType<typeof deriveEfficientCommanderWinPlanV15> | null = null;
  if (hardGatesPassed) {
    [spellbookBracket, combos] = await Promise.all([
      estimateCommanderBracket(decklist),
      findDeckCombosEvidence(decklist, Math.max(1, Math.min(100, Math.trunc(options.maxComboResults ?? 100)))),
    ]);
    const commanderCards = parsed.commanders
      .map((entry) => resolveEntryCard(entry, resolved.cards))
      .filter((card): card is ScryfallCard => Boolean(card));
    efficientWinPlan = commanderCards.length === parsed.commanders.length
      ? deriveEfficientCommanderWinPlanV15(decklist, commanderCards)
      : null;
  }

  const evidence = derivePostBuildEvidenceV15({
    commanderLegal: rules.isLegal,
    exactCardCount: parsed.totalCards === 100,
    fullyResolved: resolved.notFound.length === 0,
    printingPolicyCompliant: printingPolicySatisfied,
    averageNonlandManaValue: metrics.averageNonlandManaValue,
    earlyPlayCount: metrics.earlyPlayCount,
    fastManaCount: metrics.fastManaCount,
    freeInteractionCount: Number(metrics.roleCounts['free interaction'] ?? 0),
    cheapInteractionCount: metrics.cheapInteractionCount,
    tutorCount: metrics.tutorCount,
    gameChangerNames: resolved.cards.filter((card) => card.game_changer === true).map((card) => card.name),
    spellbookBracket,
    combos,
    efficientWinPlanSupported: efficientWinPlan?.supported === true,
    ...(options.cedhIntent !== undefined ? { cedhIntent: options.cedhIntent } : {}),
    ...(options.competitiveMetagameEvidence !== undefined ? { competitiveMetagameEvidence: options.competitiveMetagameEvidence } : {}),
    ...(options.optimizedPlanEvidence !== undefined ? { optimizedPlanEvidence: options.optimizedPlanEvidence } : {}),
    ...(options.exhibitionIntent !== undefined ? { exhibitionIntent: options.exhibitionIntent } : {}),
  });
  const actualBracket = assessActualBracketV15(evidence.signals, options.constraintDescriptions ?? []);

  return {
    decklist,
    parsed,
    resolvedCards: resolved.cards,
    unresolvedCards: resolved.notFound,
    commanderRules: rules,
    printingPolicy: describePrintingPolicyV08(policy),
    printingPolicySatisfied,
    offPolicyCards: offPolicy.map((card) => `${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`),
    perCardBudgetAudit,
    hardGatesPassed,
    metrics,
    postBuildEvidence: evidence,
    actualBracket,
    externalEvidenceChecked: hardGatesPassed,
    externalEvidenceComplete: hardGatesPassed
      && evidence.spellbookBracketSourceStatus !== 'unavailable'
      && evidence.spellbookComboSourceStatus !== 'unavailable',
    efficientWinPlan,
  };
}
