import type { ScryfallCard } from '../types/scryfall.js';
import type { ParsedDeck } from './deck.js';
import { resolveEntryCard } from './deck.js';
import { getCardManaCost, getCardOracleText, inferCardRoles } from './scryfall.js';

export interface DeckSimulationOptions {
  iterations?: number;
  turns?: number;
  seed?: number;
  maxMulligans?: number;
  comboPieces?: string[][];
}

type TapMode = 'untapped' | 'conditional' | 'tapped';

interface SimCard {
  name: string;
  cmc: number;
  manaCost: string;
  oracleText: string;
  roles: Set<string>;
  isLand: boolean;
  isModalLand: boolean;
  isLandOption: boolean;
  isCreature: boolean;
  isRamp: boolean;
  isTutor: boolean;
  isInteraction: boolean;
  isDraw: boolean;
  producedMana: string[];
  sourceOutput: number;
  tapMode: TapMode;
  oneShotMana: boolean;
  landRamp: boolean;
}

interface ManaSource {
  id: number;
  colors: string[];
  output: number;
}

interface ManaUnit {
  sourceId: number;
  colors: string[];
}

interface CommanderProfile {
  name: string;
  cmc: number;
  manaCost: string;
}

interface IterationResult {
  mulligans: number;
  openingLands: number;
  openingLandOptions: number;
  functionalOpening: boolean;
  spendableManaByTurn: number[];
  landsByTurn: number[];
  colorCoverageByTurn: number[];
  tappedLandDropsByTurn: number[];
  mdfcLandDropsByTurn: number[];
  commanderCastTurns: Array<number | null>;
  commanderTaxOneCastTurns: Array<number | null>;
  commanderTaxTwoCastTurns: Array<number | null>;
  interactionOnlineTurn: number | null;
  drawOnlineTurn: number | null;
  naturalComboTurns: Array<number | null>;
  tutorProxyComboTurns: Array<number | null>;
}

const COLORS = ['W', 'U', 'B', 'R', 'G'] as const;

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

function modalLand(card: ScryfallCard): boolean {
  const faces = card.card_faces ?? [];
  return faces.some((face) => /\bland\b/i.test(face.type_line ?? '')) && faces.some((face) => !/\bland\b/i.test(face.type_line ?? ''));
}

function sourceOutput(card: ScryfallCard, text: string): number {
  if (/add \{[WUBRGC]\}\{[WUBRGC]\}\{[WUBRGC]\}/i.test(text) || /add three mana/i.test(text)) return 3;
  if (/add \{[WUBRGC]\}\{[WUBRGC]\}/i.test(text) || /add two mana/i.test(text)) return 2;
  return 1;
}

function tapMode(card: ScryfallCard, text: string): TapMode {
  if (!/\b(?:enters|enter the battlefield) tapped\b/i.test(text)) return 'untapped';
  if (/unless|if you don['’]t|you may pay|you may have|as .* enters|if .* entered|if you control/i.test(text)) return 'conditional';
  return 'tapped';
}

function producedMana(card: ScryfallCard): string[] {
  const values = (card.produced_mana ?? []).map((value) => value.toUpperCase()).filter(Boolean);
  if (values.length > 0) return [...new Set(values)];
  const type = card.type_line.toLowerCase();
  const fallback: string[] = [];
  if (type.includes('plains')) fallback.push('W');
  if (type.includes('island')) fallback.push('U');
  if (type.includes('swamp')) fallback.push('B');
  if (type.includes('mountain')) fallback.push('R');
  if (type.includes('forest')) fallback.push('G');
  return fallback.length > 0 ? fallback : ['C'];
}

function toSimCard(card: ScryfallCard): SimCard {
  const roles = new Set(inferCardRoles(card));
  const typeLine = card.type_line.toLowerCase();
  const oracleText = getCardOracleText(card);
  const isModalLand = modalLand(card);
  const isLand = typeLine.includes('land') && !isModalLand;
  const isCreature = typeLine.includes('creature');
  const landRamp = roles.has('land ramp');
  const isRamp =
    roles.has('mana acceleration') ||
    landRamp ||
    roles.has('mana rock') ||
    roles.has('mana dork') ||
    roles.has('fast mana');
  const oneShotMana =
    typeLine.includes('instant') ||
    typeLine.includes('sorcery') ||
    /sacrifice (?:this|~|[a-z' -]+)[,:].*add|sacrifice [^.:]+[.:]\s*add/i.test(oracleText);

  return {
    name: card.name,
    cmc: card.cmc,
    manaCost: getCardManaCost(card),
    oracleText,
    roles,
    isLand,
    isModalLand,
    isLandOption: isLand || isModalLand,
    isCreature,
    isRamp,
    isTutor: roles.has('tutor'),
    isInteraction:
      roles.has('spot interaction') ||
      roles.has('countermagic') ||
      roles.has('board wipe') ||
      roles.has('free interaction'),
    isDraw: roles.has('card draw') || roles.has('card selection') || roles.has('repeatable draw'),
    producedMana: producedMana(card),
    sourceOutput: sourceOutput(card, oracleText),
    tapMode: tapMode(card, oracleText),
    oneShotMana,
    landRamp,
  };
}

function expandLibrary(parsed: ParsedDeck, cards: ScryfallCard[]): SimCard[] {
  const library: SimCard[] = [];
  for (const entry of parsed.main) {
    const resolved = resolveEntryCard(entry, cards);
    if (!resolved) continue;
    const simCard = toSimCard(resolved);
    for (let copy = 0; copy < entry.quantity; copy += 1) library.push(simCard);
  }
  return library;
}

function resolvedCommanders(parsed: ParsedDeck, cards: ScryfallCard[]): CommanderProfile[] {
  return parsed.commanders
    .map((entry) => resolveEntryCard(entry, cards))
    .filter((card): card is ScryfallCard => Boolean(card))
    .map((card) => ({ name: card.name, cmc: card.cmc, manaCost: getCardManaCost(card) }));
}

function openingScore(card: SimCard, landOptionsInHand: number): number {
  if (card.isLand) return landOptionsInHand > 3 ? 1 : 5;
  if (card.isModalLand) return landOptionsInHand > 3 ? 2 : 4;
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
  const actualLands = hand.filter((card) => card.isLand).length;
  const landOptions = hand.filter((card) => card.isLandOption).length;
  const cheapRamp = hand.filter((card) => card.isRamp && card.cmc <= 2).length;
  const cheapAction = hand.filter((card) => !card.isLand && card.cmc <= 2).length;
  if (landOptions >= 2 && landOptions <= 4) return true;
  if (actualLands === 1 && landOptions >= 1 && cheapRamp >= 1 && cheapAction >= 2) return true;
  if (landOptions === 5 && hand.some((card) => card.isDraw && card.cmc <= 2)) return true;
  return false;
}

function londonBottom(hand: SimCard[], count: number): { kept: SimCard[]; bottomed: SimCard[] } {
  if (count <= 0) return { kept: hand, bottomed: [] };
  const landOptions = hand.filter((card) => card.isLandOption).length;
  const scored = hand
    .map((card, index) => ({ card, index, score: openingScore(card, landOptions) }))
    .sort((a, b) => a.score - b.score || b.card.cmc - a.card.cmc);
  const bottomIndices = new Set(scored.slice(0, count).map((item) => item.index));
  return {
    kept: hand.filter((_, index) => !bottomIndices.has(index)),
    bottomed: hand.filter((_, index) => bottomIndices.has(index)),
  };
}

interface ManaCostRequirement {
  generic: number;
  colored: string[][];
}

function parseManaCost(manaCost: string, fallbackCmc: number, genericTax = 0): ManaCostRequirement {
  const frontCost = manaCost.split('//')[0]?.trim() ?? '';
  const symbols = frontCost.match(/\{[^}]+\}/g) ?? [];
  let generic = genericTax;
  const colored: string[][] = [];

  for (const raw of symbols) {
    const symbol = raw.slice(1, -1).toUpperCase();
    if (/^\d+$/.test(symbol)) {
      generic += Number.parseInt(symbol, 10);
      continue;
    }
    if (symbol === 'X' || symbol === 'Y' || symbol === 'Z') continue;
    if (symbol === 'C') {
      colored.push(['C']);
      continue;
    }
    if (COLORS.includes(symbol as (typeof COLORS)[number])) {
      colored.push([symbol]);
      continue;
    }
    const parts = symbol.split('/');
    const colorOptions = parts.filter((part) => COLORS.includes(part as (typeof COLORS)[number]));
    if (colorOptions.length > 0) colored.push([...new Set(colorOptions)]);
  }

  if (symbols.length === 0 && fallbackCmc > 0) generic += fallbackCmc;
  return { generic, colored };
}

function manaUnits(sources: ManaSource[]): ManaUnit[] {
  return sources.flatMap((source) =>
    Array.from({ length: Math.max(1, source.output) }, () => ({
      sourceId: source.id,
      colors: source.colors.length > 0 ? source.colors : ['C'],
    })),
  );
}

function paymentIndices(requirement: ManaCostRequirement, units: ManaUnit[]): number[] | null {
  const requirements = [...requirement.colored].sort((a, b) => a.length - b.length);
  const used = new Set<number>();

  const assign = (requirementIndex: number): boolean => {
    if (requirementIndex >= requirements.length) return true;
    const options = requirements[requirementIndex] ?? [];
    for (let index = 0; index < units.length; index += 1) {
      if (used.has(index)) continue;
      const unit = units[index];
      if (!unit || !options.some((option) => unit.colors.includes(option))) continue;
      used.add(index);
      if (assign(requirementIndex + 1)) return true;
      used.delete(index);
    }
    return false;
  };

  if (!assign(0)) return null;
  const remaining = units.map((_, index) => index).filter((index) => !used.has(index));
  if (remaining.length < requirement.generic) return null;
  for (const index of remaining.slice(0, requirement.generic)) used.add(index);
  return [...used];
}

function canPay(card: Pick<SimCard, 'manaCost' | 'cmc'>, units: ManaUnit[], genericTax = 0): boolean {
  return paymentIndices(parseManaCost(card.manaCost, card.cmc, genericTax), units) !== null;
}

function spendFor(card: Pick<SimCard, 'manaCost' | 'cmc'>, units: ManaUnit[], genericTax = 0): ManaUnit[] | null {
  const indices = paymentIndices(parseManaCost(card.manaCost, card.cmc, genericTax), units);
  if (!indices) return null;
  const spent = new Set(indices);
  return units.filter((_, index) => !spent.has(index));
}

function commanderCanPay(commander: CommanderProfile, units: ManaUnit[], tax: number): boolean {
  return paymentIndices(parseManaCost(commander.manaCost, commander.cmc, tax), units) !== null;
}

function neededCommanderColors(commanders: CommanderProfile[]): string[] {
  const colors = new Set<string>();
  for (const commander of commanders) {
    for (const symbol of parseManaCost(commander.manaCost, commander.cmc).colored.flat()) {
      if (COLORS.includes(symbol as (typeof COLORS)[number])) colors.add(symbol);
    }
  }
  return [...colors];
}

function landScore(card: SimCard, wantedColors: string[]): number {
  const overlap = card.producedMana.filter((color) => wantedColors.includes(color)).length;
  const tempo = card.tapMode === 'untapped' ? 8 : card.tapMode === 'conditional' ? 5 : 1;
  return tempo + overlap * 2 + card.sourceOutput - (card.isModalLand ? 2 : 0);
}

function chooseLandIndex(hand: SimCard[], wantedColors: string[]): number {
  const candidates = hand
    .map((card, index) => ({ card, index, score: card.isLandOption ? landScore(card, wantedColors) : -Infinity }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.index ?? -1;
}

function sourceColors(card: SimCard, commanderColors: string[]): string[] {
  if (/sacrifice .*search your library for .*\bland\b/i.test(card.oracleText) && commanderColors.length > 0) {
    return commanderColors;
  }
  return card.producedMana.length > 0 ? card.producedMana : ['C'];
}

function landEntersTapped(card: SimCard, random: SeededRandom): boolean {
  if (card.tapMode === 'tapped') return true;
  if (card.tapMode === 'conditional') return random.next() < 0.25;
  return false;
}

function isTapCreatureRamp(card: SimCard): boolean {
  return card.isCreature && /\{T\}:\s*Add|whenever .* add .* mana/i.test(card.oracleText);
}

function comboTurn(pieces: string[], seenNames: Set<string>, tutorsSeen: number, tutorProxy: boolean): boolean {
  const normalized = pieces.map((piece) => piece.toLocaleLowerCase());
  const missing = normalized.filter((piece) => !seenNames.has(piece)).length;
  return tutorProxy ? missing <= tutorsSeen : missing === 0;
}

function runIteration(
  librarySource: SimCard[],
  commanders: CommanderProfile[],
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
  const openingLandOptions = hand.filter((card) => card.isLandOption).length;
  const { kept, bottomed } = londonBottom(hand, mulligans);
  hand = [...kept];
  const library = [...shuffled.slice(7), ...bottomed];
  let drawIndex = 0;

  const seenNames = new Set(hand.map((card) => card.name.toLocaleLowerCase()));
  let tutorsSeen = hand.filter((card) => card.isTutor).length;
  const commanderColors = neededCommanderColors(commanders);
  const activeSources: ManaSource[] = [];
  let delayedSources: ManaSource[] = [];
  let sourceId = 1;
  let landsInPlay = 0;
  let interactionOnlineTurn: number | null = null;
  let drawOnlineTurn: number | null = null;
  const spendableManaByTurn: number[] = [];
  const landsByTurn: number[] = [];
  const colorCoverageByTurn: number[] = [];
  const tappedLandDropsByTurn: number[] = [];
  const mdfcLandDropsByTurn: number[] = [];
  const commanderCastTurns = commanders.map(() => null as number | null);
  const commanderTaxOneCastTurns = commanders.map(() => null as number | null);
  const commanderTaxTwoCastTurns = commanders.map(() => null as number | null);
  const naturalComboTurns = options.comboPieces.map(() => null as number | null);
  const tutorProxyComboTurns = options.comboPieces.map(() => null as number | null);
  let cumulativeTappedLandDrops = 0;
  let cumulativeMdfcLandDrops = 0;

  const functionalOpening = shouldKeepOpening(hand);

  for (let turn = 1; turn <= options.turns; turn += 1) {
    activeSources.push(...delayedSources);
    delayedSources = [];

    const drawn = library[drawIndex];
    if (drawn) {
      hand.push(drawn);
      seenNames.add(drawn.name.toLocaleLowerCase());
      if (drawn.isTutor) tutorsSeen += 1;
      drawIndex += 1;
    }

    const landIndex = chooseLandIndex(hand, commanderColors);
    let tappedLandSource: ManaSource | null = null;
    if (landIndex >= 0) {
      const land = hand.splice(landIndex, 1)[0];
      if (land) {
        landsInPlay += 1;
        if (land.isModalLand) cumulativeMdfcLandDrops += 1;
        const source: ManaSource = {
          id: sourceId++,
          colors: sourceColors(land, commanderColors),
          output: land.sourceOutput,
        };
        if (landEntersTapped(land, random)) {
          cumulativeTappedLandDrops += 1;
          tappedLandSource = source;
        } else {
          activeSources.push(source);
        }
      }
    }

    let pool = manaUnits(activeSources);

    const markCommanderAvailability = (): void => {
      commanders.forEach((commander, index) => {
        if (commanderCastTurns[index] === null && commanderCanPay(commander, pool, 0)) commanderCastTurns[index] = turn;
        if (commanderTaxOneCastTurns[index] === null && commanderCanPay(commander, pool, 2)) commanderTaxOneCastTurns[index] = turn;
        if (commanderTaxTwoCastTurns[index] === null && commanderCanPay(commander, pool, 4)) commanderTaxTwoCastTurns[index] = turn;
      });
    };

    markCommanderAvailability();
    const commanderAlreadyCastable = commanderCastTurns.some((castTurn) => castTurn === turn);

    if (!commanderAlreadyCastable) {
      let madeProgress = true;
      while (madeProgress) {
        madeProgress = false;
        const candidates = hand
          .map((card, index) => ({ card, index }))
          .filter(({ card }) => card.isRamp && !card.isLandOption)
          .sort((a, b) => a.card.cmc - b.card.cmc);

        for (const candidate of candidates) {
          const currentIndex = hand.indexOf(candidate.card);
          if (currentIndex < 0) continue;
          const remaining = spendFor(candidate.card, pool);
          if (!remaining) continue;

          pool = remaining;
          hand.splice(currentIndex, 1);
          const rampSource: ManaSource = {
            id: sourceId++,
            colors: sourceColors(candidate.card, commanderColors),
            output: candidate.card.sourceOutput,
          };

          if (candidate.card.landRamp || isTapCreatureRamp(candidate.card)) {
            delayedSources.push(rampSource);
          } else if (candidate.card.oneShotMana) {
            pool.push(...manaUnits([rampSource]));
          } else {
            activeSources.push(rampSource);
            pool.push(...manaUnits([rampSource]));
          }
          madeProgress = true;
          markCommanderAvailability();
          break;
        }
      }
    }

    if (tappedLandSource) delayedSources.push(tappedLandSource);

    spendableManaByTurn.push(pool.length);
    landsByTurn.push(landsInPlay);
    tappedLandDropsByTurn.push(cumulativeTappedLandDrops);
    mdfcLandDropsByTurn.push(cumulativeMdfcLandDrops);
    const coverage = new Set(activeSources.flatMap((source) => source.colors).filter((color) => COLORS.includes(color as (typeof COLORS)[number])));
    colorCoverageByTurn.push(coverage.size);

    if (
      interactionOnlineTurn === null &&
      hand.some((card) => card.isInteraction && (card.roles.has('free interaction') || canPay(card, pool)))
    ) {
      interactionOnlineTurn = turn;
    }
    if (drawOnlineTurn === null && hand.some((card) => card.isDraw && canPay(card, pool))) drawOnlineTurn = turn;

    options.comboPieces.forEach((pieces, comboIndex) => {
      if (naturalComboTurns[comboIndex] === null && comboTurn(pieces, seenNames, tutorsSeen, false)) naturalComboTurns[comboIndex] = turn;
      if (tutorProxyComboTurns[comboIndex] === null && comboTurn(pieces, seenNames, tutorsSeen, true)) tutorProxyComboTurns[comboIndex] = turn;
    });
  }

  return {
    mulligans,
    openingLands,
    openingLandOptions,
    functionalOpening,
    spendableManaByTurn,
    landsByTurn,
    colorCoverageByTurn,
    tappedLandDropsByTurn,
    mdfcLandDropsByTurn,
    commanderCastTurns,
    commanderTaxOneCastTurns,
    commanderTaxTwoCastTurns,
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

function averageByTurn(results: IterationResult[], getter: (result: IterationResult) => number[], turns: number): Record<string, number> {
  return Object.fromEntries(
    Array.from({ length: turns }, (_, index) => {
      const average = results.reduce((sum, result) => sum + (getter(result)[index] ?? 0), 0) / results.length;
      return [`turn${index + 1}`, Number(average.toFixed(2))];
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
  const comboPieces = (rawOptions.comboPieces ?? []).slice(0, 8).map((combo) => combo.slice(0, 6));

  const library = expandLibrary(parsed, cards);
  const commanders = resolvedCommanders(parsed, cards);
  if (library.length < 40) throw new Error(`Simulation needs a mostly resolved deck library; only ${library.length} cards were available.`);

  const random = new SeededRandom(seed);
  const results: IterationResult[] = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    results.push(runIteration(library, commanders, { turns, maxMulligans, comboPieces }, random));
  }

  const naturalCombos = comboPieces.map((pieces, comboIndex) => ({
    pieces,
    naturalAssemblyByTurn: cumulativeTurnPercent(results, (result) => result.naturalComboTurns[comboIndex] ?? null, turns),
    tutorAssistedProxyByTurn: cumulativeTurnPercent(results, (result) => result.tutorProxyComboTurns[comboIndex] ?? null, turns),
  }));

  const turn3Index = Math.min(2, turns - 1);
  const turn5Index = Math.min(4, turns - 1);
  const commanderProfiles = commanders.map((commander, commanderIndex) => ({
    name: commander.name,
    manaCost: commander.manaCost,
    manaValue: commander.cmc,
    firstCastableByTurn: cumulativeTurnPercent(results, (result) => result.commanderCastTurns[commanderIndex] ?? null, turns),
    castableWithOneCommanderTaxByTurn: cumulativeTurnPercent(results, (result) => result.commanderTaxOneCastTurns[commanderIndex] ?? null, turns),
    castableWithTwoCommanderTaxesByTurn: cumulativeTurnPercent(results, (result) => result.commanderTaxTwoCastTurns[commanderIndex] ?? null, turns),
  }));

  return {
    model: 'Monte Carlo Commander consistency model V0.3',
    iterations,
    seed,
    turns,
    libraryCardsResolved: library.length,
    commanders: commanderProfiles,
    mulliganPolicy: {
      maxMulligans,
      rule: 'London-style redraws; MDFCs with a land face count as land options. Bottoming favors real lands, flexible lands, cheap ramp, draw, tutors, and interaction.',
    },
    openingHands: {
      functionalKeepRate: percentage(results.filter((result) => result.functionalOpening).length, results.length),
      mulliganAtLeastOnceRate: percentage(results.filter((result) => result.mulligans >= 1).length, results.length),
      mulliganTwiceOrMoreRate: percentage(results.filter((result) => result.mulligans >= 2).length, results.length),
      averageOpeningLands: Number((results.reduce((sum, result) => sum + result.openingLands, 0) / results.length).toFixed(2)),
      averageOpeningLandOptionsIncludingMdfcs: Number((results.reduce((sum, result) => sum + result.openingLandOptions, 0) / results.length).toFixed(2)),
    },
    development: {
      averageSpendableManaByTurn: averageByTurn(results, (result) => result.spendableManaByTurn, turns),
      averageLandsInPlayByTurn: averageByTurn(results, (result) => result.landsByTurn, turns),
      averageColoredCoverageByTurn: averageByTurn(results, (result) => result.colorCoverageByTurn, turns),
      averageTappedLandDropsByTurn: averageByTurn(results, (result) => result.tappedLandDropsByTurn, turns),
      averageMdfcsUsedAsLandsByTurn: averageByTurn(results, (result) => result.mdfcLandDropsByTurn, turns),
      manaScrewProxyByTurn3: percentage(results.filter((result) => (result.landsByTurn[turn3Index] ?? 0) < 2).length, results.length),
      floodProxyByTurn5: percentage(results.filter((result) => (result.landsByTurn[turn5Index] ?? 0) >= 5).length, results.length),
    },
    interaction: {
      affordableInteractionSeenByTurn: cumulativeTurnPercent(results, (result) => result.interactionOnlineTurn, turns),
    },
    cardAdvantage: {
      affordableDrawSeenByTurn: cumulativeTurnPercent(results, (result) => result.drawOnlineTurn, turns),
    },
    combos: naturalCombos,
    improvementsFromV02: [
      'Colored mana pips are checked against simulated source colors instead of using mana value alone.',
      'Always-tapped lands lose the current turn; conditional tapped lands use an explicit probabilistic approximation.',
      'MDFCs with land faces are treated as flexible land options and tracked when consumed as land drops.',
      'Fetch-style lands are approximated as access to commander colors when their Oracle text searches for lands.',
      'Mana rocks, dorks, land-ramp spells, rituals, and one-shot mana are sequenced differently.',
      'Commander first-cast, +2 tax, and +4 tax affordability are reported separately.',
    ],
    caveats: [
      'This remains a consistency/goldfish model, not a complete multiplayer Magic rules engine or a match win-rate predictor.',
      'Conditional tapped-land behavior is approximated; shock-land life payments, check-land conditions, fetch targets, land types, and exact sequencing are not fully solved.',
      'Hybrid, Phyrexian, alternate-cost, convoke/delve/improvise, commander-only mana, and unusual multi-mana restrictions are simplified.',
      'The simulator does not yet model opponents removing mana, taxing spells, countering ramp, combat, politics, priority, or full stack interaction.',
      'Tutor-assisted combo numbers are a proxy: any tutor is treated as able to cover one missing combo piece.',
      'Use observed tournament/reference data alongside simulations before interpreting structural differences as real-world performance evidence.',
    ],
  };
}
