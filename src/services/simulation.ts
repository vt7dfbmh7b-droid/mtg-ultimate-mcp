import type { ScryfallCard } from '../types/scryfall.js';
import type { ParsedDeck } from './deck.js';
import { getCardOracleText, inferCardRoles } from './scryfall.js';

export interface DeckSimulationOptions {
  iterations?: number;
  turns?: number;
  seed?: number;
  maxMulligans?: number;
  comboPieces?: string[][];
}

interface SimCard {
  name: string;
  cmc: number;
  oracleText: string;
  roles: Set<string>;
  isLand: boolean;
  isCreature: boolean;
  isRamp: boolean;
  isTutor: boolean;
  isInteraction: boolean;
  isDraw: boolean;
}

interface IterationResult {
  mulligans: number;
  openingLands: number;
  functionalOpening: boolean;
  spendableManaByTurn: number[];
  landsByTurn: number[];
  commanderCastTurn: number | null;
  interactionOnlineTurn: number | null;
  drawOnlineTurn: number | null;
  naturalComboTurns: Array<number | null>;
  tutorProxyComboTurns: Array<number | null>;
}

const clampInt = (value: number | undefined, fallback: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value ?? fallback)));
};

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
    [result[index], result[swapIndex]] = [result[swapIndex] as T, result[index] as T];
  }
  return result;
}

function byName(cards: ScryfallCard[]): Map<string, ScryfallCard> {
  return new Map(cards.map((card) => [card.name.toLocaleLowerCase(), card]));
}

function toSimCard(card: ScryfallCard): SimCard {
  const roles = new Set(inferCardRoles(card));
  const type = card.type_line.toLowerCase();
  return {
    name: card.name,
    cmc: card.cmc,
    oracleText: getCardOracleText(card),
    roles,
    isLand: type.includes('land'),
    isCreature: type.includes('creature'),
    isRamp: roles.has('mana acceleration') || roles.has('land ramp') || roles.has('cost reduction'),
    isTutor: roles.has('tutor'),
    isInteraction: roles.has('spot interaction') || roles.has('countermagic') || roles.has('board wipe') || roles.has('free interaction'),
    isDraw: roles.has('card draw') || roles.has('repeatable draw') || roles.has('card selection'),
  };
}

function expandLibrary(parsed: ParsedDeck, cards: ScryfallCard[]): SimCard[] {
  const map = byName(cards);
  const library: SimCard[] = [];
  for (const entry of parsed.main) {
    const resolved = map.get(entry.name.toLocaleLowerCase());
    if (!resolved) continue;
    const simCard = toSimCard(resolved);
    for (let copy = 0; copy < entry.quantity; copy += 1) library.push(simCard);
  }
  return library;
}

function commanderCost(parsed: ParsedDeck, cards: ScryfallCard[]): number | null {
  const map = byName(cards);
  const commanders = parsed.commanders
    .map((entry) => map.get(entry.name.toLocaleLowerCase()))
    .filter((card): card is ScryfallCard => Boolean(card));
  return commanders.length > 0 ? Math.min(...commanders.map((card) => card.cmc)) : null;
}

function shouldKeep(hand: SimCard[]): boolean {
  const lands = hand.filter((card) => card.isLand).length;
  const cheapRamp = hand.filter((card) => card.isRamp && card.cmc <= 2).length;
  const cheapAction = hand.filter((card) => !card.isLand && card.cmc <= 2).length;
  if (lands >= 2 && lands <= 4) return true;
  if (lands === 1 && cheapRamp >= 1 && cheapAction >= 2) return true;
  return lands === 5 && hand.some((card) => card.isDraw && card.cmc <= 2);
}

function keepValue(card: SimCard, lands: number): number {
  if (card.isLand) return lands > 3 ? 0.5 : 4;
  if (card.roles.has('fast mana')) return 7;
  if (card.isRamp && card.cmc <= 2) return 6;
  if ((card.isDraw || card.isTutor || card.isInteraction) && card.cmc <= 2) return 5;
  if (card.cmc <= 2) return 3;
  if (card.cmc <= 4) return 2;
  return 0.5;
}

function londonBottom(hand: SimCard[], count: number): { kept: SimCard[]; bottomed: SimCard[] } {
  if (count <= 0) return { kept: hand, bottomed: [] };
  const lands = hand.filter((card) => card.isLand).length;
  const bottomIndices = new Set(
    hand
      .map((card, index) => ({ index, value: keepValue(card, lands), cmc: card.cmc }))
      .sort((a, b) => a.value - b.value || b.cmc - a.cmc)
      .slice(0, count)
      .map((item) => item.index),
  );
  return {
    kept: hand.filter((_, index) => !bottomIndices.has(index)),
    bottomed: hand.filter((_, index) => bottomIndices.has(index)),
  };
}

function rampOutput(card: SimCard): number {
  if (/add \{C\}\{C\}/i.test(card.oracleText) || /add two mana/i.test(card.oracleText)) return 2;
  if (/add three mana/i.test(card.oracleText)) return 3;
  return 1;
}

function delayedCreatureRamp(card: SimCard): boolean {
  return card.isCreature && /\{T\}:\s*Add/i.test(card.oracleText);
}

function assembled(pieces: string[], seen: Set<string>, tutors: number, proxy: boolean): boolean {
  const missing = pieces.filter((piece) => !seen.has(piece.toLocaleLowerCase())).length;
  return proxy ? missing <= tutors : missing === 0;
}

function runIteration(
  source: SimCard[],
  commanderManaValue: number | null,
  turns: number,
  maxMulligans: number,
  combos: string[][],
  random: SeededRandom,
): IterationResult {
  let mulligans = 0;
  let shuffled = shuffle(source, random);
  let seven = shuffled.slice(0, 7);
  while (!shouldKeep(seven) && mulligans < maxMulligans) {
    mulligans += 1;
    shuffled = shuffle(source, random);
    seven = shuffled.slice(0, 7);
  }

  const functionalOpening = shouldKeep(seven);
  const openingLands = seven.filter((card) => card.isLand).length;
  const { kept, bottomed } = londonBottom(seven, mulligans);
  const hand = [...kept];
  const library = [...shuffled.slice(7), ...bottomed];
  let drawIndex = 0;
  const seen = new Set(hand.map((card) => card.name.toLocaleLowerCase()));
  let tutorsSeen = hand.filter((card) => card.isTutor).length;
  let landsInPlay = 0;
  let activeRamp = 0;
  let delayedRamp = 0;
  let commanderCastTurn: number | null = null;
  let interactionOnlineTurn: number | null = null;
  let drawOnlineTurn: number | null = null;
  const spendableManaByTurn: number[] = [];
  const landsByTurn: number[] = [];
  const naturalComboTurns = combos.map(() => null as number | null);
  const tutorProxyComboTurns = combos.map(() => null as number | null);

  for (let turn = 1; turn <= turns; turn += 1) {
    activeRamp += delayedRamp;
    delayedRamp = 0;

    const drawn = library[drawIndex];
    if (drawn) {
      hand.push(drawn);
      seen.add(drawn.name.toLocaleLowerCase());
      if (drawn.isTutor) tutorsSeen += 1;
      drawIndex += 1;
    }

    const landIndex = hand.findIndex((card) => card.isLand);
    if (landIndex >= 0) {
      hand.splice(landIndex, 1);
      landsInPlay += 1;
    }

    let spendable = landsInPlay + activeRamp;
    while (true) {
      const candidate = hand
        .filter((card) => card.isRamp && !card.isLand && card.cmc <= spendable)
        .sort((a, b) => a.cmc - b.cmc)[0];
      if (!candidate) break;
      const index = hand.indexOf(candidate);
      spendable -= candidate.cmc;
      hand.splice(index, 1);
      const output = rampOutput(candidate);
      if (delayedCreatureRamp(candidate)) delayedRamp += output;
      else {
        activeRamp += output;
        spendable += output;
      }
    }

    spendableManaByTurn.push(spendable);
    landsByTurn.push(landsInPlay);

    if (commanderCastTurn === null && commanderManaValue !== null && spendable >= commanderManaValue) commanderCastTurn = turn;
    if (interactionOnlineTurn === null && hand.some((card) => card.isInteraction && card.cmc <= spendable)) interactionOnlineTurn = turn;
    if (drawOnlineTurn === null && hand.some((card) => card.isDraw && card.cmc <= spendable)) drawOnlineTurn = turn;

    combos.forEach((pieces, index) => {
      if (naturalComboTurns[index] === null && assembled(pieces, seen, tutorsSeen, false)) naturalComboTurns[index] = turn;
      if (tutorProxyComboTurns[index] === null && assembled(pieces, seen, tutorsSeen, true)) tutorProxyComboTurns[index] = turn;
    });
  }

  return {
    mulligans,
    openingLands,
    functionalOpening,
    spendableManaByTurn,
    landsByTurn,
    commanderCastTurn,
    interactionOnlineTurn,
    drawOnlineTurn,
    naturalComboTurns,
    tutorProxyComboTurns,
  };
}

const pct = (count: number, total: number): number => total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;

function cumulative(
  results: IterationResult[],
  getter: (result: IterationResult) => number | null,
  turns: number,
): Record<string, number> {
  return Object.fromEntries(
    Array.from({ length: turns }, (_, index) => {
      const turn = index + 1;
      return [
        `turn${turn}`,
        pct(results.filter((result) => {
          const value = getter(result);
          return value !== null && value <= turn;
        }).length, results.length),
      ];
    }),
  );
}

export function simulateDeckConsistency(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  rawOptions: DeckSimulationOptions = {},
): Record<string, unknown> {
  const iterations = clampInt(rawOptions.iterations, 5_000, 100, 50_000);
  const turns = clampInt(rawOptions.turns, 7, 1, 15);
  const maxMulligans = clampInt(rawOptions.maxMulligans, 2, 0, 4);
  const seed = clampInt(rawOptions.seed, 1_337, 1, 2_147_483_647);
  const combos = (rawOptions.comboPieces ?? []).slice(0, 8).map((combo) => combo.slice(0, 6));
  const library = expandLibrary(parsed, cards);
  const commanderManaValue = commanderCost(parsed, cards);
  if (library.length < 40) throw new Error(`Simulation needs a mostly resolved deck library; only ${library.length} cards were available.`);

  const random = new SeededRandom(seed);
  const results = Array.from({ length: iterations }, () =>
    runIteration(library, commanderManaValue, turns, maxMulligans, combos, random),
  );

  const averageByTurn = (getter: (result: IterationResult) => number[]) =>
    Object.fromEntries(
      Array.from({ length: turns }, (_, index) => [
        `turn${index + 1}`,
        Number((results.reduce((sum, result) => sum + (getter(result)[index] ?? 0), 0) / results.length).toFixed(2)),
      ]),
    );

  const turn3 = Math.min(2, turns - 1);
  const turn5 = Math.min(4, turns - 1);

  return {
    model: 'Monte Carlo goldfish/consistency model',
    iterations,
    seed,
    turns,
    libraryCardsResolved: library.length,
    commanderManaValueUsed: commanderManaValue,
    mulliganPolicy: {
      maxMulligans,
      rule: 'London-style redraws with heuristic keeps and bottoming that prioritizes lands, cheap ramp, draw, tutors, and interaction.',
    },
    openingHands: {
      functionalKeepRate: pct(results.filter((result) => result.functionalOpening).length, results.length),
      mulliganAtLeastOnceRate: pct(results.filter((result) => result.mulligans >= 1).length, results.length),
      mulliganTwiceOrMoreRate: pct(results.filter((result) => result.mulligans >= 2).length, results.length),
      averageOpeningLands: Number((results.reduce((sum, result) => sum + result.openingLands, 0) / results.length).toFixed(2)),
    },
    development: {
      averageSpendableManaAfterRampByTurn: averageByTurn((result) => result.spendableManaByTurn),
      averageLandsInPlayByTurn: averageByTurn((result) => result.landsByTurn),
      manaScrewProxyByTurn3: pct(results.filter((result) => (result.landsByTurn[turn3] ?? 0) < 2).length, results.length),
      floodProxyByTurn5: pct(results.filter((result) => (result.landsByTurn[turn5] ?? 0) >= 5).length, results.length),
    },
    commander: { castableByTurn: cumulative(results, (result) => result.commanderCastTurn, turns) },
    interaction: { affordableInteractionSeenByTurn: cumulative(results, (result) => result.interactionOnlineTurn, turns) },
    cardAdvantage: { affordableDrawSeenByTurn: cumulative(results, (result) => result.drawOnlineTurn, turns) },
    combos: combos.map((pieces, index) => ({
      pieces,
      naturalAssemblyByTurn: cumulative(results, (result) => result.naturalComboTurns[index] ?? null, turns),
      tutorAssistedProxyByTurn: cumulative(results, (result) => result.tutorProxyComboTurns[index] ?? null, turns),
    })),
    caveats: [
      'This is a consistency/goldfish simulator, not a complete Magic rules engine.',
      'Colored mana, tapped lands, MDFCs, complex sequencing, taxes, removal, stack interaction, combat, and opponent decisions are simplified or omitted.',
      'Tap-creature ramp is delayed by one turn; noncreature fast mana can increase same-turn spendable mana.',
      'Tutor-assisted combo numbers are a proxy: any tutor is treated as able to cover one missing combo piece.',
      'Use observed tournament/reference data alongside this model before treating structural differences as evidence of real match performance.',
    ],
  };
}
