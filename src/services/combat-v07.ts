import type { ScryfallCard } from '../types/scryfall.js';
import { getCardOracleText } from './scryfall.js';

export interface CombatCreatureStateV07 {
  card: ScryfallCard;
  plusOneCounters?: number;
  minusOneCounters?: number;
  attachedCards?: ScryfallCard[];
  isCommander?: boolean;
}

export interface CombatModifierV07 {
  source: string;
  power: number;
  toughness: number;
  grants: string[];
  reason: string;
}

export interface EffectiveCombatCreatureV07 {
  name: string;
  printedPower: number | null;
  printedToughness: number | null;
  effectivePower: number | null;
  effectiveToughness: number | null;
  modifiers: CombatModifierV07[];
  keywords: string[];
  commander: boolean;
  unresolved: string[];
}

export interface CombatBoardV07 {
  creatures: EffectiveCombatCreatureV07[];
  totalEffectivePower: number | null;
  commanderPower: Record<string, number | null>;
  notes: string[];
}

function numericStat(value: string | undefined): number | null {
  if (!value || !/^-?\d+$/.test(value.trim())) return null;
  return Number.parseInt(value.trim(), 10);
}

function creatureTypes(card: ScryfallCard): string[] {
  const line = card.type_line;
  const afterDash = line.split(/[—–-]/).slice(1).join(' ').trim();
  if (!afterDash) return [];
  return afterDash
    .split(/\s+/)
    .map((value) => value.replace(/[^A-Za-z]/g, '').toLowerCase())
    .filter(Boolean);
}

function statBonuses(text: string, subject: 'equipped' | 'enchanted' | 'generic'): Array<{ power: number; toughness: number; reason: string }> {
  const output: Array<{ power: number; toughness: number; reason: string }> = [];
  const prefix = subject === 'equipped'
    ? /equipped creature gets?/gi
    : subject === 'enchanted'
      ? /enchanted creature gets?/gi
      : /(?:creatures?|creature) you control get/gi;
  const pattern = new RegExp(`${prefix.source}\\s*([+-]\\d+)\\/([+-]\\d+)`, 'gi');
  for (const match of text.matchAll(pattern)) {
    output.push({
      power: Number.parseInt(match[1] ?? '0', 10),
      toughness: Number.parseInt(match[2] ?? '0', 10),
      reason: match[0] ?? 'static bonus',
    });
  }
  return output;
}

function grantedKeywords(text: string, subjectPattern: RegExp): string[] {
  const keywords = ['flying', 'first strike', 'double strike', 'deathtouch', 'lifelink', 'menace', 'trample', 'vigilance', 'haste', 'hexproof', 'indestructible'];
  const output: string[] = [];
  for (const keyword of keywords) {
    const sentence = text
      .split(/\n|(?<=[.!?])\s+/)
      .find((value) => subjectPattern.test(value) && new RegExp(`\\b${keyword}\\b`, 'i').test(value));
    if (sentence) output.push(keyword);
  }
  return output;
}

function attachedModifiers(attached: ScryfallCard[]): CombatModifierV07[] {
  const output: CombatModifierV07[] = [];
  for (const source of attached) {
    const text = getCardOracleText(source);
    const subject: 'equipped' | 'enchanted' | null = /equipped creature/i.test(text)
      ? 'equipped'
      : /enchanted creature/i.test(text)
        ? 'enchanted'
        : null;
    if (!subject) continue;
    const bonuses = statBonuses(text, subject);
    const grants = grantedKeywords(text, subject === 'equipped' ? /equipped creature/i : /enchanted creature/i);
    if (bonuses.length === 0 && grants.length === 0) continue;
    if (bonuses.length === 0) {
      output.push({ source: source.name, power: 0, toughness: 0, grants, reason: `${subject} creature keyword grant` });
    } else {
      for (const bonus of bonuses) {
        output.push({ source: source.name, power: bonus.power, toughness: bonus.toughness, grants, reason: bonus.reason });
      }
    }
  }
  return output;
}

interface LordRule {
  source: string;
  creatureType: string | null;
  power: number;
  toughness: number;
  otherOnly: boolean;
  grants: string[];
  raw: string;
}

function parseLordRules(card: ScryfallCard): LordRule[] {
  const text = getCardOracleText(card);
  const output: LordRule[] = [];
  for (const sentence of text.split(/\n|(?<=[.!?])\s+/)) {
    const match = sentence.match(/\b(other\s+)?([A-Za-z][A-Za-z' -]*?) creatures? you control get\s*([+-]\d+)\/([+-]\d+)/i);
    const generic = sentence.match(/\b(other\s+)?creatures? you control get\s*([+-]\d+)\/([+-]\d+)/i);
    if (match?.[3] && match[4]) {
      const typeText = (match[2] ?? '').trim().toLowerCase();
      output.push({
        source: card.name,
        creatureType: typeText || null,
        power: Number.parseInt(match[3], 10),
        toughness: Number.parseInt(match[4], 10),
        otherOnly: Boolean(match[1]),
        grants: grantedKeywords(sentence, /creatures? you control/i),
        raw: sentence.trim(),
      });
    } else if (generic?.[2] && generic[3]) {
      output.push({
        source: card.name,
        creatureType: null,
        power: Number.parseInt(generic[2], 10),
        toughness: Number.parseInt(generic[3], 10),
        otherOnly: Boolean(generic[1]),
        grants: grantedKeywords(sentence, /creatures? you control/i),
        raw: sentence.trim(),
      });
    }
  }
  return output;
}

function lordApplies(rule: LordRule, source: ScryfallCard, target: ScryfallCard): boolean {
  if (rule.otherOnly && source.name === target.name) return false;
  if (!rule.creatureType) return true;
  const targetTypes = creatureTypes(target);
  const words = rule.creatureType.split(/\s+/).filter(Boolean);
  return words.some((word) => targetTypes.includes(word));
}

export function evaluateCombatBoardV07(
  states: CombatCreatureStateV07[],
  globalPermanents: ScryfallCard[] = [],
): CombatBoardV07 {
  const lordSources = [...states.map((state) => state.card), ...globalPermanents];
  const lordRules = lordSources.flatMap((source) => parseLordRules(source).map((rule) => ({ source, rule })));

  const creatures: EffectiveCombatCreatureV07[] = states.map((state) => {
    const printedPower = numericStat(state.card.power);
    const printedToughness = numericStat(state.card.toughness);
    const modifiers: CombatModifierV07[] = [];
    const unresolved: string[] = [];
    const plus = Math.max(0, Math.trunc(state.plusOneCounters ?? 0));
    const minus = Math.max(0, Math.trunc(state.minusOneCounters ?? 0));
    if (plus > 0) modifiers.push({ source: '+1/+1 counters', power: plus, toughness: plus, grants: [], reason: `${plus} +1/+1 counter(s)` });
    if (minus > 0) modifiers.push({ source: '-1/-1 counters', power: -minus, toughness: -minus, grants: [], reason: `${minus} -1/-1 counter(s)` });
    modifiers.push(...attachedModifiers(state.attachedCards ?? []));

    for (const { source, rule } of lordRules) {
      if (!lordApplies(rule, source, state.card)) continue;
      modifiers.push({ source: rule.source, power: rule.power, toughness: rule.toughness, grants: rule.grants, reason: rule.raw });
    }

    if (printedPower === null) unresolved.push('printed power is variable or non-numeric');
    if (printedToughness === null) unresolved.push('printed toughness is variable or non-numeric');
    const powerDelta = modifiers.reduce((sum, modifier) => sum + modifier.power, 0);
    const toughnessDelta = modifiers.reduce((sum, modifier) => sum + modifier.toughness, 0);
    const keywords = [...new Set([...(state.card.keywords ?? []).map((value) => value.toLowerCase()), ...modifiers.flatMap((modifier) => modifier.grants)])];

    return {
      name: state.card.name,
      printedPower,
      printedToughness,
      effectivePower: printedPower === null ? null : printedPower + powerDelta,
      effectiveToughness: printedToughness === null ? null : printedToughness + toughnessDelta,
      modifiers,
      keywords,
      commander: Boolean(state.isCommander),
      unresolved,
    };
  });

  const anyUnknown = creatures.some((creature) => creature.effectivePower === null);
  const totalEffectivePower = anyUnknown
    ? null
    : creatures.reduce((sum, creature) => sum + (creature.effectivePower ?? 0), 0);
  const commanderPower = Object.fromEntries(
    creatures.filter((creature) => creature.commander).map((creature) => [creature.name, creature.effectivePower]),
  );

  return {
    creatures,
    totalEffectivePower,
    commanderPower,
    notes: [
      'V0.7 applies supplied +1/+1 and -1/-1 counters plus common static Equipment, Aura, and lord-style +N/+N text.',
      'Variable power/toughness, layers, characteristic-defining abilities, temporary combat tricks, Equipment attach costs, protection, and arbitrary continuous effects remain explicit rather than guessed.',
    ],
  };
}
