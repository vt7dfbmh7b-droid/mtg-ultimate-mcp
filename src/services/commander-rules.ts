import type { ScryfallCard } from '../types/scryfall.js';
import type { DeckEntry, ParsedDeck } from './deck.js';
import { getCardOracleText } from './scryfall.js';

const COLORS = ['W', 'U', 'B', 'R', 'G'] as const;
type Color = (typeof COLORS)[number];

export interface CommanderRulesResult {
  ruleset: string;
  status: 'legal' | 'illegal' | 'incomplete';
  isLegal: boolean;
  commanderCount: number;
  commanderColorIdentity: string[];
  commanderColorIdentityLabel: string;
  commanderChecks: Array<Record<string, unknown>>;
  pairing: Record<string, unknown>;
  deckSize: Record<string, unknown>;
  colorIdentityViolations: Array<Record<string, unknown>>;
  commanderLegalityViolations: Array<Record<string, unknown>>;
  singletonViolations: Array<Record<string, unknown>>;
  unresolvedEntries: Array<Record<string, unknown>>;
  rulesApplied: string[];
  warnings: string[];
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function resolveEntry(entry: DeckEntry, cards: ScryfallCard[]): ScryfallCard | undefined {
  if (entry.set && entry.collectorNumber) {
    const exact = cards.find(
      (card) => normalize(card.set) === normalize(entry.set ?? '') && normalize(card.collector_number) === normalize(entry.collectorNumber ?? ''),
    );
    if (exact) return exact;
  }
  if (entry.set) {
    const inSet = cards.find((card) => normalize(card.name) === normalize(entry.name) && normalize(card.set) === normalize(entry.set ?? ''));
    if (inSet) return inSet;
  }
  return cards.find((card) => normalize(card.name) === normalize(entry.name));
}

function colorLabel(identity: string[]): string {
  const ordered = COLORS.filter((color) => identity.includes(color));
  return ordered.length > 0 ? ordered.join('') : 'C';
}

function isLegendaryCreature(card: ScryfallCard): boolean {
  const type = card.type_line.toLowerCase();
  return type.includes('legendary') && type.includes('creature');
}

function explicitlyCanBeCommander(card: ScryfallCard): boolean {
  return /can be your commander/i.test(getCardOracleText(card));
}

function isBackground(card: ScryfallCard): boolean {
  const type = card.type_line.toLowerCase();
  return type.includes('legendary') && type.includes('background');
}

function hasChooseBackground(card: ScryfallCard): boolean {
  return /choose a background/i.test(getCardOracleText(card));
}

function hasDoctorsCompanion(card: ScryfallCard): boolean {
  return /doctor['’]s companion/i.test(getCardOracleText(card));
}

function isDoctorForCompanion(card: ScryfallCard): boolean {
  if (!isLegendaryCreature(card)) return false;
  const subtypePart = card.type_line.split(/\s+[—–]\s+/)[1]?.trim().toLowerCase() ?? '';
  return subtypePart === 'time lord doctor';
}

function hasFriendsForever(card: ScryfallCard): boolean {
  return /friends forever/i.test(getCardOracleText(card));
}

function hasCharacterSelectPartner(card: ScryfallCard): boolean {
  const source = `${getCardOracleText(card)}\n${(card.keywords ?? []).join('\n')}`;
  return /partner\s*[—–-]\s*character select/i.test(source);
}

function hasPlainPartner(card: ScryfallCard): boolean {
  const text = getCardOracleText(card);
  return /(?:^|\n)Partner(?:\s*\(|\s*$)/im.test(text)
    && !/(?:^|\n)Partner with\b/im.test(text)
    && !/Partner\s*[—–-]/i.test(text);
}

function partnerWithTarget(card: ScryfallCard): string | null {
  const match = getCardOracleText(card).match(/(?:^|\n)Partner with\s+([^\n(]+)/im);
  return match?.[1]?.trim() ?? null;
}

function ordinaryCommanderEligible(card: ScryfallCard): boolean {
  return isLegendaryCreature(card) || explicitlyCanBeCommander(card);
}

function twoCommanderPairing(first: ScryfallCard, second: ScryfallCard): { legal: boolean; method: string; reason: string } {
  if (hasCharacterSelectPartner(first) && hasCharacterSelectPartner(second)) {
    return {
      legal: true,
      method: 'Partner—Character select',
      reason: 'Both commanders have Partner—Character select; this variant pairs only with the same variant.',
    };
  }
  if (hasPlainPartner(first) && hasPlainPartner(second)) {
    return { legal: true, method: 'Partner', reason: 'Both commanders have the original Partner ability.' };
  }
  if (hasFriendsForever(first) && hasFriendsForever(second)) {
    return { legal: true, method: 'Friends forever', reason: 'Both commanders have Friends forever.' };
  }
  if ((hasChooseBackground(first) && isBackground(second)) || (hasChooseBackground(second) && isBackground(first))) {
    return { legal: true, method: 'Choose a Background', reason: 'A commander with Choose a Background is paired with a legendary Background.' };
  }
  if ((isDoctorForCompanion(first) && hasDoctorsCompanion(second)) || (isDoctorForCompanion(second) && hasDoctorsCompanion(first))) {
    return {
      legal: true,
      method: "Doctor's companion",
      reason: "A Doctor's companion is paired with a legendary creature whose creature subtypes are exactly Time Lord Doctor.",
    };
  }

  const firstTarget = partnerWithTarget(first);
  const secondTarget = partnerWithTarget(second);
  if (
    firstTarget &&
    secondTarget &&
    normalize(firstTarget) === normalize(second.name) &&
    normalize(secondTarget) === normalize(first.name)
  ) {
    return { legal: true, method: 'Partner with', reason: 'Each commander names the other in its Partner with ability.' };
  }

  return {
    legal: false,
    method: 'none',
    reason: 'The designated cards do not form a valid current two-commander pairing. Partner variants must follow their own pairing rule and cannot be mixed just because both are partner-like mechanics.',
  };
}

function numberWord(value: string): number | null {
  const numeric = Number.parseInt(value, 10);
  if (Number.isFinite(numeric)) return numeric;
  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12,
  };
  return words[value.toLowerCase()] ?? null;
}

function allowedCopies(card: ScryfallCard): number {
  if (/\bbasic\b/i.test(card.type_line) && /\bland\b/i.test(card.type_line)) return Number.POSITIVE_INFINITY;
  const text = getCardOracleText(card);
  if (/a deck can have any number of cards named/i.test(text)) return Number.POSITIVE_INFINITY;
  const upTo = text.match(/a deck can have up to\s+([a-z]+|\d+)\s+cards named/i);
  if (upTo?.[1]) return numberWord(upTo[1]) ?? 1;
  return 1;
}

function outsideColors(identity: string[], allowed: string[]): string[] {
  const allowedSet = new Set(allowed);
  return identity.filter((color) => !allowedSet.has(color));
}

function basicLandTypeColors(card: ScryfallCard): Color[] {
  const type = card.type_line.toLowerCase();
  const found: Color[] = [];
  if (/\bplains\b/.test(type)) found.push('W');
  if (/\bisland\b/.test(type)) found.push('U');
  if (/\bswamp\b/.test(type)) found.push('B');
  if (/\bmountain\b/.test(type)) found.push('R');
  if (/\bforest\b/.test(type)) found.push('G');
  return found;
}

function commanderEligibility(card: ScryfallCard, pairedAsBackground: boolean): { eligible: boolean; reason: string } {
  if (ordinaryCommanderEligible(card)) return { eligible: true, reason: 'Legendary creature or card text explicitly allows it to be a commander.' };
  if (pairedAsBackground && isBackground(card)) return { eligible: true, reason: 'Legendary Background is legal as the second commander through Choose a Background.' };
  return { eligible: false, reason: 'Card is not a legendary creature, does not explicitly say it can be your commander, and is not a valid paired Background.' };
}

export function validateCommanderDeck(parsed: ParsedDeck, cards: ScryfallCard[]): CommanderRulesResult {
  const allEntries = [...parsed.commanders, ...parsed.main];
  const resolvedEntries = allEntries.map((entry) => ({ entry, card: resolveEntry(entry, cards) }));
  const commanderResolved = parsed.commanders.map((entry) => ({ entry, card: resolveEntry(entry, cards) }));
  const commanderCards = commanderResolved.map((item) => item.card).filter((card): card is ScryfallCard => Boolean(card));
  const unresolvedEntries = resolvedEntries
    .filter((item) => !item.card)
    .map(({ entry }) => ({ name: entry.name, set: entry.set ?? null, collectorNumber: entry.collectorNumber ?? null }));

  const combinedIdentity = [...new Set(commanderCards.flatMap((card) => card.color_identity))].sort();
  const commanderCount = parsed.totalCommanders;
  const pairing = commanderCards.length === 2
    ? twoCommanderPairing(commanderCards[0] as ScryfallCard, commanderCards[1] as ScryfallCard)
    : commanderCount === 1
      ? { legal: true, method: 'single commander', reason: 'One commander is designated.' }
      : { legal: false, method: 'invalid count', reason: 'Standard Commander uses one commander, or two only when a specific pairing rule permits it.' };

  const pairedBackgroundNames = new Set<string>();
  if (commanderCards.length === 2 && pairing.legal && pairing.method === 'Choose a Background') {
    for (const card of commanderCards) if (isBackground(card)) pairedBackgroundNames.add(normalize(card.name));
  }

  const commanderChecks = commanderResolved.map(({ entry, card }) => {
    if (!card) return { name: entry.name, resolved: false, eligible: false, reason: 'Commander could not be resolved.' };
    const eligibility = commanderEligibility(card, pairedBackgroundNames.has(normalize(card.name)));
    return {
      name: card.name,
      resolved: true,
      quantity: entry.quantity,
      typeLine: card.type_line,
      colorIdentity: card.color_identity,
      commanderFormatLegality: card.legalities.commander ?? 'unknown',
      eligible: eligibility.eligible,
      reason: eligibility.reason,
    };
  });

  const colorIdentityViolations: Array<Record<string, unknown>> = [];
  const commanderLegalityViolations: Array<Record<string, unknown>> = [];
  const nameCounts = new Map<string, { card: ScryfallCard; quantity: number }>();

  for (const { entry, card } of resolvedEntries) {
    if (!card) continue;
    const legality = card.legalities.commander ?? 'unknown';
    if (legality !== 'legal') {
      commanderLegalityViolations.push({ name: card.name, legality, zone: parsed.commanders.includes(entry) ? 'commander' : 'main' });
    }

    const outside = outsideColors(card.color_identity, combinedIdentity);
    const landOutside = outsideColors(basicLandTypeColors(card), combinedIdentity);
    if (outside.length > 0 || landOutside.length > 0) {
      colorIdentityViolations.push({
        name: card.name,
        cardColorIdentity: card.color_identity,
        commanderColorIdentity: combinedIdentity,
        outsideColors: [...new Set([...outside, ...landOutside])],
        reason: `Card uses color identity outside commander identity ${colorLabel(combinedIdentity)}.`,
      });
    }

    const key = normalize(card.name);
    const current = nameCounts.get(key);
    if (current) current.quantity += entry.quantity;
    else nameCounts.set(key, { card, quantity: entry.quantity });
  }

  const singletonViolations = [...nameCounts.values()]
    .filter(({ card, quantity }) => quantity > allowedCopies(card))
    .map(({ card, quantity }) => ({ name: card.name, quantity, allowedCopies: allowedCopies(card) }));

  const commanderQuantityValid = parsed.commanders.every((entry) => entry.quantity === 1);
  const commanderEligibilityValid = commanderChecks.every((item) => item.eligible === true);
  const countValid = commanderCount === 1 || (commanderCount === 2 && pairing.legal === true);
  const deckSizeValid = parsed.totalCards === 100;
  const noResolvedRuleViolations =
    colorIdentityViolations.length === 0 &&
    commanderLegalityViolations.length === 0 &&
    singletonViolations.length === 0 &&
    commanderQuantityValid &&
    commanderEligibilityValid &&
    countValid &&
    deckSizeValid;
  const complete = unresolvedEntries.length === 0 && commanderCards.length === parsed.commanders.length;
  const status: 'legal' | 'illegal' | 'incomplete' = !complete ? 'incomplete' : noResolvedRuleViolations ? 'legal' : 'illegal';

  return {
    ruleset: 'Commander deck construction (Wizards Comprehensive Rules 903 / current Commander policy)',
    status,
    isLegal: status === 'legal',
    commanderCount,
    commanderColorIdentity: combinedIdentity,
    commanderColorIdentityLabel: colorLabel(combinedIdentity),
    commanderChecks,
    pairing,
    deckSize: {
      totalCards: parsed.totalCards,
      commanders: parsed.totalCommanders,
      libraryCards: parsed.totalMain,
      requiredTotal: 100,
      valid: deckSizeValid,
      expectedLibraryCards: commanderCount === 2 ? 98 : 99,
    },
    colorIdentityViolations,
    commanderLegalityViolations,
    singletonViolations,
    unresolvedEntries,
    rulesApplied: [
      'Exactly 100 cards including commander(s).',
      'Normally one commander; two only when an applicable pairing mechanic permits them.',
      'Partner variants are distinct: original Partner, Friends forever, Partner—Character select, Doctor’s companion, Choose a Background, and Partner with follow their own pairing conditions.',
      'Each commander must be eligible to be designated as a commander.',
      'Every card must be legal in the Commander format.',
      'Every card’s color identity must be a subset of the combined commander color identity; colorless cards are allowed.',
      'Hybrid mana contributes all of its colors to color identity under the current rule.',
      'Basic land types cannot introduce mana colors outside the commander color identity.',
      'Except for basic lands and cards with their own copy-count exception, the deck is singleton by English card name.',
    ],
    warnings: complete
      ? []
      : ['One or more cards could not be resolved, so the engine will not claim the deck is fully legal until all entries are identified.'],
  };
}
