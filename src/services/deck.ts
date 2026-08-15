import type { ScryfallCard } from '../types/scryfall.js';
import { inferCardRoles, summarizeCard } from './scryfall.js';

export interface DeckEntry {
  name: string;
  quantity: number;
}

export interface ParsedDeck {
  main: DeckEntry[];
  commanders: DeckEntry[];
  totalMain: number;
  totalCommanders: number;
  totalCards: number;
}

const COMMANDER_HEADERS = new Set(['commander', 'commanders', 'command', 'command zone']);
const MAIN_HEADERS = new Set(['main', 'mainboard', 'deck']);
const IGNORE_HEADERS = new Set(['sideboard', 'maybeboard', 'about']);

function cleanCardName(raw: string): string {
  return raw
    .replace(/\s+\*F\*\s*$/i, '')
    .replace(/\s+\([A-Z0-9]{2,8}\)\s+\S+\s*$/i, '')
    .replace(/\s+\[[A-Z0-9]{2,8}\]\s+\S+\s*$/i, '')
    .trim();
}

function addEntry(map: Map<string, DeckEntry>, name: string, quantity: number): void {
  const key = name.toLocaleLowerCase();
  const existing = map.get(key);
  if (existing) {
    existing.quantity += quantity;
  } else {
    map.set(key, { name, quantity });
  }
}

export function parseDecklist(decklist: string, commanderNames: string[] = []): ParsedDeck {
  const main = new Map<string, DeckEntry>();
  const commanders = new Map<string, DeckEntry>();
  let section: 'main' | 'commander' | 'ignore' = 'main';

  for (const originalLine of decklist.split(/\r?\n/)) {
    const line = originalLine.trim();
    if (!line) continue;

    const normalizedHeader = line.replace(/^\/\/\s*/, '').trim().toLowerCase();
    if (COMMANDER_HEADERS.has(normalizedHeader) || normalizedHeader.startsWith('commander:')) {
      section = 'commander';
      continue;
    }
    if (MAIN_HEADERS.has(normalizedHeader) || normalizedHeader.startsWith('mainboard:')) {
      section = 'main';
      continue;
    }
    if (IGNORE_HEADERS.has(normalizedHeader) || normalizedHeader.startsWith('sideboard') || normalizedHeader.startsWith('maybeboard')) {
      section = 'ignore';
      continue;
    }
    if (line.startsWith('//')) continue;
    if (section === 'ignore') continue;

    const commanderTagged = /(?:#\s*!?\s*commander|\^commander\^|\[commander\])\s*$/i.test(line);
    const withoutTag = line.replace(/\s*(?:#\s*!?\s*commander|\^commander\^|\[commander\])\s*$/i, '').trim();
    const match = withoutTag.match(/^(?:(\d+)x?\s+)?(.+?)$/i);
    if (!match) continue;

    const quantity = Number.parseInt(match[1] ?? '1', 10);
    const name = cleanCardName(match[2] ?? '');
    if (!name || !Number.isFinite(quantity) || quantity < 1) continue;

    addEntry(section === 'commander' || commanderTagged ? commanders : main, name, quantity);
  }

  for (const commanderName of commanderNames.map((name) => name.trim()).filter(Boolean)) {
    const key = commanderName.toLocaleLowerCase();
    const mainEntry = main.get(key);
    if (mainEntry) {
      main.delete(key);
      addEntry(commanders, mainEntry.name, mainEntry.quantity);
    } else if (!commanders.has(key)) {
      addEntry(commanders, commanderName, 1);
    }
  }

  const mainEntries = [...main.values()];
  const commanderEntries = [...commanders.values()];
  const totalMain = mainEntries.reduce((sum, entry) => sum + entry.quantity, 0);
  const totalCommanders = commanderEntries.reduce((sum, entry) => sum + entry.quantity, 0);

  return {
    main: mainEntries,
    commanders: commanderEntries,
    totalMain,
    totalCommanders,
    totalCards: totalMain + totalCommanders,
  };
}

export function isColorIdentitySubset(cardIdentity: string[], allowedIdentity: string[]): boolean {
  const allowed = new Set(allowedIdentity);
  return cardIdentity.every((color) => allowed.has(color));
}

function resolvedCardMap(cards: ScryfallCard[]): Map<string, ScryfallCard> {
  const map = new Map<string, ScryfallCard>();
  for (const card of cards) {
    map.set(card.name.toLocaleLowerCase(), card);
  }
  return map;
}

export function analyzeResolvedDeck(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  notFound: string[] = [],
): Record<string, unknown> {
  const cardMap = resolvedCardMap(cards);
  const allEntries = [...parsed.commanders, ...parsed.main];
  const commanderCards = parsed.commanders
    .map((entry) => cardMap.get(entry.name.toLocaleLowerCase()))
    .filter((card): card is ScryfallCard => Boolean(card));

  const allowedIdentity = [...new Set(commanderCards.flatMap((card) => card.color_identity))].sort();
  const deckIdentity = [...new Set(cards.flatMap((card) => card.color_identity))].sort();

  const typeCounts: Record<string, number> = {
    land: 0,
    creature: 0,
    artifact: 0,
    enchantment: 0,
    planeswalker: 0,
    instant: 0,
    sorcery: 0,
    battle: 0,
    other: 0,
  };
  const roleCounts: Record<string, number> = {};
  let nonlandManaValue = 0;
  let nonlandCount = 0;

  const illegalCards: Array<{ name: string; legality: string }> = [];
  const colorIdentityViolations: Array<{ name: string; colorIdentity: string[] }> = [];
  const singletonViolations: Array<{ name: string; quantity: number }> = [];

  for (const entry of allEntries) {
    const card = cardMap.get(entry.name.toLocaleLowerCase());
    if (!card) continue;
    const type = card.type_line.toLowerCase();

    let bucket = 'other';
    if (type.includes('land')) bucket = 'land';
    else if (type.includes('creature')) bucket = 'creature';
    else if (type.includes('artifact')) bucket = 'artifact';
    else if (type.includes('enchantment')) bucket = 'enchantment';
    else if (type.includes('planeswalker')) bucket = 'planeswalker';
    else if (type.includes('instant')) bucket = 'instant';
    else if (type.includes('sorcery')) bucket = 'sorcery';
    else if (type.includes('battle')) bucket = 'battle';
    typeCounts[bucket] = (typeCounts[bucket] ?? 0) + entry.quantity;

    if (!type.includes('land')) {
      nonlandManaValue += card.cmc * entry.quantity;
      nonlandCount += entry.quantity;
    }

    for (const role of inferCardRoles(card)) {
      roleCounts[role] = (roleCounts[role] ?? 0) + entry.quantity;
    }

    const commanderLegality = card.legalities.commander ?? 'unknown';
    if (commanderLegality !== 'legal') {
      illegalCards.push({ name: card.name, legality: commanderLegality });
    }

    if (allowedIdentity.length > 0 && !isColorIdentitySubset(card.color_identity, allowedIdentity)) {
      colorIdentityViolations.push({ name: card.name, colorIdentity: card.color_identity });
    }

    const isBasicLand = /\bbasic\b/i.test(card.type_line) && /\bland\b/i.test(card.type_line);
    if (!isBasicLand && entry.quantity > 1) {
      singletonViolations.push({ name: card.name, quantity: entry.quantity });
    }
  }

  return {
    parsed,
    resolvedCards: cards.length,
    unresolvedCards: notFound,
    commanderCards: commanderCards.map(summarizeCard),
    allowedCommanderColorIdentity: allowedIdentity,
    deckColorIdentity: deckIdentity,
    deckSize: parsed.totalCards,
    commanderDeckSizeValid: parsed.totalCards === 100,
    typeCounts,
    averageNonlandManaValue: nonlandCount > 0 ? Number((nonlandManaValue / nonlandCount).toFixed(2)) : 0,
    roleCounts,
    illegalCards,
    colorIdentityViolations,
    singletonViolations,
    caveats: [
      'Commander partner/background/Doctor-companion pairing rules are not yet validated in V1.',
      'Role detection is heuristic; use Oracle text and known combo data for final strategic interpretation.',
    ],
  };
}
