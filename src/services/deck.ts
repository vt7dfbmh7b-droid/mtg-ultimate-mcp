import type { ScryfallCard } from '../types/scryfall.js';
import { getCardManaCost, inferCardRoles, summarizeCard } from './scryfall.js';

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

export interface DeckMetrics {
  landCount: number;
  nonlandCount: number;
  landRatio: number;
  averageNonlandManaValue: number;
  manaCurve: Record<string, number>;
  coloredPips: Record<string, number>;
  roleCounts: Record<string, number>;
  earlyPlayCount: number;
  fastManaCount: number;
  rampCount: number;
  drawCount: number;
  tutorCount: number;
  interactionCount: number;
  cheapInteractionCount: number;
  protectionCount: number;
  recursionCount: number;
  boardWipeCount: number;
  structuralSignals: string[];
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

function curveBucket(cmc: number): string {
  if (cmc <= 0) return '0';
  if (cmc >= 7) return '7+';
  return String(Math.floor(cmc));
}

function addColoredPips(target: Record<string, number>, manaCost: string, quantity: number): void {
  const symbols = manaCost.match(/\{[^}]+\}/g) ?? [];
  for (const symbol of symbols) {
    const upper = symbol.toUpperCase();
    for (const color of ['W', 'U', 'B', 'R', 'G']) {
      if (upper.includes(color)) target[color] = (target[color] ?? 0) + quantity;
    }
  }
}

export function buildDeckMetrics(parsed: ParsedDeck, cards: ScryfallCard[]): DeckMetrics {
  const map = resolvedCardMap(cards);
  const allEntries = [...parsed.commanders, ...parsed.main];
  const roleCounts: Record<string, number> = {};
  const manaCurve: Record<string, number> = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7+': 0 };
  const coloredPips: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  let landCount = 0;
  let nonlandCount = 0;
  let nonlandManaValue = 0;
  let earlyPlayCount = 0;
  let fastManaCount = 0;
  let rampCount = 0;
  let drawCount = 0;
  let tutorCount = 0;
  let interactionCount = 0;
  let cheapInteractionCount = 0;
  let protectionCount = 0;
  let recursionCount = 0;
  let boardWipeCount = 0;

  for (const entry of allEntries) {
    const card = map.get(entry.name.toLocaleLowerCase());
    if (!card) continue;
    const type = card.type_line.toLowerCase();
    const roles = new Set(inferCardRoles(card));
    const isLand = type.includes('land');

    if (isLand) {
      landCount += entry.quantity;
    } else {
      nonlandCount += entry.quantity;
      nonlandManaValue += card.cmc * entry.quantity;
      manaCurve[curveBucket(card.cmc)] = (manaCurve[curveBucket(card.cmc)] ?? 0) + entry.quantity;
      addColoredPips(coloredPips, getCardManaCost(card), entry.quantity);
      if (card.cmc <= 2) earlyPlayCount += entry.quantity;
    }

    for (const role of roles) roleCounts[role] = (roleCounts[role] ?? 0) + entry.quantity;

    if (roles.has('fast mana')) fastManaCount += entry.quantity;
    if (roles.has('mana acceleration') || roles.has('land ramp') || roles.has('cost reduction')) rampCount += entry.quantity;
    if (roles.has('card draw') || roles.has('repeatable draw') || roles.has('card selection')) drawCount += entry.quantity;
    if (roles.has('tutor')) tutorCount += entry.quantity;
    if (roles.has('spot interaction') || roles.has('countermagic') || roles.has('board wipe') || roles.has('free interaction')) {
      interactionCount += entry.quantity;
      if (card.cmc <= 2 || roles.has('free interaction')) cheapInteractionCount += entry.quantity;
    }
    if (roles.has('protection') || roles.has('board protection')) protectionCount += entry.quantity;
    if (roles.has('graveyard recursion')) recursionCount += entry.quantity;
    if (roles.has('board wipe')) boardWipeCount += entry.quantity;
  }

  const averageNonlandManaValue = nonlandCount > 0 ? nonlandManaValue / nonlandCount : 0;
  const structuralSignals: string[] = [];
  if (landCount < 30) structuralSignals.push('Very low land count; verify fast mana, MDFCs, and the intended competitive speed before assuming this is stable.');
  if (landCount > 42) structuralSignals.push('High land count; check whether the commander/theme truly converts excess lands into value.');
  if (rampCount < 8) structuralSignals.push('Low detected ramp/mana acceleration density.');
  if (drawCount < 8) structuralSignals.push('Low detected card-advantage/selection density.');
  if (interactionCount < 8) structuralSignals.push('Low detected interaction density for a multiplayer Commander table.');
  if (averageNonlandManaValue > 4) structuralSignals.push('High nonland mana curve; early turns may be clunky without substantial acceleration.');
  if (earlyPlayCount < 12) structuralSignals.push('Low density of nonland plays at mana value 0–2; opening hands may have few proactive early actions.');

  return {
    landCount,
    nonlandCount,
    landRatio: parsed.totalCards > 0 ? Number((landCount / parsed.totalCards).toFixed(3)) : 0,
    averageNonlandManaValue: Number(averageNonlandManaValue.toFixed(2)),
    manaCurve,
    coloredPips,
    roleCounts,
    earlyPlayCount,
    fastManaCount,
    rampCount,
    drawCount,
    tutorCount,
    interactionCount,
    cheapInteractionCount,
    protectionCount,
    recursionCount,
    boardWipeCount,
    structuralSignals,
  };
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

    const commanderLegality = card.legalities.commander ?? 'unknown';
    if (commanderLegality !== 'legal') illegalCards.push({ name: card.name, legality: commanderLegality });

    if (allowedIdentity.length > 0 && !isColorIdentitySubset(card.color_identity, allowedIdentity)) {
      colorIdentityViolations.push({ name: card.name, colorIdentity: card.color_identity });
    }

    const isBasicLand = /\bbasic\b/i.test(card.type_line) && /\bland\b/i.test(card.type_line);
    if (!isBasicLand && entry.quantity > 1) singletonViolations.push({ name: card.name, quantity: entry.quantity });
  }

  const metrics = buildDeckMetrics(parsed, cards);

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
    ...metrics,
    illegalCards,
    colorIdentityViolations,
    singletonViolations,
    caveats: [
      'Commander partner/background/Doctor-companion pairing rules still need dedicated validation.',
      'Strategic role classification is heuristic; Oracle text and known combo data remain the source of truth for exact interactions.',
      'Structural signals are deck-building heuristics, not official Commander bracket rules.',
    ],
  };
}
