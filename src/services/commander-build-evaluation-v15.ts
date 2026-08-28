import type { ScryfallCard } from '../types/scryfall.js';
import { assessActualBracketV15, type ActualBracketAssessmentV15 } from './actual-bracket-assessment-v15.js';
import type { BracketAssessmentSignalsV15 } from './bracket-ceiling-v15.js';
import { validateCommanderDeck } from './commander-rules.js';
import { buildDeckMetrics, parseDecklist, resolveEntryCard, type ParsedDeck } from './deck.js';
import { deriveEfficientCommanderWinPlanV15 } from './efficient-win-plan-v15.js';
import { auditExactPerCardBudgetV15, type ExactPerCardBudgetAuditV15 } from './exact-printing-budget-v15.js';
import { auditFinalWinRoutesV15, type FinalWinRouteAuditV15 } from './final-win-route-audit-v15.js';
import {
  assessFullTableWinClosureV15,
  type FullTableWinClosureKindV15,
} from './full-table-win-closure-v15.js';
import {
  describePrintingPolicyV08,
  printingMatchesPolicyV08,
  resolvePrintingPolicyV08,
  type PrintingPolicyInputV08,
} from './printing-policy-v08.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from './scryfall.js';
import { estimateCommanderBracket, findDeckCombosEvidence } from './spellbook.js';
import {
  auditWinRouteAccessPortfolioV15,
  type WinRouteAccessAuditV15,
} from './win-route-access-v15.js';
import {
  auditWinRouteSetupInterruptionV15,
  type WinRouteSetupInterruptionAuditV15,
} from './win-route-setup-interruption-v15.js';

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
  commanderNames?: string[];
  spellbookBracket: Record<string, unknown>;
  combos: Record<string, unknown>;
  efficientWinPlanSupported: boolean;
  cedhIntent?: boolean;
  competitiveMetagameEvidence?: boolean;
  optimizedPlanEvidence?: boolean;
  exhibitionIntent?: boolean;
}

export interface VerifiedWinningComboDetailV15 {
  comboId: string;
  bracketTag: string | null;
  comboCardNames: string[];
  seedNames: string[];
  results: string[];
  requirementNames: string[];
  description: unknown;
  manaNeeded: unknown;
  otherPrerequisites: unknown;
  dependencyCompleteness: 'explicit-cards-only' | 'template-requirements-present';
  closureKind: FullTableWinClosureKindV15;
  closureTiming: 'immediate' | 'delayed' | 'not-proven';
  closureScope: 'self-win' | 'all-opponents' | 'single-opponent' | 'unscoped' | 'none';
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
  verifiedWinningComboDetails: VerifiedWinningComboDetailV15[];
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
  finalWinRouteAudit: FinalWinRouteAuditV15;
  winRouteSetupAudits: WinRouteSetupInterruptionAuditV15[];
  winRouteAccessAudits: WinRouteAccessAuditV15[];
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

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function identifiers(parsed: ParsedDeck): CardIdentifierInput[] {
  return [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
}

function comboDetail(
  combo: Record<string, unknown>,
  commanderNames: Set<string>,
): VerifiedWinningComboDetailV15 | null {
  const comboId = String(combo.id ?? '').trim();
  const results = Array.isArray(combo.results) ? combo.results.map(String) : [];
  const description = typeof combo.description === 'string' ? combo.description : '';
  const closure = assessFullTableWinClosureV15(results, description);
  if (!comboId || !closure.verifiedFullTableWin) return null;

  const cards = Array.isArray(combo.cards) ? combo.cards.map(record) : [];
  const comboCardNames: string[] = [];
  const seedNames: string[] = [];
  for (const card of cards) {
    const name = String(card.name ?? '').trim();
    if (!name || name === 'Unknown card') continue;
    comboCardNames.push(name);
    const commanderDependency = card.mustBeCommander === true || commanderNames.has(normalizeName(name));
    if (!commanderDependency) seedNames.push(name);
  }
  const requirements = Array.isArray(combo.requirements) ? combo.requirements.map(record) : [];
  const requirementNames = uniqueSorted(requirements.map((requirement) => String(requirement.name ?? '')).filter(Boolean));

  return {
    comboId,
    bracketTag: typeof combo.bracketTag === 'string' ? combo.bracketTag : null,
    comboCardNames: uniqueSorted(comboCardNames),
    seedNames: uniqueSorted(seedNames),
    results,
    requirementNames,
    description: combo.description ?? null,
    manaNeeded: combo.manaNeeded ?? null,
    otherPrerequisites: combo.otherPrerequisites ?? null,
    dependencyCompleteness: requirementNames.length > 0 ? 'template-requirements-present' : 'explicit-cards-only',
    closureKind: closure.kind,
    closureTiming: closure.timing,
    closureScope: closure.scope,
  };
}

export function derivePostBuildEvidenceV15(input: PostBuildEvidenceInputV15): PostBuildEvidenceV15 {
  const bracket = record(input.spellbookBracket);
  const combos = record(input.combos);
  const included = Array.isArray(combos.included) ? combos.included.map(record) : [];
  const counts = record(combos.counts);
  const commanderNames = new Set((input.commanderNames ?? []).map(normalizeName));
  const detailsById = new Map<string, VerifiedWinningComboDetailV15>();
  for (const combo of included) {
    const detail = comboDetail(combo, commanderNames);
    if (!detail || detailsById.has(detail.comboId)) continue;
    detailsById.set(detail.comboId, detail);
  }
  const verifiedWinningComboDetails = [...detailsById.values()].sort((a, b) => a.comboId.localeCompare(b.comboId));
  const verifiedWinningComboIds = verifiedWinningComboDetails.map((detail) => detail.comboId);
  const verifiedWinningCombos = verifiedWinningComboIds.length;
  const ruthlessWinningCombos = verifiedWinningComboDetails.filter((detail) => detail.bracketTag === 'R').length;
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
    verifiedWinningComboDetails,
    ruthlessWinningCombos,
    strategicallyRelevantCombos,
    gameChangerNames,
  };
}

export function deriveWinRouteSetupAuditsV15(
  details: readonly VerifiedWinningComboDetailV15[],
  resolvedCards: readonly ScryfallCard[],
): WinRouteSetupInterruptionAuditV15[] {
  return details.map((detail) => auditWinRouteSetupInterruptionV15({
    route: {
      comboId: detail.comboId,
      comboCardNames: detail.comboCardNames,
      seedNames: detail.seedNames,
      requirementNames: detail.requirementNames,
      manaNeeded: detail.manaNeeded,
      otherPrerequisites: detail.otherPrerequisites,
      description: detail.description,
      closureTiming: detail.closureTiming,
    },
    resolvedCards,
  }));
}

export function deriveWinRouteAccessAuditsV15(
  details: readonly VerifiedWinningComboDetailV15[],
  parsed: ParsedDeck,
  resolvedCards: readonly ScryfallCard[],
): WinRouteAccessAuditV15[] {
  return auditWinRouteAccessPortfolioV15({
    routes: details.map((detail) => ({
      comboId: detail.comboId,
      comboCardNames: detail.comboCardNames,
      seedNames: detail.seedNames,
      dependencyCompleteness: detail.dependencyCompleteness,
    })),
    parsed,
    resolvedCards,
  });
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
    commanderNames: parsed.commanders.map((entry) => entry.name),
    spellbookBracket,
    combos,
    efficientWinPlanSupported: efficientWinPlan?.supported === true,
    ...(options.cedhIntent !== undefined ? { cedhIntent: options.cedhIntent } : {}),
    ...(options.competitiveMetagameEvidence !== undefined ? { competitiveMetagameEvidence: options.competitiveMetagameEvidence } : {}),
    ...(options.optimizedPlanEvidence !== undefined ? { optimizedPlanEvidence: options.optimizedPlanEvidence } : {}),
    ...(options.exhibitionIntent !== undefined ? { exhibitionIntent: options.exhibitionIntent } : {}),
  });
  const finalWinRouteAudit = auditFinalWinRoutesV15({
    comboVerificationComplete: evidence.comboVerificationComplete,
    verifiedWinningComboDetails: evidence.verifiedWinningComboDetails,
  });
  const winRouteSetupAudits = deriveWinRouteSetupAuditsV15(evidence.verifiedWinningComboDetails, resolved.cards);
  const winRouteAccessAudits = deriveWinRouteAccessAuditsV15(evidence.verifiedWinningComboDetails, parsed, resolved.cards);
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
    finalWinRouteAudit,
    winRouteSetupAudits,
    winRouteAccessAudits,
    actualBracket,
    externalEvidenceChecked: hardGatesPassed,
    externalEvidenceComplete: hardGatesPassed
      && evidence.spellbookBracketSourceStatus !== 'unavailable'
      && evidence.spellbookComboSourceStatus !== 'unavailable',
    efficientWinPlan,
  };
}
