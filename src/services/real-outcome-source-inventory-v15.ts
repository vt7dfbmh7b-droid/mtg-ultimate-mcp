export const REAL_OUTCOME_SOURCE_INVENTORY_SCHEMA_V15 = 'real-outcome-source-inventory-v15.1' as const;
export const REAL_OUTCOME_SOURCE_INVENTORY_VERIFIED_AT_V15 = '2026-08-19' as const;

export type RealOutcomeAccessModeV15 =
  | 'structured-live-api'
  | 'public-reference'
  | 'public-aggregate-reference';

export type RealOutcomePopulationV15 =
  | 'competitive-tournament'
  | 'casual-tracked-game';

export type RealOutcomeTrainingStatusV15 =
  | 'enabled-strict-historical'
  | 'blocked-mirror-reference'
  | 'blocked-no-stable-ingestion';

export interface RealOutcomeSourceInventoryEntryV15 {
  sourceId: string;
  name: string;
  sourceUrl: string;
  documentationUrl: string;
  verifiedAt: typeof REAL_OUTCOME_SOURCE_INVENTORY_VERIFIED_AT_V15;
  accessMode: RealOutcomeAccessModeV15;
  evidenceClass: 'observed-results';
  population: RealOutcomePopulationV15;
  lineageFamily: string;
  trainingStatus: RealOutcomeTrainingStatusV15;
  compatibleLearningTargets: Array<'event-top-cut' | 'match-win'>;
  historicalReplayability: 'strict-materializer-available' | 'reference-only';
  attributionRequired: boolean | 'unknown-recheck-required';
  termsRecheckBeforeNewCollection: boolean;
  temporalNotes: string;
  independenceNotes: string;
  usageNotes: string;
}

/**
 * Source-policy inventory for real Commander outcome learning.
 *
 * This is intentionally smaller and stricter than the general research-source
 * registry. Presence here does not authorize scraping or model training. An
 * entry must explicitly opt into `enabled-strict-historical`, and any new live
 * collection still has to pass the source's current usage requirements plus the
 * historical provenance boundary.
 *
 * Current public-source review (2026-08-19):
 * - TopDeck V2 documents a structured tournament API, required attribution, and
 *   rate limits. The project already has a bounded one-request adapter and a
 *   strict historical materializer.
 * - EDHTop16 states that it aggregates publicly available tournament data from
 *   TopDeck.gg. Its tournament rows therefore share the TopDeck lineage family
 *   and must never be counted as independent corroboration of the same events.
 * - Playgroup.gg publishes aggregate statistics from real tracked casual
 *   Commander games. That is a different outcome population from competitive
 *   tournament top-cut labels, and the project does not currently have a stable,
 *   permission-reviewed row-level ingestion path for it.
 */
export const REAL_OUTCOME_SOURCE_INVENTORY_V15: readonly RealOutcomeSourceInventoryEntryV15[] = [
  {
    sourceId: 'topdeck',
    name: 'TopDeck.gg',
    sourceUrl: 'https://topdeck.gg/',
    documentationUrl: 'https://topdeck.gg/docs/tournaments-v2',
    verifiedAt: REAL_OUTCOME_SOURCE_INVENTORY_VERIFIED_AT_V15,
    accessMode: 'structured-live-api',
    evidenceClass: 'observed-results',
    population: 'competitive-tournament',
    lineageFamily: 'topdeck-tournament-results',
    trainingStatus: 'enabled-strict-historical',
    compatibleLearningTargets: ['event-top-cut', 'match-win'],
    historicalReplayability: 'strict-materializer-available',
    attributionRequired: true,
    termsRecheckBeforeNewCollection: true,
    temporalNotes: 'Completed tournament search supports bounded date windows. Historical training is allowed only after strict source observation/retrieval and content-hash provenance are materialized.',
    independenceNotes: 'Different TopDeck events may form distinct evidence/leakage groups, but mirrors of a TopDeck event remain one underlying evidence lineage.',
    usageNotes: 'Visible TopDeck.gg attribution is required by the current API documentation. Rate limits and current API requirements must be rechecked before collection.',
  },
  {
    sourceId: 'edhtop16',
    name: 'EDHTop16',
    sourceUrl: 'https://edhtop16.com/',
    documentationUrl: 'https://edhtop16.com/privacy',
    verifiedAt: REAL_OUTCOME_SOURCE_INVENTORY_VERIFIED_AT_V15,
    accessMode: 'public-reference',
    evidenceClass: 'observed-results',
    population: 'competitive-tournament',
    lineageFamily: 'topdeck-tournament-results',
    trainingStatus: 'blocked-mirror-reference',
    compatibleLearningTargets: ['event-top-cut'],
    historicalReplayability: 'reference-only',
    attributionRequired: 'unknown-recheck-required',
    termsRecheckBeforeNewCollection: true,
    temporalNotes: 'Useful for competitive reference/discovery, but the project has no currently verified replayable historical row materializer for this source.',
    independenceNotes: 'EDHTop16 states that it aggregates publicly available tournament data from TopDeck.gg, so its tournament results are not an independent evidence family relative to TopDeck.',
    usageNotes: 'Reference use only until a current stable API, usage requirements, provenance semantics, and replayable ingestion path are separately verified.',
  },
  {
    sourceId: 'playgroup',
    name: 'Playgroup.gg',
    sourceUrl: 'https://playgroup.gg/',
    documentationUrl: 'https://playgroup.gg/commanders',
    verifiedAt: REAL_OUTCOME_SOURCE_INVENTORY_VERIFIED_AT_V15,
    accessMode: 'public-aggregate-reference',
    evidenceClass: 'observed-results',
    population: 'casual-tracked-game',
    lineageFamily: 'playgroup-tracked-games',
    trainingStatus: 'blocked-no-stable-ingestion',
    compatibleLearningTargets: ['match-win'],
    historicalReplayability: 'reference-only',
    attributionRequired: 'unknown-recheck-required',
    termsRecheckBeforeNewCollection: true,
    temporalNotes: 'Public pages expose aggregate real-game statistics and rolling windows, not a project-approved row-level historical corpus contract.',
    independenceNotes: 'The tracked-game lineage is structurally separate from TopDeck tournament results, but it represents a different casual-game population and must not be merged into an event-top-cut target.',
    usageNotes: 'Use as attributed aggregate context only until a stable documented/permission-reviewed row-level ingestion path is verified.',
  },
] as const;

const SOURCE_BY_ID = new Map(REAL_OUTCOME_SOURCE_INVENTORY_V15.map((source) => [source.sourceId, source] as const));

export function realOutcomeSourceInventoryV15(): RealOutcomeSourceInventoryEntryV15[] {
  return REAL_OUTCOME_SOURCE_INVENTORY_V15.map((source) => ({
    ...source,
    compatibleLearningTargets: [...source.compatibleLearningTargets],
  }));
}

export function realOutcomeSourceByIdV15(sourceId: string): RealOutcomeSourceInventoryEntryV15 | null {
  if (typeof sourceId !== 'string' || !sourceId.trim()) return null;
  const source = SOURCE_BY_ID.get(sourceId.trim().toLocaleLowerCase());
  return source ? { ...source, compatibleLearningTargets: [...source.compatibleLearningTargets] } : null;
}

export type RealOutcomeSourceRelationshipV15 =
  | 'same-source'
  | 'shared-lineage'
  | 'independent-different-population'
  | 'independent-compatible-population'
  | 'unknown-source';

export function classifyRealOutcomeSourceRelationshipV15(
  leftSourceId: string,
  rightSourceId: string,
): RealOutcomeSourceRelationshipV15 {
  const left = realOutcomeSourceByIdV15(leftSourceId);
  const right = realOutcomeSourceByIdV15(rightSourceId);
  if (!left || !right) return 'unknown-source';
  if (left.sourceId === right.sourceId) return 'same-source';
  if (left.lineageFamily === right.lineageFamily) return 'shared-lineage';
  if (left.population !== right.population) return 'independent-different-population';
  return 'independent-compatible-population';
}

export function sourceCanTrainTargetV15(sourceId: string, target: string): boolean {
  const source = realOutcomeSourceByIdV15(sourceId);
  if (!source || source.trainingStatus !== 'enabled-strict-historical') return false;
  return source.compatibleLearningTargets.includes(target as 'event-top-cut' | 'match-win');
}
