import type { ScryfallCard } from '../types/scryfall.js';
import {
  effectiveCardRolesV15 as baseEffectiveCardRolesV15,
  tutorRoleTruthV15 as baseTutorRoleTruthV15,
} from './card-role-truth-v15-base.js';

export type {
  InteractionRoleTruthV15,
  ManaRoleTruthV15,
  SacrificeRoleTruthV15,
  TutorRoleTruthV15,
} from './card-role-truth-v15-base.js';
export {
  interactionRoleTruthV15,
  manaRoleTruthV15,
  sacrificeRoleTruthV15,
} from './card-role-truth-v15-base.js';

const ORACLE_QUANTITY = '(?:\\d+|one hundred|hundred|one|two|three|four|five|six|seven|eight|nine|ten|twenty|a|an)';
const THRESHOLD_COUNTER_GATE = new RegExp(
  `\\b(?:if|as long as)\\b[^.\\n]{0,220}\\bhas\\s+${ORACLE_QUANTITY}\\s+or\\s+more\\s+[a-z-]+\\s+counters?\\b`,
);

function librarySearchRequiresThresholdCountersV15(card: ScryfallCard): boolean {
  const oracle = (card.oracle_text ?? card.card_faces?.map(face => face.oracle_text ?? '').join('\n') ?? '').toLocaleLowerCase();
  const searchAbilities = oracle.split(/\r?\n/).filter(line => /\bsearch your library for\b/.test(line));
  return searchAbilities.length > 0 && searchAbilities.every(ability => THRESHOLD_COUNTER_GATE.test(ability));
}

export function tutorRoleTruthV15(card: ScryfallCard): ReturnType<typeof baseTutorRoleTruthV15> {
  const base = baseTutorRoleTruthV15(card);
  const thresholdGated = librarySearchRequiresThresholdCountersV15(card);
  if (!thresholdGated) return base;

  const reasons = base.reasons.includes('library search requires accumulated counters before its tutor effect becomes available')
    ? base.reasons
    : [...base.reasons, 'library search requires accumulated counters before its tutor effect becomes available'];

  return {
    ...base,
    setupGated: true,
    reliableStructuralTutor: false,
    reasons,
  };
}

export function effectiveCardRolesV15(card: ScryfallCard): string[] {
  const roles = new Set(baseEffectiveCardRolesV15(card));
  const tutorTruth = tutorRoleTruthV15(card);
  if (tutorTruth.setupGated && roles.has('tutor')) {
    roles.delete('tutor');
    roles.add('conditional tutor');
  }
  return [...roles];
}
