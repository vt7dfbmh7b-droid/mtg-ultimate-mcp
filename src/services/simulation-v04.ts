import type { ScryfallCard } from '../types/scryfall.js';
import type { ParsedDeck } from './deck.js';
import { resolveEntryCard } from './deck.js';
import { classifyLandEntry } from './mana-v04.js';
import { getCardManaCost, getCardOracleText, inferCardRoles } from './scryfall.js';

export interface DeckSimulationV04Options {
  iterations?: number;
  turns?: number;
  seed?: number;
  maxMulligans?: number;
  comboPieces?: string[][];
  opponents?: number;
}

type RestrictionKind = 'any' | 'commander' | 'creature' | 'artifact' | 'instant-sorcery';
type TutorDestination = 'hand' | 'top' | 'battlefield' | 'graveyard' | 'unknown';

interface ManaRestriction {
  kind: RestrictionKind;
  raw: string | null;
}

interface TutorSpec {
  isTutor: boolean;
  destination: TutorDestination;
  anyCard: boolean;
  basicOnly: boolean;
  types: string[];
  landTypes: string[];
  maxManaValue: number | null;
}

interface DrawProfile {
  immediate: number;
  recurringPerTurn: number;
  recurringReason: string | null;
}

interface FetchSpec {
  isFetch: boolean;
  basicOnly: boolean;
  anyLand: boolean;
  landTypes: string[];
  entersTappedFromSearch: boolean;
}

interface CostReducer {
  amount: number;
  appliesTo: 'all' | 'creature' | 'artifact' | 'commander';
  raw: string;
}

interface SimCard {
  uid: number;
  card: ScryfallCard;
  name: string;
  cmc: number;
  manaCost: string;
  typeLine: string;
  oracleText: string;
  roles: Set<string>;
  isLand: boolean;
  isModalLand: boolean;
  isLandOption: boolean;
  landTypes: string[];
  producedMana: string[];
  sourceOutput: number;
  manaRestriction: ManaRestriction;
  isManaPermanent: boolean;
  isManaCreature: boolean;
  oneShotMana: boolean;
  isRamp: boolean;
  fetch: FetchSpec;
  tutor: TutorSpec;
  draw: DrawProfile;
  reducer: CostReducer | null;
  isInteraction: boolean;
  isProtection: boolean;
}

interface ManaSource {
  id: number;
  colors: string[];
  output: number;
  restriction: ManaRestriction;
}

interface ManaUnit {
  sourceId: number;
  colors: string[];
  restriction: ManaRestriction;
}

interface LandPermanent {
  name: string;
  types: string[];
}

interface CommanderProfile {
  name: string;
  cmc: number;
  manaCost: string;
  typeLine: string;
}

interface IterationResult {
  mulligans: number;
  openingLandOptions: number;
  functionalOpening: boolean;
  spendableManaByTurn: number[];
  landsByTurn: number[];
  colorCoverageByTurn: number[];
  cardsSeenByTurn: number[];
  commanderCastTurns: Array<number | null>;
  commanderTaxOneCastTurns: Array<number | null>;
  commanderTaxTwoCastTurns: Array<number | null>;
  interactionOnlineTurn: number | null;
  drawEngineOnlineTurn: number | null;
  naturalComboTurns: Array<number | null>;
  tutorAssistedComboTurns: Array<number | null>;
  tutorsCast: number;
  tutorsFoundRequestedComboPiece: number;
  immediateCardsDrawn: number;
  recurringCardsDrawn: number;
  shockLifePaid: number;
  fetchesActivated: number;
  fetchesWithNoTarget: number;
  landModeCounts: Record<string, number>;
  restrictedManaSourcesDeployed: number;
  reducerSpellsDeployed: number;
}

const COLORS = ['W', 'U', 'B', 'R', 'G'] as const;
const BASIC_TYPES: Record<string, string> = {
  plains: 'W',
  island: 'U',
  swamp: 'B',
  mountain: 'R',
  forest: 'G',
};

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value ?? fallback)));
}

class SeededRandom {
  private state: number;
  constructor(seed: number) {
    this.state = (seed >>> 0) || 0x9e3779b9;
  }
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0x1_0000_0000;
  }
}

function shuffle<T>(items: T[], random: SeededRandom): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random.next() * (index + 1));
    const current = result[index] as T;
    result[index] = result[swapIndex] as T;
    result[swapIndex] = current;
  }
  return result;
}

function landFaces(card: ScryfallCard): Array<{ typeLine: string; oracleText: string }> {
  const faces = (card.card_faces ?? [])
    .filter((face) => /\bland\b/i.test(face.type_line ?? ''))
    .map((face) => ({ typeLine: face.type_line ?? '', oracleText: face.oracle_text ?? '' }));
  if (faces.length > 0) return faces;
  return /\bland\b/i.test(card.type_line)
    ? [{ typeLine: card.type_line, oracleText: getCardOracleText(card) }]
    : [];
}

function isModalLand(card: ScryfallCard): boolean {
  const faces = card.card_faces ?? [];
  return faces.some((face) => /\bland\b/i.test(face.type_line ?? '')) && faces.some((face) => !/\bland\b/i.test(face.type_line ?? ''));
}

function landTypes(card: ScryfallCard): string[] {
  const found = new Set<string>();
  for (const face of landFaces(card)) {
    for (const type of Object.keys(BASIC_TYPES)) {
      if (new RegExp(`\\b${type}\\b`, 'i').test(face.typeLine)) found.add(type);
    }
  }
  return [...found];
}

function producedMana(card: ScryfallCard, commanderIdentity: string[]): string[] {
  const text = getCardOracleText(card);
  if (/any color in your commander['’]s color identity/i.test(text)) return [...commanderIdentity];
  const explicit = (card.produced_mana ?? []).map((value) => value.toUpperCase()).filter(Boolean);
  if (explicit.length > 0) return [...new Set(explicit)];
  const fallback = landTypes(card).map((type) => BASIC_TYPES[type]).filter((value): value is string => Boolean(value));
  return fallback.length > 0 ? [...new Set(fallback)] : ['C'];
}

function sourceOutput(card: ScryfallCard): number {
  const text = getCardOracleText(card);
  const manaSymbols = text.match(/add\s+((?:\{[WUBRGC]\}){2,5})/i)?.[1]?.match(/\{[WUBRGC]\}/gi) ?? [];
  if (manaSymbols.length > 1) return manaSymbols.length;
  const word = text.match(/add (two|three|four|five) mana/i)?.[1]?.toLowerCase();
  if (word === 'two') return 2;
  if (word === 'three') return 3;
  if (word === 'four') return 4;
  if (word === 'five') return 5;
  return 1;
}

export function parseManaRestriction(card: ScryfallCard): ManaRestriction {
  const text = getCardOracleText(card);
  const raw = text.match(/spend this mana only to ([^.\n]+)/i)?.[1]?.trim() ?? null;
  if (!raw) return { kind: 'any', raw: null };
  const lower = raw.toLowerCase();
  if (/cast (?:your )?commander/.test(lower)) return { kind: 'commander', raw };
  if (/cast (?:a |an )?creature/.test(lower)) return { kind: 'creature', raw };
  if (/cast (?:an |a )?artifact/.test(lower)) return { kind: 'artifact', raw };
  if (/cast (?:an |a )?(?:instant|sorcery)|instant and sorcery|instant or sorcery/.test(lower)) {
    return { kind: 'instant-sorcery', raw };
  }
  return { kind: 'any', raw };
}

function parseNumberWord(value: string): number | null {
  const direct = Number.parseInt(value, 10);
  if (Number.isFinite(direct)) return direct;
  const map: Record<string, number> = {
    a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  };
  return map[value.toLowerCase()] ?? null;
}

export function parseDrawProfile(card: ScryfallCard): DrawProfile {
  const text = getCardOracleText(card);
  let immediate = 0;
  const direct = text.match(/draw (a|one|two|three|four|five|six|seven|\d+) cards?/i);
  if (direct?.[1]) immediate = parseNumberWord(direct[1]) ?? 0;

  let recurringPerTurn = 0;
  let recurringReason: string | null = null;
  const recurringPatterns: Array<[RegExp, string]> = [
    [/at the beginning of your upkeep[^.]*draw a card/i, 'upkeep draw'],
    [/at the beginning of your end step[^.]*draw a card/i, 'end-step draw'],
    [/whenever you attack[^.]*draw a card/i, 'attack-trigger draw proxy'],
    [/whenever one or more creatures you control deal combat damage[^.]*draw a card/i, 'combat-damage draw proxy'],
  ];
  for (const [pattern, reason] of recurringPatterns) {
    if (pattern.test(text)) {
      recurringPerTurn = 1;
      recurringReason = reason;
      break;
    }
  }
  return { immediate, recurringPerTurn, recurringReason };
}

export function parseTutorSpec(card: ScryfallCard): TutorSpec {
  const text = getCardOracleText(card);
  const match = text.match(/search your library for ([\s\S]*?)(?:,|\.)(?:\s|$)/i);
  if (!match?.[1]) {
    return { isTutor: false, destination: 'unknown', anyCard: false, basicOnly: false, types: [], landTypes: [], maxManaValue: null };
  }
  const clause = match[1].toLowerCase();
  const destination: TutorDestination = /put (?:it|that card) into your hand/i.test(text)
    ? 'hand'
    : /put (?:it|that card) onto the battlefield/i.test(text)
      ? 'battlefield'
      : /put (?:it|that card) on top of your library/i.test(text)
        ? 'top'
        : /put (?:it|that card) into your graveyard/i.test(text)
          ? 'graveyard'
          : 'unknown';
  const types = ['creature', 'artifact', 'enchantment', 'instant', 'sorcery', 'planeswalker', 'land']
    .filter((type) => new RegExp(`\\b${type}\\b`, 'i').test(clause));
  const landTypeMatches = Object.keys(BASIC_TYPES).filter((type) => new RegExp(`\\b${type}\\b`, 'i').test(clause));
  const mv = clause.match(/mana value (\d+) or less/i)?.[1];
  return {
    isTutor: true,
    destination,
    anyCard: /\ba card\b/i.test(clause) && types.length === 0 && landTypeMatches.length === 0,
    basicOnly: /basic land|basic (?:plains|island|swamp|mountain|forest)/i.test(clause),
    types,
    landTypes: landTypeMatches,
    maxManaValue: mv ? Number.parseInt(mv, 10) : null,
  };
}

function parseFetchSpec(card: ScryfallCard): FetchSpec {
  const text = getCardOracleText(card);
  const match = text.match(/search your library for ([\s\S]*?)(?:,|\.)(?:\s|$)/i);
  if (!match?.[1] || !/\bland\b|\bplains\b|\bisland\b|\bswamp\b|\bmountain\b|\bforest\b/i.test(match[1])) {
    return { isFetch: false, basicOnly: false, anyLand: false, landTypes: [], entersTappedFromSearch: false };
  }
  const clause = match[1].toLowerCase();
  const types = Object.keys(BASIC_TYPES).filter((type) => new RegExp(`\\b${type}\\b`, 'i').test(clause));
  return {
    isFetch: /sacrifice/i.test(text) || /exile/i.test(text),
    basicOnly: /basic land|basic (?:plains|island|swamp|mountain|forest)/i.test(clause),
    anyLand: /\ba land card\b/i.test(clause) && types.length === 0,
    landTypes: types,
    entersTappedFromSearch: /put (?:it|that card) onto the battlefield tapped/i.test(text),
  };
}

function parseReducer(card: ScryfallCard): CostReducer | null {
  const text = getCardOracleText(card);
  const match = text.match(/([^\n.]{0,90}?)(?:spells?|commander spells?) you cast cost \{(\d+)\} less to cast/i);
  if (!match?.[2]) return null;
  const raw = match[0];
  const lower = raw.toLowerCase();
  const amount = Number.parseInt(match[2], 10);
  const appliesTo: CostReducer['appliesTo'] = /commander/.test(lower)
    ? 'commander'
    : /creature/.test(lower)
      ? 'creature'
      : /artifact/.test(lower)
        ? 'artifact'
        : 'all';
  return { amount, appliesTo, raw };
}

function toTemplate(card: ScryfallCard, commanderIdentity: string[]): Omit<SimCard, 'uid'> {
  const roles = new Set(inferCardRoles(card));
  const faces = landFaces(card);
  const modal = isModalLand(card);
  const type = card.type_line.toLowerCase();
  const text = getCardOracleText(card);
  const source = /\badd\b.*(?:mana|\{[WUBRGC]\})|\{T\}:\s*Add/i.test(text);
  const isManaCreature = type.includes('creature') && source;
  const isManaPermanent = source && (type.includes('artifact') || type.includes('creature'));
  const oneShotMana = source && (type.includes('instant') || type.includes('sorcery') || /sacrifice [^.:]+[.:][^\n]*add/i.test(text));
  return {
    card,
    name: card.name,
    cmc: card.cmc,
    manaCost: getCardManaCost(card),
    typeLine: card.type_line,
    oracleText: text,
    roles,
    isLand: faces.length > 0 && !modal,
    isModalLand: modal,
    isLandOption: faces.length > 0,
    landTypes: landTypes(card),
    producedMana: producedMana(card, commanderIdentity),
    sourceOutput: sourceOutput(card),
    manaRestriction: parseManaRestriction(card),
    isManaPermanent,
    isManaCreature,
    oneShotMana,
    isRamp: isManaPermanent || oneShotMana || roles.has('land ramp') || roles.has('cost reduction'),
    fetch: parseFetchSpec(card),
    tutor: parseTutorSpec(card),
    draw: parseDrawProfile(card),
    reducer: parseReducer(card),
    isInteraction: roles.has('spot interaction') || roles.has('countermagic') || roles.has('board wipe') || roles.has('free interaction'),
    isProtection: roles.has('protection') || roles.has('board protection'),
  };
}

function commanderIdentity(parsed: ParsedDeck, cards: ScryfallCard[]): string[] {
  return [...new Set(
    parsed.commanders
      .map((entry) => resolveEntryCard(entry, cards))
      .filter((card): card is ScryfallCard => Boolean(card))
      .flatMap((card) => card.color_identity),
  )].sort();
}

function expandLibrary(parsed: ParsedDeck, cards: ScryfallCard[], identity: string[]): SimCard[] {
  const output: SimCard[] = [];
  let uid = 1;
  for (const entry of parsed.main) {
    const card = resolveEntryCard(entry, cards);
    if (!card) continue;
    const template = toTemplate(card, identity);
    for (let copy = 0; copy < entry.quantity; copy += 1) output.push({ uid: uid++, ...template });
  }
  return output;
}

function commanderProfiles(parsed: ParsedDeck, cards: ScryfallCard[]): CommanderProfile[] {
  return parsed.commanders
    .map((entry) => resolveEntryCard(entry, cards))
    .filter((card): card is ScryfallCard => Boolean(card))
    .map((card) => ({ name: card.name, cmc: card.cmc, manaCost: getCardManaCost(card), typeLine: card.type_line }));
}

interface ManaRequirement {
  generic: number;
  colored: string[][];
}

function parseManaRequirement(manaCost: string, fallbackCmc: number, genericTax: number, genericReduction: number): ManaRequirement {
  const cost = manaCost.split('//')[0]?.trim() ?? '';
  const symbols = cost.match(/\{[^}]+\}/g) ?? [];
  let generic = Math.max(0, genericTax - genericReduction);
  const colored: string[][] = [];
  for (const raw of symbols) {
    const symbol = raw.slice(1, -1).toUpperCase();
    if (/^\d+$/.test(symbol)) {
      generic += Number.parseInt(symbol, 10);
      continue;
    }
    if (symbol === 'C') {
      colored.push(['C']);
      continue;
    }
    if (COLORS.includes(symbol as (typeof COLORS)[number])) {
      colored.push([symbol]);
      continue;
    }
    const options = symbol.split('/').filter((part) => COLORS.includes(part as (typeof COLORS)[number]));
    if (options.length > 0) colored.push([...new Set(options)]);
  }
  if (symbols.length === 0 && fallbackCmc > 0) generic += Math.max(0, fallbackCmc - genericReduction);
  return { generic, colored };
}

function restrictionAllows(unit: ManaUnit, cardTypeLine: string, isCommander: boolean): boolean {
  if (unit.restriction.kind === 'any') return true;
  if (unit.restriction.kind === 'commander') return isCommander;
  const lower = cardTypeLine.toLowerCase();
  if (unit.restriction.kind === 'creature') return lower.includes('creature');
  if (unit.restriction.kind === 'artifact') return lower.includes('artifact');
  if (unit.restriction.kind === 'instant-sorcery') return lower.includes('instant') || lower.includes('sorcery');
  return true;
}

function reducerAmount(reducers: CostReducer[], typeLine: string, isCommander: boolean): number {
  const lower = typeLine.toLowerCase();
  return reducers.reduce((sum, reducer) => {
    const applies = reducer.appliesTo === 'all'
      || (reducer.appliesTo === 'commander' && isCommander)
      || (reducer.appliesTo === 'creature' && lower.includes('creature'))
      || (reducer.appliesTo === 'artifact' && lower.includes('artifact'));
    return sum + (applies ? reducer.amount : 0);
  }, 0);
}

function manaUnits(sources: ManaSource[]): ManaUnit[] {
  return sources.flatMap((source) => Array.from({ length: Math.max(1, source.output) }, () => ({
    sourceId: source.id,
    colors: source.colors.length > 0 ? source.colors : ['C'],
    restriction: source.restriction,
  })));
}

function paymentIndices(
  requirement: ManaRequirement,
  units: ManaUnit[],
  typeLine: string,
  isCommander: boolean,
): number[] | null {
  const available = units.map((unit, index) => ({ unit, index })).filter(({ unit }) => restrictionAllows(unit, typeLine, isCommander));
  const requirements = [...requirement.colored].sort((a, b) => a.length - b.length);
  const used = new Set<number>();

  const assign = (requirementIndex: number): boolean => {
    if (requirementIndex >= requirements.length) return true;
    const colors = requirements[requirementIndex] ?? [];
    for (const { unit, index } of available) {
      if (used.has(index)) continue;
      if (!colors.some((color) => unit.colors.includes(color))) continue;
      used.add(index);
      if (assign(requirementIndex + 1)) return true;
      used.delete(index);
    }
    return false;
  };

  if (!assign(0)) return null;
  const genericCandidates = available.map(({ index }) => index).filter((index) => !used.has(index));
  if (genericCandidates.length < requirement.generic) return null;
  for (const index of genericCandidates.slice(0, requirement.generic)) used.add(index);
  return [...used];
}

function spendFor(
  card: Pick<SimCard, 'manaCost' | 'cmc' | 'typeLine'>,
  pool: ManaUnit[],
  reducers: CostReducer[],
  genericTax = 0,
  isCommander = false,
): ManaUnit[] | null {
  const reduction = reducerAmount(reducers, card.typeLine, isCommander);
  const indices = paymentIndices(parseManaRequirement(card.manaCost, card.cmc, genericTax, reduction), pool, card.typeLine, isCommander);
  if (!indices) return null;
  const used = new Set(indices);
  return pool.filter((_, index) => !used.has(index));
}

function canPayCommander(commander: CommanderProfile, pool: ManaUnit[], reducers: CostReducer[], tax: number): boolean {
  const reduction = reducerAmount(reducers, commander.typeLine, true);
  const requirement = parseManaRequirement(commander.manaCost, commander.cmc, tax, reduction);
  return paymentIndices(requirement, pool, commander.typeLine, true) !== null;
}

function openingScore(card: SimCard, landOptions: number): number {
  if (card.isLand && landOptions <= 3) return 6;
  if (card.isModalLand && landOptions <= 3) return 5;
  if (card.isRamp && card.cmc <= 2) return 5;
  if (card.tutor.isTutor && card.cmc <= 2) return 4.5;
  if ((card.draw.immediate > 0 || card.draw.recurringPerTurn > 0) && card.cmc <= 2) return 4;
  if (card.isInteraction && card.cmc <= 2) return 4;
  if (card.cmc <= 2) return 2.5;
  return 1;
}

function shouldKeep(hand: SimCard[]): boolean {
  const lands = hand.filter((card) => card.isLandOption).length;
  const cheapRamp = hand.filter((card) => card.isRamp && card.cmc <= 2).length;
  const cheapAction = hand.filter((card) => !card.isLandOption && card.cmc <= 2).length;
  if (lands >= 2 && lands <= 4) return true;
  if (lands === 1 && cheapRamp >= 1 && cheapAction >= 2) return true;
  if (lands === 5 && hand.some((card) => card.draw.immediate > 0 && card.cmc <= 2)) return true;
  return false;
}

function londonBottom(hand: SimCard[], count: number): { kept: SimCard[]; bottomed: SimCard[] } {
  if (count <= 0) return { kept: [...hand], bottomed: [] };
  const lands = hand.filter((card) => card.isLandOption).length;
  const scored = hand
    .map((card, index) => ({ card, index, score: openingScore(card, lands) }))
    .sort((a, b) => a.score - b.score || b.card.cmc - a.card.cmc);
  const bottom = new Set(scored.slice(0, count).map((item) => item.index));
  return {
    kept: hand.filter((_, index) => !bottom.has(index)),
    bottomed: hand.filter((_, index) => bottom.has(index)),
  };
}

function landHasType(card: SimCard, type: string): boolean {
  return card.landTypes.includes(type.toLowerCase());
}

function tutorCanFind(tutor: TutorSpec, candidate: SimCard): boolean {
  if (!tutor.isTutor) return false;
  const type = candidate.typeLine.toLowerCase();
  if (tutor.maxManaValue !== null && candidate.cmc > tutor.maxManaValue) return false;
  if (tutor.basicOnly && !(/\bbasic\b/i.test(candidate.typeLine) && candidate.isLandOption)) return false;
  if (tutor.landTypes.length > 0 && !tutor.landTypes.some((landType) => landHasType(candidate, landType))) return false;
  if (tutor.types.length > 0 && !tutor.types.some((wanted) => type.includes(wanted))) return false;
  return tutor.anyCard || tutor.basicOnly || tutor.types.length > 0 || tutor.landTypes.length > 0;
}

function fetchCanFind(fetch: FetchSpec, candidate: SimCard): boolean {
  if (!fetch.isFetch || !candidate.isLandOption) return false;
  if (fetch.basicOnly && !/\bbasic\b/i.test(candidate.typeLine)) return false;
  if (fetch.landTypes.length > 0 && !fetch.landTypes.some((type) => landHasType(candidate, type))) return false;
  return fetch.anyLand || fetch.basicOnly || fetch.landTypes.length > 0;
}

function wantedColors(commanders: CommanderProfile[]): string[] {
  const found = new Set<string>();
  for (const commander of commanders) {
    for (const symbol of commander.manaCost.match(/\{[^}]+\}/g) ?? []) {
      for (const color of COLORS) if (symbol.toUpperCase().includes(color)) found.add(color);
    }
  }
  return [...found];
}

function landWillEnterTapped(card: SimCard, lands: LandPermanent[], hand: SimCard[], opponents: number): { tapped: boolean; shockLife: number; mode: string } {
  const classification = classifyLandEntry(card.card);
  const mode = classification.mode;
  if (mode === 'untapped') return { tapped: false, shockLife: 0, mode };
  if (mode === 'always-tapped') return { tapped: true, shockLife: 0, mode };
  if (mode === 'shock-choice') return { tapped: false, shockLife: 2, mode };
  if (mode === 'fast-land') return { tapped: lands.length > 2, shockLife: 0, mode };
  if (mode === 'slow-land') return { tapped: lands.length < 2, shockLife: 0, mode };
  if (mode === 'multiplayer-land') return { tapped: opponents < 2, shockLife: 0, mode };
  if (mode === 'check-land') {
    const required = classification.relevantTypes;
    const hasType = lands.some((land) => required.some((type) => land.types.includes(type)));
    return { tapped: !hasType, shockLife: 0, mode };
  }
  if (mode === 'reveal-land') {
    const required = classification.relevantTypes;
    const revealable = hand.some((held) => held.isLandOption && required.some((type) => held.landTypes.includes(type)));
    return { tapped: !revealable, shockLife: 0, mode };
  }
  return { tapped: true, shockLife: 0, mode };
}

function landScore(card: SimCard, colorsNeeded: string[], lands: LandPermanent[], hand: SimCard[], opponents: number): number {
  const entry = landWillEnterTapped(card, lands, hand, opponents);
  const coverage = card.producedMana.filter((color) => colorsNeeded.includes(color)).length;
  const fetchBonus = card.fetch.isFetch ? 3 : 0;
  return (entry.tapped ? 0 : 8) + coverage * 4 + fetchBonus + card.sourceOutput - (card.isModalLand ? 2 : 0);
}

function chooseLandIndex(hand: SimCard[], colorsNeeded: string[], lands: LandPermanent[], opponents: number): number {
  return hand
    .map((card, index) => ({ card, index, score: card.isLandOption ? landScore(card, colorsNeeded, lands, hand, opponents) : -Infinity }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score)[0]?.index ?? -1;
}

function chooseFetchTarget(library: SimCard[], fetch: FetchSpec, colorsNeeded: string[], lands: LandPermanent[], hand: SimCard[], opponents: number): number {
  return library
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => fetchCanFind(fetch, card))
    .map(({ card, index }) => ({ card, index, score: landScore(card, colorsNeeded, lands, hand, opponents) }))
    .sort((a, b) => b.score - a.score)[0]?.index ?? -1;
}

function deployLand(
  land: SimCard,
  library: SimCard[],
  hand: SimCard[],
  lands: LandPermanent[],
  active: ManaSource[],
  delayed: ManaSource[],
  colorsNeeded: string[],
  opponents: number,
  nextSourceId: () => number,
): { shockLife: number; fetchActivated: boolean; fetchNoTarget: boolean; mode: string } {
  if (land.fetch.isFetch) {
    const targetIndex = chooseFetchTarget(library, land.fetch, colorsNeeded, lands, hand, opponents);
    if (targetIndex < 0) return { shockLife: 0, fetchActivated: true, fetchNoTarget: true, mode: 'fetch-no-target' };
    const target = library.splice(targetIndex, 1)[0] as SimCard;
    const entry = landWillEnterTapped(target, lands, hand, opponents);
    const forcedTapped = land.fetch.entersTappedFromSearch;
    lands.push({ name: target.name, types: target.landTypes });
    const source: ManaSource = {
      id: nextSourceId(),
      colors: target.producedMana,
      output: target.sourceOutput,
      restriction: target.manaRestriction,
    };
    if (forcedTapped || entry.tapped) delayed.push(source);
    else active.push(source);
    return { shockLife: forcedTapped ? 0 : entry.shockLife, fetchActivated: true, fetchNoTarget: false, mode: `fetch->${entry.mode}` };
  }

  const entry = landWillEnterTapped(land, lands, hand, opponents);
  lands.push({ name: land.name, types: land.landTypes });
  const source: ManaSource = {
    id: nextSourceId(),
    colors: land.producedMana,
    output: land.sourceOutput,
    restriction: land.manaRestriction,
  };
  if (entry.tapped) delayed.push(source);
  else active.push(source);
  return { shockLife: entry.shockLife, fetchActivated: false, fetchNoTarget: false, mode: entry.mode };
}

function drawCards(library: SimCard[], hand: SimCard[], count: number, seen: Set<string>): number {
  let drawn = 0;
  for (let index = 0; index < count; index += 1) {
    const card = library.shift();
    if (!card) break;
    hand.push(card);
    seen.add(card.name.toLocaleLowerCase());
    drawn += 1;
  }
  return drawn;
}

function moveTutorTarget(spec: TutorSpec, targetIndex: number, library: SimCard[], hand: SimCard[], seen: Set<string>): SimCard | null {
  const target = library.splice(targetIndex, 1)[0];
  if (!target) return null;
  if (spec.destination === 'hand') {
    hand.push(target);
    seen.add(target.name.toLocaleLowerCase());
  } else if (spec.destination === 'top') {
    library.unshift(target);
  } else if (spec.destination === 'battlefield' || spec.destination === 'graveyard') {
    seen.add(target.name.toLocaleLowerCase());
  }
  return target;
}

function chooseTutorTarget(
  tutor: TutorSpec,
  library: SimCard[],
  comboPieces: string[][],
  seen: Set<string>,
  landsInPlay: number,
): { index: number; requestedComboPiece: boolean } {
  const missingComboNames = new Set(
    comboPieces.flat().map((name) => name.toLocaleLowerCase()).filter((name) => !seen.has(name)),
  );
  const candidates = library
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => tutorCanFind(tutor, card));
  const combo = candidates.find(({ card }) => missingComboNames.has(card.name.toLocaleLowerCase()));
  if (combo) return { index: combo.index, requestedComboPiece: true };
  if (landsInPlay < 3) {
    const land = candidates.find(({ card }) => card.isLandOption);
    if (land) return { index: land.index, requestedComboPiece: false };
  }
  const scored = candidates
    .map(({ card, index }) => {
      let score = 0;
      if (card.draw.recurringPerTurn > 0) score += 12;
      if (card.draw.immediate > 0) score += 10;
      if (card.isRamp) score += 8;
      if (card.isInteraction) score += 7;
      if (card.isProtection) score += 6;
      score += Math.max(0, 6 - card.cmc);
      return { index, score };
    })
    .sort((a, b) => b.score - a.score)[0];
  return { index: scored?.index ?? -1, requestedComboPiece: false };
}

function comboAssembled(pieces: string[], seen: Set<string>): boolean {
  return pieces.every((piece) => seen.has(piece.toLocaleLowerCase()));
}

function runIteration(
  librarySource: SimCard[],
  commanders: CommanderProfile[],
  options: { turns: number; maxMulligans: number; comboPieces: string[][]; opponents: number },
  random: SeededRandom,
): IterationResult {
  let mulligans = 0;
  let shuffled = shuffle(librarySource, random);
  let opening = shuffled.slice(0, 7);
  while (!shouldKeep(opening) && mulligans < options.maxMulligans) {
    mulligans += 1;
    shuffled = shuffle(librarySource, random);
    opening = shuffled.slice(0, 7);
  }
  const { kept, bottomed } = londonBottom(opening, mulligans);
  const hand = [...kept];
  const library = [...shuffled.slice(7), ...bottomed];
  const openingLandOptions = hand.filter((card) => card.isLandOption).length;
  const functionalOpening = shouldKeep(hand);
  const seen = new Set(hand.map((card) => card.name.toLocaleLowerCase()));
  const colorsNeeded = wantedColors(commanders);

  const lands: LandPermanent[] = [];
  const activeSources: ManaSource[] = [];
  let delayedSources: ManaSource[] = [];
  const reducers: CostReducer[] = [];
  let recurringDraw = 0;
  let sourceId = 1;
  const nextSourceId = (): number => sourceId++;

  const spendableManaByTurn: number[] = [];
  const landsByTurn: number[] = [];
  const colorCoverageByTurn: number[] = [];
  const cardsSeenByTurn: number[] = [];
  const commanderCastTurns = commanders.map(() => null as number | null);
  const commanderTaxOneCastTurns = commanders.map(() => null as number | null);
  const commanderTaxTwoCastTurns = commanders.map(() => null as number | null);
  const naturalComboTurns = options.comboPieces.map(() => null as number | null);
  const tutorAssistedComboTurns = options.comboPieces.map(() => null as number | null);
  let interactionOnlineTurn: number | null = null;
  let drawEngineOnlineTurn: number | null = null;
  let tutorsCast = 0;
  let tutorsFoundRequestedComboPiece = 0;
  let immediateCardsDrawn = 0;
  let recurringCardsDrawn = 0;
  let shockLifePaid = 0;
  let fetchesActivated = 0;
  let fetchesWithNoTarget = 0;
  let restrictedManaSourcesDeployed = 0;
  let reducerSpellsDeployed = 0;
  const landModeCounts: Record<string, number> = {};
  const tutorInfluencedSeen = new Set<string>();

  for (let turn = 1; turn <= options.turns; turn += 1) {
    activeSources.push(...delayedSources);
    delayedSources = [];

    if (recurringDraw > 0) {
      const count = drawCards(library, hand, recurringDraw, seen);
      recurringCardsDrawn += count;
    }
    drawCards(library, hand, 1, seen);

    const landIndex = chooseLandIndex(hand, colorsNeeded, lands, options.opponents);
    if (landIndex >= 0) {
      const land = hand.splice(landIndex, 1)[0];
      if (land) {
        const deployed = deployLand(land, library, hand, lands, activeSources, delayedSources, colorsNeeded, options.opponents, nextSourceId);
        shockLifePaid += deployed.shockLife;
        fetchesActivated += deployed.fetchActivated ? 1 : 0;
        fetchesWithNoTarget += deployed.fetchNoTarget ? 1 : 0;
        landModeCounts[deployed.mode] = (landModeCounts[deployed.mode] ?? 0) + 1;
      }
    }

    let pool = manaUnits(activeSources);
    const interactionPool = [...pool];
    if (interactionOnlineTurn === null && hand.some((card) => card.isInteraction && spendFor(card, interactionPool, reducers) !== null)) {
      interactionOnlineTurn = turn;
    }

    const markCommanders = (): void => {
      commanders.forEach((commander, index) => {
        if (commanderCastTurns[index] === null && canPayCommander(commander, pool, reducers, 0)) commanderCastTurns[index] = turn;
        if (commanderTaxOneCastTurns[index] === null && canPayCommander(commander, pool, reducers, 2)) commanderTaxOneCastTurns[index] = turn;
        if (commanderTaxTwoCastTurns[index] === null && canPayCommander(commander, pool, reducers, 4)) commanderTaxTwoCastTurns[index] = turn;
      });
    };
    markCommanders();

    let actions = 0;
    while (actions < 12) {
      actions += 1;
      let acted = false;

      const tutorCandidates = hand
        .map((card, index) => ({ card, index }))
        .filter(({ card }) => card.tutor.isTutor && ['hand', 'top', 'battlefield', 'graveyard'].includes(card.tutor.destination))
        .sort((a, b) => a.card.cmc - b.card.cmc);
      for (const candidate of tutorCandidates) {
        const paid = spendFor(candidate.card, pool, reducers);
        if (!paid) continue;
        const target = chooseTutorTarget(candidate.card.tutor, library, options.comboPieces, seen, lands.length);
        if (target.index < 0) continue;
        pool = paid;
        hand.splice(hand.indexOf(candidate.card), 1);
        const moved = moveTutorTarget(candidate.card.tutor, target.index, library, hand, seen);
        tutorsCast += 1;
        if (moved && target.requestedComboPiece) {
          tutorsFoundRequestedComboPiece += 1;
          tutorInfluencedSeen.add(moved.name.toLocaleLowerCase());
        }
        acted = true;
        break;
      }
      if (acted) {
        markCommanders();
        continue;
      }

      const rampCandidates = hand
        .map((card) => card)
        .filter((card) => card.isRamp && !card.isLandOption)
        .sort((a, b) => a.cmc - b.cmc);
      for (const card of rampCandidates) {
        const paid = spendFor(card, pool, reducers);
        if (!paid) continue;
        pool = paid;
        hand.splice(hand.indexOf(card), 1);
        if (card.reducer) {
          reducers.push(card.reducer);
          reducerSpellsDeployed += 1;
        }
        if (card.roles.has('land ramp')) {
          const basicTutor: FetchSpec = { isFetch: true, basicOnly: /basic land/i.test(card.oracleText), anyLand: /\ba land card\b/i.test(card.oracleText), landTypes: Object.keys(BASIC_TYPES).filter((type) => new RegExp(`\\b${type}\\b`, 'i').test(card.oracleText)), entersTappedFromSearch: /onto the battlefield tapped/i.test(card.oracleText) };
          const targetIndex = chooseFetchTarget(library, basicTutor, colorsNeeded, lands, hand, options.opponents);
          if (targetIndex >= 0) {
            const target = library.splice(targetIndex, 1)[0] as SimCard;
            const entry = landWillEnterTapped(target, lands, hand, options.opponents);
            lands.push({ name: target.name, types: target.landTypes });
            const source: ManaSource = { id: nextSourceId(), colors: target.producedMana, output: target.sourceOutput, restriction: target.manaRestriction };
            if (basicTutor.entersTappedFromSearch || entry.tapped) delayedSources.push(source);
            else activeSources.push(source);
          }
        } else if (card.oneShotMana) {
          const source: ManaSource = { id: nextSourceId(), colors: card.producedMana, output: card.sourceOutput, restriction: card.manaRestriction };
          if (source.restriction.kind !== 'any') restrictedManaSourcesDeployed += 1;
          pool.push(...manaUnits([source]));
        } else if (card.isManaPermanent) {
          const source: ManaSource = { id: nextSourceId(), colors: card.producedMana, output: card.sourceOutput, restriction: card.manaRestriction };
          if (source.restriction.kind !== 'any') restrictedManaSourcesDeployed += 1;
          if (card.isManaCreature) delayedSources.push(source);
          else {
            activeSources.push(source);
            pool.push(...manaUnits([source]));
          }
        }
        acted = true;
        break;
      }
      if (acted) {
        markCommanders();
        continue;
      }

      const drawCandidates = hand
        .filter((card) => !card.isInteraction && (card.draw.immediate > 0 || card.draw.recurringPerTurn > 0))
        .sort((a, b) => a.cmc - b.cmc);
      for (const card of drawCandidates) {
        const paid = spendFor(card, pool, reducers);
        if (!paid) continue;
        pool = paid;
        hand.splice(hand.indexOf(card), 1);
        if (card.draw.immediate > 0) immediateCardsDrawn += drawCards(library, hand, card.draw.immediate, seen);
        if (card.draw.recurringPerTurn > 0) {
          recurringDraw += card.draw.recurringPerTurn;
          if (drawEngineOnlineTurn === null) drawEngineOnlineTurn = turn;
        }
        acted = true;
        break;
      }
      if (!acted) break;
      markCommanders();
    }

    spendableManaByTurn.push(pool.length);
    landsByTurn.push(lands.length);
    const colorCoverage = new Set(activeSources.flatMap((source) => source.colors).filter((color) => COLORS.includes(color as (typeof COLORS)[number])));
    colorCoverageByTurn.push(colorCoverage.size);
    cardsSeenByTurn.push(seen.size);

    options.comboPieces.forEach((pieces, index) => {
      if (naturalComboTurns[index] === null && comboAssembled(pieces, seen) && !pieces.some((piece) => tutorInfluencedSeen.has(piece.toLocaleLowerCase()))) {
        naturalComboTurns[index] = turn;
      }
      if (tutorAssistedComboTurns[index] === null && comboAssembled(pieces, seen)) tutorAssistedComboTurns[index] = turn;
    });
  }

  return {
    mulligans,
    openingLandOptions,
    functionalOpening,
    spendableManaByTurn,
    landsByTurn,
    colorCoverageByTurn,
    cardsSeenByTurn,
    commanderCastTurns,
    commanderTaxOneCastTurns,
    commanderTaxTwoCastTurns,
    interactionOnlineTurn,
    drawEngineOnlineTurn,
    naturalComboTurns,
    tutorAssistedComboTurns,
    tutorsCast,
    tutorsFoundRequestedComboPiece,
    immediateCardsDrawn,
    recurringCardsDrawn,
    shockLifePaid,
    fetchesActivated,
    fetchesWithNoTarget,
    landModeCounts,
    restrictedManaSourcesDeployed,
    reducerSpellsDeployed,
  };
}

const percentage = (count: number, total: number): number => total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;

function cumulativeTurnPercent(results: IterationResult[], getter: (result: IterationResult) => number | null, turns: number): Record<string, number> {
  return Object.fromEntries(Array.from({ length: turns }, (_, index) => {
    const turn = index + 1;
    return [`turn${turn}`, percentage(results.filter((result) => {
      const value = getter(result);
      return value !== null && value <= turn;
    }).length, results.length)];
  }));
}

function averageByTurn(results: IterationResult[], getter: (result: IterationResult) => number[], turns: number): Record<string, number> {
  return Object.fromEntries(Array.from({ length: turns }, (_, index) => {
    const value = results.reduce((sum, result) => sum + (getter(result)[index] ?? 0), 0) / results.length;
    return [`turn${index + 1}`, Number(value.toFixed(2))];
  }));
}

function sumRecord(results: IterationResult[], getter: (result: IterationResult) => Record<string, number>): Record<string, number> {
  const output: Record<string, number> = {};
  for (const result of results) {
    for (const [key, value] of Object.entries(getter(result))) output[key] = (output[key] ?? 0) + value;
  }
  return Object.fromEntries(Object.entries(output).map(([key, value]) => [key, Number((value / results.length).toFixed(2))]));
}

export function simulateDeckConsistencyV04(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  rawOptions: DeckSimulationV04Options = {},
): Record<string, unknown> {
  const iterations = clampInt(rawOptions.iterations, 5_000, 100, 50_000);
  const turns = clampInt(rawOptions.turns, 8, 1, 15);
  const seed = clampInt(rawOptions.seed, 20_260_816, 1, 2_147_483_647);
  const maxMulligans = clampInt(rawOptions.maxMulligans, 2, 0, 4);
  const opponents = clampInt(rawOptions.opponents, 3, 0, 3);
  const comboPieces = (rawOptions.comboPieces ?? []).slice(0, 8).map((combo) => combo.slice(0, 6));
  const identity = commanderIdentity(parsed, cards);
  const library = expandLibrary(parsed, cards, identity);
  const commanders = commanderProfiles(parsed, cards);
  if (library.length < 40) throw new Error(`V0.4 simulation needs a mostly resolved library; only ${library.length} cards were available.`);

  const random = new SeededRandom(seed);
  const results: IterationResult[] = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    results.push(runIteration(library, commanders, { turns, maxMulligans, comboPieces, opponents }, random));
  }

  const commanderOutput = commanders.map((commander, index) => ({
    name: commander.name,
    manaCost: commander.manaCost,
    manaValue: commander.cmc,
    firstCastableByTurn: cumulativeTurnPercent(results, (result) => result.commanderCastTurns[index] ?? null, turns),
    castableWithOneCommanderTaxByTurn: cumulativeTurnPercent(results, (result) => result.commanderTaxOneCastTurns[index] ?? null, turns),
    castableWithTwoCommanderTaxesByTurn: cumulativeTurnPercent(results, (result) => result.commanderTaxTwoCastTurns[index] ?? null, turns),
  }));
  const combos = comboPieces.map((pieces, index) => ({
    pieces,
    naturalAssemblyByTurn: cumulativeTurnPercent(results, (result) => result.naturalComboTurns[index] ?? null, turns),
    tutorAssistedProxyByTurn: cumulativeTurnPercent(results, (result) => result.tutorAssistedComboTurns[index] ?? null, turns),
    note: 'Tutor-assisted assembly now requires a cast tutor to be able to legally find a missing piece; it is no longer “any tutor equals any missing card.”',
  }));

  const average = (getter: (result: IterationResult) => number): number => Number((results.reduce((sum, result) => sum + getter(result), 0) / results.length).toFixed(2));
  return {
    model: 'MTG Ultimate rules-aware Commander consistency model V0.4',
    iterations,
    seed,
    turns,
    opponents,
    libraryCardsResolved: library.length,
    commanderColorIdentity: identity,
    commanders: commanderOutput,
    openingHands: {
      functionalKeepRate: percentage(results.filter((result) => result.functionalOpening).length, results.length),
      mulliganAtLeastOnceRate: percentage(results.filter((result) => result.mulligans >= 1).length, results.length),
      averageOpeningLandOptions: average((result) => result.openingLandOptions),
    },
    development: {
      averageSpendableManaByTurn: averageByTurn(results, (result) => result.spendableManaByTurn, turns),
      averageLandsInPlayByTurn: averageByTurn(results, (result) => result.landsByTurn, turns),
      averageColoredCoverageByTurn: averageByTurn(results, (result) => result.colorCoverageByTurn, turns),
      averageUniqueCardsSeenByTurn: averageByTurn(results, (result) => result.cardsSeenByTurn, turns),
      averageShockLifePaid: average((result) => result.shockLifePaid),
      averageFetchesActivated: average((result) => result.fetchesActivated),
      averageFetchesWithNoLegalTarget: average((result) => result.fetchesWithNoTarget),
      averageLandEntryDecisions: sumRecord(results, (result) => result.landModeCounts),
      averageRestrictedManaSourcesDeployed: average((result) => result.restrictedManaSourcesDeployed),
      averageCostReducersDeployed: average((result) => result.reducerSpellsDeployed),
    },
    tutors: {
      averageTutorsCast: average((result) => result.tutorsCast),
      averageTutorsThatFoundRequestedComboPiece: average((result) => result.tutorsFoundRequestedComboPiece),
      targetingRule: 'Tutors parse common card/type/basic-land/mana-value restrictions and prioritize a legally findable missing requested combo piece; otherwise they choose a development/value target.',
    },
    cardAdvantage: {
      averageImmediateCardsDrawnByEffects: average((result) => result.immediateCardsDrawn),
      averageRecurringCardsDrawnByEngines: average((result) => result.recurringCardsDrawn),
      recurringDrawEngineOnlineByTurn: cumulativeTurnPercent(results, (result) => result.drawEngineOnlineTurn, turns),
    },
    interaction: {
      affordableInteractionSeenByTurn: cumulativeTurnPercent(results, (result) => result.interactionOnlineTurn, turns),
      note: 'Interaction availability checks actual colored/restricted mana before proactive main-phase development spending; full priority/stack choices remain the pressure/stack stage.',
    },
    combos,
    rulesAwareSequencing: [
      'Common shock/check/fast/slow/reveal/multiplayer/tapped-land conditions are evaluated against simulated board/hand state.',
      'Fetch lands search the simulated remaining library and can only find legal targets actually present there.',
      'Commander-identity mana sources use the resolved commander color identity.',
      'Common “spend this mana only to…” restrictions are enforced for commander, creature, artifact, and instant/sorcery casting payments.',
      'Common generic cost reducers are deployed and applied to matching spells/commander tax.',
      'Common tutors are cast, select legal targets, remove those cards from the simulated library, and move them to the parsed destination.',
      'One-shot draw spells add actual extra cards from the simulated library; simple upkeep/end-step/attack/combat-damage draw engines add recurring card flow after deployment.',
    ],
    caveats: [
      'This is still a simulation model rather than a complete Magic rules engine.',
      'Shock lands choose tempo and pay 2 life when played; life-total strategy beyond tracking that payment is not yet optimized.',
      'Conditional land patterns outside common shock/check/fast/slow/reveal/multiplayer templates conservatively enter tapped.',
      'Complex tutors, hidden-information choices, multi-card piles, replacement effects, and zone-specific combo requirements can require deeper card-specific logic.',
      'Recurring attack/combat-damage draw is treated as one card per subsequent turn once the engine is deployed; blockers, summoning sickness, and failed attacks are not fully simulated.',
      'Phyrexian mana, delve, convoke, improvise, affinity, alternate/free costs, treasures created conditionally, and unusual mana restrictions still need dedicated parsers.',
      'Opponent stack decisions, removal targets, and politics are handled only through the separate explicit pod-pressure layer, not invented here.',
    ],
  };
}
