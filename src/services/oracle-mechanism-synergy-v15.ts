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
  return /whenever you gain life[^.]*put (?:a|one) \+1\/\+1 counter on target creature you control/.test(oracle);
}

function convertsOwnCountersToAnyTargetDamageV15(oracle: string): boolean {
  return /remove a \+1\/\+1 counter from [^:]+:[^.]*deals 1 damage to any target/.test(oracle);
}

/**
 * Detect a closed deterministic mechanism from provider-retained Oracle text. This is advisory
 * synergy evidence, not a replacement for external combo-database verification.
 */
export function oracleMechanismSynergiesV15(
  candidate: ScryfallCard,
  existingCards: readonly ScryfallCard[],
): OracleMechanismSynergyV15[] {
  const candidateOracle = getCardOracleText(candidate).toLocaleLowerCase();
  if (!grantsControlledCreatureLifelinkV15(candidateOracle)
    || !convertsLifeGainToCreatureCountersV15(candidateOracle)) return [];
  return existingCards
    .filter((card) => convertsOwnCountersToAnyTargetDamageV15(getCardOracleText(card).toLocaleLowerCase()))
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
