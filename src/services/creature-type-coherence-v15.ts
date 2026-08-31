import type { ScryfallCard } from '../types/scryfall.js';
import { resolveEntryCard, type ParsedDeck } from './deck.js';
import { getCardOracleText, inferCardRoles } from './scryfall.js';

export interface CreatureTypePreferenceV15 {
  creatureType: string;
  score: number;
  existingCreatureCount: number;
  commanderPrintedType: boolean;
  commanderCreatesType: boolean;
  supportReferenceCount: number;
  evidence: string[];
}

const GENERIC_TYPE_WORDS = new Set([
  'creature', 'legendary', 'artifact', 'enchantment', 'token', 'card', 'permanent',
]);

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function titleCase(value: string): string {
  return value.split(/\s+/).map((part) => part ? `${part[0]?.toLocaleUpperCase()}${part.slice(1)}` : '').join(' ');
}

export function creatureSubtypesV15(card: ScryfallCard): string[] {
  const faces = card.type_line.split(/\s*\/\/\s*/);
  const types = new Set<string>();
  for (const face of faces) {
    if (!/\bcreature\b/i.test(face)) continue;
    const dash = face.split(/\s+[—-]\s+/)[1];
    if (!dash) continue;
    for (const raw of dash.trim().split(/\s+/)) {
      const cleaned = raw.replace(/[^A-Za-z'-]/g, '');
      if (!cleaned || GENERIC_TYPE_WORDS.has(normalize(cleaned))) continue;
      types.add(titleCase(cleaned));
    }
  }
  return [...types];
}

export function createdCreatureTypesV15(card: ScryfallCard): string[] {
  const oracle = getCardOracleText(card).toLocaleLowerCase();
  const output = new Set<string>();
  for (const match of oracle.matchAll(/\bcreate [^.\n]{0,160}?\b([a-z][a-z'-]*) creature tokens?\b/g)) {
    const creatureType = match[1]?.trim();
    if (!creatureType || GENERIC_TYPE_WORDS.has(creatureType)) continue;
    output.add(titleCase(creatureType));
  }
  return [...output];
}

function mentionsOwnTypeSupport(card: ScryfallCard, creatureType: string): boolean {
  const oracle = getCardOracleText(card).toLocaleLowerCase();
  const type = normalize(creatureType).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\bcontrol (?:a|an|another|one or more|any number of) ${type}\\b`).test(oracle)
    || new RegExp(`\\b${type}s? you control\\b`).test(oracle)
    || new RegExp(`\\bother ${type}s?\\b`).test(oracle)
    || new RegExp(`\\bcast (?:a|an|another|your)?\\s*${type}\\b`).test(oracle)
    || new RegExp(`\\b${type} (?:card|creature)s? in your graveyard\\b`).test(oracle);
}

function commanderCards(parsed: ParsedDeck, cards: ScryfallCard[]): ScryfallCard[] {
  return parsed.commanders
    .map((entry) => resolveEntryCard(entry, cards))
    .filter((card): card is ScryfallCard => Boolean(card));
}

export function deriveCreatureTypePreferencesV15(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
): CreatureTypePreferenceV15[] {
  const commanders = commanderCards(parsed, cards);
  const map = new Map<string, CreatureTypePreferenceV15>();

  const ensure = (creatureType: string): CreatureTypePreferenceV15 => {
    const key = normalize(creatureType);
    const existing = map.get(key);
    if (existing) return existing;
    const created: CreatureTypePreferenceV15 = {
      creatureType: titleCase(creatureType),
      score: 0,
      existingCreatureCount: 0,
      commanderPrintedType: false,
      commanderCreatesType: false,
      supportReferenceCount: 0,
      evidence: [],
    };
    map.set(key, created);
    return created;
  };

  for (const commander of commanders) {
    for (const creatureType of creatureSubtypesV15(commander)) {
      const row = ensure(creatureType);
      row.commanderPrintedType = true;
      row.score += 2;
      row.evidence.push(`commander is a ${creatureType}`);
    }
    for (const creatureType of createdCreatureTypesV15(commander)) {
      const row = ensure(creatureType);
      row.commanderCreatesType = true;
      row.score += 8;
      row.evidence.push(`commander creates ${creatureType} creature tokens`);
    }
  }

  for (const entry of parsed.main) {
    const card = resolveEntryCard(entry, cards);
    if (!card || !card.type_line.toLocaleLowerCase().includes('creature')) continue;
    for (const creatureType of creatureSubtypesV15(card)) {
      const row = ensure(creatureType);
      row.existingCreatureCount += entry.quantity;
      row.score += 2 * entry.quantity;
    }
  }

  for (const row of map.values()) {
    for (const entry of [...parsed.commanders, ...parsed.main]) {
      const card = resolveEntryCard(entry, cards);
      if (!card || !mentionsOwnTypeSupport(card, row.creatureType)) continue;
      row.supportReferenceCount += entry.quantity;
      row.score += 5 * entry.quantity;
      row.evidence.push(`${card.name} explicitly rewards/depends on ${row.creatureType}`);
    }
  }

  return [...map.values()]
    .filter((row) => row.score >= 6)
    .sort((a, b) => b.score - a.score || b.supportReferenceCount - a.supportReferenceCount || b.existingCreatureCount - a.existingCreatureCount || a.creatureType.localeCompare(b.creatureType));
}

export function cardCreatureTypeCoherenceScoreV15(
  card: ScryfallCard,
  preference: CreatureTypePreferenceV15 | null,
): { score: number; reasons: string[] } {
  if (!preference || card.cmc > 3 || !card.type_line.toLocaleLowerCase().includes('creature')) return { score: 0, reasons: [] };
  if (!creatureSubtypesV15(card).some((type) => normalize(type) === normalize(preference.creatureType))) return { score: 0, reasons: [] };

  const roles = new Set(inferCardRoles(card));
  const oracle = getCardOracleText(card).toLocaleLowerCase();
  const reasons: string[] = [];
  let score = Math.min(30, preference.score);

  if (roles.has('sacrifice outlet')) {
    score += 70;
    reasons.push(`${preference.creatureType} sacrifice outlet reinforces the preferred creature package`);
  }
  if (roles.has('graveyard recursion')) {
    score += 58;
    reasons.push(`${preference.creatureType} recursion reinforces the preferred creature package`);
  }
  if (roles.has('card draw') || roles.has('repeatable draw')) {
    score += 48;
    reasons.push(`${preference.creatureType} card advantage reinforces the preferred creature package`);
  }
  if (roles.has('tutor')) {
    score += 52;
    reasons.push(`${preference.creatureType} tutor reinforces the preferred creature package`);
  }
  if (roles.has('life drain')) {
    score += 48;
    reasons.push(`${preference.creatureType} death/drain payoff reinforces the preferred creature package`);
  }
  if (roles.has('token production') || roles.has('treasure')) {
    score += 35;
    reasons.push(`${preference.creatureType} resource production reinforces the preferred creature package`);
  }
  if (/\b(?:when|whenever) [^.]{0,120}\bdies?\b/.test(oracle)) {
    score += 35;
    reasons.push(`${preference.creatureType} death trigger overlaps with sacrifice engines`);
  }
  if (mentionsOwnTypeSupport(card, preference.creatureType)) {
    score += 45;
    reasons.push(`explicitly supports ${preference.creatureType}`);
  }

  return reasons.length > 0 ? { score, reasons } : { score: 0, reasons: [] };
}

export function isPreferredCreatureTypeCardV15(card: ScryfallCard, preference: CreatureTypePreferenceV15 | null): boolean {
  if (!preference) return false;
  return creatureSubtypesV15(card).some((type) => normalize(type) === normalize(preference.creatureType));
}
