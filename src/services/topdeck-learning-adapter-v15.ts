import { parseDecklist } from './deck.js';
import type { ObservedLearningSourceRecordV15 } from './learning-corpus-ingestion-v15.js';
import type { LearningFeatureV15 } from './research-learning-v15.js';

export const TOPDECK_V2_ATTRIBUTION_V15 = 'Data provided by TopDeck.gg';
export const MAX_TOPDECK_TOURNAMENT_STANDINGS_V15 = 5_000;
export const TOPDECK_DECKOBJ_SCHEMA_V15 = 'topdeck-deckobj-id-count-v15.1' as const;

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
    deckSource: 'inline-text' | 'topdeck-deckobj';
    deckObjectSchemaVersion?: typeof TOPDECK_DECKOBJ_SCHEMA_V15;
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
  | 'invalid-structured-deck'
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

function requireCardName(name: string, value: unknown): string {
  const normalized = requireString(name, value, 300);
  if (/\r|\n/.test(normalized)) throw new Error(`${name} must not contain line breaks.`);
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
  if (parsed.totalCards !== 100) throw new Error(`TopDeck Commander deck must contain exactly 100 cards; found ${parsed.totalCards}.`);
  if (parsed.commanders.length < 1 || parsed.commanders.length > 2) {
    throw new Error(`TopDeck Commander deck must contain one or two commander entries; found ${parsed.commanders.length}.`);
  }
  if (parsed.commanders.some((entry) => entry.quantity !== 1)) {
    throw new Error('Each TopDeck commander entry must represent exactly one physical card.');
  }
  return parsed.commanders.map((entry) => entry.name);
}

function structuredSection(deckObj: Record<string, unknown>, wanted: 'commanders' | 'mainboard'): Record<string, unknown> {
  const match = Object.entries(deckObj).find(([key]) => key.trim().toLocaleLowerCase() === wanted);
  const value = match?.[1];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`TopDeck deckObj must contain an object ${wanted} section.`);
  }
  return value as Record<string, unknown>;
}

function strictStructuredEntry(section: string, cardName: string, value: unknown): { name: string; count: number } {
  const name = requireCardName(`${section} card name`, cardName);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`TopDeck deckObj ${section} entry must be an object.`);
  const object = value as Record<string, unknown>;
  const keys = Object.keys(object).map((key) => key.trim()).sort();
  if (keys.length !== 2 || keys[0] !== 'count' || keys[1] !== 'id') {
    throw new Error(`TopDeck deckObj ${section} entry must use the strict id+count schema.`);
  }
  requireString(`${section}.id`, object.id, 300);
  const count = optionalInteger(object.count);
  if (count === null || count < 1 || count > 100) throw new Error(`TopDeck deckObj ${section}.count must be an integer from 1 to 100.`);
  return { name, count };
}

export function materializeTopDeckDeckObjectV15(value: unknown): { decklist: string; commanderNames: string[] } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('TopDeck deckObj must be an object.');
  const deckObj = value as Record<string, unknown>;
  const commanders = Object.entries(structuredSection(deckObj, 'commanders'))
    .map(([name, entry]) => strictStructuredEntry('commanders', name, entry))
    .sort((a, b) => a.name.localeCompare(b.name));
  const mainboard = Object.entries(structuredSection(deckObj, 'mainboard'))
    .map(([name, entry]) => strictStructuredEntry('mainboard', name, entry))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (commanders.length < 1 || commanders.length > 2) {
    throw new Error(`TopDeck deckObj must contain one or two commander entries; found ${commanders.length}.`);
  }
  if (commanders.some((entry) => entry.count !== 1)) throw new Error('Each TopDeck deckObj commander must have count 1.');
  const totalCards = [...commanders, ...mainboard].reduce((sum, entry) => sum + entry.count, 0);
  if (totalCards !== 100) throw new Error(`TopDeck deckObj must contain exactly 100 cards; found ${totalCards}.`);
  const decklist = [
    '// COMMANDER',
    ...commanders.map((entry) => `${entry.count} ${entry.name}`),
    '',
    '// MAIN',
    ...mainboard.map((entry) => `${entry.count} ${entry.name}`),
  ].join('\n');
  return { decklist, commanderNames: validateCommanderDeck(decklist) };
}

export function adaptTopDeckV2TournamentForLearningV15(input: TopDeckV2BulkTournamentV15): TopDeckLearningAdapterResultV15 {
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
    rejected.push(rejection(null, null, null, 'malformed-tournament', error instanceof Error ? error.message : String(error)));
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
  const tournamentName = typeof input.tournamentName === 'string' && input.tournamentName.trim() ? input.tournamentName.trim().slice(0, 300) : null;
  const eventData = input.eventData && typeof input.eventData === 'object' ? input.eventData as Record<string, unknown> : null;
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
    try { playerId = requireString('standing.id', standing.id); }
    catch (error) {
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

    let decklist: string;
    let commanderNames: string[];
    let deckSource: TopDeckLearningCandidateV15['metadata']['deckSource'];
    const hasInlineMultilineDeck = typeof standing.decklist === 'string' && Boolean(standing.decklist.trim()) && /\r|\n/.test(standing.decklist);
    if (hasInlineMultilineDeck) {
      try {
        decklist = normalizeTopDeckDecklistTextV15(standing.decklist);
        commanderNames = validateCommanderDeck(decklist);
        deckSource = 'inline-text';
      } catch (error) {
        rejected.push(rejection(tournamentId, index, playerId, 'invalid-commander-deck', error instanceof Error ? error.message : String(error)));
        continue;
      }
    } else if (standing.deckObj && typeof standing.deckObj === 'object' && !Array.isArray(standing.deckObj)) {
      try {
        const structured = materializeTopDeckDeckObjectV15(standing.deckObj);
        decklist = structured.decklist;
        commanderNames = structured.commanderNames;
        deckSource = 'topdeck-deckobj';
      } catch (error) {
        rejected.push(rejection(tournamentId, index, playerId, 'invalid-structured-deck', error instanceof Error ? error.message : String(error)));
        continue;
      }
    } else if (typeof standing.decklist === 'string' && standing.decklist.trim()) {
      rejected.push(rejection(tournamentId, index, playerId, 'external-decklist-url', 'TopDeck supplied a single-line deck reference without a usable strict deckObj; external references are not fetched by the learning adapter.'));
      continue;
    } else {
      rejected.push(rejection(tournamentId, index, playerId, 'missing-decklist-text', 'TopDeck standing has no inline deck text or strict structured deckObj.'));
      continue;
    }

    candidates.push({
      sourceId: 'topdeck', providerEventId: tournamentId, providerPlayerId: playerId,
      providerRecordId: `${tournamentId}:standing:${playerId}`, sourceUrl: sourceUrlForTournament(tournamentId),
      outcomeOccurredAt, standing: standingNumber, fieldSize, topCutSize, decklist, commanderNames,
      metadata: {
        provider: 'topdeck-v2', tournamentName, wins: optionalInteger(standing.wins), draws: optionalInteger(standing.draws), losses: optionalInteger(standing.losses),
        standingSource, deckSource,
        ...(deckSource === 'topdeck-deckobj' ? { deckObjectSchemaVersion: TOPDECK_DECKOBJ_SCHEMA_V15 } : {}),
        ...(eventCity !== null ? { eventCity } : {}), ...(eventState !== null ? { eventState } : {}),
      },
    });
  }
  return { candidates, rejected, attribution: TOPDECK_V2_ATTRIBUTION_V15 };
}

export function enrichTopDeckLearningCandidateV15(candidate: TopDeckLearningCandidateV15, enrichment: TopDeckLearningEnrichmentV15): ObservedLearningSourceRecordV15 {
  return {
    sourceId: 'topdeck', sourceRecordId: candidate.providerRecordId, sourceUrl: candidate.sourceUrl,
    canonicalOutcomeId: requireString('canonicalOutcomeId', enrichment.canonicalOutcomeId),
    independenceKey: requireString('independenceKey', enrichment.independenceKey),
    leakageKey: requireString('leakageKey', enrichment.leakageKey),
    outcomeOccurredAt: candidate.outcomeOccurredAt, sourceObservedAt: requireString('sourceObservedAt', enrichment.sourceObservedAt),
    decklist: candidate.decklist, expectedCommanderNames: [...candidate.commanderNames],
    featureExtractorId: requireString('featureExtractorId', enrichment.featureExtractorId), features: { ...enrichment.features },
    outcome: { kind: 'event-top-cut', standing: candidate.standing, fieldSize: candidate.fieldSize, topCutSize: candidate.topCutSize },
    ...(enrichment.importance !== undefined ? { importance: enrichment.importance } : {}),
    metadata: {
      provider: candidate.metadata.provider, providerEventId: candidate.providerEventId, providerPlayerId: candidate.providerPlayerId,
      tournamentName: candidate.metadata.tournamentName, wins: candidate.metadata.wins, draws: candidate.metadata.draws, losses: candidate.metadata.losses,
      standingSource: candidate.metadata.standingSource, deckSource: candidate.metadata.deckSource,
      ...(candidate.metadata.deckObjectSchemaVersion !== undefined ? { deckObjectSchemaVersion: candidate.metadata.deckObjectSchemaVersion } : {}),
      ...(candidate.metadata.eventCity !== undefined ? { eventCity: candidate.metadata.eventCity } : {}),
      ...(candidate.metadata.eventState !== undefined ? { eventState: candidate.metadata.eventState } : {}),
      attribution: TOPDECK_V2_ATTRIBUTION_V15,
    },
  };
}
