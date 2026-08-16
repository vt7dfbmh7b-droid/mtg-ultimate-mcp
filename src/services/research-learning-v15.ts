import {
  EVIDENCE_SOURCES_V09,
  evidenceSourcesForV09,
  type EvidenceFocusV09,
  type EvidenceSourceV09,
} from './evidence-sources-v09.js';

export type ResearchPolarityV15 = 'support' | 'oppose';

export interface ResearchObservationV15 {
  sourceId: string;
  focus: EvidenceFocusV09;
  subject: string;
  claim: string;
  polarity?: ResearchPolarityV15;
  ageDays?: number;
  independentGroup?: string;
  sampleSize?: number;
  outcomeStrength?: number;
  structured?: boolean;
}

export interface ScoredResearchObservationV15 extends ResearchObservationV15 {
  source: EvidenceSourceV09;
  score: number;
  freshness: number;
  sampleFactor: number;
  accessFactor: number;
}

export type ResearchVerdictV15 = 'supported' | 'rejected' | 'disputed' | 'insufficient';

export interface ResearchSynthesisV15 {
  subject: string;
  claim: string;
  verdict: ResearchVerdictV15;
  confidence: number;
  supportWeight: number;
  opposeWeight: number;
  sourceCount: number;
  independentGroupCount: number;
  evidenceClassCount: number;
  evidenceClasses: string[];
  observations: ScoredResearchObservationV15[];
  researchGaps: string[];
}

export interface DeepResearchPlanV15 {
  focuses: EvidenceFocusV09[];
  sources: Array<{
    sourceId: string;
    name: string;
    evidenceClass: EvidenceSourceV09['evidenceClass'];
    access: EvidenceSourceV09['access'];
    weight: number;
    priority: number;
    bestFor: string;
    caution: string;
  }>;
  evidenceClasses: string[];
  guidance: string[];
}

export type LearningFeatureV15 =
  | 'simulationImprovement'
  | 'tournamentSupport'
  | 'crossClassResearch'
  | 'comboVerification'
  | 'manaEfficiency'
  | 'interactionEfficiency'
  | 'priceEfficiency'
  | 'communitySupport';

export const LEARNING_FEATURES_V15: LearningFeatureV15[] = [
  'simulationImprovement',
  'tournamentSupport',
  'crossClassResearch',
  'comboVerification',
  'manaEfficiency',
  'interactionEfficiency',
  'priceEfficiency',
  'communitySupport',
];

export interface LearningExampleV15 {
  features: Partial<Record<LearningFeatureV15, number>>;
  label: 0 | 1;
  importance?: number;
}

export interface HardDeckChecksV15 {
  commanderLegal: boolean;
  fullyResolved: boolean;
  exactCardCount: boolean;
  printingPolicyCompliant: boolean;
}

export interface AdaptiveRankerV15 {
  modelType: 'transparent-logistic-ranker';
  version: 1;
  weights: Record<LearningFeatureV15, number>;
  bias: number;
  trainedExamples: number;
  holdoutExamples: number;
  holdoutAccuracy: number | null;
  promotable: boolean;
  promotionReasons: string[];
  guardrails: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function round(value: number, digits = 4): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function sourceById(sourceId: string): EvidenceSourceV09 {
  const source = EVIDENCE_SOURCES_V09.find((entry) => entry.id === sourceId);
  if (!source) throw new Error(`Unknown evidence source: ${sourceId}`);
  return source;
}

function halfLifeDays(focus: EvidenceFocusV09): number {
  if (focus === 'pricing' || focus === 'nz-availability') return 14;
  if (focus === 'competitive' || focus === 'recorded-games') return 45;
  if (focus === 'community' || focus === 'decklists' || focus === 'deck-analysis') return 120;
  if (focus === 'combos') return 365;
  if (focus === 'cards') return 720;
  return 3650;
}

function accessFactor(source: EvidenceSourceV09): number {
  if (source.access === 'live-api' || source.access === 'existing-integration') return 1;
  if (source.access === 'public-reference') return 0.9;
  return 0.8;
}

function sampleFactor(sampleSize: number | undefined): number {
  if (!Number.isFinite(sampleSize) || (sampleSize ?? 0) <= 0) return 0.72;
  return clamp(0.45 + Math.log10((sampleSize ?? 0) + 1) * 0.18, 0.5, 1);
}

export function scoreResearchObservationV15(observation: ResearchObservationV15): ScoredResearchObservationV15 {
  const source = sourceById(observation.sourceId);
  if (!source.focuses.includes(observation.focus)) {
    throw new Error(`${source.name} is not registered for ${observation.focus} evidence.`);
  }
  const ageDays = Math.max(0, Number.isFinite(observation.ageDays) ? observation.ageDays ?? 0 : 0);
  const freshness = clamp(2 ** (-ageDays / halfLifeDays(observation.focus)), 0.12, 1);
  const sample = sampleFactor(observation.sampleSize);
  const access = accessFactor(source);
  const strength = clamp(observation.outcomeStrength ?? 1, 0.2, 1);
  const structureBoost = observation.structured === true ? 1.04 : 1;
  const score = clamp(source.weight * freshness * sample * access * strength * structureBoost, 0, 1);
  return {
    ...observation,
    polarity: observation.polarity ?? 'support',
    source,
    score: round(score),
    freshness: round(freshness),
    sampleFactor: round(sample),
    accessFactor: access,
  };
}

function researchKey(observation: ResearchObservationV15): string {
  return `${normalize(observation.subject)}|${normalize(observation.claim)}`;
}

function independenceKey(observation: ScoredResearchObservationV15): string {
  return normalize(observation.independentGroup ?? observation.sourceId);
}

function collapseDependentEvidence(observations: ScoredResearchObservationV15[]): ScoredResearchObservationV15[] {
  const strongest = new Map<string, ScoredResearchObservationV15>();
  for (const observation of observations) {
    const key = `${independenceKey(observation)}|${observation.polarity ?? 'support'}`;
    const existing = strongest.get(key);
    if (!existing || observation.score > existing.score) strongest.set(key, observation);
  }
  return [...strongest.values()];
}

function synthesisGaps(observations: ScoredResearchObservationV15[], focus: EvidenceFocusV09): string[] {
  const gaps: string[] = [];
  const classes = new Set(observations.map((entry) => entry.source.evidenceClass));
  const groups = new Set(observations.map(independenceKey));
  if (groups.size < 2) gaps.push('Only one independent evidence group supports this claim.');
  if (classes.size < 2) gaps.push('Evidence comes from only one evidence class; seek a different kind of source.');
  if (focus === 'rules' && !observations.some((entry) => entry.source.evidenceClass === 'official')) {
    gaps.push('Rules claims need an official source before high confidence is allowed.');
  }
  if ((focus === 'competitive' || focus === 'recorded-games')
    && !observations.some((entry) => entry.source.evidenceClass === 'observed-results')) {
    gaps.push('Performance claims need observed-results evidence rather than only deck popularity or analysis scores.');
  }
  if ((focus === 'pricing' || focus === 'nz-availability') && observations.every((entry) => entry.freshness < 0.5)) {
    gaps.push('Market evidence is stale for a fast-changing pricing or availability claim.');
  }
  return gaps;
}

export function synthesizeDeepResearchV15(observations: ResearchObservationV15[]): ResearchSynthesisV15[] {
  const groups = new Map<string, ResearchObservationV15[]>();
  for (const observation of observations) {
    if (!observation.subject.trim() || !observation.claim.trim()) continue;
    const key = researchKey(observation);
    const current = groups.get(key) ?? [];
    current.push(observation);
    groups.set(key, current);
  }

  const output: ResearchSynthesisV15[] = [];
  for (const rawGroup of groups.values()) {
    const scored = collapseDependentEvidence(rawGroup.map(scoreResearchObservationV15));
    if (scored.length === 0) continue;
    const supportWeight = scored.filter((entry) => entry.polarity !== 'oppose').reduce((sum, entry) => sum + entry.score, 0);
    const opposeWeight = scored.filter((entry) => entry.polarity === 'oppose').reduce((sum, entry) => sum + entry.score, 0);
    const total = supportWeight + opposeWeight;
    const dominant = Math.max(supportWeight, opposeWeight);
    const minority = Math.min(supportWeight, opposeWeight);
    const directionalCertainty = total > 0 ? (dominant - minority) / total : 0;
    const classes = [...new Set(scored.map((entry) => entry.source.evidenceClass))].sort();
    const independentGroups = new Set(scored.map(independenceKey));
    const corroboration = Math.min(0.2, Math.max(0, classes.length - 1) * 0.06 + Math.max(0, independentGroups.size - 1) * 0.025);
    const conflictPenalty = total > 0 ? (minority / total) * 0.32 : 0;
    let confidence = clamp((dominant / Math.max(1, total)) * 0.48 + directionalCertainty * 0.34 + corroboration - conflictPenalty, 0, 1);
    const focus = scored[0]?.focus ?? 'community';
    const gaps = synthesisGaps(scored, focus);
    if (gaps.length > 0) confidence = Math.min(confidence, groups.size < 2 ? 0.55 : 0.78);
    if (focus === 'rules' && !scored.some((entry) => entry.source.evidenceClass === 'official')) confidence = Math.min(confidence, 0.6);

    let verdict: ResearchVerdictV15 = 'insufficient';
    if (total >= 0.55 && directionalCertainty >= 0.38) verdict = supportWeight >= opposeWeight ? 'supported' : 'rejected';
    if (total >= 0.7 && minority / Math.max(0.0001, dominant) >= 0.55) verdict = 'disputed';

    output.push({
      subject: rawGroup[0]?.subject ?? '',
      claim: rawGroup[0]?.claim ?? '',
      verdict,
      confidence: round(confidence),
      supportWeight: round(supportWeight),
      opposeWeight: round(opposeWeight),
      sourceCount: new Set(scored.map((entry) => entry.sourceId)).size,
      independentGroupCount: independentGroups.size,
      evidenceClassCount: classes.length,
      evidenceClasses: classes,
      observations: scored.sort((a, b) => b.score - a.score),
      researchGaps: gaps,
    });
  }

  return output.sort((a, b) => b.confidence - a.confidence || a.subject.localeCompare(b.subject));
}

export function buildDeepResearchPlanV15(focuses: EvidenceFocusV09[]): DeepResearchPlanV15 {
  const wanted = [...new Set(focuses)];
  const sources = evidenceSourcesForV09(wanted).map((source, index) => ({
    sourceId: source.id,
    name: source.name,
    evidenceClass: source.evidenceClass,
    access: source.access,
    weight: source.weight,
    priority: index + 1,
    bestFor: source.bestFor,
    caution: source.caution,
  }));
  const evidenceClasses = [...new Set(sources.map((source) => source.evidenceClass))];
  const guidance = [
    'Use official/structured sources for identity, legality, printings and rules before community interpretation.',
    'For performance claims, prefer observed results plus a different evidence class; popularity alone is not performance.',
    'Deduplicate sources that ultimately depend on the same underlying event, decklist or dataset.',
    'Apply stronger freshness decay to prices, availability and competitive metagame claims than to stable rules or Oracle identity.',
    'Keep contradictions visible instead of averaging them away; disputed claims should trigger more research or lower confidence.',
  ];
  return { focuses: wanted, sources, evidenceClasses, guidance };
}

function featureValue(example: LearningExampleV15, feature: LearningFeatureV15): number {
  const value = example.features[feature] ?? 0;
  return clamp(Number.isFinite(value) ? value : 0, -1, 1);
}

function sigmoid(value: number): number {
  if (value >= 0) {
    const z = Math.exp(-value);
    return 1 / (1 + z);
  }
  const z = Math.exp(value);
  return z / (1 + z);
}

function emptyWeights(): Record<LearningFeatureV15, number> {
  return Object.fromEntries(LEARNING_FEATURES_V15.map((feature) => [feature, 0])) as Record<LearningFeatureV15, number>;
}

function rawModelScore(features: Partial<Record<LearningFeatureV15, number>>, weights: Record<LearningFeatureV15, number>, bias: number): number {
  return LEARNING_FEATURES_V15.reduce((sum, feature) => sum + clamp(features[feature] ?? 0, -1, 1) * weights[feature], bias);
}

export function trainAdaptiveRankerV15(
  examples: LearningExampleV15[],
  options: { epochs?: number; learningRate?: number; l2?: number; minimumExamples?: number; minimumHoldoutAccuracy?: number } = {},
): AdaptiveRankerV15 {
  const epochs = Math.max(1, Math.min(500, Math.trunc(options.epochs ?? 120)));
  const learningRate = clamp(options.learningRate ?? 0.08, 0.001, 0.5);
  const l2 = clamp(options.l2 ?? 0.01, 0, 0.2);
  const minimumExamples = Math.max(10, Math.trunc(options.minimumExamples ?? 30));
  const minimumHoldoutAccuracy = clamp(options.minimumHoldoutAccuracy ?? 0.72, 0.5, 1);
  const holdout = examples.filter((_, index) => index % 5 === 0);
  const training = examples.filter((_, index) => index % 5 !== 0);
  const weights = emptyWeights();
  let bias = 0;

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (const example of training) {
      const prediction = sigmoid(rawModelScore(example.features, weights, bias));
      const error = example.label - prediction;
      const importance = clamp(example.importance ?? 1, 0.1, 5);
      for (const feature of LEARNING_FEATURES_V15) {
        const x = featureValue(example, feature);
        weights[feature] += learningRate * importance * (error * x - l2 * weights[feature]);
        weights[feature] = clamp(weights[feature], -4, 4);
      }
      bias += learningRate * importance * error;
      bias = clamp(bias, -4, 4);
    }
  }

  let correct = 0;
  for (const example of holdout) {
    const prediction = sigmoid(rawModelScore(example.features, weights, bias));
    const predictedLabel = prediction >= 0.5 ? 1 : 0;
    if (predictedLabel === example.label) correct += 1;
  }
  const holdoutAccuracy = holdout.length > 0 ? correct / holdout.length : null;
  const promotionReasons: string[] = [];
  if (examples.length < minimumExamples) promotionReasons.push(`Need at least ${minimumExamples} labelled examples before promotion.`);
  if (holdout.length < 5) promotionReasons.push('Need at least five deterministic holdout examples before promotion.');
  if (holdoutAccuracy === null || holdoutAccuracy < minimumHoldoutAccuracy) {
    promotionReasons.push(`Holdout accuracy must reach ${(minimumHoldoutAccuracy * 100).toFixed(0)}% before promotion.`);
  }

  return {
    modelType: 'transparent-logistic-ranker',
    version: 1,
    weights: Object.fromEntries(LEARNING_FEATURES_V15.map((feature) => [feature, round(weights[feature])])) as Record<LearningFeatureV15, number>,
    bias: round(bias),
    trainedExamples: training.length,
    holdoutExamples: holdout.length,
    holdoutAccuracy: holdoutAccuracy === null ? null : round(holdoutAccuracy),
    promotable: promotionReasons.length === 0,
    promotionReasons,
    guardrails: [
      'Learning never overrides Commander legality.',
      'Learning never overrides exact 100-card validation.',
      'Learning never overrides unresolved-card failures.',
      'Learning never overrides exact physical-printing restrictions.',
      'A learned model is not promoted without deterministic holdout evaluation.',
    ],
  };
}

export function scoreCandidateWithLearningV15(
  features: Partial<Record<LearningFeatureV15, number>>,
  model: AdaptiveRankerV15,
  hardChecks: HardDeckChecksV15,
): { eligible: boolean; probability: number | null; failedGuardrails: string[] } {
  const failedGuardrails: string[] = [];
  if (!hardChecks.commanderLegal) failedGuardrails.push('commanderLegal');
  if (!hardChecks.fullyResolved) failedGuardrails.push('fullyResolved');
  if (!hardChecks.exactCardCount) failedGuardrails.push('exactCardCount');
  if (!hardChecks.printingPolicyCompliant) failedGuardrails.push('printingPolicyCompliant');
  if (failedGuardrails.length > 0) return { eligible: false, probability: null, failedGuardrails };
  return {
    eligible: true,
    probability: round(sigmoid(rawModelScore(features, model.weights, model.bias))),
    failedGuardrails,
  };
}
