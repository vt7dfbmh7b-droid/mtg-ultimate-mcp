import type { ScryfallCard } from '../types/scryfall.js';
import type { DeckEntry, ParsedDeck } from './deck.js';
import { resolveEntryCard } from './deck.js';
import { getCardOracleText } from './scryfall.js';

const COLORS = ['W', 'U', 'B', 'R', 'G'] as const;
const BASIC_TYPES: Record<string, string> = {
  plains: 'W',
  island: 'U',
  swamp: 'B',
  mountain: 'R',
  forest: 'G',
};

export type LandEntryMode =
  | 'untapped'
  | 'always-tapped'
  | 'shock-choice'
  | 'check-land'
  | 'fast-land'
  | 'slow-land'
  | 'reveal-land'
  | 'multiplayer-land'
  | 'conditional-other';

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function commanderIdentity(parsed: ParsedDeck, cards: ScryfallCard[]): string[] {
  return [...new Set(
    parsed.commanders
      .map((entry) => resolveEntryCard(entry, cards))
      .filter((card): card is ScryfallCard => Boolean(card))
      .flatMap((card) => card.color_identity),
  )].sort();
}

function landFaces(card: ScryfallCard): Array<{ typeLine: string; oracleText: string }> {
  const faces = card.card_faces ?? [];
  const landSides = faces
    .filter((face) => /\bland\b/i.test(face.type_line ?? ''))
    .map((face) => ({ typeLine: face.type_line ?? '', oracleText: face.oracle_text ?? '' }));
  if (landSides.length > 0) return landSides;
  if (/\bland\b/i.test(card.type_line)) return [{ typeLine: card.type_line, oracleText: getCardOracleText(card) }];
  return [];
}

function landTypeSet(card: ScryfallCard): Set<string> {
  const types = new Set<string>();
  for (const face of landFaces(card)) {
    const lower = face.typeLine.toLowerCase();
    for (const type of Object.keys(BASIC_TYPES)) if (new RegExp(`\\b${type}\\b`, 'i').test(lower)) types.add(type);
  }
  return types;
}

function isBasicLand(card: ScryfallCard): boolean {
  return landFaces(card).some((face) => /\bbasic\b/i.test(face.typeLine) && /\bland\b/i.test(face.typeLine));
}

function produces(card: ScryfallCard, identity: string[]): string[] {
  const text = getCardOracleText(card);
  if (/any color in your commander['’]s color identity/i.test(text)) return identity;
  const values = (card.produced_mana ?? []).map((value) => value.toUpperCase());
  if (values.length > 0) return [...new Set(values)];
  const types = landTypeSet(card);
  const fallback = [...types].map((type) => BASIC_TYPES[type]).filter((value): value is string => Boolean(value));
  return fallback.length > 0 ? [...new Set(fallback)] : [];
}

export function classifyLandEntry(card: ScryfallCard): { mode: LandEntryMode; explanation: string; relevantTypes: string[] } {
  const text = landFaces(card).map((face) => face.oracleText).join('\n') || getCardOracleText(card);
  const lower = text.toLowerCase();
  const relevantTypes = Object.keys(BASIC_TYPES).filter((type) => new RegExp(`\\b${type}\\b`, 'i').test(lower));

  if (!/enters(?: the battlefield)? tapped|enter(?:s)? tapped/i.test(lower)) {
    return { mode: 'untapped', explanation: 'No enters-tapped restriction detected on the land face.', relevantTypes };
  }
  if (/pay 2 life[\s\S]*if you don['’]t[\s\S]*enters(?: the battlefield)? tapped/i.test(lower)) {
    return { mode: 'shock-choice', explanation: 'May enter untapped by paying 2 life.', relevantTypes };
  }
  if (/enters(?: the battlefield)? tapped unless you control two or fewer other lands/i.test(lower)) {
    return { mode: 'fast-land', explanation: 'Untapped while you control two or fewer other lands.', relevantTypes };
  }
  if (/enters(?: the battlefield)? tapped unless you control two or more other lands/i.test(lower)) {
    return { mode: 'slow-land', explanation: 'Untapped once you control two or more other lands.', relevantTypes };
  }
  if (/enters(?: the battlefield)? tapped unless you have two or more opponents/i.test(lower)) {
    return { mode: 'multiplayer-land', explanation: 'Normally untapped in a four-player Commander pod while you have at least two opponents.', relevantTypes };
  }
  if (/enters(?: the battlefield)? tapped unless you control (?:a|an) /i.test(lower) && relevantTypes.length > 0) {
    return { mode: 'check-land', explanation: `Untapped if you control the required land type (${relevantTypes.join(' or ')}).`, relevantTypes };
  }
  if (/reveal (?:a|an) [^\n.]* card from your hand[\s\S]*if you don['’]t[\s\S]*enters(?: the battlefield)? tapped/i.test(lower)) {
    return { mode: 'reveal-land', explanation: `Untapped if the required card is revealed from hand${relevantTypes.length ? ` (${relevantTypes.join(' or ')})` : ''}.`, relevantTypes };
  }
  if (/enters(?: the battlefield)? tapped unless/i.test(lower) || /if you don['’]t[\s\S]*enters(?: the battlefield)? tapped/i.test(lower)) {
    return { mode: 'conditional-other', explanation: 'Has a conditional enters-tapped clause that needs board/hand state evaluation.', relevantTypes };
  }
  return { mode: 'always-tapped', explanation: 'Enters tapped with no optional/conditional untap route detected.', relevantTypes };
}

interface FetchRule {
  isFetch: boolean;
  basicOnly: boolean;
  landTypes: string[];
  anyLand: boolean;
}

function fetchRule(card: ScryfallCard): FetchRule {
  const text = getCardOracleText(card);
  if (!/search your library for/i.test(text) || !/\bland\b|\bPlains\b|\bIsland\b|\bSwamp\b|\bMountain\b|\bForest\b/i.test(text)) {
    return { isFetch: false, basicOnly: false, landTypes: [], anyLand: false };
  }
  const searchClause = text.match(/search your library for([\s\S]*?)(?:,|\.)(?:\s|$)/i)?.[1] ?? text;
  const lower = searchClause.toLowerCase();
  const landTypes = Object.keys(BASIC_TYPES).filter((type) => new RegExp(`\\b${type}\\b`, 'i').test(lower));
  const basicOnly = /basic land card/i.test(lower) || /basic (?:plains|island|swamp|mountain|forest)/i.test(lower);
  const anyLand = /\ba land card\b/i.test(lower) && landTypes.length === 0 && !basicOnly;
  return { isFetch: true, basicOnly, landTypes, anyLand };
}

function entryIsLand(entry: DeckEntry, cards: ScryfallCard[]): ScryfallCard | null {
  const card = resolveEntryCard(entry, cards);
  if (!card) return null;
  return landFaces(card).length > 0 ? card : null;
}

function validFetchTarget(source: ScryfallCard, target: ScryfallCard, rule: FetchRule): boolean {
  if (normalize(source.id) === normalize(target.id)) return false;
  if (landFaces(target).length === 0) return false;
  if (rule.anyLand) return true;
  if (rule.basicOnly && !isBasicLand(target)) return false;
  if (rule.landTypes.length > 0) {
    const targetTypes = landTypeSet(target);
    return rule.landTypes.some((type) => targetTypes.has(type));
  }
  return rule.basicOnly ? isBasicLand(target) : false;
}

function restriction(card: ScryfallCard): string | null {
  const text = getCardOracleText(card);
  const match = text.match(/spend this mana only to ([^.\n]+)/i);
  return match?.[1]?.trim() ?? null;
}

function costReduction(card: ScryfallCard): string | null {
  const text = getCardOracleText(card);
  const match = text.match(/([^\n.]{0,90}?)costs?\s+\{?\d+\}?\s+less to cast/i);
  return match?.[0]?.trim() ?? null;
}

export function analyzeManaBaseV04(parsed: ParsedDeck, cards: ScryfallCard[]): Record<string, unknown> {
  const identity = commanderIdentity(parsed, cards);
  const landEntries = parsed.main
    .map((entry) => ({ entry, card: entryIsLand(entry, cards) }))
    .filter((item): item is { entry: DeckEntry; card: ScryfallCard } => Boolean(item.card));

  const colorSourceCounts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  const entryModeCounts: Record<string, number> = {};
  const lands = landEntries.map(({ entry, card }) => {
    const colors = produces(card, identity);
    for (const color of colors) colorSourceCounts[color] = (colorSourceCounts[color] ?? 0) + entry.quantity;
    const entryCondition = classifyLandEntry(card);
    entryModeCounts[entryCondition.mode] = (entryModeCounts[entryCondition.mode] ?? 0) + entry.quantity;
    const fetch = fetchRule(card);
    const targets = fetch.isFetch
      ? landEntries
          .filter((candidate) => validFetchTarget(card, candidate.card, fetch))
          .map((candidate) => ({
            name: candidate.card.name,
            set: candidate.card.set.toUpperCase(),
            collectorNumber: candidate.card.collector_number,
            quantity: candidate.entry.quantity,
            landTypes: [...landTypeSet(candidate.card)],
            produces: produces(candidate.card, identity),
            enters: classifyLandEntry(candidate.card),
          }))
      : [];

    return {
      name: card.name,
      quantity: entry.quantity,
      set: card.set.toUpperCase(),
      collectorNumber: card.collector_number,
      landTypes: [...landTypeSet(card)],
      producedMana: colors,
      entryCondition,
      manaRestriction: restriction(card),
      fetch: fetch.isFetch
        ? {
            rule: fetch,
            targetCount: targets.reduce((sum, target) => sum + target.quantity, 0),
            targets,
            warning: targets.length === 0 ? 'No legal target matching this search clause was detected in the resolved deck.' : null,
          }
        : null,
    };
  });

  const nonlandManaSources = parsed.main
    .map((entry) => ({ entry, card: resolveEntryCard(entry, cards) }))
    .filter((item): item is { entry: DeckEntry; card: ScryfallCard } => Boolean(item.card))
    .filter(({ card }) => landFaces(card).length === 0 && (card.produced_mana?.length || /\badd\b.*mana|\{T\}:\s*Add/i.test(getCardOracleText(card))))
    .map(({ entry, card }) => ({
      name: card.name,
      quantity: entry.quantity,
      manaValue: card.cmc,
      producedMana: produces(card, identity),
      restriction: restriction(card),
      sourceType: /creature/i.test(card.type_line) ? 'creature' : /artifact/i.test(card.type_line) ? 'artifact' : 'other',
    }));

  const reducers = parsed.main
    .map((entry) => ({ entry, card: resolveEntryCard(entry, cards) }))
    .filter((item): item is { entry: DeckEntry; card: ScryfallCard } => Boolean(item.card))
    .map(({ entry, card }) => ({ entry, card, reduction: costReduction(card) }))
    .filter((item): item is { entry: DeckEntry; card: ScryfallCard; reduction: string } => Boolean(item.reduction))
    .map(({ entry, card, reduction }) => ({ name: card.name, quantity: entry.quantity, reduction }));

  const identitySources = Object.fromEntries(
    identity.map((color) => [color, colorSourceCounts[color] ?? 0]),
  );

  return {
    model: 'MTG Ultimate mana-base rules analysis V0.4',
    commanderColorIdentity: identity,
    commanderColorIdentityLabel: identity.length ? COLORS.filter((color) => identity.includes(color)).join('') : 'C',
    landCount: landEntries.reduce((sum, item) => sum + item.entry.quantity, 0),
    colorSourceCounts,
    commanderIdentityColorSources: identitySources,
    landEntryModeCounts: entryModeCounts,
    lands,
    nonlandManaSources,
    costReducers: reducers,
    rulesNotes: [
      'A mana source can sometimes produce a color outside the commander identity without making that source illegal; deck legality is determined by the card’s color identity, not every color it might produce through words such as “any color.”',
      'Fetch target counts are based on resolved cards actually present in this deck and the target card’s land types/basic status.',
      'Commander-identity mana sources such as Command Tower/Arcane Signet are restricted to the resolved combined commander color identity for simulation purposes.',
    ],
    caveats: [
      'Highly unusual replacement effects and dynamically copied land types are not evaluated before the game begins.',
      'Conditional lands not matching common shock/check/fast/slow/reveal/multiplayer patterns are marked conditional-other rather than guessed.',
    ],
  };
}
