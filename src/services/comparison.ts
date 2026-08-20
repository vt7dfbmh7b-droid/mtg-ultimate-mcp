import type { ScryfallCard } from '../types/scryfall.js';
import { buildDeckMetrics, type ParsedDeck } from './deck.js';
import { simulateDeckConsistency } from './simulation.js';

interface NamedDeck {
  label: string;
  parsed: ParsedDeck;
  cards: ScryfallCard[];
}

interface ComparisonOptions {
  iterations?: number;
  turns?: number;
  seed?: number;
}

function numberAt(object: unknown, path: string[]): number | null {
  let current: unknown = object;
  for (const key of path) {
    if (!current || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'number' && Number.isFinite(current) ? current : null;
}

function delta(first: number, second: number): number {
  return Number((first - second).toFixed(2));
}

function structuralExplanations(
  firstLabel: string,
  secondLabel: string,
  first: ReturnType<typeof buildDeckMetrics>,
  second: ReturnType<typeof buildDeckMetrics>,
): string[] {
  const explanations: string[] = [];
  const compare = (
    firstValue: number,
    secondValue: number,
    threshold: number,
    higherMeaning: string,
    lowerMeaning?: string,
  ) => {
    const difference = firstValue - secondValue;
    if (Math.abs(difference) < threshold) return;
    if (difference > 0) explanations.push(`${firstLabel} has ${Math.abs(Number(difference.toFixed(2)))} more ${higherMeaning} than ${secondLabel}.`);
    else explanations.push(`${firstLabel} has ${Math.abs(Number(difference.toFixed(2)))} fewer ${lowerMeaning ?? higherMeaning} than ${secondLabel}.`);
  };

  compare(first.earlyPlayCount, second.earlyPlayCount, 3, 'early nonland plays (MV 0–2)');
  compare(first.fastManaCount, second.fastManaCount, 2, 'fast-mana pieces');
  compare(first.rampCount, second.rampCount, 3, 'detected mana-acceleration pieces');
  compare(first.drawCount, second.drawCount, 3, 'draw/selection pieces');
  compare(first.tutorCount, second.tutorCount, 2, 'tutors');
  compare(first.interactionCount, second.interactionCount, 3, 'interaction pieces');
  compare(first.cheapInteractionCount, second.cheapInteractionCount, 2, 'cheap/free interaction pieces');
  compare(first.protectionCount, second.protectionCount, 2, 'protection pieces');

  const curveDifference = first.averageNonlandManaValue - second.averageNonlandManaValue;
  if (Math.abs(curveDifference) >= 0.35) {
    explanations.push(
      `${firstLabel}'s average nonland mana value is ${first.averageNonlandManaValue} versus ${second.averageNonlandManaValue} for ${secondLabel}; ${curveDifference > 0 ? 'the higher curve can increase early clunkiness unless acceleration compensates' : 'the lower curve can make early sequencing easier but may trade away raw card impact'}.`,
    );
  }

  const landDifference = first.landCount - second.landCount;
  if (Math.abs(landDifference) >= 3) {
    explanations.push(`${firstLabel} runs ${Math.abs(landDifference)} ${landDifference > 0 ? 'more' : 'fewer'} lands than ${secondLabel}; simulation results should be checked to see whether this changes screw/flood pressure.`);
  }

  return explanations;
}

function simulationExplanations(
  firstLabel: string,
  secondLabel: string,
  first: Record<string, unknown>,
  second: Record<string, unknown>,
  turns: number,
): Array<Record<string, unknown>> {
  const checks: Array<{
    name: string;
    path: string[];
    threshold: number;
    higherIsBetter: boolean;
    meaning: string;
  }> = [
    {
      name: 'functionalKeepRate',
      path: ['openingHands', 'functionalKeepRate'],
      threshold: 3,
      higherIsBetter: true,
      meaning: 'opening-hand keepability under the same heuristic mulligan policy',
    },
    {
      name: 'manaScrewProxyByTurn3',
      path: ['development', 'manaScrewProxyByTurn3'],
      threshold: 3,
      higherIsBetter: false,
      meaning: 'turn-three land-development screw proxy',
    },
    {
      name: 'commanderCastByTurn4',
      path: ['commander', 'castableByTurn', `turn${Math.min(4, turns)}`],
      threshold: 5,
      higherIsBetter: true,
      meaning: 'commander castability by the comparison turn',
    },
    {
      name: 'interactionByTurn3',
      path: ['interaction', 'affordableInteractionSeenByTurn', `turn${Math.min(3, turns)}`],
      threshold: 5,
      higherIsBetter: true,
      meaning: 'probability of seeing affordable interaction by the comparison turn',
    },
    {
      name: 'drawByTurn3',
      path: ['cardAdvantage', 'affordableDrawSeenByTurn', `turn${Math.min(3, turns)}`],
      threshold: 5,
      higherIsBetter: true,
      meaning: 'probability of seeing affordable draw/selection by the comparison turn',
    },
  ];

  return checks.flatMap((check) => {
    const firstValue = numberAt(first, check.path);
    const secondValue = numberAt(second, check.path);
    if (firstValue === null || secondValue === null) return [];
    const difference = delta(firstValue, secondValue);
    if (Math.abs(difference) < check.threshold) return [];
    const firstFavored = check.higherIsBetter ? difference > 0 : difference < 0;
    return [{
      metric: check.name,
      first: firstValue,
      second: secondValue,
      difference,
      favoredProfile: firstFavored ? firstLabel : secondLabel,
      interpretation: `${firstFavored ? firstLabel : secondLabel} has the more favorable sampled ${check.meaning} under this simplified model.`,
    }];
  });
}

export function compareDeckPerformanceProfiles(
  firstDeck: NamedDeck,
  secondDeck: NamedDeck,
  options: ComparisonOptions = {},
): Record<string, unknown> {
  const iterations = Math.max(250, Math.min(50_000, Math.trunc(options.iterations ?? 5_000)));
  const turns = Math.max(3, Math.min(12, Math.trunc(options.turns ?? 7)));
  const seed = Math.max(1, Math.min(2_147_483_647, Math.trunc(options.seed ?? 2_026)));

  const firstMetrics = buildDeckMetrics(firstDeck.parsed, firstDeck.cards);
  const secondMetrics = buildDeckMetrics(secondDeck.parsed, secondDeck.cards);
  const firstSimulation = simulateDeckConsistency(firstDeck.parsed, firstDeck.cards, { iterations, turns, seed });
  const secondSimulation = simulateDeckConsistency(secondDeck.parsed, secondDeck.cards, { iterations, turns, seed });

  return {
    model: 'same-seed structural + Monte Carlo profile comparison',
    settings: { iterations, turns, seed },
    first: {
      label: firstDeck.label,
      commanders: firstDeck.parsed.commanders.map((entry) => entry.name),
      metrics: firstMetrics,
      simulation: firstSimulation,
    },
    second: {
      label: secondDeck.label,
      commanders: secondDeck.parsed.commanders.map((entry) => entry.name),
      metrics: secondMetrics,
      simulation: secondSimulation,
    },
    structuralDifferences: structuralExplanations(
      firstDeck.label,
      secondDeck.label,
      firstMetrics,
      secondMetrics,
    ),
    sampledConsistencyDifferences: simulationExplanations(
      firstDeck.label,
      secondDeck.label,
      firstSimulation,
      secondSimulation,
      turns,
    ),
    interpretationRule: 'Use these differences as candidate explanations to investigate. A more favorable structural/simulation profile can explain consistency differences, but it does not prove why a real player won or lost.',
    caveats: [
      'Both decks are tested with the same random seed and simulation settings for a fairer consistency comparison.',
      'This comparison does not model pilot skill, threat assessment, pod composition, interaction from opponents, seat order, politics, matchup, or full Magic rules.',
      'Combine this result with actual tournament records or attributed reference-deck evidence before making real-world performance claims.',
    ],
  };
}
