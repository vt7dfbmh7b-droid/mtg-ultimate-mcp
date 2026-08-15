import type { ScryfallCard } from '../types/scryfall.js';
import { analyzeCastingProfileV05 } from './casting-v05.js';
import { analyzeCommanderDependencyV05 } from './combat-v05.js';
import type { ParsedDeck } from './deck.js';
import { resolveEntryCard } from './deck.js';
import {
  evaluateCastabilityV05,
  type ManaPoolV05,
  type PaymentLineV05,
} from './payment-v05.js';
import {
  getCardOracleText,
  inferCardRoles,
} from './scryfall.js';
import {
  parseDrawProfile,
  simulateDeckConsistencyV04,
  type DeckSimulationV04Options,
} from './simulation-v04.js';

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

interface ManaSourceV06 {
  colors: string[];
  output: number;
}

interface SimCardV06 {
  uid: number;
  card: ScryfallCard;
  name: string;
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

interface CommanderStateV06 {
  card: SimCardV06;
  online: boolean;
  timesCast: number;
  firstResolvedTurn: number | null;
  removalCount: number;
  stoppedOnStackCount: number;
}

interface IterationResultV06 {
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
const BASIC_COLOR: Array<[RegExp, string]> = [
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

class SeededRandomV06 {
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

function shuffle<T>(items: T[], random: SeededRandomV06): T[] {
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
  if (/\bland\b/i.test(card.type_line)) return true;
  return (card.card_faces ?? []).some((face) => /\bland\b/i.test(face.type_line ?? ''));
}

function isPermanent(card: ScryfallCard): boolean {
  return /\b(creature|artifact|enchantment|planeswalker|battle)\b/i.test(card.type_line);
}

function cardColors(card: ScryfallCard, commanderIdentity: string[]): string[] {
  const text = getCardOracleText(card);
  if (/any color in your commander['’]s color identity/i.test(text)) return [...commanderIdentity];
  const explicit = (card.produced_mana ?? []).map((color) => color.toUpperCase()).filter(Boolean);
  if (explicit.length > 0) return [...new Set(explicit)];
  const inferred = BASIC_COLOR.filter(([pattern]) => pattern.test(card.type_line)).map(([, color]) => color);
  return inferred.length > 0 ? inferred : ['C'];
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

function toSimCard(card: ScryfallCard, uid: number, identity: string[]): SimCardV06 {
  const type = card.type_line.toLowerCase();
  const text = getCardOracleText(card);
  const roles = new Set(inferCardRoles(card));
  const sourceText = /\badd\b.*(?:mana|\{[WUBRGC]\})|\{T\}:\s*Add/i.test(text);
  const permanent = isPermanent(card);
  const creature = type.includes('creature');
  const artifact = type.includes('artifact');
  const manaPermanent = permanent && sourceText && (creature || artifact);
  return {
    uid,
    card,
    name: card.name,
    roles,
    casting: analyzeCastingProfileV05(card),
    draw: parseDrawProfile(card),
    isLand: hasLandFace(card),
    isPermanent: permanent,
    isCreature: creature,
    isArtifact: artifact,
    isManaPermanent: manaPermanent,
    isManaCreature: manaPermanent && creature,
    isOneShotMana: !permanent && sourceText,
    isProtection: roles.has('protection') || roles.has('board protection') || roles.has('countermagic') || roles.has('free interaction'),
    isInteraction: roles.has('spot interaction') || roles.has('countermagic') || roles.has('board wipe') || roles.has('free interaction'),
    commanderDependent: analyzeCommanderDependencyV05(card).dependsOnCommander,
    colors: cardColors(card, identity),
    manaOutput: manaOutput(card),
  };
}

function expandMainDeck(parsed: ParsedDeck, cards: ScryfallCard[], identity: string[]): SimCardV06[] {
  const output: SimCardV06[] = [];
  let uid = 1;
  for (const entry of parsed.main) {
    const card = resolveEntryCard(entry, cards);
    if (!card) continue;
    for (let copy = 0; copy < entry.quantity; copy += 1) output.push(toSimCard(card, uid++, identity));
  }
  return output;
}

function commanderStates(parsed: ParsedDeck, cards: ScryfallCard[], identity: string[]): CommanderStateV06[] {
  let uid = -1;
  return parsed.commanders
    .map((entry) => resolveEntryCard(entry, cards))
    .filter((card): card is ScryfallCard => Boolean(card))
    .map((card) => ({
      card: toSimCard(card, uid--, identity),
      online: false,
      timesCast: 0,
      firstResolvedTurn: null,
      removalCount: 0,
      stoppedOnStackCount: 0,
    }));
}

function drawCards(library: SimCardV06[], hand: SimCardV06[], count: number): number {
  let drawn = 0;
  while (drawn < count && library.length > 0) {
    const next = library.shift();
    if (!next) break;
    hand.push(next);
    drawn += 1;
  }
  return drawn;
}

function sourceToPool(pool: ManaPoolV05, source: ManaSourceV06): void {
  for (let index = 0; index < Math.max(1, source.output); index += 1) {
    const colors = source.colors.filter((color) => COLORS.includes(color as (typeof COLORS)[number]) || color === 'C');
    if (colors.length > 1) {
      pool.any = (pool.any ?? 0) + 1;
      continue;
    }
    const color = colors[0] ?? 'C';
    if (color === 'W') pool.W = (pool.W ?? 0) + 1;
    else if (color === 'U') pool.U = (pool.U ?? 0) + 1;
    else if (color === 'B') pool.B = (pool.B ?? 0) + 1;
    else if (color === 'R') pool.R = (pool.R ?? 0) + 1;
    else if (color === 'G') pool.G = (pool.G ?? 0) + 1;
    else pool.C = (pool.C ?? 0) + 1;
  }
}

function buildManaPool(sources: ManaSourceV06[]): ManaPoolV05 {
  const pool: ManaPoolV05 = {};
  for (const source of sources) sourceToPool(pool, source);
  return pool;
}

function subtractMana(pool: ManaPoolV05, used: Record<string, number>): void {
  const keys: Array<keyof ManaPoolV05> = ['W', 'U', 'B', 'R', 'G', 'C', 'any'];
  for (const key of keys) {
    const amount = used[key] ?? 0;
    if (amount <= 0) continue;
    pool[key] = Math.max(0, (pool[key] ?? 0) - amount);
  }
}

function permanentArtifactCount(battlefield: SimCardV06[]): number {
  return battlefield.filter((card) => card.isArtifact).length;
}

function convokeCreatures(battlefield: SimCardV06[], tappedCreatures: number): Array<{ colors: string[] }> {
  return battlefield
    .filter((card) => card.isCreature)
    .slice(Math.max(0, tappedCreatures))
    .map((card) => ({ colors: card.card.colors ?? card.card.color_identity }));
}

function escapeExileCost(card: ScryfallCard): number | null {
  const text = getCardOracleText(card);
  const raw = text.match(/Escape[—–-][^\n]*?Exile\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+other cards?/i)?.[1];
  if (!raw) return null;
  const numeric = Number.parseInt(raw, 10);
  if (Number.isFinite(numeric)) return numeric;
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  return words[raw.toLowerCase()] ?? null;
}

function affinityCountFor(card: SimCardV06, battlefield: SimCardV06[], treasures: number): number {
  if (!card.casting.paymentMechanics.includes('affinity')) return 0;
  if (card.casting.affinityFor.some((subject) => /artifact/i.test(subject))) {
    return permanentArtifactCount(battlefield) + treasures;
  }
  return 0;
}

function lineAllowed(card: SimCardV06, line: PaymentLineV05, graveyardCards: number): boolean {
  if (line.mode === 'normal') return true;
  if (['evoke', 'blitz', 'overload', 'prototype', 'sneak'].includes(line.mode)) return true;
  if (line.mode === 'escape') {
    const exile = escapeExileCost(card.card);
    return exile !== null && graveyardCards >= exile;
  }
  return false;
}

interface PaymentContextV06 {
  mana: ManaPoolV05;
  treasures: number;
  battlefield: SimCardV06[];
  tappedCreatures: number;
  tappedArtifacts: number;
  graveyardCards: number;
  life: number;
  commanderTax: number;
  isCommander: boolean;
}

function choosePaymentLine(card: SimCardV06, context: PaymentContextV06): PaymentLineV05 | null {
  const availableArtifacts = Math.max(0, permanentArtifactCount(context.battlefield) - context.tappedArtifacts);
  const result = evaluateCastabilityV05(card.card, {
    mana: context.mana,
    treasures: context.treasures,
    untappedCreatures: convokeCreatures(context.battlefield, context.tappedCreatures),
    untappedArtifacts: availableArtifacts,
    graveyardCards: context.graveyardCards,
    affinityCount: affinityCountFor(card, context.battlefield, context.treasures),
    life: context.life,
    isCommander: context.isCommander,
    commanderTax: context.commanderTax,
    alternativeResourceReady: true,
  });
  const allowed = result.lines.filter((line) => line.castable && lineAllowed(card, line, context.graveyardCards));
  return allowed.find((line) => line.mode === 'normal') ?? allowed[0] ?? null;
}

function paymentMechanicsUsed(line: PaymentLineV05): string[] {
  const output: string[] = [];
  if (line.used.convokeCreatures > 0) output.push('convoke');
  if (line.used.improviseArtifacts > 0) output.push('improvise');
  if (line.used.delvedCards > 0) output.push('delve');
  if (line.used.phyrexianLife > 0) output.push('phyrexian-mana');
  if (line.reasons.some((reason) => /Affinity reduced/i.test(reason))) output.push('affinity');
  if (line.mode !== 'normal') output.push(`alternative:${line.mode}`);
  return output;
}

function applyPayment(
  card: SimCardV06,
  line: PaymentLineV05,
  state: {
    mana: ManaPoolV05;
    treasures: number;
    graveyardCards: number;
    life: number;
    tappedCreatures: number;
    tappedArtifacts: number;
  },
): { treasuresSpent: number; delvedCards: number; lifePaid: number; mechanics: string[] } {
  subtractMana(state.mana, line.used.mana);
  state.treasures = Math.max(0, state.treasures - line.used.treasures);
  state.graveyardCards = Math.max(0, state.graveyardCards - line.used.delvedCards);
  state.life = Math.max(0, state.life - line.used.phyrexianLife);
  state.tappedCreatures += line.used.convokeCreatures;
  state.tappedArtifacts += line.used.improviseArtifacts;
  if (line.mode === 'escape') {
    const exile = escapeExileCost(card.card) ?? 0;
    state.graveyardCards = Math.max(0, state.graveyardCards - exile);
  }
  return {
    treasuresSpent: line.used.treasures,
    delvedCards: line.used.delvedCards,
    lifePaid: line.used.phyrexianLife,
    mechanics: paymentMechanicsUsed(line),
  };
}

function simpleLandDelayed(card: SimCardV06): boolean {
  const text = getCardOracleText(card.card);
  return /enters (?:the battlefield )?tapped/i.test(text);
}

function recurringTreasurePerTurn(card: SimCardV06): number {
  const profile = card.casting.treasure;
  if (!profile.recurring || !profile.trigger) return 0;
  if (/enters(?: the battlefield)?/i.test(profile.trigger)) return 0;
  if (/upkeep|end step|whenever you attack|combat damage|whenever .*cast/i.test(profile.trigger)) {
    return Math.max(1, profile.recurringTreasurePerTrigger);
  }
  return 0;
}

function treasureOnResolve(card: SimCardV06): number {
  let amount = card.casting.treasure.immediateTreasure;
  const trigger = card.casting.treasure.trigger ?? '';
  if (card.casting.treasure.recurring && /enters(?: the battlefield)?/i.test(trigger)) {
    amount += Math.max(1, card.casting.treasure.recurringTreasurePerTrigger);
  }
  return amount;
}

function recurringDrawPerTurn(battlefield: SimCardV06[]): number {
  return battlefield.reduce((sum, card) => sum + card.draw.recurringPerTurn, 0);
}

function isComboPiece(card: SimCardV06, comboPieces: string[][]): boolean {
  const name = card.name.toLocaleLowerCase();
  return comboPieces.some((combo) => combo.some((piece) => piece.toLocaleLowerCase() === name));
}

function candidateScore(card: SimCardV06, comboPieces: string[][]): number {
  let score = 0;
  if (card.roles.has('mana acceleration') || card.roles.has('land ramp') || card.isManaPermanent || card.isOneShotMana) score += 90;
  if (card.casting.treasure.createsTreasure) score += 78;
  if (card.roles.has('card draw') || card.roles.has('repeatable draw') || card.draw.immediate > 0 || card.draw.recurringPerTurn > 0) score += 65;
  if (isComboPiece(card, comboPieces)) score += 55;
  if (card.commanderDependent) score += 35;
  if (card.isPermanent) score += 20;
  if (card.isInteraction || card.isProtection) score -= 30;
  score -= card.card.cmc * 2;
  return score;
}

function namesInZones(hand: SimCardV06[], battlefield: SimCardV06[], graveyardNames: Set<string>): Set<string> {
  return new Set([
    ...hand.map((card) => card.name.toLocaleLowerCase()),
    ...battlefield.map((card) => card.name.toLocaleLowerCase()),
    ...graveyardNames,
  ]);
}

function comboCurrentReady(combo: string[], hand: SimCardV06[], battlefield: SimCardV06[]): boolean {
  const accessible = new Set([...hand, ...battlefield].map((card) => card.name.toLocaleLowerCase()));
  return combo.every((piece) => accessible.has(piece.toLocaleLowerCase()));
}

function comboSeen(combo: string[], seen: Set<string>): boolean {
  return combo.every((piece) => seen.has(piece.toLocaleLowerCase()));
}

function percentage(count: number, total: number): number {
  return total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function cumulativeTurnPercent(results: IterationResultV06[], getter: (result: IterationResultV06) => number | null, turns: number): Record<string, number> {
  return Object.fromEntries(Array.from({ length: turns }, (_, index) => {
    const turn = index + 1;
    return [`turn${turn}`, percentage(results.filter((result) => {
      const value = getter(result);
      return value !== null && value <= turn;
    }).length, results.length)];
  }));
}

function averageByTurn(results: IterationResultV06[], getter: (result: IterationResultV06) => number[], turns: number): Record<string, number> {
  return Object.fromEntries(Array.from({ length: turns }, (_, index) => [
    `turn${index + 1}`,
    Number((results.reduce((sum, result) => sum + (getter(result)[index] ?? 0), 0) / results.length).toFixed(2)),
  ]));
}

function addMechanic(target: Record<string, number>, mechanic: string): void {
  target[mechanic] = (target[mechanic] ?? 0) + 1;
}

function runAdvancedIteration(
  baseLibrary: SimCardV06[],
  commanderBase: CommanderStateV06[],
  options: { turns: number; comboPieces: string[][]; pressure: PressureProfile },
  random: SeededRandomV06,
): IterationResultV06 {
  const library = shuffle(baseLibrary, random);
  const hand: SimCardV06[] = [];
  drawCards(library, hand, 7);
  const battlefield: SimCardV06[] = [];
  const graveyardNames = new Set<string>();
  let graveyardCards = 0;
  let treasures = 0;
  let life = 40;
  const activeSources: ManaSourceV06[] = [];
  let delayedSources: ManaSourceV06[] = [];
  const commanders = commanderBase.map((state) => ({ ...state }));
  const comboReadyTurns = options.comboPieces.map(() => null as number | null);
  const comboSeenTurns = options.comboPieces.map(() => null as number | null);
  const treasuresByTurn: number[] = [];
  const lifeByTurn: number[] = [];
  const mechanicUses: Record<string, number> = {};
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

  const tryProtection = (mana: ManaPoolV05, tapped: { creatures: number; artifacts: number }): boolean => {
    const candidates = hand.filter((card) => card.isProtection && !card.isLand).sort((a, b) => a.card.cmc - b.card.cmc);
    for (const protector of candidates) {
      const line = choosePaymentLine(protector, {
        mana,
        treasures,
        battlefield,
        tappedCreatures: tapped.creatures,
        tappedArtifacts: tapped.artifacts,
        graveyardCards,
        life,
        commanderTax: 0,
        isCommander: false,
      });
      if (!line) continue;
      protectionAttempts += 1;
      const mutable = { mana, treasures, graveyardCards, life, tappedCreatures: tapped.creatures, tappedArtifacts: tapped.artifacts };
      const paid = applyPayment(protector, line, mutable);
      treasures = mutable.treasures;
      graveyardCards = mutable.graveyardCards + 1;
      life = mutable.life;
      tapped.creatures = mutable.tappedCreatures;
      tapped.artifacts = mutable.tappedArtifacts;
      treasuresSpent += paid.treasuresSpent;
      phyrexianLifePaid += paid.lifePaid;
      delvedCards += paid.delvedCards;
      if (paid.treasuresSpent > 0 && firstTreasureSpendTurn === null) firstTreasureSpendTurn = 1;
      for (const mechanic of paid.mechanics) addMechanic(mechanicUses, mechanic);
      hand.splice(hand.indexOf(protector), 1);
      graveyardNames.add(protector.name.toLocaleLowerCase());
      spellsCast += 1;
      protectionWins += 1;
      return true;
    }
    return false;
  };

  for (let turn = 1; turn <= options.turns; turn += 1) {
    activeSources.push(...delayedSources);
    delayedSources = [];
    let tappedCreatures = 0;
    let tappedArtifacts = 0;

    const recurringTreasure = battlefield.reduce((sum, card) => sum + recurringTreasurePerTurn(card), 0);
    if (recurringTreasure > 0) {
      treasures += recurringTreasure;
      treasuresCreated += recurringTreasure;
    }

    const recurringDraw = recurringDrawPerTurn(battlefield);
    if (recurringDraw > 0) cardsDrawnByEffects += drawCards(library, hand, recurringDraw);
    drawCards(library, hand, 1);

    const landIndex = hand.findIndex((card) => card.isLand);
    if (landIndex >= 0) {
      const land = hand.splice(landIndex, 1)[0];
      if (land) {
        const source: ManaSourceV06 = { colors: land.colors, output: Math.max(1, land.manaOutput) };
        if (simpleLandDelayed(land)) delayedSources.push(source);
        else activeSources.push(source);
      }
    }

    const mana = buildManaPool(activeSources);
    const tapped = { creatures: tappedCreatures, artifacts: tappedArtifacts };

    const castNonCommander = (card: SimCardV06, isKeySpell: boolean): boolean => {
      const line = choosePaymentLine(card, {
        mana,
        treasures,
        battlefield,
        tappedCreatures: tapped.creatures,
        tappedArtifacts: tapped.artifacts,
        graveyardCards,
        life,
        commanderTax: 0,
        isCommander: false,
      });
      if (!line) return false;

      if (isKeySpell && random.next() < options.pressure.keySpellChallenge) {
        keySpellChallenges += 1;
        if (!tryProtection(mana, tapped)) {
          keySpellStops += 1;
          hand.splice(hand.indexOf(card), 1);
          graveyardCards += 1;
          graveyardNames.add(card.name.toLocaleLowerCase());
          spellsCast += 1;
          return true;
        }
      }

      const mutable = { mana, treasures, graveyardCards, life, tappedCreatures: tapped.creatures, tappedArtifacts: tapped.artifacts };
      const paid = applyPayment(card, line, mutable);
      treasures = mutable.treasures;
      graveyardCards = mutable.graveyardCards;
      life = mutable.life;
      tapped.creatures = mutable.tappedCreatures;
      tapped.artifacts = mutable.tappedArtifacts;
      treasuresSpent += paid.treasuresSpent;
      phyrexianLifePaid += paid.lifePaid;
      delvedCards += paid.delvedCards;
      if (paid.treasuresSpent > 0 && firstTreasureSpendTurn === null) firstTreasureSpendTurn = turn;
      for (const mechanic of paid.mechanics) addMechanic(mechanicUses, mechanic);
      if (paid.mechanics.length > 0) advancedCasts += 1;
      if (line.mode !== 'normal') alternativeCostCasts += 1;
      hand.splice(hand.indexOf(card), 1);
      spellsCast += 1;

      const treasureGain = treasureOnResolve(card);
      if (treasureGain > 0) {
        treasures += treasureGain;
        treasuresCreated += treasureGain;
      }

      if (card.draw.immediate > 0) cardsDrawnByEffects += drawCards(library, hand, card.draw.immediate);

      if (card.roles.has('land ramp')) {
        const targetIndex = library.findIndex((candidate) => candidate.isLand);
        if (targetIndex >= 0) {
          const land = library.splice(targetIndex, 1)[0];
          if (land) delayedSources.push({ colors: land.colors, output: Math.max(1, land.manaOutput) });
        }
      }

      if (card.isOneShotMana) sourceToPool(mana, { colors: card.colors, output: Math.max(1, card.manaOutput) });

      if (card.isPermanent && line.mode !== 'evoke') {
        battlefield.push(card);
        if (card.commanderDependent) commanderDependentPermanentsCast += 1;
        if (card.isManaPermanent) {
          const source = { colors: card.colors, output: Math.max(1, card.manaOutput) };
          if (card.isManaCreature || simpleLandDelayed(card)) delayedSources.push(source);
          else {
            activeSources.push(source);
            sourceToPool(mana, source);
          }
        }
      } else {
        graveyardCards += 1;
        graveyardNames.add(card.name.toLocaleLowerCase());
      }
      return true;
    };

    const setup = hand
      .filter((card) => !card.isLand && !card.isInteraction && !card.isProtection)
      .sort((a, b) => candidateScore(b, options.comboPieces) - candidateScore(a, options.comboPieces));
    const earlySetup = setup.find((card) => candidateScore(card, options.comboPieces) >= 65);
    if (earlySetup) castNonCommander(earlySetup, isComboPiece(earlySetup, options.comboPieces));

    for (const commander of commanders) {
      if (commander.online) continue;
      const tax = commander.timesCast * 2;
      const line = choosePaymentLine(commander.card, {
        mana,
        treasures,
        battlefield,
        tappedCreatures: tapped.creatures,
        tappedArtifacts: tapped.artifacts,
        graveyardCards,
        life,
        commanderTax: tax,
        isCommander: true,
      });
      if (!line) continue;
      commander.timesCast += 1;
      commanderCasts += 1;
      if (random.next() < options.pressure.keySpellChallenge) {
        keySpellChallenges += 1;
        if (!tryProtection(mana, tapped)) {
          commander.stoppedOnStackCount += 1;
          commanderStoppedOnStack += 1;
          keySpellStops += 1;
          continue;
        }
      }
      const mutable = { mana, treasures, graveyardCards, life, tappedCreatures: tapped.creatures, tappedArtifacts: tapped.artifacts };
      const paid = applyPayment(commander.card, line, mutable);
      treasures = mutable.treasures;
      graveyardCards = mutable.graveyardCards;
      life = mutable.life;
      tapped.creatures = mutable.tappedCreatures;
      tapped.artifacts = mutable.tappedArtifacts;
      treasuresSpent += paid.treasuresSpent;
      phyrexianLifePaid += paid.lifePaid;
      delvedCards += paid.delvedCards;
      if (paid.treasuresSpent > 0 && firstTreasureSpendTurn === null) firstTreasureSpendTurn = turn;
      for (const mechanic of paid.mechanics) addMechanic(mechanicUses, mechanic);
      if (paid.mechanics.length > 0) advancedCasts += 1;
      if (line.mode !== 'normal') alternativeCostCasts += 1;
      commander.online = true;
      commander.firstResolvedTurn ??= turn;
      battlefield.push(commander.card);
      spellsCast += 1;
    }

    let actions = 0;
    while (actions < 6) {
      actions += 1;
      const candidates = hand
        .filter((card) => !card.isLand && !card.isInteraction && !card.isProtection)
        .sort((a, b) => candidateScore(b, options.comboPieces) - candidateScore(a, options.comboPieces));
      let acted = false;
      for (const card of candidates) {
        if (castNonCommander(card, isComboPiece(card, options.comboPieces))) {
          acted = true;
          break;
        }
      }
      if (!acted) break;
    }

    for (const commander of commanders) {
      if (!commander.online) continue;
      commanderOnlineTurns += 1;
      if (random.next() < options.pressure.commanderRemoval) {
        if (!tryProtection(mana, tapped)) {
          commander.online = false;
          commander.removalCount += 1;
          commanderRemovals += 1;
          const index = battlefield.findIndex((card) => card.uid === commander.card.uid);
          if (index >= 0) battlefield.splice(index, 1);
        }
      }
    }

    if (battlefield.filter((card) => card.isCreature).length >= 2 && random.next() < options.pressure.boardWipe) {
      boardWipes += 1;
      if (!tryProtection(mana, tapped)) {
        for (let index = battlefield.length - 1; index >= 0; index -= 1) {
          const card = battlefield[index];
          if (!card?.isCreature) continue;
          const commander = commanders.find((state) => state.card.uid === card.uid);
          if (commander) commander.online = false;
          else {
            graveyardCards += 1;
            graveyardNames.add(card.name.toLocaleLowerCase());
          }
          battlefield.splice(index, 1);
        }
      }
    }

    const seen = namesInZones(hand, battlefield, graveyardNames);
    options.comboPieces.forEach((combo, index) => {
      if (comboReadyTurns[index] === null && comboCurrentReady(combo, hand, battlefield)) comboReadyTurns[index] = turn;
      if (comboSeenTurns[index] === null && comboSeen(combo, seen)) comboSeenTurns[index] = turn;
    });

    treasuresByTurn.push(treasures);
    lifeByTurn.push(life);
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

function aggregateMechanics(results: IterationResultV06[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const result of results) {
    for (const [mechanic, count] of Object.entries(result.mechanicUses)) counts[mechanic] = (counts[mechanic] ?? 0) + count;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, Number((value / results.length).toFixed(2))]));
}

function buildSimpleSummary(
  results: IterationResultV06[],
  turns: number,
  pressure: PodPressureV06,
  comboPieces: string[][],
): string[] {
  const summary: string[] = [];
  const treasureGames = results.filter((result) => result.treasuresSpent > 0).length;
  if (treasureGames > 0) summary.push(`Treasures were actually spent in ${percentage(treasureGames, results.length)}% of simulated games.`);
  const advancedGames = results.filter((result) => result.advancedCasts > 0).length;
  if (advancedGames > 0) summary.push(`Convoke, delve, improvise, affinity, Phyrexian mana, or an alternative cost mattered in ${percentage(advancedGames, results.length)}% of games.`);
  const uptime = percentage(results.reduce((sum, result) => sum + result.commanderOnlineTurns, 0), results.length * turns);
  summary.push(`Under the ${pressure} pressure assumptions, the commander was on the battlefield for about ${uptime}% of simulated turns.`);
  const challenges = results.reduce((sum, result) => sum + result.keySpellChallenges, 0);
  const protectionWins = results.reduce((sum, result) => sum + result.protectionWins, 0);
  if (challenges > 0) summary.push(`Protection successfully answered ${percentage(protectionWins, challenges)}% of modeled challenges to key plays.`);
  if (comboPieces.length > 0) {
    const ready = results.filter((result) => result.comboReadyTurns.some((turn) => turn !== null)).length;
    summary.push(`At least one requested combo had all named pieces in hand/battlefield by turn ${turns} in ${percentage(ready, results.length)}% of games.`);
  }
  return summary.slice(0, 5);
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
  const comboPieces = (rawOptions.comboPieces ?? []).slice(0, 8).map((combo) => combo.slice(0, 6));
  const identity = commanderIdentity(parsed, cards);
  const library = expandMainDeck(parsed, cards, identity);
  const commanders = commanderStates(parsed, cards, identity);
  if (library.length < 40) throw new Error(`V0.6 advanced simulation needs a mostly resolved library; only ${library.length} cards were available.`);

  const random = new SeededRandomV06(seed ^ 0x6a09e667);
  const results: IterationResultV06[] = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    results.push(runAdvancedIteration(library, commanders, { turns, comboPieces, pressure: PRESSURE[pressure] }, random));
  }

  const totalChallenges = results.reduce((sum, result) => sum + result.keySpellChallenges, 0);
  const totalProtectionWins = results.reduce((sum, result) => sum + result.protectionWins, 0);
  const comboOutput = comboPieces.map((pieces, index) => ({
    pieces,
    allNamedPiecesSeenByTurn: cumulativeTurnPercent(results, (result) => result.comboSeenTurns[index] ?? null, turns),
    allNamedPiecesInHandOrBattlefieldByTurn: cumulativeTurnPercent(results, (result) => result.comboReadyTurns[index] ?? null, turns),
    note: 'This is zone-readiness for the named pieces, not proof that every Commander Spellbook requirement, target, timing condition, or mana requirement is satisfied.',
  }));

  return {
    model: 'MTG Ultimate advanced turn simulation V0.6',
    iterations,
    turns,
    seed,
    pressure,
    summary: buildSimpleSummary(results, turns, pressure, comboPieces),
    resources: {
      averageTreasuresCreated: average(results.map((result) => result.treasuresCreated)),
      averageTreasuresSpent: average(results.map((result) => result.treasuresSpent)),
      firstTreasureSpendByTurn: cumulativeTurnPercent(results, (result) => result.firstTreasureSpendTurn, turns),
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
      battlefieldUptimePercent: percentage(results.reduce((sum, result) => sum + result.commanderOnlineTurns, 0), iterations * turns),
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
      protectionWinRateWhenChallenged: percentage(totalProtectionWins, totalChallenges),
      averageBoardWipes: average(results.map((result) => result.boardWipes)),
    },
    cardFlow: {
      averageCardsDrawnByEffects: average(results.map((result) => result.cardsDrawnByEffects)),
      averageSpellsCast: average(results.map((result) => result.spellsCast)),
    },
    combos: comboOutput,
    assumptions: [
      `The ${pressure} profile is a transparent simulation assumption, not a measured win-rate claim.`,
      'V0.6 uses the V0.5 payment solver inside each simulated turn for Treasures, convoke, improvise, delve, artifact-affinity, Phyrexian mana, commander tax, and supported named alternative costs.',
      'Pitch-style alternate costs and “cast without paying” effects stay disabled unless their separate permission/resource can be proven; this avoids treating every free-cast sentence as always active.',
      'The advanced lane uses conservative land timing and simplified opponent choices. V0.4 remains the stronger source for detailed land/fetch/tutor sequencing.',
      'Protection and removal pressure are modeled as explicit probabilities; politics and full multiplayer priority trees are not yet claimed.',
    ],
  };
}

export function simulateDeckGameplayV06(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  options: DeckSimulationV06Options = {},
): Record<string, unknown> {
  const baseline = simulateDeckConsistencyV04(parsed, cards, options);
  const advanced = simulateAdvancedGameplayV06(parsed, cards, options);
  const baselineRecord = baseline as Record<string, unknown>;
  return {
    model: 'MTG Ultimate hybrid Commander simulation V0.6',
    summary: (advanced as Record<string, unknown>).summary,
    baseline: {
      openingHands: baselineRecord.openingHands,
      development: baselineRecord.development,
      commanders: baselineRecord.commanders,
      tutors: baselineRecord.tutors,
      cardAdvantage: baselineRecord.cardAdvantage,
      interaction: baselineRecord.interaction,
      combos: baselineRecord.combos,
    },
    advanced,
    explanation: 'Use the baseline for land/fetch/tutor consistency and the advanced lane for special payment, Treasure, commander-pressure, and protection behavior. The two views are intentionally kept separate where one model is stronger than the other.',
  };
}
