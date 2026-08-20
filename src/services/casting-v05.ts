import type { ScryfallCard } from '../types/scryfall.js';
import { getCardManaCost, getCardOracleText } from './scryfall.js';

export type PaymentMechanic =
  | 'convoke'
  | 'improvise'
  | 'delve'
  | 'affinity'
  | 'phyrexian-mana'
  | 'alternate-cost'
  | 'without-paying-mana-cost';

export interface AlternativeCost {
  kind: string;
  raw: string;
  manaCost: string | null;
  additionalResource: string | null;
  commanderTaxStillApplies: boolean;
}

export interface TreasureProfile {
  createsTreasure: boolean;
  immediateTreasure: number;
  recurringTreasurePerTrigger: number;
  recurring: boolean;
  trigger: string | null;
  notes: string[];
}

export interface CastingProfileV05 {
  name: string;
  printedManaCost: string;
  manaValue: number;
  paymentMechanics: PaymentMechanic[];
  phyrexianSymbols: string[];
  phyrexianLifeAlternativeCount: number;
  affinityFor: string[];
  alternativeCosts: AlternativeCost[];
  treasure: TreasureProfile;
  freeCastText: string[];
  rulesNotes: string[];
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function numberFromWord(value: string | undefined): number {
  if (!value) return 1;
  const numeric = Number.parseInt(value, 10);
  if (Number.isFinite(numeric)) return numeric;
  return NUMBER_WORDS[value.toLowerCase()] ?? 1;
}

function keywordSet(card: ScryfallCard): Set<string> {
  return new Set((card.keywords ?? []).map((keyword) => keyword.toLocaleLowerCase()));
}

function hasKeyword(card: ScryfallCard, keyword: string): boolean {
  const lower = keyword.toLocaleLowerCase();
  return keywordSet(card).has(lower) || new RegExp(`\\b${lower}\\b`, 'i').test(getCardOracleText(card));
}

function phyrexianSymbols(card: ScryfallCard): string[] {
  return [...new Set((getCardManaCost(card).match(/\{(?:W|U|B|R|G)\/P\}/gi) ?? []).map((symbol) => symbol.toUpperCase()))];
}

function parseAffinity(text: string): string[] {
  const found = new Set<string>();
  const pattern = /affinity for ([^\n.(]+)/gi;
  for (const match of text.matchAll(pattern)) {
    const subject = match[1]?.trim();
    if (subject) found.add(subject);
  }
  return [...found];
}

function parseNamedAlternativeCosts(text: string): AlternativeCost[] {
  const output: AlternativeCost[] = [];
  const patterns: Array<{ kind: string; regex: RegExp }> = [
    { kind: 'evoke', regex: /\bEvoke[—–-]\s*([^\n(]+)/gi },
    { kind: 'escape', regex: /\bEscape[—–-]\s*([^\n(]+)/gi },
    { kind: 'blitz', regex: /\bBlitz[—–-]\s*([^\n(]+)/gi },
    { kind: 'overload', regex: /\bOverload\s+([^\n(]+)/gi },
    { kind: 'prototype', regex: /\bPrototype\s+([^\n(]+)/gi },
    { kind: 'sneak', regex: /\bSneak[—–-]\s*([^\n(]+)/gi },
  ];

  for (const { kind, regex } of patterns) {
    for (const match of text.matchAll(regex)) {
      const raw = match[0]?.trim();
      if (!raw) continue;
      const manaCost = raw.match(/(?:\{[^}]+\})+/)?.[0] ?? null;
      output.push({
        kind,
        raw,
        manaCost,
        additionalResource: kind === 'escape' ? 'May also require exiling cards from your graveyard.' : null,
        commanderTaxStillApplies: true,
      });
    }
  }
  return output;
}

function parseRatherThanPay(text: string): AlternativeCost[] {
  const output: AlternativeCost[] = [];
  const sentences = text.split(/(?<=[.!?])\s+|\n+/);
  for (const sentence of sentences) {
    if (!/rather than pay (?:this spell['’]s|its) mana cost/i.test(sentence)) continue;
    output.push({
      kind: 'alternate-cost',
      raw: sentence.trim(),
      manaCost: sentence.match(/(?:\{[^}]+\})+/)?.[0] ?? null,
      additionalResource: /exile/i.test(sentence)
        ? 'Exile requirement'
        : /discard/i.test(sentence)
          ? 'Discard requirement'
          : /pay \d+ life/i.test(sentence)
            ? 'Life payment requirement'
            : 'Card-specific alternative requirement',
      commanderTaxStillApplies: true,
    });
  }
  return output;
}

function parseFreeCastText(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => /without paying (?:its|their|that spell['’]s) mana cost/i.test(sentence));
}

function treasureCountFromText(fragment: string): number {
  const match = fragment.match(/create\s+(?:(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+)?Treasure tokens?/i);
  return match ? numberFromWord(match[1]) : 0;
}

export function parseTreasureProfile(card: ScryfallCard): TreasureProfile {
  const text = getCardOracleText(card);
  const notes: string[] = [];
  let immediateTreasure = 0;
  let recurringTreasurePerTrigger = 0;
  let recurring = false;
  let trigger: string | null = null;

  const clauses = text.split(/\n|(?<=[.!?])\s+/).filter(Boolean);
  for (const clause of clauses) {
    const amount = treasureCountFromText(clause);
    if (amount <= 0) continue;
    if (/\bwhen(?:ever)?\b|at the beginning|each time/i.test(clause)) {
      recurring = true;
      recurringTreasurePerTrigger = Math.max(recurringTreasurePerTrigger, amount);
      trigger ??= clause.trim();
    } else {
      immediateTreasure += amount;
    }
  }

  if (/Treasure token/i.test(text)) {
    notes.push('Treasure tokens are modeled as expendable one-mana sources of any color when a gameplay simulator consumes this profile.');
  }
  if (/for each|equal to|that many Treasure/i.test(text)) {
    notes.push('Variable Treasure quantity detected; static count is a floor/known count and requires board-state evaluation for the exact amount.');
  }

  return {
    createsTreasure: /Treasure token/i.test(text),
    immediateTreasure,
    recurringTreasurePerTrigger,
    recurring,
    trigger,
    notes,
  };
}

export function analyzeCastingProfileV05(card: ScryfallCard): CastingProfileV05 {
  const text = getCardOracleText(card);
  const mechanics = new Set<PaymentMechanic>();
  const phyrexian = phyrexianSymbols(card);
  const affinityFor = parseAffinity(text);
  const alternativeCosts = [...parseNamedAlternativeCosts(text), ...parseRatherThanPay(text)];
  const freeCastText = parseFreeCastText(text);

  if (hasKeyword(card, 'convoke')) mechanics.add('convoke');
  if (hasKeyword(card, 'improvise')) mechanics.add('improvise');
  if (hasKeyword(card, 'delve')) mechanics.add('delve');
  if (affinityFor.length > 0 || hasKeyword(card, 'affinity')) mechanics.add('affinity');
  if (phyrexian.length > 0) mechanics.add('phyrexian-mana');
  if (alternativeCosts.length > 0) mechanics.add('alternate-cost');
  if (freeCastText.length > 0) mechanics.add('without-paying-mana-cost');

  const rulesNotes: string[] = [];
  if (mechanics.has('convoke')) {
    rulesNotes.push('Convoke helps pay the total cost after increases/reductions; a creature may pay generic or one mana of that creature’s color.');
  }
  if (mechanics.has('improvise')) {
    rulesNotes.push('Improvise helps pay generic mana in the total cost by tapping artifacts; it does not pay colored or colorless symbols.');
  }
  if (mechanics.has('delve')) {
    rulesNotes.push('Delve can exile cards from the graveyard to pay generic mana in the total cost.');
  }
  if (mechanics.has('affinity')) {
    rulesNotes.push('Affinity is a cost reduction tied to the named permanent/card quality and does not change mana value.');
  }
  if (phyrexian.length > 0) {
    rulesNotes.push('Each Phyrexian mana symbol can normally be paid with the matching mana or 2 life unless another rule/effect says otherwise.');
  }
  if (alternativeCosts.length > 0 || freeCastText.length > 0) {
    rulesNotes.push('Alternative/free casting changes the base casting payment, but commander tax and other applicable additional costs still apply.');
  }

  return {
    name: card.name,
    printedManaCost: getCardManaCost(card),
    manaValue: card.cmc,
    paymentMechanics: [...mechanics],
    phyrexianSymbols: phyrexian,
    phyrexianLifeAlternativeCount: phyrexian.length,
    affinityFor,
    alternativeCosts,
    treasure: parseTreasureProfile(card),
    freeCastText,
    rulesNotes,
  };
}
