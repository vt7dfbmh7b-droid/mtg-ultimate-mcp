import type { ScryfallCard } from '../types/scryfall.js';
import type { ParsedDeck } from './deck.js';
import { buildDeckMetrics } from './deck.js';
import { simulateDeckConsistency } from './simulation.js';

export type PodPressureProfile = 'goldfish' | 'casual' | 'core' | 'upgraded' | 'optimized' | 'cedh';

export interface PressureParameters {
  commanderRemovalPerTurn: number;
  keySpellInteractionChance: number;
  boardResetPerTurn: number;
}

export interface PodSimulationOptions {
  iterations?: number;
  turns?: number;
  seed?: number;
  maxMulligans?: number;
  comboPieces?: string[][];
  podProfile?: PodPressureProfile;
  customPressure?: {
    commanderRemovalPerTurn?: number | undefined;
    keySpellInteractionChance?: number | undefined;
    boardResetPerTurn?: number | undefined;
  };
}

const PROFILES: Record<PodPressureProfile, PressureParameters> = {
  goldfish: { commanderRemovalPerTurn: 0, keySpellInteractionChance: 0, boardResetPerTurn: 0 },
  casual: { commanderRemovalPerTurn: 0.06, keySpellInteractionChance: 0.05, boardResetPerTurn: 0.025 },
  core: { commanderRemovalPerTurn: 0.10, keySpellInteractionChance: 0.08, boardResetPerTurn: 0.04 },
  upgraded: { commanderRemovalPerTurn: 0.15, keySpellInteractionChance: 0.14, boardResetPerTurn: 0.055 },
  optimized: { commanderRemovalPerTurn: 0.20, keySpellInteractionChance: 0.20, boardResetPerTurn: 0.07 },
  cedh: { commanderRemovalPerTurn: 0.28, keySpellInteractionChance: 0.32, boardResetPerTurn: 0.05 },
};

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value ?? fallback)));
}

function clampProbability(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value ?? fallback));
}

class Random {
  private state: number;
  constructor(seed: number) {
    this.state = (seed >>> 0) || 0x6d2b79f5;
  }
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

function turnCurve(record: unknown, turns: number): number[] {
  const source = (record ?? {}) as Record<string, unknown>;
  return Array.from({ length: turns }, (_, index) => {
    const value = Number(source[`turn${index + 1}`] ?? 0);
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) / 100 : 0;
  });
}

function sampleCumulativeTurn(curve: number[], random: Random, minimumTurn = 1): number | null {
  const roll = random.next();
  for (let index = Math.max(0, minimumTurn - 1); index < curve.length; index += 1) {
    if ((curve[index] ?? 0) >= roll) return index + 1;
  }
  return null;
}

function protectionSeenProbability(protectionCount: number, turn: number, librarySize = 99): number {
  if (protectionCount <= 0) return 0;
  const cardsSeen = Math.min(librarySize, 7 + turn);
  const missSingleDraw = Math.max(0, (librarySize - protectionCount) / librarySize);
  return 1 - Math.pow(missSingleDraw, cardsSeen);
}

function percentage(value: number, total: number): number {
  return total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;
}

function average(value: number, total: number): number {
  return total > 0 ? Number((value / total).toFixed(2)) : 0;
}

function resolvePressure(profile: PodPressureProfile, custom?: PodSimulationOptions['customPressure']): PressureParameters {
  const defaults = PROFILES[profile];
  return {
    commanderRemovalPerTurn: clampProbability(custom?.commanderRemovalPerTurn, defaults.commanderRemovalPerTurn),
    keySpellInteractionChance: clampProbability(custom?.keySpellInteractionChance, defaults.keySpellInteractionChance),
    boardResetPerTurn: clampProbability(custom?.boardResetPerTurn, defaults.boardResetPerTurn),
  };
}

export function simulatePodPressureV04(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  rawOptions: PodSimulationOptions = {},
): Record<string, unknown> {
  const iterations = clampInt(rawOptions.iterations, 5_000, 250, 50_000);
  const turns = clampInt(rawOptions.turns, 8, 3, 15);
  const seed = clampInt(rawOptions.seed, 20_260_816, 1, 2_147_483_647);
  const maxMulligans = clampInt(rawOptions.maxMulligans, 2, 0, 4);
  const comboPieces = (rawOptions.comboPieces ?? []).slice(0, 8).map((combo) => combo.slice(0, 6));
  const podProfile = rawOptions.podProfile ?? 'upgraded';
  const pressure = resolvePressure(podProfile, rawOptions.customPressure);

  const base = simulateDeckConsistency(parsed, cards, {
    iterations,
    turns,
    seed,
    maxMulligans,
    comboPieces,
  });
  const metrics = buildDeckMetrics(parsed, cards);
  const commanderProfiles = (base.commanders ?? []) as Array<Record<string, unknown>>;
  const comboProfiles = (base.combos ?? []) as Array<Record<string, unknown>>;
  const random = new Random(seed ^ 0x5f3759df);

  const commanders = commanderProfiles.map((commander) => {
    const firstCurve = turnCurve(commander.firstCastableByTurn, turns);
    const taxOneCurve = turnCurve(commander.castableWithOneCommanderTaxByTurn, turns);
    const taxTwoCurve = turnCurve(commander.castableWithTwoCommanderTaxesByTurn, turns);
    let firstCastCount = 0;
    let firstRemovalCount = 0;
    let firstRecastCount = 0;
    let secondRemovalCount = 0;
    let secondRecastCount = 0;
    let totalUptime = 0;
    let totalRemovalEvents = 0;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const firstCast = sampleCumulativeTurn(firstCurve, random);
      if (firstCast === null) continue;
      firstCastCount += 1;
      let currentCastTurn = firstCast;
      let taxStage = 0;

      for (let turn = firstCast; turn <= turns; turn += 1) {
        if (turn < currentCastTurn) continue;
        totalUptime += 1;
        const creatureBoardExposure = pressure.boardResetPerTurn * 0.65;
        const removalChance = 1 - (1 - pressure.commanderRemovalPerTurn) * (1 - creatureBoardExposure);
        if (random.next() >= removalChance) continue;

        totalRemovalEvents += 1;
        if (taxStage === 0) firstRemovalCount += 1;
        if (taxStage === 1) secondRemovalCount += 1;
        taxStage += 1;
        if (taxStage > 2) break;

        const recastCurve = taxStage === 1 ? taxOneCurve : taxTwoCurve;
        const recast = sampleCumulativeTurn(recastCurve, random, turn + 1);
        if (recast === null) break;
        if (taxStage === 1) firstRecastCount += 1;
        if (taxStage === 2) secondRecastCount += 1;
        currentCastTurn = recast;
        turn = recast - 1;
      }
    }

    return {
      name: commander.name,
      firstCastBySimulationHorizon: percentage(firstCastCount, iterations),
      removedAtLeastOnceProxy: percentage(firstRemovalCount, Math.max(1, firstCastCount)),
      recastAfterFirstRemovalProxy: percentage(firstRecastCount, Math.max(1, firstRemovalCount)),
      removedTwiceProxy: percentage(secondRemovalCount, Math.max(1, firstCastCount)),
      recastAfterSecondRemovalProxy: percentage(secondRecastCount, Math.max(1, secondRemovalCount)),
      averageCommanderUptimeTurns: average(totalUptime, iterations),
      averageRemovalEvents: average(totalRemovalEvents, iterations),
      baseCastability: {
        firstCastableByTurn: commander.firstCastableByTurn,
        plusTwoTaxCastableByTurn: commander.castableWithOneCommanderTaxByTurn,
        plusFourTaxCastableByTurn: commander.castableWithTwoCommanderTaxesByTurn,
      },
    };
  });

  const combos = comboProfiles.map((combo) => {
    const assemblyCurve = turnCurve(combo.naturalAssemblyByTurn, turns);
    const tutorCurve = turnCurve(combo.tutorAssistedProxyByTurn, turns);
    let naturalAttempts = 0;
    let naturalResolutions = 0;
    let tutorAttempts = 0;
    let tutorResolutions = 0;
    let protectedNatural = 0;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const naturalTurn = sampleCumulativeTurn(assemblyCurve, random);
      if (naturalTurn !== null) {
        naturalAttempts += 1;
        const challenged = random.next() < pressure.keySpellInteractionChance;
        const protectionSeen = random.next() < protectionSeenProbability(metrics.protectionCount, naturalTurn);
        if (!challenged || protectionSeen) {
          naturalResolutions += 1;
          if (challenged && protectionSeen) protectedNatural += 1;
        }
      }

      const tutorTurn = sampleCumulativeTurn(tutorCurve, random);
      if (tutorTurn !== null) {
        tutorAttempts += 1;
        const tutorExposure = Math.min(1, pressure.keySpellInteractionChance * 1.12);
        const challenged = random.next() < tutorExposure;
        const protectionSeen = random.next() < protectionSeenProbability(metrics.protectionCount, tutorTurn);
        if (!challenged || protectionSeen) tutorResolutions += 1;
      }
    }

    return {
      pieces: combo.pieces,
      naturalAssemblyBase: combo.naturalAssemblyByTurn,
      tutorAssistedBase: combo.tutorAssistedProxyByTurn,
      naturalAttemptRateByHorizon: percentage(naturalAttempts, iterations),
      naturalResolutionUnderPressureProxy: percentage(naturalResolutions, iterations),
      challengedNaturalAttemptsSavedByProtectionProxy: percentage(protectedNatural, Math.max(1, naturalAttempts)),
      tutorAssistedAttemptRateByHorizon: percentage(tutorAttempts, iterations),
      tutorAssistedResolutionUnderPressureProxy: percentage(tutorResolutions, iterations),
    };
  });

  return {
    model: 'MTG Ultimate V0.4 pod-pressure overlay',
    iterations,
    turns,
    seed,
    podProfile,
    pressureAssumptions: pressure,
    protectionCardsDetected: metrics.protectionCount,
    commanders,
    combos,
    baseConsistencyModel: base,
    interpretation: [
      'Legality and card rules are deterministic elsewhere; these pod-pressure numbers are scenario outputs, not official rules or observed win rates.',
      'Commander removal is applied after the base mana model says a commander is castable; recasts use the +2/+4 tax affordability curves.',
      'Key-spell interaction is applied to combo attempts, while detected protection density creates a transparent protection-seen proxy.',
      'Higher pressure profiles represent more frequent interaction, not stronger player skill or guaranteed competitive outcomes.',
    ],
    caveats: [
      'Pressure percentages are explicit configurable assumptions and are not claimed to be universal real-world frequencies.',
      'The overlay does not yet choose exact opponent cards, resolve a full stack, model priority passes, or model politics.',
      'Commander uptime does not yet feed back into every commander-dependent card in the 99.',
      'Tutor-assisted combo assembly remains inherited from the V0.3 tutor proxy until exact tutor target timing is implemented.',
    ],
  };
}
