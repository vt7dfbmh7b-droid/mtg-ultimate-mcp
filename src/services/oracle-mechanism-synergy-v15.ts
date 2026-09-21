import type { ScryfallCard } from '../types/scryfall.js';
import { getCardOracleText } from './scryfall.js';

export interface OracleMechanismSynergyV15 {
  id: 'lifelink-counter-damage-loop';
  partnerName: string;
  evidence: {
    candidateGrantsLifelink: true;
    candidateConvertsLifeGainToCounters: true;
    partnerConvertsCountersToDamage: true;
  };
}

function grantsControlledCreatureLifelinkV15(oracle: string): boolean {
  return /(?:another )?target creature you control gains lifelink/.test(oracle);
}

function convertsLifeGainToCreatureCountersV15(oracle: string): boolean {
  // An optional replacement that increases the counter output does not break the loop.
  // Costs, intervening conditions, and per-turn restrictions still fail closed.
  return /(?:^|\n)whenever you gain life, put (?:a|one) \+1\/\+1 counter on target creature you control\.(?: if [^.\n]+, put (?:two|three|four|five|[2-9][0-9]*) \+1\/\+1 counters on that creature instead\.)?(?:\n|$)/.test(oracle);
}

function convertsOwnCountersToAnyTargetDamageV15(card: ScryfallCard): boolean {
  if (!card.type_line?.toLocaleLowerCase().includes('creature') || (card.card_faces?.length ?? 0) > 1) return false;
  const name = card.name.toLocaleLowerCase();
  // Match the complete activation, including its cost and damage source. An extra tap/mana
  // cost, other counter owner, or separate damage source does not close this mechanism.
  const activation = `remove a +1/+1 counter from ${name}: ${name} deals 1 damage to any target.`;
  return getCardOracleText(card).toLocaleLowerCase().split('\n').some((line) => line.trim() === activation);
}

/**
 * Detect a potential closed mechanism from provider-retained Oracle text. Battlefield setup
 * and activation availability still require external combo verification; this is advisory only.
 */
export function oracleMechanismSynergiesV15(
  candidate: ScryfallCard,
  existingCards: readonly ScryfallCard[],
): OracleMechanismSynergyV15[] {
  const candidateOracle = getCardOracleText(candidate).toLocaleLowerCase();
  if ((candidate.card_faces?.length ?? 0) > 1) return [];
  if (!grantsControlledCreatureLifelinkV15(candidateOracle)
    || !convertsLifeGainToCreatureCountersV15(candidateOracle)) return [];
  return existingCards
    .filter((card) => card.name !== candidate.name && convertsOwnCountersToAnyTargetDamageV15(card))
    .map((card) => ({
      id: 'lifelink-counter-damage-loop' as const,
      partnerName: card.name,
      evidence: {
        candidateGrantsLifelink: true as const,
        candidateConvertsLifeGainToCounters: true as const,
        partnerConvertsCountersToDamage: true as const,
      },
    }));
}

export function oracleMechanismProtectedCardNamesV15(cards: readonly ScryfallCard[]): Set<string> {
  const protectedNames = new Set<string>();
  for (const card of cards) {
    for (const relationship of oracleMechanismSynergiesV15(card, cards)) {
      protectedNames.add(card.name.toLocaleLowerCase());
      protectedNames.add(relationship.partnerName.toLocaleLowerCase());
    }
  }
  return protectedNames;
}
