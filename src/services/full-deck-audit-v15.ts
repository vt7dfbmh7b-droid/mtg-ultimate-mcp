import type { ScryfallCard } from '../types/scryfall.js';
import { auditCardPurposeV15, type CardPurposeContextV15, type CardPurposeStatusV15 } from './card-purpose-v15.js';
import type { ResolvedDeckSlotV15 } from './deck-slots-v15.js';
import { getCardOracleText, inferCardRoles } from './scryfall.js';

export interface LandAuditProfileV15 {
  basic: boolean;
  entersTapped: boolean;
  producedMana: string[];
  commanderColorsProduced: string[];
  utilityRoles: string[];
}

export interface FullDeckSlotAuditV15 {
  slot: number;
  copy: number;
  cardName: string;
  set: string;
  collectorNumber: string;
  typeLine: string;
  manaValue: number;
  status: CardPurposeStatusV15;
  score: number;
  roles: string[];
  purposes: string[];
  supportEvidence: string[];
  warnings: string[];
  deterministicComboHits: string[];
  land: LandAuditProfileV15 | null;
  roleRedundancy: Array<{ role: string; otherSlots: number }>;
  removalConsequence: string;
}

export interface FullDeckAuditV15 {
  physicalSlots: number;
  counts: Record<CardPurposeStatusV15, number>;
  slots: FullDeckSlotAuditV15[];
  challengeSlots: string[];
  reviewSlots: string[];
  note: string;
}

function normalize(value: string): string { return value.trim().toLocaleLowerCase(); }
function unique(values: readonly string[]): string[] { return [...new Set(values)]; }
function isLand(card: ScryfallCard): boolean { return card.type_line.toLocaleLowerCase().includes('land'); }
function isBasicLand(card: ScryfallCard): boolean { return card.type_line.toLocaleLowerCase().includes('basic land'); }

function landProfile(card: ScryfallCard, commander?: ScryfallCard): LandAuditProfileV15 | null {
  if (!isLand(card)) return null;
  const text = getCardOracleText(card).replace(/\s+/g, ' ').toLocaleLowerCase();
  const roles = inferCardRoles(card);
  const producedMana = unique(card.produced_mana ?? []);
  const commanderIdentity = new Set(commander?.color_identity ?? []);
  const commanderColorsProduced = producedMana.filter((color) => commanderIdentity.has(color));
  const utilityRoles = roles.filter((role) => !['mana acceleration', 'land ramp', 'persistent colored mana source'].includes(role));
  return {
    basic: isBasicLand(card),
    entersTapped: /\benters tapped\b/.test(text),
    producedMana,
    commanderColorsProduced,
    utilityRoles,
  };
}

function adjustedLandFinding(
  card: ScryfallCard,
  status: CardPurposeStatusV15,
  score: number,
  warnings: readonly string[],
  profile: LandAuditProfileV15 | null,
  commander?: ScryfallCard,
): { status: CardPurposeStatusV15; score: number; warnings: string[] } {
  if (!profile) return { status, score, warnings: [...warnings] };
  const nextWarnings = [...warnings];
  let nextStatus = status;
  let nextScore = score;

  if (profile.basic) {
    return { status: nextStatus, score: nextScore + 1, warnings: nextWarnings };
  }

  if (profile.entersTapped) {
    nextWarnings.push('nonbasic land enters tapped; tempo cost must be justified against legal alternatives');
    nextScore -= 1;
    if (nextStatus === 'supported') nextStatus = 'review';
  }

  const commanderColors = commander?.color_identity.length ?? 0;
  if (commanderColors >= 2 && profile.commanderColorsProduced.length === 0 && profile.utilityRoles.length === 0) {
    nextWarnings.push('multicolor mana base slot does not directly produce a commander color and has no detected non-mana utility role');
    nextScore -= 1;
    if (nextStatus === 'supported') nextStatus = 'review';
  }

  return { status: nextStatus, score: nextScore, warnings: unique(nextWarnings) };
}

function removalConsequence(
  card: ScryfallCard,
  status: CardPurposeStatusV15,
  purposes: readonly string[],
  profile: LandAuditProfileV15 | null,
  totalLands: number,
): string {
  if (status === 'locked') return 'Removing this slot breaks a supplied win package or a caller-protected structural role.';
  if (profile) {
    const colors = profile.commanderColorsProduced.length > 0 ? profile.commanderColorsProduced.join('/') : 'no detected commander colors';
    return `Removing this slot reduces the physical land count from ${totalLands} to ${Math.max(0, totalLands - 1)} and removes a source producing ${colors}; any replacement must preserve mana stability or add enough utility to justify the trade.`;
  }
  if (status === 'challenge') return 'The audit found little evidence-backed deck-specific loss if this slot is replaced, so it should face strong alternative pressure.';
  if (status === 'review') return `The slot has a real job (${purposes.join(', ') || 'identified role'}), but its warnings or narrowness mean a replacement may preserve that job more efficiently.`;
  return `Removing this slot weakens ${purposes.join(', ') || 'an identified structural role'}; a replacement should preserve or improve those functions.`;
}

/**
 * Audits every physical card slot in the main deck. This intentionally consumes expanded physical
 * slots rather than a deduplicated Scryfall result so repeated basics and other quantities count.
 */
export function auditFullDeckV15(
  slots: readonly ResolvedDeckSlotV15[],
  context: Omit<CardPurposeContextV15, 'deck'>,
): FullDeckAuditV15 {
  const physicalDeck = slots.map((slot) => slot.card);
  const roleTotals = new Map<string, number>();
  for (const card of physicalDeck) {
    for (const role of inferCardRoles(card)) roleTotals.set(role, (roleTotals.get(role) ?? 0) + 1);
  }
  const totalLands = physicalDeck.filter(isLand).length;
  const counts: Record<CardPurposeStatusV15, number> = { locked: 0, supported: 0, review: 0, challenge: 0 };

  const audited = slots.map((slot) => {
    const purpose = auditCardPurposeV15(slot.card, { ...context, deck: physicalDeck });
    const profile = landProfile(slot.card, context.commander);
    const adjusted = adjustedLandFinding(slot.card, purpose.status, purpose.score, purpose.warnings, profile, context.commander);
    counts[adjusted.status] += 1;
    const roleRedundancy = purpose.roles.map((role) => ({ role, otherSlots: Math.max(0, (roleTotals.get(role) ?? 0) - 1) }));
    return {
      slot: slot.slot,
      copy: slot.copy,
      cardName: slot.card.name,
      set: slot.card.set.toUpperCase(),
      collectorNumber: slot.card.collector_number,
      typeLine: slot.card.type_line,
      manaValue: slot.card.cmc,
      status: adjusted.status,
      score: adjusted.score,
      roles: purpose.roles,
      purposes: purpose.purposes,
      supportEvidence: purpose.supportEvidence,
      warnings: adjusted.warnings,
      deterministicComboHits: purpose.deterministicComboHits,
      land: profile,
      roleRedundancy,
      removalConsequence: removalConsequence(slot.card, adjusted.status, purpose.purposes, profile, totalLands),
    } satisfies FullDeckSlotAuditV15;
  });

  return {
    physicalSlots: audited.length,
    counts,
    slots: audited,
    challengeSlots: unique(audited.filter((slot) => slot.status === 'challenge').map((slot) => slot.cardName)),
    reviewSlots: unique(audited.filter((slot) => slot.status === 'review').map((slot) => slot.cardName)),
    note: 'This is a physical-slot purpose audit, not an automatic optimality verdict. Locked/supported slots can still be outclassed; review/challenge slots should be tested against legal alternatives. Land review includes tempo/fixing pressure.',
  };
}
