import { createHash } from 'node:crypto';
import type { ScryfallCard } from '../types/scryfall.js';
import {
  buildDeckMetrics,
  parseDecklist,
  resolveEntryCard,
  type DeckEntry,
} from './deck.js';
import { fingerprintExactDeckV15 } from './learning-corpus-v15.js';
import type { LearningFeatureV15 } from './research-learning-v15.js';

export const DECK_FEATURE_EXTRACTOR_ID_V15 = 'deck-structural-v15.2' as const;
export const DECK_FEATURE_NORMALIZER_ID_V15 = 'deck-structural-minmax-v15.1' as const;
export const MAX_DECK_FEATURE_SNAPSHOTS_V15 = 50_000;

export interface RawDeckFeaturesV15 {
  totalCards: number;
  totalMain: number;
  totalCommanders: number;
  landCount: number;
  nonlandCount: number;
  landRatio: number;
  averageNonlandManaValue: number;
  earlyPlayCount: number;
  fastManaCount: number;
  rampCount: number;
  drawCount: number;
  tutorCount: number;
  interactionCount: number;
  cheapInteractionCount: number;
  protectionCount: number;
  recursionCount: number;
  boardWipeCount: number;
}

export interface DeckFeatureSnapshotV15 {
  extractorId: typeof DECK_FEATURE_EXTRACTOR_ID_V15;
  deckFingerprint: string;
  cardDataSnapshotFingerprint: string;
  commanderNames: string[];
  availableAt: string;
  cardDataObservedAt: string;
  raw: RawDeckFeaturesV15;
}

export interface DeckFeatureNormalizerFieldV15 {
  rawField: 'averageNonlandManaValue' | 'cheapInteractionCount';
  minimum: number;
  maximum: number;
  direction: 'lower-is-better' | 'higher-is-better';
}

export interface DeckFeatureNormalizerV15 {
  normalizerId: typeof DECK_FEATURE_NORMALIZER_ID_V15;
  extractorId: typeof DECK_FEATURE_EXTRACTOR_ID_V15;
  fittedSnapshotCount: number;
  fitFingerprint: string;
  fields: {
    manaEfficiency: DeckFeatureNormalizerFieldV15;
    interactionEfficiency: DeckFeatureNormalizerFieldV15;
  };
}

export interface ProjectedDeckFeaturesV15 {
  deckFingerprint: string;
  availableAt: string;
  features: Partial<Record<LearningFeatureV15, number>>;
}

export interface TemporalDeckFeaturePreparationV15 {
  normalizer: DeckFeatureNormalizerV15;
  training: ProjectedDeckFeaturesV15[];
  holdout: ProjectedDeckFeaturesV15[];
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function timestamp(name: string, value: string): { iso: string; ms: number } {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty timestamp.`);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`${name} must be a valid timestamp.`);
  return { iso: new Date(ms).toISOString(), ms };
}

function releaseTimestampMs(card: ScryfallCard): number | null {
  if (!card.released_at) return null;
  const ms = Date.parse(`${card.released_at}T00:00:00.000Z`);
  return Number.isFinite(ms) ? ms : null;
}

function assertResolvedEntry(entry: DeckEntry, cards: ScryfallCard[], availableAtMs: number): ScryfallCard {
  const resolved = resolveEntryCard(entry, cards);
  if (!resolved) throw new Error(`Could not resolve deck entry ${entry.name}.`);
  if (normalize(resolved.name) !== normalize(entry.name)) {
    throw new Error(`Resolved card identity for ${entry.name} does not match supplied card ${resolved.name}.`);
  }
  if (entry.set && resolved.set.toLocaleLowerCase() !== entry.set.toLocaleLowerCase()) {
    throw new Error(`Resolved printing for ${entry.name} does not match requested set ${entry.set}.`);
  }
  if (entry.collectorNumber
    && resolved.collector_number.toLocaleLowerCase() !== entry.collectorNumber.toLocaleLowerCase()) {
    throw new Error(`Resolved printing for ${entry.name} does not match collector number ${entry.collectorNumber}.`);
  }
  const releasedAtMs = releaseTimestampMs(resolved);
  if (releasedAtMs !== null && releasedAtMs > availableAtMs) {
    throw new Error(`Resolved future printing ${resolved.name} (${resolved.set.toUpperCase()} ${resolved.collector_number}) was released after feature availableAt.`);
  }
  return resolved;
}

function sortedStrings(values: string[] | undefined): string[] {
  return [...(values ?? [])].sort((a, b) => a.localeCompare(b));
}

function canonicalCardData(card: ScryfallCard): Record<string, unknown> {
  return {
    id: card.id,
    oracleId: card.oracle_id ?? null,
    name: card.name,
    releasedAt: card.released_at ?? null,
    manaCost: card.mana_cost ?? null,
    cmc: card.cmc,
    typeLine: card.type_line,
    oracleText: card.oracle_text ?? null,
    colors: sortedStrings(card.colors),
    colorIdentity: sortedStrings(card.color_identity),
    keywords: sortedStrings(card.keywords),
    producedMana: sortedStrings(card.produced_mana),
    power: card.power ?? null,
    toughness: card.toughness ?? null,
    loyalty: card.loyalty ?? null,
    defense: card.defense ?? null,
    set: card.set.toLocaleLowerCase(),
    collectorNumber: card.collector_number,
    rarity: card.rarity,
    commanderLegality: card.legalities.commander ?? null,
    cardFaces: (card.card_faces ?? []).map((face) => ({
      name: face.name,
      manaCost: face.mana_cost ?? null,
      typeLine: face.type_line ?? null,
      oracleText: face.oracle_text ?? null,
      colors: sortedStrings(face.colors),
      power: face.power ?? null,
      toughness: face.toughness ?? null,
      loyalty: face.loyalty ?? null,
    })),
  };
}

function cardDataIdentity(card: ScryfallCard): string {
  return `${normalize(card.name)}|${card.set.toLocaleLowerCase()}|${card.collector_number.toLocaleLowerCase()}|${card.id}`;
}

function fingerprintResolvedCardData(cards: ScryfallCard[]): string {
  const unique = new Map<string, ScryfallCard>();
  for (const card of cards) unique.set(cardDataIdentity(card), card);
  const rows = [...unique.values()]
    .map((card) => JSON.stringify(canonicalCardData(card)))
    .sort();
  return createHash('sha256').update(rows.join('\n')).digest('hex');
}

function finiteNonNegative(name: string, value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be finite and non-negative.`);
  return value;
}

function validateSnapshot(snapshot: DeckFeatureSnapshotV15): void {
  if (snapshot.extractorId !== DECK_FEATURE_EXTRACTOR_ID_V15) {
    throw new Error(`Feature extractor contract mismatch: expected ${DECK_FEATURE_EXTRACTOR_ID_V15}, received ${String(snapshot.extractorId)}.`);
  }
  if (!/^[a-f0-9]{64}$/i.test(snapshot.deckFingerprint)) throw new Error('deckFingerprint must be a SHA-256 hex digest.');
  if (!/^[a-f0-9]{64}$/i.test(snapshot.cardDataSnapshotFingerprint)) {
    throw new Error('cardDataSnapshotFingerprint must be a SHA-256 hex digest.');
  }
  timestamp('snapshot.availableAt', snapshot.availableAt);
  timestamp('snapshot.cardDataObservedAt', snapshot.cardDataObservedAt);
  if (!Array.isArray(snapshot.commanderNames) || snapshot.commanderNames.length < 1 || snapshot.commanderNames.length > 2) {
    throw new Error('Feature snapshot must contain one or two commander names.');
  }
  for (const [key, value] of Object.entries(snapshot.raw)) finiteNonNegative(`snapshot.raw.${key}`, value);
}

/**
 * Deterministically extracts deck-intrinsic structural facts from a complete
 * historical Commander list and an explicitly supplied card-data snapshot.
 *
 * Tournament standing, match result, community adoption, price movement and
 * other outcome-derived facts are intentionally not accepted as inputs.
 */
export function extractDeckFeatureSnapshotV15(
  decklist: string,
  cards: ScryfallCard[],
  options: {
    availableAt: string;
    cardDataObservedAt: string;
  },
): DeckFeatureSnapshotV15 {
  if (typeof decklist !== 'string' || !decklist.trim()) throw new Error('decklist must be a non-empty string.');
  if (!Array.isArray(cards) || cards.length === 0) throw new Error('cards must contain the resolved historical card-data snapshot.');

  const availableAt = timestamp('availableAt', options.availableAt);
  const cardDataObservedAt = timestamp('cardDataObservedAt', options.cardDataObservedAt);
  if (cardDataObservedAt.ms > availableAt.ms) {
    throw new Error('cardDataObservedAt cannot occur after availableAt for a predictor snapshot.');
  }

  const parsed = parseDecklist(decklist);
  if (parsed.totalCards !== 100) {
    throw new Error(`Historical Commander feature deck must contain exactly 100 cards; found ${parsed.totalCards}.`);
  }
  if (parsed.commanders.length < 1 || parsed.commanders.length > 2) {
    throw new Error(`Historical Commander feature deck must contain one or two commander entries; found ${parsed.commanders.length}.`);
  }
  if (parsed.commanders.some((entry) => entry.quantity !== 1)) {
    throw new Error('Each historical Commander entry must represent exactly one physical card.');
  }

  const resolvedFeatureCards: ScryfallCard[] = [];
  for (const entry of [...parsed.commanders, ...parsed.main]) {
    resolvedFeatureCards.push(assertResolvedEntry(entry, cards, availableAt.ms));
  }

  const metrics = buildDeckMetrics(parsed, cards);
  const raw: RawDeckFeaturesV15 = {
    totalCards: parsed.totalCards,
    totalMain: parsed.totalMain,
    totalCommanders: parsed.totalCommanders,
    landCount: metrics.landCount,
    nonlandCount: metrics.nonlandCount,
    landRatio: metrics.landRatio,
    averageNonlandManaValue: metrics.averageNonlandManaValue,
    earlyPlayCount: metrics.earlyPlayCount,
    fastManaCount: metrics.fastManaCount,
    rampCount: metrics.rampCount,
    drawCount: metrics.drawCount,
    tutorCount: metrics.tutorCount,
    interactionCount: metrics.interactionCount,
    cheapInteractionCount: metrics.cheapInteractionCount,
    protectionCount: metrics.protectionCount,
    recursionCount: metrics.recursionCount,
    boardWipeCount: metrics.boardWipeCount,
  };

  return {
    extractorId: DECK_FEATURE_EXTRACTOR_ID_V15,
    deckFingerprint: fingerprintExactDeckV15(decklist),
    cardDataSnapshotFingerprint: fingerprintResolvedCardData(resolvedFeatureCards),
    commanderNames: parsed.commanders.map((entry) => entry.name),
    availableAt: availableAt.iso,
    cardDataObservedAt: cardDataObservedAt.iso,
    raw,
  };
}

function fitFingerprint(snapshots: DeckFeatureSnapshotV15[]): string {
  const rows = snapshots.map((snapshot) => [
    snapshot.deckFingerprint,
    snapshot.cardDataSnapshotFingerprint,
    snapshot.availableAt,
    snapshot.raw.averageNonlandManaValue,
    snapshot.raw.cheapInteractionCount,
  ].join('|')).sort();
  return createHash('sha256').update(rows.join('\n')).digest('hex');
}

function range(
  snapshots: DeckFeatureSnapshotV15[],
  rawField: DeckFeatureNormalizerFieldV15['rawField'],
  direction: DeckFeatureNormalizerFieldV15['direction'],
): DeckFeatureNormalizerFieldV15 {
  const values = snapshots.map((snapshot) => snapshot.raw[rawField]);
  return {
    rawField,
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    direction,
  };
}

/** Fit only on the training snapshots supplied by the caller. */
export function fitDeckFeatureNormalizerV15(
  trainingSnapshots: DeckFeatureSnapshotV15[],
): DeckFeatureNormalizerV15 {
  if (!Array.isArray(trainingSnapshots) || trainingSnapshots.length < 1) {
    throw new Error('At least one training feature snapshot is required to fit normalization.');
  }
  if (trainingSnapshots.length > MAX_DECK_FEATURE_SNAPSHOTS_V15) {
    throw new Error(`At most ${MAX_DECK_FEATURE_SNAPSHOTS_V15} training snapshots may be normalized at once.`);
  }
  for (const snapshot of trainingSnapshots) validateSnapshot(snapshot);

  return {
    normalizerId: DECK_FEATURE_NORMALIZER_ID_V15,
    extractorId: DECK_FEATURE_EXTRACTOR_ID_V15,
    fittedSnapshotCount: trainingSnapshots.length,
    fitFingerprint: fitFingerprint(trainingSnapshots),
    fields: {
      manaEfficiency: range(trainingSnapshots, 'averageNonlandManaValue', 'lower-is-better'),
      interactionEfficiency: range(trainingSnapshots, 'cheapInteractionCount', 'higher-is-better'),
    },
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value: number, digits = 6): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function normalizeWithRange(value: number, field: DeckFeatureNormalizerFieldV15): number {
  if (field.maximum === field.minimum) return 0;
  const unit = clamp((value - field.minimum) / (field.maximum - field.minimum), 0, 1);
  const signed = unit * 2 - 1;
  return round(field.direction === 'lower-is-better' ? -signed : signed);
}

export function projectDeckFeatureSnapshotV15(
  snapshot: DeckFeatureSnapshotV15,
  normalizer: DeckFeatureNormalizerV15,
): Partial<Record<LearningFeatureV15, number>> {
  validateSnapshot(snapshot);
  if (normalizer.extractorId !== DECK_FEATURE_EXTRACTOR_ID_V15
    || normalizer.normalizerId !== DECK_FEATURE_NORMALIZER_ID_V15) {
    throw new Error('Normalizer extractor/version contract does not match the deck feature snapshot contract.');
  }

  return {
    manaEfficiency: normalizeWithRange(
      snapshot.raw.averageNonlandManaValue,
      normalizer.fields.manaEfficiency,
    ),
    interactionEfficiency: normalizeWithRange(
      snapshot.raw.cheapInteractionCount,
      normalizer.fields.interactionEfficiency,
    ),
  };
}

function projected(
  snapshot: DeckFeatureSnapshotV15,
  normalizer: DeckFeatureNormalizerV15,
): ProjectedDeckFeaturesV15 {
  return {
    deckFingerprint: snapshot.deckFingerprint,
    availableAt: snapshot.availableAt,
    features: projectDeckFeatureSnapshotV15(snapshot, normalizer),
  };
}

/**
 * Leakage-safe convenience boundary: the normalizer is fitted exclusively from
 * `trainingSnapshots`; `holdoutSnapshots` are transform-only and can never alter
 * fitted ranges or previously projected training examples.
 */
export function prepareTemporalDeckFeaturesV15(
  trainingSnapshots: DeckFeatureSnapshotV15[],
  holdoutSnapshots: DeckFeatureSnapshotV15[],
): TemporalDeckFeaturePreparationV15 {
  if (!Array.isArray(holdoutSnapshots)) throw new Error('holdoutSnapshots must be an array.');
  if (holdoutSnapshots.length > MAX_DECK_FEATURE_SNAPSHOTS_V15) {
    throw new Error(`At most ${MAX_DECK_FEATURE_SNAPSHOTS_V15} holdout snapshots may be transformed at once.`);
  }
  for (const snapshot of holdoutSnapshots) validateSnapshot(snapshot);

  const normalizer = fitDeckFeatureNormalizerV15(trainingSnapshots);
  return {
    normalizer,
    training: trainingSnapshots.map((snapshot) => projected(snapshot, normalizer)),
    holdout: holdoutSnapshots.map((snapshot) => projected(snapshot, normalizer)),
  };
}
