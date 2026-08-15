import { config } from '../config.js';
import { fetchJson } from '../lib/http.js';
import type { ScryfallCard } from '../types/scryfall.js';
import { buildDeckMetrics, parseDecklist, type DeckMetrics, type ParsedDeck } from './deck.js';
import { getCardsByNames } from './scryfall.js';

interface ArchidektCategory {
  name: string;
  includedInDeck?: boolean;
  isPremier?: boolean;
}

interface ArchidektOracleCard {
  name?: string;
}

interface ArchidektPrinting {
  oracleCard?: ArchidektOracleCard;
  displayName?: string | null;
}

interface ArchidektCardEntry {
  quantity?: number;
  categories?: string[];
  card?: ArchidektPrinting;
}

interface ArchidektDeckResponse {
  id: number;
  name: string;
  updatedAt?: string;
  viewCount?: number;
  private?: boolean;
  unlisted?: boolean;
  theorycrafted?: boolean;
  edhBracket?: number | null;
  owner?: { username?: string };
  categories?: ArchidektCategory[];
  cards?: ArchidektCardEntry[];
}

export interface ReferenceDeckAnalysis {
  source: string;
  sourceUrl: string;
  name: string;
  owner?: string;
  commanderNames: string[];
  deckSize: number;
  metrics: DeckMetrics;
  unresolvedCards: string[];
  metadata: Record<string, unknown>;
}

interface TopDeckStanding {
  standing?: number;
  name?: string;
  id?: string;
  decklist?: string | Record<string, unknown> | null;
  deckObj?: Record<string, unknown> | null;
  wins?: number;
  draws?: number;
  losses?: number;
  winRate?: number;
}

interface TopDeckTournament {
  TID?: string;
  tournamentName?: string;
  startDate?: number;
  standings?: TopDeckStanding[];
}

interface TournamentDeckRecord {
  tournamentId: string;
  tournamentName: string;
  player: string;
  standing: number | null;
  wins: number;
  draws: number;
  losses: number;
  games: number;
  observedWinRate: number;
  parsed: ParsedDeck;
  metrics: DeckMetrics;
  sourceDeckUrl?: string;
}

const BASIC_LANDS = new Set(['plains', 'island', 'swamp', 'mountain', 'forest', 'wastes']);

function archidektId(reference: string | number): number {
  if (typeof reference === 'number' && Number.isInteger(reference) && reference > 0) return reference;
  const text = String(reference).trim();
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  const match = text.match(/archidekt\.com\/(?:decks|api\/decks)\/(\d+)/i);
  if (!match?.[1]) throw new Error(`Could not parse an Archidekt deck id from: ${text}`);
  return Number.parseInt(match[1], 10);
}

function archidektDecklist(data: ArchidektDeckResponse): string {
  const excluded = new Set(
    (data.categories ?? [])
      .filter((category) => category.includedInDeck === false)
      .map((category) => category.name.toLocaleLowerCase()),
  );
  const commanderLines: string[] = [];
  const mainLines: string[] = [];

  for (const entry of data.cards ?? []) {
    const quantity = Math.max(1, Math.trunc(entry.quantity ?? 1));
    const name = entry.card?.oracleCard?.name ?? entry.card?.displayName ?? undefined;
    if (!name) continue;
    const categories = (entry.categories ?? []).map((category) => category.toLocaleLowerCase());
    const isCommander = categories.includes('commander') || categories.includes('commanders');
    const hasIncludedCategory = categories.length === 0 || categories.some((category) => !excluded.has(category));
    if (!hasIncludedCategory && !isCommander) continue;
    const line = `${quantity} ${name}`;
    if (isCommander) commanderLines.push(line);
    else mainLines.push(line);
  }

  return ['// COMMANDER', ...commanderLines, '', '// MAIN', ...mainLines].join('\n');
}

export async function fetchArchidektReference(reference: string | number): Promise<{
  data: ArchidektDeckResponse;
  decklist: string;
  sourceUrl: string;
}> {
  const id = archidektId(reference);
  const sourceUrl = `https://archidekt.com/decks/${id}`;
  const data = await fetchJson<ArchidektDeckResponse>(`https://archidekt.com/api/decks/${id}/`);
  if (data.private) throw new Error(`Archidekt deck ${id} is private and cannot be used as a public reference.`);
  return { data, decklist: archidektDecklist(data), sourceUrl };
}

async function analyzeOneReference(
  decklist: string,
  metadata: Omit<ReferenceDeckAnalysis, 'commanderNames' | 'deckSize' | 'metrics' | 'unresolvedCards'>,
): Promise<ReferenceDeckAnalysis> {
  const parsed = parseDecklist(decklist);
  const names = [...parsed.commanders, ...parsed.main].map((entry) => entry.name);
  const { cards, notFound } = await getCardsByNames(names);
  return {
    ...metadata,
    commanderNames: parsed.commanders.map((entry) => entry.name),
    deckSize: parsed.totalCards,
    metrics: buildDeckMetrics(parsed, cards),
    unresolvedCards: notFound,
  };
}

function cardFrequencyFromDecklists(decklists: string[]): Array<{ card: string; decks: number; percentage: number }> {
  const counts = new Map<string, { display: string; count: number }>();
  for (const decklist of decklists) {
    const parsed = parseDecklist(decklist);
    const names = new Map<string, string>();
    for (const entry of parsed.main) {
      const key = entry.name.toLocaleLowerCase();
      if (BASIC_LANDS.has(key)) continue;
      names.set(key, entry.name);
    }
    for (const [key, display] of names) {
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { display, count: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display))
    .map((item) => ({
      card: item.display,
      decks: item.count,
      percentage: decklists.length > 0 ? Number(((item.count / decklists.length) * 100).toFixed(1)) : 0,
    }));
}

export async function analyzeArchidektReferences(
  references: Array<string | number>,
  targetDecklist?: string,
): Promise<Record<string, unknown>> {
  const safeReferences = references.slice(0, 10);
  if (safeReferences.length === 0) throw new Error('Provide at least one Archidekt public deck id or URL.');

  const fetched = [] as Array<Awaited<ReturnType<typeof fetchArchidektReference>>>;
  for (const reference of safeReferences) fetched.push(await fetchArchidektReference(reference));

  const analyses: ReferenceDeckAnalysis[] = [];
  for (const item of fetched) {
    analyses.push(
      await analyzeOneReference(item.decklist, {
        source: 'Archidekt',
        sourceUrl: item.sourceUrl,
        name: item.data.name,
        ...(item.data.owner?.username ? { owner: item.data.owner.username } : {}),
        metadata: {
          updatedAt: item.data.updatedAt ?? null,
          viewCount: item.data.viewCount ?? null,
          theorycrafted: item.data.theorycrafted ?? null,
          edhBracket: item.data.edhBracket ?? null,
        },
      }),
    );
  }

  let targetComparison: Record<string, unknown> | null = null;
  if (targetDecklist) {
    const target = await analyzeOneReference(targetDecklist, {
      source: 'user',
      sourceUrl: 'user-supplied',
      name: 'Target deck',
      metadata: {},
    });
    const targetCards = new Set(parseDecklist(targetDecklist).main.map((entry) => entry.name.toLocaleLowerCase()));
    const common = cardFrequencyFromDecklists(fetched.map((item) => item.decklist));
    targetComparison = {
      targetMetrics: target.metrics,
      popularReferenceCardsMissingFromTarget: common
        .filter((item) => !targetCards.has(item.card.toLocaleLowerCase()))
        .slice(0, 30),
    };
  }

  return {
    source: 'Archidekt public deck references',
    attribution: 'Reference decks are credited to their Archidekt owners and link back to the original public deck.',
    referenceCount: analyses.length,
    references: analyses,
    commonCardsAcrossReferences: cardFrequencyFromDecklists(fetched.map((item) => item.decklist)).slice(0, 40),
    targetComparison,
    caveats: [
      'Archidekt views, tags, and public deck presence are community signals, not match results.',
      'A popular inclusion can be meta-, budget-, theme-, or creator-dependent; do not treat frequency alone as proof a card is optimal.',
    ],
  };
}

function deckObjToText(deckObj: Record<string, unknown>): string | null {
  const sectionEntries = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.flatMap((item) => {
        if (typeof item === 'string') return [`1 ${item}`];
        if (!item || typeof item !== 'object') return [];
        const record = item as Record<string, unknown>;
        const name = typeof record.name === 'string' ? record.name : typeof record.card === 'string' ? record.card : null;
        const quantity = typeof record.quantity === 'number' ? record.quantity : typeof record.count === 'number' ? record.count : 1;
        return name ? [`${quantity} ${name}`] : [];
      });
    }
    if (value && typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>).flatMap(([name, quantity]) => {
        if (typeof quantity === 'number') return [`${quantity} ${name}`];
        if (quantity && typeof quantity === 'object') {
          const record = quantity as Record<string, unknown>;
          const count = typeof record.quantity === 'number' ? record.quantity : typeof record.count === 'number' ? record.count : 1;
          return [`${count} ${name}`];
        }
        return [`1 ${name}`];
      });
    }
    return [];
  };

  const commanderValue = deckObj.Commanders ?? deckObj.commanders ?? deckObj.Commander ?? deckObj.commander;
  const mainValue = deckObj.Mainboard ?? deckObj.mainboard ?? deckObj.Main ?? deckObj.main;
  const commanders = sectionEntries(commanderValue);
  const main = sectionEntries(mainValue);
  if (commanders.length === 0 && main.length === 0) return null;
  return ['// COMMANDER', ...commanders, '', '// MAIN', ...main].join('\n');
}

async function standingDecklist(standing: TopDeckStanding): Promise<{ decklist: string; sourceDeckUrl?: string } | null> {
  if (standing.deckObj) {
    const text = deckObjToText(standing.deckObj);
    if (text) return { decklist: text };
  }
  if (typeof standing.decklist === 'string') {
    const value = standing.decklist.trim();
    if (!value) return null;
    if (value.includes('\n') || /^\s*(?:\/\/|~~|\d+\s)/m.test(value)) return { decklist: value };
    if (/archidekt\.com\/decks\/\d+/i.test(value)) {
      const reference = await fetchArchidektReference(value);
      return { decklist: reference.decklist, sourceDeckUrl: reference.sourceUrl };
    }
  }
  return null;
}

const METRIC_FIELDS: Array<keyof Pick<
  DeckMetrics,
  | 'landCount'
  | 'averageNonlandManaValue'
  | 'earlyPlayCount'
  | 'fastManaCount'
  | 'rampCount'
  | 'drawCount'
  | 'tutorCount'
  | 'interactionCount'
  | 'cheapInteractionCount'
  | 'protectionCount'
  | 'recursionCount'
>> = [
  'landCount',
  'averageNonlandManaValue',
  'earlyPlayCount',
  'fastManaCount',
  'rampCount',
  'drawCount',
  'tutorCount',
  'interactionCount',
  'cheapInteractionCount',
  'protectionCount',
  'recursionCount',
];

function averageMetrics(records: TournamentDeckRecord[]): Record<string, number> {
  return Object.fromEntries(
    METRIC_FIELDS.map((field) => [
      field,
      records.length > 0
        ? Number((records.reduce((sum, record) => sum + Number(record.metrics[field]), 0) / records.length).toFixed(2))
        : 0,
    ]),
  );
}

function metricMeaning(metric: string, difference: number): string {
  const direction = difference > 0 ? 'more/higher' : 'less/lower';
  const meanings: Record<string, string> = {
    landCount: 'mana-base density',
    averageNonlandManaValue: 'nonland curve',
    earlyPlayCount: 'early deployable action density',
    fastManaCount: 'fast-mana density',
    rampCount: 'mana acceleration density',
    drawCount: 'card-advantage/selection density',
    tutorCount: 'tutor density',
    interactionCount: 'total interaction density',
    cheapInteractionCount: 'cheap/free interaction density',
    protectionCount: 'protection density',
    recursionCount: 'recursion/resilience density',
  };
  return `Higher-performing sampled lists had ${direction} ${meanings[metric] ?? metric}; this is an observed association, not proof that changing this metric alone causes more wins.`;
}

export async function analyzeTopDeckTournamentReferences(options: {
  lastDays?: number;
  participantMin?: number;
  commanderName?: string;
  sampleLimit?: number;
  minGames?: number;
} = {}): Promise<Record<string, unknown>> {
  if (!config.topDeckApiKey) {
    throw new Error('TOPDECK_API_KEY is not configured. Create a free TopDeck.gg API key and add it to the service environment before using tournament reference analysis.');
  }

  const lastDays = Math.max(1, Math.min(365, Math.trunc(options.lastDays ?? 90)));
  const participantMin = Math.max(4, Math.min(500, Math.trunc(options.participantMin ?? 16)));
  const sampleLimit = Math.max(4, Math.min(40, Math.trunc(options.sampleLimit ?? 16)));
  const minGames = Math.max(1, Math.min(20, Math.trunc(options.minGames ?? 3)));

  const tournaments = await fetchJson<TopDeckTournament[]>(`${config.topDeckApiBase}/v2/tournaments`, {
    method: 'POST',
    headers: {
      Authorization: config.topDeckApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      game: 'Magic: The Gathering',
      format: 'EDH',
      last: lastDays,
      participantMin,
      columns: ['name', 'decklist', 'wins', 'draws', 'losses', 'winRate'],
    }),
  });

  const records: TournamentDeckRecord[] = [];
  outer: for (const tournament of tournaments) {
    for (const standing of tournament.standings ?? []) {
      if (records.length >= sampleLimit) break outer;
      const source = await standingDecklist(standing);
      if (!source) continue;
      const parsed = parseDecklist(source.decklist);
      if (
        options.commanderName &&
        !parsed.commanders.some((entry) => entry.name.toLocaleLowerCase() === options.commanderName?.toLocaleLowerCase())
      ) continue;
      const wins = Math.max(0, standing.wins ?? 0);
      const draws = Math.max(0, standing.draws ?? 0);
      const losses = Math.max(0, standing.losses ?? 0);
      const games = wins + draws + losses;
      if (games < minGames) continue;
      const names = [...parsed.commanders, ...parsed.main].map((entry) => entry.name);
      const { cards } = await getCardsByNames(names);
      const observedWinRate = Number(
        (typeof standing.winRate === 'number' ? standing.winRate : (wins + draws * 0.5) / games).toFixed(3),
      );
      records.push({
        tournamentId: tournament.TID ?? 'unknown',
        tournamentName: tournament.tournamentName ?? 'Unnamed tournament',
        player: standing.name ?? 'Unknown player',
        standing: standing.standing ?? null,
        wins,
        draws,
        losses,
        games,
        observedWinRate,
        parsed,
        metrics: buildDeckMetrics(parsed, cards),
        ...(source.sourceDeckUrl ? { sourceDeckUrl: source.sourceDeckUrl } : {}),
      });
    }
  }

  if (records.length < 4) {
    return {
      source: 'TopDeck.gg EDH tournament data',
      attribution: 'Tournament data provided by TopDeck.gg.',
      sampledDecks: records.length,
      records,
      caveat: 'Too few resolved tournament decklists matched the filters for a meaningful high-vs-low structural comparison.',
    };
  }

  const sorted = [...records].sort((a, b) => b.observedWinRate - a.observedWinRate);
  const cohortSize = Math.max(2, Math.floor(sorted.length / 3));
  const high = sorted.slice(0, cohortSize);
  const low = sorted.slice(-cohortSize);
  const highAverages = averageMetrics(high);
  const lowAverages = averageMetrics(low);
  const observedAssociations = METRIC_FIELDS.map((metric) => {
    const topAverage = highAverages[metric] ?? 0;
    const bottomAverage = lowAverages[metric] ?? 0;
    const difference = Number((topAverage - bottomAverage).toFixed(2));
    return {
      metric,
      topCohortAverage: topAverage,
      bottomCohortAverage: bottomAverage,
      difference,
      interpretation: metricMeaning(metric, difference),
    };
  }).sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

  return {
    source: 'TopDeck.gg EDH tournament data',
    attribution: 'Tournament data provided by TopDeck.gg; retain visible source credit when displaying or publishing derived tournament analysis.',
    filters: { lastDays, participantMin, commanderName: options.commanderName ?? null, minGames, sampleLimit },
    sampledDecks: records.length,
    records: sorted.map((record) => ({
      tournamentId: record.tournamentId,
      tournamentName: record.tournamentName,
      player: record.player,
      standing: record.standing,
      commanders: record.parsed.commanders.map((entry) => entry.name),
      wins: record.wins,
      draws: record.draws,
      losses: record.losses,
      games: record.games,
      observedWinRate: record.observedWinRate,
      metrics: record.metrics,
      sourceDeckUrl: record.sourceDeckUrl ?? null,
    })),
    highPerformingCohort: {
      count: high.length,
      averageObservedWinRate: Number((high.reduce((sum, record) => sum + record.observedWinRate, 0) / high.length).toFixed(3)),
      averageMetrics: highAverages,
    },
    lowerPerformingCohort: {
      count: low.length,
      averageObservedWinRate: Number((low.reduce((sum, record) => sum + record.observedWinRate, 0) / low.length).toFixed(3)),
      averageMetrics: lowAverages,
    },
    observedAssociations,
    caveats: [
      'Tournament results are observed outcomes, but deck structure is only one contributor; pilot skill, pods, matchups, seat order, event size, and variance matter.',
      'The high-vs-low comparison is correlation/association analysis and must not be presented as causal proof.',
      'Only standings with usable public/structured decklists are analyzed, which can create selection bias.',
    ],
  };
}
