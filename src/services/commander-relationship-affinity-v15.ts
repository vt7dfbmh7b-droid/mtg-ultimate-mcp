import type { ScryfallCard } from '../types/scryfall.js';
import { getCardOracleText } from './scryfall.js';

export interface RequestedThemeComponentV15 {
  id: string;
  queryClause: string;
}

export interface CommanderRelationshipAffinityV15 {
  score: number;
  reasons: string[];
}

function normalized(text: string): string {
  return text.toLocaleLowerCase();
}

function words(typeLine: string): Set<string> {
  return new Set(normalized(typeLine).split(/[^a-z0-9]+/).filter(Boolean));
}

function quotedCreatureType(component: RequestedThemeComponentV15): string | null {
  const match = component.queryClause.trim().match(/^t:"([^"]+)"$/i);
  return match?.[1]?.toLocaleLowerCase() ?? null;
}

function typalEngineAffinityV15(card: ScryfallCard, components: readonly RequestedThemeComponentV15[]): { score: number; reason: string | null } {
  const activeTypes = components.map(quotedCreatureType).filter((value): value is string => Boolean(value));
  if (activeTypes.length === 0) return { score: 0, reason: null };
  const oracle = normalized(getCardOracleText(card));
  const typeWords = words(card.type_line);

  // Generic choose-a-type / chosen-type engines are high-value typal infrastructure even when
  // they never print the requested creature type literally (Reflections-style effects).
  const genericTypalEngine = /choose a creature type|creature type of your choice|chosen type|share a creature type|of that type/.test(oracle);
  if (genericTypalEngine) {
    return { score: 5, reason: 'generic typal engine/payoff for an explicitly requested creature type' };
  }

  for (const creatureType of activeTypes) {
    const literal = new RegExp(`\\b${creatureType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i');
    if (literal.test(oracle)) {
      return { score: 4, reason: `rules text directly rewards or references requested ${creatureType} typal identity` };
    }
    if (typeWords.has(creatureType) && /other|each|whenever|creatures? you control|gets? \+|create/.test(oracle)) {
      return { score: 3, reason: `requested ${creatureType} card also carries typal payoff/engine text` };
    }
  }
  return { score: 0, reason: null };
}

function auraSpecializationAffinityV15(card: ScryfallCard, commanders: readonly ScryfallCard[]): { score: number; reason: string | null } {
  const cardType = normalized(card.type_line);
  if (!/\baura\b/.test(cardType)) return { score: 0, reason: null };
  const commanderText = commanders.map((commander) => normalized(getCardOracleText(commander))).join('\n');
  if (/enchanted creature|aura you control|auras you control|aura spell|attached to/.test(commanderText)) {
    return { score: 5, reason: 'Aura directly satisfies an Aura/enchanted-permanent commander incentive' };
  }
  return { score: 0, reason: null };
}

function satisfiesCommanderPermanentShapeV15(card: ScryfallCard, commander: ScryfallCard): { score: number; reason: string | null } {
  const oracle = normalized(getCardOracleText(commander));
  const typeWords = words(card.type_line);

  const thresholdMatch = oracle.match(/mana value\s+(\d+)\s+or greater/);
  if (!thresholdMatch) return { score: 0, reason: null };
  const threshold = Number(thresholdMatch[1]);
  if (!Number.isFinite(threshold) || card.cmc < threshold) return { score: 0, reason: null };

  const mentionsArtifact = /\bartifacts?\b/.test(oracle);
  const mentionsEnchantment = /\benchantments?\b/.test(oracle);
  let shapeMatch = (mentionsArtifact && typeWords.has('artifact')) || (mentionsEnchantment && typeWords.has('enchantment'));
  if (!shapeMatch) return { score: 0, reason: null };

  if (/non-?equipment artifacts?/.test(oracle) && typeWords.has('artifact') && typeWords.has('equipment')) shapeMatch = false;
  if (/non-?aura enchantments?/.test(oracle) && typeWords.has('enchantment') && typeWords.has('aura')) shapeMatch = false;
  if (/noncreature artifacts?/.test(oracle) && typeWords.has('artifact') && typeWords.has('creature')) shapeMatch = false;
  if (/noncreature enchantments?/.test(oracle) && typeWords.has('enchantment') && typeWords.has('creature')) shapeMatch = false;
  if (!shapeMatch) return { score: 0, reason: null };

  return {
    score: 6,
    reason: `card satisfies commander-referenced permanent type and mana-value shape (mana value ${threshold} or greater)`,
  };
}

/**
 * Advisory relationship strength beyond broad theme membership. It recognizes reusable relations
 * from rules text rather than commander/card names: typal engines, Aura-specific commander plans,
 * and commander-referenced artifact/enchantment + mana-value/noncreature shapes.
 */
export function commanderRelationshipAffinityV15(
  card: ScryfallCard,
  commanders: readonly ScryfallCard[],
  components: readonly RequestedThemeComponentV15[] = [],
): CommanderRelationshipAffinityV15 {
  const reasons: string[] = [];
  let score = 0;

  const typal = typalEngineAffinityV15(card, components);
  if (typal.score > 0 && typal.reason) {
    score += typal.score;
    reasons.push(typal.reason);
  }

  const aura = auraSpecializationAffinityV15(card, commanders);
  if (aura.score > 0 && aura.reason) {
    score += aura.score;
    reasons.push(aura.reason);
  }

  for (const commander of commanders) {
    const shape = satisfiesCommanderPermanentShapeV15(card, commander);
    if (shape.score > 0 && shape.reason) {
      score += shape.score;
      reasons.push(shape.reason);
      break;
    }
  }

  return { score: Number(Math.min(12, score).toFixed(3)), reasons };
}
