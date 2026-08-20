type UnknownRecord = Record<string, unknown>;

export interface TournamentEvidenceRecordV12 {
  source: 'TopDeck.gg' | 'EDHTop16';
  eventName: string | null;
  eventId: string | null;
  player: string | null;
  commanders: string[];
  standing: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  deckUrl: string | null;
  raw: UnknownRecord;
}

export interface DeduplicatedTournamentRecordV12 extends TournamentEvidenceRecordV12 {
  sources: Array<'TopDeck.gg' | 'EDHTop16'>;
  duplicateReason: string | null;
  corroboratingRecords: TournamentEvidenceRecordV12[];
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalize(value: string | null): string {
  return (value ?? '')
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/https?:\/\/(?:www\.)?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeUrl(value: string | null): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    return `${url.hostname.toLocaleLowerCase().replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}`;
  } catch {
    return normalize(value);
  }
}

function commanderList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => typeof item === 'string' ? [item.trim()] : []).filter(Boolean);
  }
  const single = text(value);
  if (!single) return [];
  return single
    .split(/\s+(?:\/\/|\/|\+|&|and)\s+/i)
    .map((name) => name.trim())
    .filter(Boolean);
}

function canonicalCommanders(value: string[]): string {
  return [...value].map((name) => normalize(name)).filter(Boolean).sort().join('|');
}

function topDeckRecords(input: unknown): TournamentEvidenceRecordV12[] {
  const root = asRecord(input);
  const records = Array.isArray(root.records) ? root.records.map(asRecord) : [];
  return records.map((record) => ({
    source: 'TopDeck.gg' as const,
    eventName: text(record.tournamentName),
    eventId: text(record.tournamentId),
    player: text(record.player),
    commanders: commanderList(record.commanders),
    standing: numberOrNull(record.standing),
    wins: numberOrNull(record.wins),
    draws: numberOrNull(record.draws),
    losses: numberOrNull(record.losses),
    deckUrl: text(record.sourceDeckUrl),
    raw: record,
  }));
}

function edhTop16Records(input: unknown): TournamentEvidenceRecordV12[] {
  const root = asRecord(input);
  const entries = Array.isArray(root.entries) ? root.entries.map(asRecord) : [];
  return entries.map((record) => ({
    source: 'EDHTop16' as const,
    eventName: text(record.tournamentName ?? record.tourneyName ?? record.eventName),
    eventId: text(record.tournamentId ?? record.tourneyId ?? record.TID),
    player: text(record.name ?? record.player),
    commanders: commanderList(record.commander ?? record.commanders),
    standing: numberOrNull(record.standing),
    wins: numberOrNull(record.wins),
    draws: numberOrNull(record.draws),
    losses: numberOrNull(record.losses),
    deckUrl: text(record.decklist ?? record.deckUrl),
    raw: record,
  }));
}

function sameResults(a: TournamentEvidenceRecordV12, b: TournamentEvidenceRecordV12): boolean {
  const values: Array<keyof Pick<TournamentEvidenceRecordV12, 'wins' | 'draws' | 'losses'>> = ['wins', 'draws', 'losses'];
  let compared = 0;
  for (const key of values) {
    if (a[key] === null || b[key] === null) continue;
    compared += 1;
    if (a[key] !== b[key]) return false;
  }
  return compared >= 2;
}

function eventLooksSame(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  return shorter.length >= 8 && longer.includes(shorter);
}

function duplicateReason(a: TournamentEvidenceRecordV12, b: TournamentEvidenceRecordV12): string | null {
  if (a.source === b.source) return null;
  const eventA = normalize(a.eventName);
  const eventB = normalize(b.eventName);
  const playerA = normalize(a.player);
  const playerB = normalize(b.player);
  const deckA = normalizeUrl(a.deckUrl);
  const deckB = normalizeUrl(b.deckUrl);
  const commandersA = canonicalCommanders(a.commanders);
  const commandersB = canonicalCommanders(b.commanders);

  if (a.eventId && b.eventId && normalize(a.eventId) === normalize(b.eventId) && playerA && playerA === playerB) {
    return 'same-event-id-and-player';
  }
  if (eventLooksSame(eventA, eventB) && playerA && playerA === playerB) {
    return 'same-event-and-player';
  }
  if (eventLooksSame(eventA, eventB) && deckA && deckA === deckB) {
    return 'same-event-and-deck-link';
  }
  if (
    eventLooksSame(eventA, eventB)
    && playerA
    && playerA === playerB
    && commandersA
    && commandersA === commandersB
    && sameResults(a, b)
  ) {
    return 'same-event-player-commanders-and-record';
  }
  return null;
}

function richness(record: TournamentEvidenceRecordV12): number {
  return [record.eventName, record.eventId, record.player, record.deckUrl].filter(Boolean).length
    + record.commanders.length
    + [record.standing, record.wins, record.draws, record.losses].filter((value) => value !== null).length;
}

export function deduplicateTournamentEvidenceV12(
  topDeckEvidence: unknown,
  edhTop16Evidence: unknown,
): Record<string, unknown> {
  const raw = [...topDeckRecords(topDeckEvidence), ...edhTop16Records(edhTop16Evidence)];
  const unique: DeduplicatedTournamentRecordV12[] = [];
  const duplicateGroups: Array<Record<string, unknown>> = [];

  for (const record of raw) {
    let matchedIndex = -1;
    let reason: string | null = null;
    for (let index = 0; index < unique.length; index += 1) {
      const candidate = unique[index];
      if (!candidate) continue;
      reason = duplicateReason(candidate, record);
      if (reason) {
        matchedIndex = index;
        break;
      }
    }

    if (matchedIndex < 0 || !reason) {
      unique.push({
        ...record,
        sources: [record.source],
        duplicateReason: null,
        corroboratingRecords: [],
      });
      continue;
    }

    const existing = unique[matchedIndex];
    if (!existing) continue;
    const combinedSources = [...new Set([...existing.sources, record.source])];
    const primary = richness(record) > richness(existing) ? record : existing;
    const corroborating = richness(record) > richness(existing)
      ? [existing, ...existing.corroboratingRecords]
      : [...existing.corroboratingRecords, record];
    unique[matchedIndex] = {
      ...primary,
      sources: combinedSources,
      duplicateReason: reason,
      corroboratingRecords: corroborating,
    };
    duplicateGroups.push({
      reason,
      sources: combinedSources,
      eventName: primary.eventName,
      player: primary.player,
      commanders: primary.commanders,
    });
  }

  const duplicateCount = raw.length - unique.length;
  return {
    rawRecordCount: raw.length,
    effectiveUniqueRecordCount: unique.length,
    duplicateRecordCount: duplicateCount,
    overlapRate: raw.length > 0 ? Number((duplicateCount / raw.length).toFixed(3)) : 0,
    uniqueRecords: unique.map((record) => ({
      source: record.source,
      sources: record.sources,
      eventName: record.eventName,
      eventId: record.eventId,
      player: record.player,
      commanders: record.commanders,
      standing: record.standing,
      wins: record.wins,
      draws: record.draws,
      losses: record.losses,
      deckUrl: record.deckUrl,
      duplicateReason: record.duplicateReason,
    })),
    duplicateGroups,
    guidance: duplicateCount > 0
      ? 'Potential cross-site duplicates were collapsed before reporting effective sample size. Source agreement still counts as corroboration, but not as a second independent tournament result.'
      : 'No conservative cross-site duplicate matches were found in this sample.',
    caveat: 'Deduplication is intentionally conservative. It requires event/player/deck/result context and never treats a reused deck URL alone as proof that two records are the same tournament appearance.',
  };
}
