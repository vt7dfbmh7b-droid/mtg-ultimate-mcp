import type { ScryfallCard } from '../types/scryfall.js';
import { analyzeCastingProfileV05 } from './casting-v05.js';
import { analyzeCommanderDependencyV05 } from './combat-v05.js';
import type { ParsedDeck } from './deck.js';
import { resolveEntryCard } from './deck.js';
import { evaluateCastabilityV05, type ManaPoolV05, type PaymentLineV05 } from './payment-v05.js';
import { getCardOracleText, inferCardRoles } from './scryfall.js';
import { parseDrawProfile, simulateDeckConsistencyV04, type DeckSimulationV04Options } from './simulation-v04.js';

export type PodPressureV06 = 'goldfish' | 'casual' | 'upgraded' | 'optimized' | 'cedh';

export interface DeckSimulationV06Options extends DeckSimulationV04Options {
  advancedIterations?: number;
  pressure?: PodPressureV06;
}

interface PressureProfile {
  keySpellChallenge: number;
  commanderRemoval: number;
  boardWipe: number;
}

const PRESSURE: Record<PodPressureV06, PressureProfile> = {
  goldfish: { keySpellChallenge: 0, commanderRemoval: 0, boardWipe: 0 },
  casual: { keySpellChallenge: 0.06, commanderRemoval: 0.05, boardWipe: 0.025 },
  upgraded: { keySpellChallenge: 0.14, commanderRemoval: 0.12, boardWipe: 0.05 },
  optimized: { keySpellChallenge: 0.23, commanderRemoval: 0.20, boardWipe: 0.07 },
  cedh: { keySpellChallenge: 0.34, commanderRemoval: 0.27, boardWipe: 0.045 },
};

interface ManaSource {
  colors: string[];
  output: number;
}

interface SimCard {
  uid: number;
  card: ScryfallCard;
  roles: Set<string>;
  casting: ReturnType<typeof analyzeCastingProfileV05>;
  draw: ReturnType<typeof parseDrawProfile>;
  isLand: boolean;
  isPermanent: boolean;
  isCreature: boolean;
  isArtifact: boolean;
  isManaPermanent: boolean;
  isManaCreature: boolean;
  isOneShotMana: boolean;
  isProtection: boolean;
  isInteraction: boolean;
  commanderDependent: boolean;
  colors: string[];
  manaOutput: number;
}

interface CommanderState {
  card: SimCard;
  online: boolean;
  timesCast: number;
}

interface Resources {
  mana: ManaPoolV05;
  treasures: number;
  graveyardCards: number;
  life: number;
  convokeUsed: number;
  improviseUsed: number;
}

interface IterationResult {
  treasuresCreated: number;
  treasuresSpent: number;
  firstTreasureSpendTurn: number | null;
  advancedCasts: number;
  alternativeCostCasts: number;
  mechanicUses: Record<string, number>;
  phyrexianLifePaid: number;
  delvedCards: number;
  cardsDrawnByEffects: number;
  commanderOnlineTurns: number;
  commanderCasts: number;
  commanderRemovals: number;
  commanderStoppedOnStack: number;
  keySpellChallenges: number;
  keySpellStops: number;
  protectionAttempts: number;
  protectionWins: number;
  boardWipes: number;
  spellsCast: number;
  commanderDependentPermanentsCast: number;
  comboReadyTurns: Array<number | null>;
  comboSeenTurns: Array<number | null>;
  treasuresByTurn: number[];
  lifeByTurn: number[];
}

const COLORS = ['W', 'U', 'B', 'R', 'G'] as const;
const BASIC_COLORS: Array<[RegExp, string]> = [
  [/\bPlains\b/i, 'W'],
  [/\bIsland\b/i, 'U'],
  [/\bSwamp\b/i, 'B'],
  [/\bMountain\b/i, 'R'],
  [/\bForest\b/i, 'G'],
];

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

function hasLandFace(card: ScryfallCard): boolean {
  return /\bland\b/i.test(card.type_line)
    || (card.card_faces ?? []).some((face) => /\bland\b/i.test(face.type_line ?? ''));
}

function isPermanent(card: ScryfallCard): boolean {
  return /\b(creature|artifact|enchantment|planeswalker|battle)\b/i.test(card.type_line);
}

function cardColors(card: ScryfallCard, commanderIdentity: string[]): string[] {
  const text = getCardOracleText(card);
  if (/any color in your commander['’]s color identity/i.test(text)) return [...commanderIdentity];
  const produced = (card.produced_mana ?? []).map((color) => color.toUpperCase()).filter(Boolean);
  if (produced.length > 0) return [...new Set(produced)];
  const fromType = BASIC_COLORS.filter(([pattern]) => pattern.test(card.type_line)).map(([, color]) => color);
  return fromType.length > 0 ? fromType : ['C'];
}

function manaOutput(card: ScryfallCard): number {
  const text = getCardOracleText(card);
  const symbols = text.match(/add\s+((?:\{[WUBRGC]\}){2,6})/i)?.[1]?.match(/\{[WUBRGC]\}/gi) ?? [];
  if (symbols.length > 1) return symbols.length;
  const word = text.match(/add (two|three|four|five) mana/i)?.[1]?.toLowerCase();
  if (word === 'two') return 2;
  if (word === 'three') return 3;
  if (word === 'four') return 4;
  if (word === 'five') return 5;
  return 1;
}

function commanderIdentity(parsed: ParsedDeck, cards: ScryfallCard[]): string[] {
  return [...new Set(
    parsed.commanders
      .map((entry) => resolveEntryCard(entry, cards))
      .filter((card): card is ScryfallCard => Boolean(card))
      .flatMap((card) => card.color_identity),
  )].sort();
}

function toSimCard(card: ScryfallCard, uid: number, identity: string[]): SimCard {
  const type = card.type_line.toLowerCase();
  const text = getCardOracleText(card);
  const roles = new Set(inferCardRoles(card));
  const permanent = isPermanent(card);
  const creature = type.includes('creature');
  const artifact = type.includes('artifact');
  const producesMana = /\badd\b.*(?:mana|\{[WUBRGC]\})|\{T\}:\s*Add/i.test(text);
  const manaPermanent = permanent && producesMana && (creature || artifact);
  return {
    uid,
    card,
    roles,
    casting: analyzeCastingProfileV05(card),
    draw: parseDrawProfile(card),
    isLand: hasLandFace(card),
    isPermanent: permanent,
    isCreature: creature,
    isArtifact: artifact,
    isManaPermanent: manaPermanent,
    isManaCreature: manaPermanent && creature,
    isOneShotMana: !permanent && producesMana,
    isProtection: roles.has('protection') || roles.has('board protection') || roles.has('countermagic') || roles.has('free interaction'),
    isInteraction: roles.has('spot interaction') || roles.has('countermagic') || roles.has('board wipe') || roles.has('free interaction'),
    commanderDependent: analyzeCommanderDependencyV05(card).dependsOnCommander,
    colors: cardColors(card, identity),
    manaOutput: manaOutput(card),
  };
}

function expandLibrary(parsed: ParsedDeck, cards: ScryfallCard[], identity: string[]): SimCard[] {
  const result: SimCard[] = [];
  let uid = 1;
  for (const entry of parsed.main) {
    const card = resolveEntryCard(entry, cards);
    if (!card) continue;
    for (let copy = 0; copy < entry.quantity; copy += 1) result.push(toSimCard(card, uid++, identity));
  }
  return result;
}

function commandersFor(parsed: ParsedDeck, cards: ScryfallCard[], identity: string[]): CommanderState[] {
  let uid = -1;
  return parsed.commanders
    .map((entry) => resolveEntryCard(entry, cards))
    .filter((card): card is ScryfallCard => Boolean(card))
    .map((card) => ({ card: toSimCard(card, uid--, identity), online: false, timesCast: 0 }));
}

function draw(library: SimCard[], hand: SimCard[], count: number): number {
  let drawn = 0;
  while (drawn < count && library.length > 0) {
    const next = library.shift();
    if (!next) break;
    hand.push(next);
    drawn += 1;
  }
  return drawn;
}

function addMana(pool: ManaPoolV05, source: ManaSource): void {
  for (let unit = 0; unit < Math.max(1, source.output); unit += 1) {
    const colors = source.colors.filter((color) => COLORS.includes(color as (typeof COLORS)[number]) || color === 'C');
    if (colors.length > 1) pool.any = (pool.any ?? 0) + 1;
    else if (colors[0] === 'W') pool.W = (pool.W ?? 0) + 1;
    else if (colors[0] === 'U') pool.U = (pool.U ?? 0) + 1;
    else if (colors[0] === 'B') pool.B = (pool.B ?? 0) + 1;
    else if (colors[0] === 'R') pool.R = (pool.R ?? 0) + 1;
    else if (colors[0] === 'G') pool.G = (pool.G ?? 0) + 1;
    else pool.C = (pool.C ?? 0) + 1;
  }
}

function freshManaPool(sources: ManaSource[]): ManaPoolV05 {
  const pool: ManaPoolV05 = {};
  for (const source of sources) addMana(pool, source);
  return pool;
}

function subtractMana(pool: ManaPoolV05, used: Record<string, number>): void {
  const keys: Array<keyof ManaPoolV05> = ['W', 'U', 'B', 'R', 'G', 'C', 'any'];
  for (const key of keys) {
    pool[key] = Math.max(0, (pool[key] ?? 0) - (used[key] ?? 0));
  }
}

function escapeExileCost(card: ScryfallCard): number | null {
  const raw = getCardOracleText(card).match(
    /Escape[—–-][^\n]*?Exile\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+other cards?/i,
  )?.[1];
  if (!raw) return null;
  const direct = Number.parseInt(raw, 10);
  if (Number.isFinite(direct)) return direct;
  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };
  return words[raw.toLowerCase()] ?? null;
}

function affinityCount(card: SimCard, battlefield: SimCard[], treasures: number): number {
  if (!card.casting.paymentMechanics.includes('affinity')) return 0;
  if (!card.casting.affinityFor.some((subject) => /artifact/i.test(subject))) return 0;
  return battlefield.filter((permanent) => permanent.isArtifact).length + treasures;
}

function convokeOptions(battlefield: SimCard[], alreadyUsed: number): Array<{ colors: string[] }> {
  return battlefield
    .filter((card) => card.isCreature && !card.isManaCreature)
    .slice(alreadyUsed)
    .map((card) => ({ colors: card.card.colors ?? card.card.color_identity }));
}

function improviseOptions(battlefield: SimCard[], alreadyUsed: number): number {
  return Math.max(0, battlefield.filter((card) => card.isArtifact && !card.isManaPermanent).length - alreadyUsed);
}

function allowedAlternative(card: SimCard, line: PaymentLineV05, graveyardCards: number): boolean {
  if (line.mode === 'normal') return true;
  if (['evoke', 'blitz', 'overload', 'prototype', 'sneak'].includes(line.mode)) return true;
  if (line.mode === 'escape') {
    const required = escapeExileCost(card.card);
    return required !== null && graveyardCards >= required;
  }
  return false;
}

function choosePayment(card: SimCard, resources: Resources, battlefield: SimCard[], commanderTax = 0, isCommander = false): PaymentLineV05 | null {
  const report = evaluateCastabilityV05(card.card, {
    mana: resources.mana,
    treasures: resources.treasures,
    untappedCreatures: convokeOptions(battlefield, resources.convokeUsed),
    untappedArtifacts: improviseOptions(battlefield, resources.improviseUsed),
    graveyardCards: resources.graveyardCards,
    affinityCount: affinityCount(card, battlefield, resources.treasures),
    life: resources.life,
    commanderTax,
    isCommander,
    alternativeResourceReady: true,
  });
  const legal = report.lines.filter((line) => line.castable && allowedAlternative(card, line, resources.graveyardCards));
  return legal.find((line) => line.mode === 'normal') ?? legal[0] ?? null;
}

function mechanicsFrom(line: PaymentLineV05): string[] {
  const result: string[] = [];
  if (line.used.convokeCreatures > 0) result.push('convoke');
  if (line.used.improviseArtifacts > 0) result.push('improvise');
  if (line.used.delvedCards > 0) result.push('delve');
  if (line.used.phyrexianLife > 0) result.push('phyrexian-mana');
  if (line.reasons.some((reason) => /Affinity reduced/i.test(reason))) result.push('affinity');
  if (line.mode !== 'normal') result.push(`alternative:${line.mode}`);
  return result;
}

function pay(card: SimCard, line: PaymentLineV05, resources: Resources): { treasures: number; life: number; delve: number; mechanics: string[] } {
  subtractMana(resources.mana, line.used.mana);
  resources.treasures = Math.max(0, resources.treasures - line.used.treasures);
  resources.graveyardCards = Math.max(0, resources.graveyardCards - line.used.delvedCards);
  resources.life = Math.max(0, resources.life - line.used.phyrexianLife);
  resources.convokeUsed += line.used.convokeCreatures;
  resources.improviseUsed += line.used.improviseArtifacts;
  if (line.mode === 'escape') {
    resources.graveyardCards = Math.max(0, resources.graveyardCards - (escapeExileCost(card.card) ?? 0));
  }
  return {
    treasures: line.used.treasures,
    life: line.used.phyrexianLife,
    delve: line.used.delvedCards,
    mechanics: mechanicsFrom(line),
  };
}

function entersTapped(card: SimCard): boolean {
  return /enters (?:the battlefield )?tapped/i.test(getCardOracleText(card.card));
}

function treasureOnResolve(card: SimCard): number {
  const profile = card.casting.treasure;
  let amount = profile.immediateTreasure;
  if (profile.recurring && /enters(?: the battlefield)?/i.test(profile.trigger ?? '')) {
    amount += Math.max(1, profile.recurringTreasurePerTrigger);
  }
  return amount;
}

function treasurePerTurn(card: SimCard): number {
  const profile = card.casting.treasure;
  if (!profile.recurring || !profile.trigger || /enters(?: the battlefield)?/i.test(profile.trigger)) return 0;
  return /upkeep|end step|whenever you attack|combat damage|whenever .*cast/i.test(profile.trigger)
    ? Math.max(1, profile.recurringTreasurePerTrigger)
    : 0;
}

function isComboPiece(card: SimCard, combos: string[][]): boolean {
  const name = card.card.name.toLocaleLowerCase();
  return combos.some((combo) => combo.some((piece) => piece.toLocaleLowerCase() === name));
}

function priority(card: SimCard, combos: string[][]): number {
  let score = 0;
  if (card.roles.has('mana acceleration') || card.roles.has('land ramp') || card.isManaPermanent || card.isOneShotMana) score += 90;
  if (card.casting.treasure.createsTreasure) score += 78;
  if (card.roles.has('card draw') || card.roles.has('repeatable draw') || card.draw.immediate > 0 || card.draw.recurringPerTurn > 0) score += 65;
  if (isComboPiece(card, combos)) score += 55;
  if (card.commanderDependent) score += 35;
  if (card.isPermanent) score += 20;
  if (card.isInteraction || card.isProtection) score -= 30;
  return score - card.card.cmc * 2;
}

const percentage = (count: number, total: number): number => total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
const average = (values: number[]): number => values.length > 0
  ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
  : 0;

function cumulative(results: IterationResult[], getter: (result: IterationResult) => number | null, turns: number): Record<string, number> {
  return Object.fromEntries(Array.from({ length: turns }, (_, index) => {
    const turn = index + 1;
    return [`turn${turn}`, percentage(results.filter((result) => {
      const value = getter(result);
      return value !== null && value <= turn;
    }).length, results.length)];
  }));
}

function averageByTurn(results: IterationResult[], getter: (result: IterationResult) => number[], turns: number): Record<string, number> {
  return Object.fromEntries(Array.from({ length: turns }, (_, index) => [
    `turn${index + 1}`,
    Number((results.reduce((sum, result) => sum + (getter(result)[index] ?? 0), 0) / results.length).toFixed(2)),
  ]));
}

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

function runIteration(
  baseLibrary: SimCard[],
  commanderTemplate: CommanderState[],
  turns: number,
  combos: string[][],
  pressure: PressureProfile,
  random: SeededRandom,
): IterationResult {
  const library = shuffle(baseLibrary, random);
  const hand: SimCard[] = [];
  draw(library, hand, 7);
  const battlefield: SimCard[] = [];
  const graveyardNames = new Set<string>();
  const commanders = commanderTemplate.map((commander) => ({ ...commander }));
  const activeSources: ManaSource[] = [];
  let delayedSources: ManaSource[] = [];
  const comboReadyTurns = combos.map(() => null as number | null);
  const comboSeenTurns = combos.map(() => null as number | null);
  const treasuresByTurn: number[] = [];
  const lifeByTurn: number[] = [];
  const mechanicUses: Record<string, number> = {};
  const resources: Resources = {
    mana: {}, treasures: 0, graveyardCards: 0, life: 40, convokeUsed: 0, improviseUsed: 0,
  };

  let treasuresCreated = 0;
  let treasuresSpent = 0;
  let firstTreasureSpendTurn: number | null = null;
  let advancedCasts = 0;
  let alternativeCostCasts = 0;
  let phyrexianLifePaid = 0;
  let delvedCards = 0;
  let cardsDrawnByEffects = 0;
  let commanderOnlineTurns = 0;
  let commanderCasts = 0;
  let commanderRemovals = 0;
  let commanderStoppedOnStack = 0;
  let keySpellChallenges = 0;
  let keySpellStops = 0;
  let protectionAttempts = 0;
  let protectionWins = 0;
  let boardWipes = 0;
  let spellsCast = 0;
  let commanderDependentPermanentsCast = 0;

  const recordPayment = (result: ReturnType<typeof pay>, turn: number): void => {
    treasuresSpent += result.treasures;
    phyrexianLifePaid += result.life;
    delvedCards += result.delve;
    if (result.treasures > 0 && firstTreasureSpendTurn === null) firstTreasureSpendTurn = turn;
    for (const mechanic of result.mechanics) increment(mechanicUses, mechanic);
    if (result.mechanics.length > 0) advancedCasts += 1;
  };

  const castProtection = (turn: number): boolean => {
    const options = hand.filter((card) => card.isProtection && !card.isLand).sort((a, b) => a.card.cmc - b.card.cmc);
    for (const card of options) {
      const line = choosePayment(card, resources, battlefield);
      if (!line) continue;
      protectionAttempts += 1;
      recordPayment(pay(card, line, resources), turn);
      hand.splice(hand.indexOf(card), 1);
      resources.graveyardCards += 1;
      graveyardNames.add(card.card.name.toLocaleLowerCase());
      spellsCast += 1;
      protectionWins += 1;
      return true;
    }
    return false;
  };

  const resolveCard = (card: SimCard, line: PaymentLineV05): void => {
    const treasureGain = treasureOnResolve(card);
    resources.treasures += treasureGain;
    treasuresCreated += treasureGain;

    const oracle = getCardOracleText(card.card);
    if (card.draw.immediate > 0 && !/at the beginning/i.test(oracle)) {
      cardsDrawnByEffects += draw(library, hand, card.draw.immediate);
    }

    if (card.roles.has('land ramp')) {
      const landIndex = library.findIndex((candidate) => candidate.isLand);
      if (landIndex >= 0) {
        const land = library.splice(landIndex, 1)[0];
        if (land) delayedSources.push({ colors: land.colors, output: Math.max(1, land.manaOutput) });
      }
    }

    if (card.isOneShotMana) {
      addMana(resources.mana, { colors: card.colors, output: Math.max(1, card.manaOutput) });
    }

    if (card.isPermanent && line.mode !== 'evoke') {
      battlefield.push(card);
      if (card.commanderDependent) commanderDependentPermanentsCast += 1;
      if (card.isManaPermanent) {
        const source = { colors: card.colors, output: Math.max(1, card.manaOutput) };
        if (card.isManaCreature || entersTapped(card)) delayedSources.push(source);
        else {
          activeSources.push(source);
          addMana(resources.mana, source);
        }
      }
    } else {
      resources.graveyardCards += 1;
      graveyardNames.add(card.card.name.toLocaleLowerCase());
    }
  };

  const castCard = (card: SimCard, turn: number, keySpell: boolean): boolean => {
    const line = choosePayment(card, resources, battlefield);
    if (!line) return false;

    hand.splice(hand.indexOf(card), 1);
    recordPayment(pay(card, line, resources), turn);
    if (line.mode !== 'normal') alternativeCostCasts += 1;
    spellsCast += 1;

    if (keySpell && random.next() < pressure.keySpellChallenge) {
      keySpellChallenges += 1;
      if (!castProtection(turn)) {
        keySpellStops += 1;
        resources.graveyardCards += 1;
        graveyardNames.add(card.card.name.toLocaleLowerCase());
        return true;
      }
    }

    resolveCard(card, line);
    return true;
  };

  for (let turn = 1; turn <= turns; turn += 1) {
    activeSources.push(...delayedSources);
    delayedSources = [];
    resources.mana = freshManaPool(activeSources);
    resources.convokeUsed = 0;
    resources.improviseUsed = 0;

    const recurringTreasureGain: number = battlefield.reduce(
      (sum: number, card: SimCard): number => sum + treasurePerTurn(card),
      0,
    );
    resources.treasures += recurringTreasureGain;
    treasuresCreated += recurringTreasureGain;

    const recurringDraw = battlefield.reduce((sum, card) => sum + card.draw.recurringPerTurn, 0);
    if (recurringDraw > 0) cardsDrawnByEffects += draw(library, hand, recurringDraw);
    draw(library, hand, 1);

    const landIndex = hand.findIndex((card) => card.isLand);
    if (landIndex >= 0) {
      const land = hand.splice(landIndex, 1)[0];
      if (land) {
        const source = { colors: land.colors, output: Math.max(1, land.manaOutput) };
        if (entersTapped(land)) delayedSources.push(source);
        else {
          activeSources.push(source);
          addMana(resources.mana, source);
        }
      }
    }

    const earlySetup = hand
      .filter((card) => !card.isLand && !card.isInteraction && !card.isProtection)
      .sort((a, b) => priority(b, combos) - priority(a, combos))
      .find((card) => priority(card, combos) >= 65);
    if (earlySetup) castCard(earlySetup, turn, isComboPiece(earlySetup, combos));

    for (const commander of commanders) {
      if (commander.online) continue;
      const line = choosePayment(commander.card, resources, battlefield, commander.timesCast * 2, true);
      if (!line) continue;

      commander.timesCast += 1;
      commanderCasts += 1;
      recordPayment(pay(commander.card, line, resources), turn);
      if (line.mode !== 'normal') alternativeCostCasts += 1;
      spellsCast += 1;

      if (random.next() < pressure.keySpellChallenge) {
        keySpellChallenges += 1;
        if (!castProtection(turn)) {
          commanderStoppedOnStack += 1;
          keySpellStops += 1;
          continue;
        }
      }

      commander.online = true;
      battlefield.push(commander.card);
    }

    let actionCount = 0;
    while (actionCount < 6) {
      actionCount += 1;
      const candidates = hand
        .filter((card) => !card.isLand && !card.isInteraction && !card.isProtection)
        .sort((a, b) => priority(b, combos) - priority(a, combos));
      let acted = false;
      for (const card of candidates) {
        if (castCard(card, turn, isComboPiece(card, combos))) {
          acted = true;
          break;
        }
      }
      if (!acted) break;
    }

    for (const commander of commanders) {
      if (!commander.online) continue;
      commanderOnlineTurns += 1;
      if (random.next() < pressure.commanderRemoval && !castProtection(turn)) {
        commander.online = false;
        commanderRemovals += 1;
        const index = battlefield.findIndex((card) => card.uid === commander.card.uid);
        if (index >= 0) battlefield.splice(index, 1);
      }
    }

    if (battlefield.filter((card) => card.isCreature).length >= 2 && random.next() < pressure.boardWipe) {
      boardWipes += 1;
      if (!castProtection(turn)) {
        for (let index = battlefield.length - 1; index >= 0; index -= 1) {
          const card = battlefield[index];
          if (!card?.isCreature) continue;
          const commander = commanders.find((state) => state.card.uid === card.uid);
          if (commander) commander.online = false;
          else {
            resources.graveyardCards += 1;
            graveyardNames.add(card.card.name.toLocaleLowerCase());
          }
          battlefield.splice(index, 1);
        }
      }
    }

    const seen = new Set([
      ...hand.map((card) => card.card.name.toLocaleLowerCase()),
      ...battlefield.map((card) => card.card.name.toLocaleLowerCase()),
      ...graveyardNames,
    ]);
    const available = new Set([...hand, ...battlefield].map((card) => card.card.name.toLocaleLowerCase()));
    combos.forEach((combo, index) => {
      if (comboSeenTurns[index] === null && combo.every((piece) => seen.has(piece.toLocaleLowerCase()))) comboSeenTurns[index] = turn;
      if (comboReadyTurns[index] === null && combo.every((piece) => available.has(piece.toLocaleLowerCase()))) comboReadyTurns[index] = turn;
    });

    treasuresByTurn.push(resources.treasures);
    lifeByTurn.push(resources.life);
  }

  return {
    treasuresCreated,
    treasuresSpent,
    firstTreasureSpendTurn,
    advancedCasts,
    alternativeCostCasts,
    mechanicUses,
    phyrexianLifePaid,
    delvedCards,
    cardsDrawnByEffects,
    commanderOnlineTurns,
    commanderCasts,
    commanderRemovals,
    commanderStoppedOnStack,
    keySpellChallenges,
    keySpellStops,
    protectionAttempts,
    protectionWins,
    boardWipes,
    spellsCast,
    commanderDependentPermanentsCast,
    comboReadyTurns,
    comboSeenTurns,
    treasuresByTurn,
    lifeByTurn,
  };
}

function aggregateMechanics(results: IterationResult[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const result of results) {
    for (const [mechanic, count] of Object.entries(result.mechanicUses)) {
      totals[mechanic] = (totals[mechanic] ?? 0) + count;
    }
  }
  return Object.fromEntries(
    Object.entries(totals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, Number((value / results.length).toFixed(2))]),
  );
}

function simpleSummary(results: IterationResult[], turns: number, pressure: PodPressureV06, combos: string[][]): string[] {
  const output: string[] = [];
  const treasureGames = results.filter((result) => result.treasuresSpent > 0).length;
  if (treasureGames > 0) output.push(`Treasures were actually spent in ${percentage(treasureGames, results.length)}% of simulated games.`);

  const advancedGames = results.filter((result) => result.advancedCasts > 0).length;
  if (advancedGames > 0) output.push(`A special payment mechanic or alternative cost mattered in ${percentage(advancedGames, results.length)}% of games.`);

  const uptime = percentage(
    results.reduce((sum, result) => sum + result.commanderOnlineTurns, 0),
    results.length * turns,
  );
  output.push(`Under the ${pressure} pressure assumptions, the commander was on the battlefield for about ${uptime}% of simulated turns.`);

  const challenges = results.reduce((sum, result) => sum + result.keySpellChallenges, 0);
  const protectionWins = results.reduce((sum, result) => sum + result.protectionWins, 0);
  if (challenges > 0) output.push(`Protection answered ${percentage(protectionWins, challenges)}% of modeled challenges to key plays.`);

  if (combos.length > 0) {
    const ready = results.filter((result) => result.comboReadyTurns.some((turn) => turn !== null)).length;
    output.push(`At least one requested combo had all named pieces in hand/battlefield by turn ${turns} in ${percentage(ready, results.length)}% of games.`);
  }
  return output.slice(0, 5);
}

export function simulateAdvancedGameplayV06(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  rawOptions: DeckSimulationV06Options = {},
): Record<string, unknown> {
  const turns = clampInt(rawOptions.turns, 7, 1, 15);
  const iterations = clampInt(rawOptions.advancedIterations ?? rawOptions.iterations, 2_500, 100, 10_000);
  const seed = clampInt(rawOptions.seed, 20_260_816, 1, 2_147_483_647);
  const pressure = rawOptions.pressure ?? 'upgraded';
  const combos = (rawOptions.comboPieces ?? []).slice(0, 8).map((combo) => combo.slice(0, 6));
  const identity = commanderIdentity(parsed, cards);
  const library = expandLibrary(parsed, cards, identity);
  const commanders = commandersFor(parsed, cards, identity);
  if (library.length < 40) {
    throw new Error(`V0.6 advanced simulation needs a mostly resolved library; only ${library.length} cards were available.`);
  }

  const random = new SeededRandom(seed ^ 0x6a09e667);
  const results: IterationResult[] = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    results.push(runIteration(library, commanders, turns, combos, PRESSURE[pressure], random));
  }

  const challenges = results.reduce((sum, result) => sum + result.keySpellChallenges, 0);
  const protectionWins = results.reduce((sum, result) => sum + result.protectionWins, 0);

  return {
    model: 'MTG Ultimate advanced turn simulation V0.6',
    iterations,
    turns,
    seed,
    pressure,
    summary: simpleSummary(results, turns, pressure, combos),
    resources: {
      averageTreasuresCreated: average(results.map((result) => result.treasuresCreated)),
      averageTreasuresSpent: average(results.map((result) => result.treasuresSpent)),
      firstTreasureSpendByTurn: cumulative(results, (result) => result.firstTreasureSpendTurn, turns),
      averageTreasuresRemainingByTurn: averageByTurn(results, (result) => result.treasuresByTurn, turns),
      averagePhyrexianLifePaid: average(results.map((result) => result.phyrexianLifePaid)),
      averageCardsDelved: average(results.map((result) => result.delvedCards)),
      averageLifeByTurn: averageByTurn(results, (result) => result.lifeByTurn, turns),
    },
    advancedCasting: {
      averageAdvancedCasts: average(results.map((result) => result.advancedCasts)),
      averageAlternativeCostCasts: average(results.map((result) => result.alternativeCostCasts)),
      averageMechanicUses: aggregateMechanics(results),
    },
    commanderPressure: {
      battlefieldUptimePercent: percentage(
        results.reduce((sum, result) => sum + result.commanderOnlineTurns, 0),
        iterations * turns,
      ),
      averageCommanderCasts: average(results.map((result) => result.commanderCasts)),
      averageCommanderRemovals: average(results.map((result) => result.commanderRemovals)),
      averageCommanderSpellsStopped: average(results.map((result) => result.commanderStoppedOnStack)),
      averageCommanderDependentPermanentsCast: average(results.map((result) => result.commanderDependentPermanentsCast)),
    },
    interactionPressure: {
      averageKeySpellChallenges: average(results.map((result) => result.keySpellChallenges)),
      averageKeySpellStops: average(results.map((result) => result.keySpellStops)),
      averageProtectionAttempts: average(results.map((result) => result.protectionAttempts)),
      averageProtectionWins: average(results.map((result) => result.protectionWins)),
      protectionWinRateWhenChallenged: percentage(protectionWins, challenges),
      averageBoardWipes: average(results.map((result) => result.boardWipes)),
    },
    cardFlow: {
      averageCardsDrawnByEffects: average(results.map((result) => result.cardsDrawnByEffects)),
      averageSpellsCast: average(results.map((result) => result.spellsCast)),
    },
    combos: combos.map((pieces, index) => ({
      pieces,
      allNamedPiecesSeenByTurn: cumulative(results, (result) => result.comboSeenTurns[index] ?? null, turns),
      allNamedPiecesInHandOrBattlefieldByTurn: cumulative(results, (result) => result.comboReadyTurns[index] ?? null, turns),
      note: 'This is named-piece zone readiness, not proof that every target, timing, Spellbook prerequisite, or mana condition is satisfied.',
    })),
    assumptions: [
      `The ${pressure} profile is a transparent simulation assumption, not a measured win-rate claim.`,
      'Spell costs are paid before the model lets opponents challenge the spell; protection must then be affordable from the remaining resources.',
      'V0.6 uses the V0.5 payment solver for Treasures, convoke, improvise, delve, artifact-affinity, Phyrexian mana, commander tax, and supported named alternative costs.',
      'Mana creatures are not simultaneously counted for their mana and convoke, and mana rocks are not simultaneously counted for mana and improvise.',
      'Pitch-style alternate costs and “cast without paying” effects stay disabled unless their separate permission/resource can be proven.',
      'The advanced lane uses conservative land timing and simplified opponent choices; V0.4 remains the stronger source for detailed land/fetch/tutor sequencing.',
    ],
  };
}

export function simulateDeckGameplayV06(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  options: DeckSimulationV06Options = {},
): Record<string, unknown> {
  const baseline = simulateDeckConsistencyV04(parsed, cards, options) as Record<string, unknown>;
  const advanced = simulateAdvancedGameplayV06(parsed, cards, options) as Record<string, unknown>;
  return {
    model: 'MTG Ultimate hybrid Commander simulation V0.6',
    summary: advanced.summary,
    baseline: {
      openingHands: baseline.openingHands,
      development: baseline.development,
      commanders: baseline.commanders,
      tutors: baseline.tutors,
      cardAdvantage: baseline.cardAdvantage,
      interaction: baseline.interaction,
      combos: baseline.combos,
    },
    advanced,
    explanation: 'Use the baseline for land/fetch/tutor consistency and the advanced lane for special payment, Treasure, commander-pressure, and protection behavior.',
  };
}
