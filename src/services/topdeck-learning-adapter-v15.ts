import { parseDecklist } from './deck.js';
import type { ObservedLearningSourceRecordV15 } from './learning-corpus-ingestion-v15.js';
import type { LearningFeatureV15 } from './research-learning-v15.js';

export const TOPDECK_V2_ATTRIBUTION_V15 = 'Data provided by TopDeck.gg';
export const MAX_TOPDECK_TOURNAMENT_STANDINGS_V15 = 5_000;

export interface TopDeckV2StandingV15 {
  standing?: unknown;
  id?: unknown;
  name?: unknown;
  decklist?: unknown;
  deckObj?: unknown;
  wins?: unknown;
  draws?: unknown;
  losses?: unknown;
}

export interface TopDeckV2BulkTournamentV15 {
  TID?: unknown;
  tournamentName?: unknown;
  startDate?: unknown;
  game?: unknown;
  format?: unknown;
  topCut?: unknown;
  standings?: unknown;
  isTeamEvent?: unknown;
  eventData?: unknown;
}

export interface TopDeckLearningCandidateV15 {
  sourceId: 'topdeck';
  providerEventId: string;
  providerPlayerId: string;
  providerRecordId: string;
  sourceUrl: string;
  outcomeOccurredAt: string;
  standing: number;
  fieldSize: number;
  topCutSize: number;
  decklist: string;
  commanderNames: string[];
  metadata: {
    provider: 'topdeck-v2';
    tournamentName: string | null;
    wins: number | null;
    draws: number | null;
    losses: number | null;
    standingSource: 'provider-field' | 'bulk-array-order';
    eventCity?: string;
    eventState?: string;
  };
}

export type TopDeckLearningAdapterRejectionCodeV15 =
  | 'malformed-tournament'
  | 'wrong-game-or-format'
  | 'team-event-unsupported'
  | 'missing-top-cut'
  | 'invalid-standings'
  | 'missing-player-id'
  | 'invalid-standing'
  | 'missing-decklist-text'
  | 'external-decklist-url'
  | 'invalid-commander-deck';

export interface TopDeckLearningAdapterRejectionV15 {
  tournamentId: string | null;
  standingIndex: number | null;
  playerId: string | null;
  code: TopDeckLearningAdapterRejectionCodeV15;
  reason: string;
}

export interface TopDeckLearningAdapterResultV15 {
  candidates: TopDeckLearningCandidateV15[];
  rejected: TopDeckLearningAdapterRejectionV15[];
  attribution: typeof TOPDECK_V2_ATTRIBUTION_V15;
}

export interface TopDeckLearningEnrichmentV15 {
  canonicalOutcomeId: string;
  independenceKey: string;
  leakageKey: string;
  sourceObservedAt: string;
  featureExtractorId: string;
  features: Partial<Record<LearningFeatureV15, number>>;
  importance?: number;
}

function requireString(name: string, value: unknown, maximum = 300): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  const normalized = value.trim();
  if (normalized.length > maximum) throw new Error(`${name} must be at most ${maximum} characters.`);
  return normalized;
}

function optionalMetadataString(value: unknown, maximum = 120): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.trim();
  return normalized.length <= maximum ? normalized : normalized.slice(0, maximum);
}

function optionalInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value) ? value : null;
}

function unixSecondsToIso(name: string, value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative unix-seconds integer.`);
  }
  const milliseconds = value * 1_000;
  const date = new Date(milliseconds);
  if (!Number.isFinite(date.getTime())) throw new Error(`${name} is outside the supported date range.`);
  return date.toISOString();
}

function sourceUrlForTournament(tournamentId: string): string {
  return `https://topdeck.gg/event/${encodeURIComponent(tournamentId)}`;
}

function rejection(
  tournamentId: string | null,
  standingIndex: number | null,
  playerId: string | null,
  code: TopDeckLearningAdapterRejectionCodeV15,
  reason: string,
): TopDeckLearningAdapterRejectionV15 {
  return { tournamentId, standingIndex, playerId, code, reason };
}

/**
 * TopDeck's public V2 documentation represents text decklists with headings such
 * as `~~Commanders~~` and `~~Mainboard~~`. Convert only those section markers to
 * the project's parser format. No card names, quantities, printings, or inferred
 * commander identities are fabricated here.
 */
export function normalizeTopDeckDecklistTextV15(value: unknown): string {
  const raw = requireString('decklist', value, 200_000);
  if (/^https?:\/\//i.test(raw)) {
    throw new Error('TopDeck decklist is an external URL rather than inline deck text.');
  }

  const output: string[] = [];
  for (const originalLine of raw.split(/\r?\n/)) {
    const line = originalLine.trim();
    const section = line.replace(/^~+|~+$/g, '').trim().toLocaleLowerCase();
    if (section === 'commander' || section === 'commanders' || section === 'command zone') {
      output.push('// COMMANDER');
      continue;
    }
    if (section === 'main' || section === 'mainboard' || section === 'deck') {
      output.push('// MAIN');
      continue;
    }
    if (section === 'sideboard' || section === 'maybeboard' || section === 'about') {
      output.push('// SIDEBOARD');
      continue;
    }
    output.push(originalLine.trimEnd());
  }
  return output.join('\n').trim();
}

function validateCommanderDeck(decklist: string): string[] {
  const parsed = parseDecklist(decklist);
  if (parsed.totalCards !== 100) {
    throw new Error(`TopDeck Commander deck must contain exactly 100 cards; found ${parsed.totalCards}.`);
  }
  if (parsed.commanders.length < 1 || parsed.commanders.length > 2) {
    throw new Error(`TopDeck Commander deck must contain one or two commander entries; found ${parsed.commanders.length}.`);
  }
  if (parsed.commanders.some((entry) => entry.quantity !== 1)) {
    throw new Error('Each TopDeck commander entry must represent exactly one physical card.');
  }
  return parsed.commanders.map((entry) => entry.name);
}

/**
 * Deterministic adapter for TopDeck V2 bulk-tournament responses.
 *
 * The bulk endpoint's selectable `columns` do not include `standing`; current
 * TopDeck documentation returns the rows as player standings. Therefore an
 * explicit numeric `standing` is preferred when present, while a missing field
 * is derived from the documented standings-array order (`index + 1`). A present
 * but malformed/out-of-range standing still fails closed instead of falling back.
 * The chosen source is preserved in metadata for downstream provenance audits.
 *
 * It intentionally does not assign cross-source `canonicalOutcomeId`,
 * `independenceKey`, `leakageKey`, learning features, or a training label. Those
 * are separate enrichment/ingestion concerns. This prevents provider-local IDs
 * from being mistaken for evidence independence and prevents tournament outcomes
 * from leaking into feature construction.
 */
export function adaptTopDeckV2TournamentForLearningV15(
  input: TopDeckV2BulkTournamentV15,
): TopDeckLearningAdapterResultV15 {
  const candidates: TopDeckLearningCandidateV15[] = [];
  const rejected: TopDeckLearningAdapterRejectionV15[] = [];

  let tournamentId: string;
  let outcomeOccurredAt: string;
  try {
    if (!input || typeof input !== 'object') throw new Error('TopDeck tournament must be an object.');
    tournamentId = requireString('TID', input.TID);
    const game = requireString('game', input.game);
    const format = requireString('format', input.format);
    if (game !== 'Magic: The Gathering' || format !== 'EDH') {
      rejected.push(rejection(tournamentId, null, null, 'wrong-game-or-format', `Expected Magic: The Gathering / EDH; received ${game} / ${format}.`));
      return { candidates, rejected, attribution: TOPDECK_V2_ATTRIBUTION_V15 };
    }
    if (input.isTeamEvent === true) {
      rejected.push(rejection(tournamentId, null, null, 'team-event-unsupported', 'TopDeck team-event standings do not map to one Commander deck per standing and are not accepted by this adapter.'));
      return { candidates, rejected, attribution: TOPDECK_V2_ATTRIBUTION_V15 };
    }
    outcomeOccurredAt = unixSecondsToIso('startDate', input.startDate);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    rejected.push(rejection(null, null, null, 'malformed-tournament', message));
    return { candidates, rejected, attribution: TOPDECK_V2_ATTRIBUTION_V15 };
  }

  const topCutSize = optionalInteger(input.topCut);
  if (topCutSize === null || topCutSize < 1) {
    rejected.push(rejection(tournamentId, null, null, 'missing-top-cut', 'TopDeck tournament must expose a positive topCut value for the event-top-cut learning target.'));
    return { candidates, rejected, attribution: TOPDECK_V2_ATTRIBUTION_V15 };
  }
  if (!Array.isArray(input.standings) || input.standings.length < 1 || input.standings.length > MAX_TOPDECK_TOURNAMENT_STANDINGS_V15) {
    rejected.push(rejection(tournamentId, null, null, 'invalid-standings', `TopDeck standings must contain 1-${MAX_TOPDECK_TOURNAMENT_STANDINGS_V15} entries.`));
    return { candidates, rejected, attribution: TOPDECK_V2_ATTRIBUTION_V15 };
  }

  const fieldSize = input.standings.length;
  if (topCutSize > fieldSize) {
    rejected.push(rejection(tournamentId, null, null, 'missing-top-cut', `TopDeck topCut ${topCutSize} exceeds standings field size ${fieldSize}.`));
    return { candidates, rejected, attribution: TOPDECK_V2_ATTRIBUTION_V15 };
  }
  const tournamentName = typeof input.tournamentName === 'string' && input.tournamentName.trim()
    ? input.tournamentName.trim().slice(0, 300)
    : null;
  const eventData = input.eventData && typeof input.eventData === 'object'
    ? input.eventData as Record<string, unknown>
    : null;
  const eventCity = optionalMetadataString(eventData?.city);
  const eventState = optionalMetadataString(eventData?.state);

  for (let index = 0; index < input.standings.length; index += 1) {
    const raw = input.standings[index];
    if (!raw || typeof raw !== 'object') {
      rejected.push(rejection(tournamentId, index, null, 'invalid-standing', 'TopDeck standing must be an object.'));
      continue;
    }
    const standing = raw as TopDeckV2StandingV15;
    let playerId: string;
    try {
      playerId = requireString('standing.id', standing.id);
    } catch (error) {
      rejected.push(rejection(tournamentId, index, null, 'missing-player-id', error instanceof Error ? error.message : String(error)));
      continue;
    }

    const hasExplicitStanding = standing.standing !== undefined && standing.standing !== null;
    const explicitStanding = optionalInteger(standing.standing);
    let standingNumber: number;
    let standingSource: TopDeckLearningCandidateV15['metadata']['standingSource'];
    if (hasExplicitStanding) {
      if (explicitStanding === null || explicitStanding < 1 || explicitStanding > fieldSize) {
        rejected.push(rejection(tournamentId, index, playerId, 'invalid-standing', `TopDeck standing must be an integer within 1-${fieldSize}.`));
        continue;
      }
      standingNumber = explicitStanding;
      standingSource = 'provider-field';
    } else {
      standingNumber = index + 1;
      standingSource = 'bulk-array-order';
    }

    if (typeof standing.decklist !== 'string' || !standing.decklist.trim()) {
      const structuredNote = standing.deckObj && typeof standing.deckObj === 'object'
        ? ' Structured deckObj was present, but its internal schema is not documented tightly enough to infer a 100-card text deck safely.'
        : '';
      rejected.push(rejection(tournamentId, index, playerId, 'missing-decklist-text', `TopDeck standing has no inline decklist text.${structuredNote}`));
      continue;
    }

    let decklist: string;
    let commanderNames: string[];
    try {
      decklist = normalizeTopDeckDecklistTextV15(standing.decklist);
      commanderNames = validateCommanderDeck(decklist);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code: TopDeckLearningAdapterRejectionCodeV15 = /external URL/i.test(message)
        ? 'external-decklist-url'
        : 'invalid-commander-deck';
      rejected.push(rejection(tournamentId, index, playerId, code, message));
      continue;
    }

    candidates.push({
      sourceId: 'topdeck',
      providerEventId: tournamentId,
      providerPlayerId: playerId,
      providerRecordId: `${tournamentId}:standing:${playerId}`,
      sourceUrl: sourceUrlForTournament(tournamentId),
      outcomeOccurredAt,
      standing: standingNumber,
      fieldSize,
      topCutSize,
      decklist,
      commanderNames,
      metadata: {
        provider: 'topdeck-v2',
        tournamentName,
        wins: optionalInteger(standing.wins),
        draws: optionalInteger(standing.draws),
        losses: optionalInteger(standing.losses),
        standingSource,
        ...(eventCity !== null ? { eventCity } : {}),
        ...(eventState !== null ? { eventState } : {}),
      },
    });
  }

  return { candidates, rejected, attribution: TOPDECK_V2_ATTRIBUTION_V15 };
}

/**
 * Explicitly enrich a provider candidate into the generic ingestion contract.
 * Cross-source identity and feature extraction are required inputs on purpose.
 */
export function enrichTopDeckLearningCandidateV15(
  candidate: TopDeckLearningCandidateV15,
  enrichment: TopDeckLearningEnrichmentV15,
): ObservedLearningSourceRecordV15 {
  return {
    sourceId: 'topdeck',
    sourceRecordId: candidate.providerRecordId,
    sourceUrl: candidate.sourceUrl,
    canonicalOutcomeId: requireString('canonicalOutcomeId', enrichment.canonicalOutcomeId),
    independenceKey: requireString('independenceKey', enrichment.independenceKey),
    leakageKey: requireString('leakageKey', enrichment.leakageKey),
    outcomeOccurredAt: candidate.outcomeOccurredAt,
    sourceObservedAt: requireString('sourceObservedAt', enrichment.sourceObservedAt),
    decklist: candidate.decklist,
    expectedCommanderNames: [...candidate.commanderNames],
    featureExtractorId: requireString('featureExtractorId', enrichment.featureExtractorId),
    features: { ...enrichment.features },
    outcome: {
      kind: 'event-top-cut',
      standing: candidate.standing,
      fieldSize: candidate.fieldSize,
      topCutSize: candidate.topCutSize,
    },
    ...(enrichment.importance !== undefined ? { importance: enrichment.importance } : {}),
    metadata: {
      provider: candidate.metadata.provider,
      providerEventId: candidate.providerEventId,
      providerPlayerId: candidate.providerPlayerId,
      tournamentName: candidate.metadata.tournamentName,
      wins: candidate.metadata.wins,
      draws: candidate.metadata.draws,
      losses: candidate.metadata.losses,
      standingSource: candidate.metadata.standingSource,
      ...(candidate.metadata.eventCity !== undefined ? { eventCity: candidate.metadata.eventCity } : {}),
      ...(candidate.metadata.eventState !== undefined ? { eventState: candidate.metadata.eventState } : {}),
      attribution: TOPDECK_V2_ATTRIBUTION_V15,
    },
  };
}
