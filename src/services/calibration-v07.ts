import type { PodPressureV06 } from './simulation-v06.js';

export interface TournamentMetricSnapshotV07 {
  interactionCount?: number | undefined;
  cheapInteractionCount?: number | undefined;
  protectionCount?: number | undefined;
  tutorCount?: number | undefined;
  fastManaCount?: number | undefined;
  rampCount?: number | undefined;
  averageNonlandManaValue?: number | undefined;
}

interface NormalizedTournamentMetricsV07 {
  interactionCount: number;
  cheapInteractionCount: number;
  protectionCount: number;
  tutorCount: number;
  fastManaCount: number;
  rampCount: number;
  averageNonlandManaValue: number;
}

export interface PressureCalibrationV07 {
  selectedPressure: PodPressureV06;
  structuralPressureScore: number;
  inputs: NormalizedTournamentMetricsV07;
  signals: Array<{ signal: string; contribution: number; explanation: string }>;
  confidence: 'low' | 'medium';
  explanation: string;
  caveats: string[];
}

function number(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;
}

export function calibratePressureFromMetricsV07(metrics: TournamentMetricSnapshotV07): PressureCalibrationV07 {
  const inputs: NormalizedTournamentMetricsV07 = {
    interactionCount: number(metrics.interactionCount),
    cheapInteractionCount: number(metrics.cheapInteractionCount),
    protectionCount: number(metrics.protectionCount),
    tutorCount: number(metrics.tutorCount),
    fastManaCount: number(metrics.fastManaCount),
    rampCount: number(metrics.rampCount),
    averageNonlandManaValue: number(metrics.averageNonlandManaValue),
  };

  const signals = [
    {
      signal: 'cheap/free interaction',
      contribution: inputs.cheapInteractionCount * 1.15,
      explanation: 'Cheap interaction is the strongest decklist-level proxy for how often important spells can be challenged while players still develop their boards.',
    },
    {
      signal: 'total interaction',
      contribution: inputs.interactionCount * 0.45,
      explanation: 'More total interaction generally increases the number of plausible disruption windows, though not every interaction spell hits every threat.',
    },
    {
      signal: 'protection',
      contribution: inputs.protectionCount * 0.55,
      explanation: 'Protection density raises the chance that important plays are defended rather than simply stopped.',
    },
    {
      signal: 'tutors',
      contribution: inputs.tutorCount * 0.35,
      explanation: 'Tutor density is used as a proxy for consistency and access to interaction/win pieces, not as interaction itself.',
    },
    {
      signal: 'fast mana',
      contribution: inputs.fastManaCount * 0.4,
      explanation: 'Fast mana compresses turn windows and is used as a proxy for faster, more resource-dense environments.',
    },
  ];
  const structuralPressureScore = Number(signals.reduce((sum, signal) => sum + signal.contribution, 0).toFixed(2));

  const selectedPressure: PodPressureV06 = structuralPressureScore < 7
    ? 'casual'
    : structuralPressureScore < 14
      ? 'upgraded'
      : structuralPressureScore < 22
        ? 'optimized'
        : 'cedh';

  const populatedSignals = [
    inputs.interactionCount,
    inputs.cheapInteractionCount,
    inputs.protectionCount,
    inputs.tutorCount,
    inputs.fastManaCount,
  ].filter((value) => value > 0).length;

  return {
    selectedPressure,
    structuralPressureScore,
    inputs,
    signals: signals.map((signal) => ({ ...signal, contribution: Number(signal.contribution.toFixed(2)) })),
    confidence: populatedSignals >= 4 ? 'medium' : 'low',
    explanation: `The sampled deck structure maps most closely to the existing ${selectedPressure} simulation-pressure preset. This is a calibration proxy from deck construction, not a measured per-game interaction rate.`,
    caveats: [
      'Tournament decklists show what players registered, not exactly when cards were drawn, cast, held up, or aimed at a particular player.',
      'Pilot skill, matchup, seat order, mulligans, hidden information, politics, event rules, and variance can all change actual pressure.',
      'The score is intentionally a transparent heuristic. It should be re-tuned as larger observed datasets or game-log data become available.',
    ],
  };
}

export function calibratePressureFromTournamentAnalysisV07(analysis: Record<string, unknown>): PressureCalibrationV07 | null {
  const cohort = analysis.highPerformingCohort as Record<string, unknown> | undefined;
  const metrics = cohort?.averageMetrics as Record<string, unknown> | undefined;
  if (!metrics) return null;
  const read = (key: string): number | undefined => typeof metrics[key] === 'number' ? metrics[key] as number : undefined;
  return calibratePressureFromMetricsV07({
    interactionCount: read('interactionCount'),
    cheapInteractionCount: read('cheapInteractionCount'),
    protectionCount: read('protectionCount'),
    tutorCount: read('tutorCount'),
    fastManaCount: read('fastManaCount'),
    rampCount: read('rampCount'),
    averageNonlandManaValue: read('averageNonlandManaValue'),
  });
}
