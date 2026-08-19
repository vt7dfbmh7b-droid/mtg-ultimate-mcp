import type { ScryfallCard } from '../types/scryfall.js';
import type { DeckEntry, ParsedDeck } from './deck.js';
import { validateCommanderDeck, type CommanderRulesResult } from './commander-rules.js';
import { getCardOracleText } from './scryfall.js';

/**
 * Edge of Eternities released on 2025-08-01 and changed CR 903.3 so legendary
 * Vehicles/Spacecraft with printed power and toughness became Commander-eligible.
 * This matters historically because the change retroactively affected older
 * cards. Current validation should use the new rule, while an earlier predictor
 * must not inherit that future eligibility.
 */
export const VEHICLE_SPACECRAFT_COMMANDER_RULE_EFFECTIVE_AT_V15 = '2025-08-01T00:00:00.000Z' as const;

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function resolveEntry(entry: DeckEntry, cards: ScryfallCard[]): ScryfallCard | undefined {
  if (entry.set && entry.collectorNumber) {
    const exact = cards.find((card) =>
      normalize(card.name) === normalize(entry.name)
      && normalize(card.set) === normalize(entry.set ?? '')
      && normalize(card.collector_number) === normalize(entry.collectorNumber ?? ''));
    if (exact) return exact;
  }
  if (entry.set) {
    const inSet = cards.find((card) =>
      normalize(card.name) === normalize(entry.name)
      && normalize(card.set) === normalize(entry.set ?? ''));
    if (inSet) return inSet;
  }
  return cards.find((card) => normalize(card.name) === normalize(entry.name));
}

function printedStats(value: { power?: string; toughness?: string }): boolean {
  return typeof value.power === 'string' && value.power.trim().length > 0
    && typeof value.toughness === 'string' && value.toughness.trim().length > 0;
}

function legendaryVehicleOrSpacecraftFace(value: {
  type_line?: string;
  power?: string;
  toughness?: string;
}): boolean {
  const type = value.type_line?.toLocaleLowerCase() ?? '';
  return type.includes('legendary')
    && (type.includes('vehicle') || type.includes('spacecraft'))
    && printedStats(value);
}

function gainedEligibilityOnlyFrom2025Rule(card: ScryfallCard): boolean {
  const type = card.type_line.toLocaleLowerCase();
  const legendaryCreature = type.includes('legendary') && type.includes('creature');
  const explicitPermission = /can be your commander/i.test(getCardOracleText(card));
  if (legendaryCreature || explicitPermission) return false;
  return legendaryVehicleOrSpacecraftFace(card)
    || (card.card_faces ?? []).some((face) => legendaryVehicleOrSpacecraftFace(face));
}

function timestamp(value: string): number {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Commander rules asOf must be a non-empty timestamp.');
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error('Commander rules asOf must be a valid timestamp.');
  return milliseconds;
}

/**
 * Apply current hard Commander validation, then remove only eligibility that is
 * known to have been introduced after the requested historical cutoff.
 *
 * This is intentionally fail-closed and narrowly versioned. It is not a license
 * to reconstruct unknown historical rules from present-day state. Future
 * retroactive Commander-rule changes should receive their own dated gate here.
 */
export function validateCommanderDeckAsOfV15(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  asOf: string,
): CommanderRulesResult {
  const asOfMs = timestamp(asOf);
  const current = validateCommanderDeck(parsed, cards);
  const effectiveMs = Date.parse(VEHICLE_SPACECRAFT_COMMANDER_RULE_EFFECTIVE_AT_V15);

  const historicallyIneligibleNames = new Set<string>();
  if (asOfMs < effectiveMs) {
    for (const entry of parsed.commanders) {
      const card = resolveEntry(entry, cards);
      if (card && gainedEligibilityOnlyFrom2025Rule(card)) {
        historicallyIneligibleNames.add(normalize(card.name));
      }
    }
  }

  const commanderChecks = current.commanderChecks.map((check) => {
    const name = typeof check.name === 'string' ? check.name : '';
    if (!historicallyIneligibleNames.has(normalize(name))) return check;
    return {
      ...check,
      eligible: false,
      reason: `Legendary Vehicle/Spacecraft printed-stat commander eligibility was not effective before ${VEHICLE_SPACECRAFT_COMMANDER_RULE_EFFECTIVE_AT_V15}.`,
    };
  });

  const historicalEligibilityViolation = historicallyIneligibleNames.size > 0;
  const status = current.status === 'incomplete'
    ? 'incomplete' as const
    : historicalEligibilityViolation
      ? 'illegal' as const
      : current.status;

  return {
    ...current,
    ruleset: `Commander deck construction as of ${new Date(asOfMs).toISOString()} (dated Commander policy gates + hard construction validation)`,
    status,
    isLegal: status === 'legal',
    commanderChecks,
    rulesApplied: [
      ...current.rulesApplied,
      `Historical rule gate: legendary Vehicle/Spacecraft printed-stat commander eligibility is available only from ${VEHICLE_SPACECRAFT_COMMANDER_RULE_EFFECTIVE_AT_V15}.`,
    ],
  };
}
