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
  typeLine: string;
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
  keptCards: number;
  openingLands: number;
  functionalOpening: boolean;
  manaByTurn: number[];
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
    const temp = result[index];
    result[index] = result[swapIndex] as T;
    result[swapIndex] = temp as T;
  }
  return result;
}

function cardMap(cards: ScryfallCard[]): Map<string, ScryfallCard> {
  return new Map(cards.map((card) => [card.name.toLocaleLowerCase(), card]));
}

function toSimCard(card: ScryfallCard): SimCard {
  const roles = new Set(inferCardRoles(card));
  const typeLine = card.type_line.toLowerCase();
  return {
    name: card.name,
    cmc: card.cmc,
    typeLine: card.type_line,
    oracleText: getCardOracleText(card),
    roles,
    isLand: typeLine.includes('land'),
    isCreature: typeLine.includes('creature'),
    isRamp:
      roles.has('mana acceleration') ||
      roles.has('land ramp') ||
      roles.has('mana rock') ||
      roles.has('mana dork') ||
      roles.has('fast mana'),
    isTutor: roles.has('tutor'),
    isInteraction:
      roles.has('spot interaction') ||
      roles.has('countermagic') ||
      roles.has('board wipe') ||
      roles.has('free interaction'),
    isDraw: roles.has('card draw') || roles.has('card selection') || roles.has('repeatable draw'),
  };
}

function expandLibrary(parsed: ParsedDeck, cards: ScryfallCard[]): SimCard[] {
  const byName = cardMap(cards);
  const library: SimCard[] = [];
  for (const entry of parsed.main) {
    const resolved = byName.get(entry.name.toLocaleLowerCase());
    if (!resolved) continue;
    const simCard = toSimCard(resolved);
    for (let copy = 0; copy < entry.quantity; copy += 1) library.push(simCard);
  }
  return library;
}

function resolvedCommanders(parsed: ParsedDeck, cards: ScryfallCard[]): ScryfallCard[] {
  const byName = cardMap(cards);
  return parsed.commanders
    .map((entry) => byName.get(entry.name.toLocaleLowerCase()))
    .filter((card): card is ScryfallCard => Boolean(card));
}

function openingScore(card: SimCard, landsInHand: number): number {
  if (card.isLand) return landsInHand > 3 ? 0.5 : 4;
  if (card.roles.has('fast mana')) return 6;
  if (card.isRamp && card.cmc <= 2) return 5;
  if (card.isDraw && card.cmc <= 2) return 4.5;
  if (card.isInteraction && card.cmc <= 2) return 4;
  if (card.isTutor && card.cmc <= 2) return 4;
  if (card.cmc <= 2) return 3;
  if (card.cmc <= 4) return 2;
  return 0.75;
}

function shouldKeepOpening(hand: SimCard[]): boolean {
  const lands = hand.filter((card) => card.isLand).length;
  const cheapRamp = hand.filter((card) => card.isRamp && card.cmc <= 2).length;
  const cheapAction = hand.filter((card) => !card.isLand && card.cmc <= 2).length;
  if (lands >= 2 && lands <= 4) return true;
  if (lands === 1 && cheapRamp >= 1 && cheapAction >= 2) return true;
  if (lands === 5 && hand.some((card) => card.isDraw && card.cmc <= 2)) return true;
  return false;
}

function londonBottom(hand: SimCard[], count: number): { kept: SimCard[]; bottomed: SimCard[] } {
  if (count <= 0) return { kept: hand, bottomed: [] };
  const lands = hand.filter((card) => card.isLand).length;
  const scored = hand
    .map((card, index) => ({ card, index, score: openingScore(card, lands) }))
    .sort((a, b) => a.score - b.score || b.card.cmc - a.card.cmc);
  const bottomIndices = new Set(scored.slice(0, count).map((item) => item.index));
  return {
    kept: hand.filter((_, index) => !bottomIndices.has(index)),
    bottomed: hand.filter((_, index) => bottomIndices.has(index)),
  };
}

function estimateRampOutput(card: SimCard): number {
  const text = card.oracleText;
  if (/add \{C\}\{C\}/i.test(text) || /add two mana/i.test(text)) return 2;
  if (/add three mana/i.test(text)) return 3;
  return 1;
}

function isTapCreatureRamp(card: SimCard): boolean {
  return card.isCreature && /\{T\}:\s*Add/i.test(card.oracleText);
}

function comboTurn(
  pieces: string[],
  seenNames: Set<string>,
  tutorsSeen: number,
  tutorProxy: boolean,
): boolean {
  const normalized = pieces.map((piece) => piece.toLocaleLowerCase());
  const missing = normalized.filter((piece) => !seenNames.has(piece)).length;
  return tutorProxy ? missing <= tutorsSeen : missing === 0;
}

function runIteration(
  librarySource: SimCard[],
  commanderCost: number | null,
  options: Required<Pick<DeckSimulationOptions, 'turns' | 'maxMulligans'>> & { comboPieces: string[][] },
  random: SeededRandom,
): IterationResult {
  let mulligans = 0;
  let shuffled = shuffle(librarySource, random);
  let hand = shuffled.slice(0, 7);

  while (!shouldKeepOpening(hand) && mulligans < options.maxMulligans) {
    mulligans += 1;
    shuffled = shuffle(librarySource, random);
    hand = shuffled.slice(0, 7);
  }

  const openingLands = hand.filter((card) => card.isLand).length;
  const { kept, bottomed } = londonBottom(hand, mulligans);
  hand = [...kept];
  const library = [...shuffled.slice(7), ...bottomed];
  let drawIndex = 0;

  const seenNames = new Set(hand.map((card) => card.name.toLocaleLowerCase()));
  let tutorsSeen = hand.filter((card) => card.isTutor).length;
  let landsInPlay = 0;
  let activeRamp = 0;
  let delayedRamp = 0;
  let commanderCastTurn: number | null = null;
  let interactionOnlineTurn: number | null = null;
  let drawOnlineTurn: number | null = null;
  const manaByTurn: number[] = [];
  const landsByTurn: number[] = [];
  const naturalComboTurns = options.comboPieces.map(() => null as number | null);
  const tutorProxyComboTurns = options.comboPieces.map(() => null as number | null);

  const functionalOpening = shouldKeepOpening(hand);

  for (let turn = 1; turn <= options.turns; turn += 1) {
    activeRamp += delayedRamp;
    delayedRamp = 0;

    const drawn = library[drawIndex];
    if (drawn) {
      hand.push(drawn);
      seenNames.add(drawn.name.toLocaleLowerCase());
      if (drawn.isTutor) tutorsSeen += 1;
      drawIndex += 1;
    }

    const landIndex = hand.findIndex((card) => card.isLand);
    if (landIndex >= 0) {
      hand.splice(landIndex, 1);
      landsInPlay += 1;
    }

    let availableMana = landsInPlay + activeRamp;

    const rampCandidates = hand
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => card.isRamp && !card.isLand && card.cmc <= availableMana)
      .sort((a, b) => a.card.cmc - b.card.cmc);

    for (const candidate of rampCandidates) {
      const currentIndex = hand.indexOf(candidate.card);
      if (currentIndex < 0 || candidate.card.cmc > availableMana) continue;
      availableMana -= candidate.card.cmc;
      hand.splice(currentIndex, 1);
      const output = estimateRampOutput(candidate.card);
      if (isTapCreatureRamp(candidate.card)) delayedRamp += output;
      else activeRamp += output;
      availableMana = Math.max(availableMana, landsInPlay + activeRamp - candidate.card.cmc);
    }

    const totalMana = landsInPlay + activeRamp;
    manaByTurn.push(totalMana);
    landsByTurn.push(landsInPlay);

    if (commanderCastTurn === null && commanderCost !== null && totalMana >= commanderCost) {
      commanderCastTurn = turn;
    }

    if (
      interactionOnlineTurn === null &&
      hand.some((card) => card.isInteraction && card.cmc <= totalMana)
    ) {
      interactionOnlineTurn = turn;
    }

    if (drawOnlineTurn === null && hand.some((card) => card.isDraw && card.cmc <= totalMana)) {
      drawOnlineTurn = turn;
    }

    options.comboPieces.forEach((pieces, comboIndex) => {
      if (
        naturalComboTurns[comboIndex] === null &&
        comboTurn(pieces, seenNames, tutorsSeen, false)
      ) {
        naturalComboTurns[comboIndex] = turn;
      }
      if (
        tutorProxyComboTurns[comboIndex] === null &&
        comboTurn(pieces, seenNames, tutorsSeen, true)
      ) {
        tutorProxyComboTurns[comboIndex] = turn;
      }
    });
  }

  return {
    mulligans,
    keptCards: hand.length,
    openingLands,
    functionalOpening,
    manaByTurn,
    landsByTurn,
    commanderCastTurn,
    interactionOnlineTurn,
    drawOnlineTurn,
    naturalComboTurns,
    tutorProxyComboTurns,
  };
}

const percentage = (count: number, total: number): number =>
  total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;

function cumulativeTurnPercent(
  results: IterationResult[],
  getter: (result: IterationResult) => number | null,
  turns: number,
): Record<string, number> {
  const output: Record<string, number> = {};
  for (let turn = 1; turn <= turns; turn += 1) {
    output[`turn${turn}`] = percentage(
      results.filter((result) => {
        const value = getter(result);
        return value !== null && value <= turn;
      }).length,
      results.length,
    );
  }
  return output;
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
  const comboPieces = (rawOptions.comboPieces ?? []).slice(0, 8).map((combo) => combo.slice(0, 6));

  const library = expandLibrary(parsed, cards);
  const commanders = resolvedCommanders(parsed, cards);
  const commanderCost = commanders.length > 0 ? Math.min(...commanders.map((card) => card.cmc)) : null;

  if (library.length < 40) {
    throw new Error(`Simulation needs a mostly resolved deck library; only ${library.length} cards were available.`);
  }

  const random = new SeededRandom(seed);
  const results: IterationResult[] = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    results.push(
      runIteration(
        library,
        commanderCost,
        { turns, maxMulligans, comboPieces },
        random,
      ),
    );
  }

  const avgManaByTurn = Array.from({ length: turns }, (_, index) =>
    Number(
      (
        results.reduce((sum, result) => sum + (result.manaByTurn[index] ?? 0), 0) /
        results.length
      ).toFixed(2),
    ),
  );
  const avgLandsByTurn = Array.from({ length: turns }, (_, index) =>
    Number(
      (
        results.reduce((sum, result) => sum + (result.landsByTurn[index] ?? 0), 0) /
        results.length
      ).toFixed(2),
    ),
  );

  const naturalCombos = comboPieces.map((pieces, comboIndex) => ({
    pieces,
    naturalAssemblyByTurn: cumulativeTurnPercent(
      results,
      (result) => result.naturalComboTurns[comboIndex] ?? null,
      turns,
    ),
    tutorAssistedProxyByTurn: cumulativeTurnPercent(
      results,
      (result) => result.tutorProxyComboTurns[comboIndex] ?? null,
      turns,
    ),
  }));

  const turn3Index = Math.min(2, turns - 1);
  const turn5Index = Math.min(4, turns - 1);

  return {
    model: 'Monte Carlo goldfish/consistency model',
    iterations,
    seed,
    turns,
    libraryCardsResolved: library.length,
    commanderManaValueUsed: commanderCost,
    mulliganPolicy: {
      maxMulligans,
      rule: 'London-style redraws; keep 2–4 lands, or a constrained one-land/cheap-ramp hand. Bottoming favors keeping lands, cheap ramp, draw, tutors, and interaction.',
    },
    openingHands: {
      functionalKeepRate: percentage(results.filter((result) => result.functionalOpening).length, results.length),
      mulliganAtLeastOnceRate: percentage(results.filter((result) => result.mulligans >= 1).length, results.length),
      mulliganTwiceOrMoreRate: percentage(results.filter((result) => result.mulligans >= 2).length, results.length),
      averageOpeningLands: Number(
        (results.reduce((sum, result) => sum + result.openingLands, 0) / results.length).toFixed(2),
      ),
    },
    development: {
      averageManaAvailableByTurn: Object.fromEntries(avgManaByTurn.map((value, index) => [`turn${index + 1}`, value])),
      averageLandsInPlayByTurn: Object.fromEntries(avgLandsByTurn.map((value, index) => [`turn${index + 1}`, value])),
      manaScrewProxyByTurn3: percentage(
        results.filter((result) => (result.landsByTurn[turn3Index] ?? 0) < 2).length,
        results.length,
      ),
      floodProxyByTurn5: percentage(
        results.filter((result) => (result.landsByTurn[turn5Index] ?? 0) >= 5).length,
        results.length,
      ),
    },
    commander: {
      castableByTurn: cumulativeTurnPercent(results, (result) => result.commanderCastTurn, turns),
    },
    interaction: {
      affordableInteractionSeenByTurn: cumulativeTurnPercent(
        results,
        (result) => result.interactionOnlineTurn,
        turns,
      ),
    },
    cardAdvantage: {
      affordableDrawSeenByTurn: cumulativeTurnPercent(results, (result) => result.drawOnlineTurn, turns),
    },
    combos: naturalCombos,
    caveats: [
      'This is a consistency/goldfish simulator, not a complete Magic rules engine.',
      'Mana colors, sequencing choices, tapped lands, summoning sickness beyond mana dorks, taxes, removal, stack interaction, combat, and opponent decisions are simplified or omitted.',
      'Tutor-assisted combo numbers are a proxy: any tutor is treated as able to cover one missing combo piece, so use natural assembly as the conservative number.',
      'Use observed tournament/reference data alongside this model before treating a structural difference as evidence of real match performance.',
    ],
  };
}
