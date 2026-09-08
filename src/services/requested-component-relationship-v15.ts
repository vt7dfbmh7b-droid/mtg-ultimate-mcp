import type { ScryfallCard } from '../types/scryfall.js';
import { getCardOracleText } from './scryfall.js';

export interface RequestedComponentRelationshipSignalV15 {
  score: number;
  reasons: string[];
}

export interface RequestedComponentClauseV15 {
  id: string;
  queryClause: string;
}

function normalized(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function quotedTypeAtomsV15(clause: string): string[] {
  return [...clause.matchAll(/\bt:\"([^\"]+)\"/gi)]
    .map((match) => normalized(match[1] ?? ''))
    .filter(Boolean);
}

function unquotedTypeAtomsV15(clause: string): string[] {
  return [...clause.matchAll(/\bt:([a-z][a-z0-9-]*)\b/gi)]
    .map((match) => normalized(match[1] ?? ''))
    .filter(Boolean);
}

function typeContainsV15(card: ScryfallCard, type: string): boolean {
  return card.type_line.toLocaleLowerCase().split(/[^a-z0-9]+/).filter(Boolean).includes(type);
}

function oracleMentionsTypePayoffV15(card: ScryfallCard, type: string): boolean {
  const oracle = normalized(getCardOracleText(card));
  const escaped = type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}s?\\b`).test(oracle)
    && /\b(?:you control|other|target|each|whenever|for each|create|gets?|gain|have|attacks?|combat damage|counter)\b/.test(oracle);
}

function auraSpecializationV15(card: ScryfallCard, commanders: readonly ScryfallCard[], clauses: readonly RequestedComponentClauseV15[]): boolean {
  if (!typeContainsV15(card, 'aura')) return false;
  const requestedAura = clauses.some((component) => [...quotedTypeAtomsV15(component.queryClause), ...unquotedTypeAtomsV15(component.queryClause)].includes('aura'));
  if (requestedAura) return true;
  const commanderOracle = normalized(commanders.map((commander) => getCardOracleText(commander)).join(' // '));
  return /\bauras?\b|\benchanted creature\b|\bbecomes enchanted\b/.test(commanderOracle);
}

function commanderShapeAffinityV15(card: ScryfallCard, commanders: readonly ScryfallCard[]): RequestedComponentRelationshipSignalV15 {
  const typeLine = normalized(card.type_line);
  const commanderOracle = normalized(commanders.map((commander) => getCardOracleText(commander)).join(' // '));
  if (!commanderOracle) return { score: 0, reasons: [] };

  const referencedTypes = ['artifact', 'enchantment', 'creature', 'equipment', 'aura', 'instant', 'sorcery']
    .filter((type) => new RegExp(`\\b${type}s?\\b`).test(commanderOracle));
  const matchesReferencedType = referencedTypes.some((type) => typeContainsV15(card, type));
  if (!matchesReferencedType) return { score: 0, reasons: [] };

  let score = 1;
  const reasons = ['matches a permanent/card type explicitly referenced by the commander'];
  const requiresNoncreature = /\bnoncreature\b[^.]{0,100}\b(?:artifact|enchantment|permanent)s?\b|\b(?:artifact|enchantment)s?\b[^.]{0,100}\bnoncreature\b/.test(commanderOracle);
  if (requiresNoncreature && !typeLine.includes('creature')) {
    score += 2;
    reasons.push('matches the commander\'s noncreature shape condition');
  }

  const thresholdMatches = [...commanderOracle.matchAll(/\bmana value (\d+) or greater\b/g)]
    .map((match) => Number.parseInt(match[1] ?? '', 10))
    .filter(Number.isFinite);
  if (thresholdMatches.some((threshold) => card.cmc >= threshold)) {
    score += 3;
    reasons.push('matches the commander\'s mana-value threshold');
  }

  if (/\b(?:during|on) your turn\b[^.]{0,220}\b(?:creature|attacking|haste|indestructible|power|toughness)\b/.test(commanderOracle)) {
    score += 1;
    reasons.push('matches a commander-conditioned combat conversion relationship');
  }
  return { score, reasons };
}

/**
 * Advisory relationship evidence for relative replacement ranking. Broad requested-component
 * membership is handled elsewhere; this scorer asks whether a card is an engine/payoff/specialized
 * realization of that component or satisfies a commander-declared card-shape relationship.
 * It never makes a card uncuttable and contains no card, commander, fixture, or set names.
 */
export function requestedComponentRelationshipAffinityV15(
  card: ScryfallCard,
  commanders: readonly ScryfallCard[],
  components: readonly RequestedComponentClauseV15[],
): RequestedComponentRelationshipSignalV15 {
  let score = 0;
  const reasons: string[] = [];

  for (const component of components) {
    for (const creatureType of quotedTypeAtomsV15(component.queryClause)) {
      if (!typeContainsV15(card, creatureType)) continue;
      if (oracleMentionsTypePayoffV15(card, creatureType)) {
        score += 4;
        reasons.push(`provides payoff/engine text for requested creature type ${creatureType}`);
      } else {
        score += 1;
        reasons.push(`is a requested creature-type member (${creatureType})`);
      }
    }
  }

  if (auraSpecializationV15(card, commanders, components)) {
    score += 3;
    reasons.push('is an Aura-specific realization of the requested/commander enchantment mechanism');
  }

  const commanderShape = commanderShapeAffinityV15(card, commanders);
  score += commanderShape.score;
  reasons.push(...commanderShape.reasons);

  return {
    score: Number(Math.min(12, score).toFixed(3)),
    reasons: [...new Set(reasons)],
  };
}
