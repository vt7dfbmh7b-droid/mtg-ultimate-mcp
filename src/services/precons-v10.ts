import { config } from '../config.js';
import { fetchJson } from '../lib/http.js';
import type { ScryfallCard } from '../types/scryfall.js';
import { validateCommanderDeck } from './commander-rules.js';
import { buildSimulationBackedUpgradePlanV07 } from './deck-builder-v07.js';
import { buildDeckMetrics, parseDecklist, type ParsedDeck } from './deck.js';
import { buildResearchLinksV09 } from './evidence-sources-v09.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from './scryfall.js';
import { simulateDeckGameplayV06 } from './simulation-v06.js';
import { estimateCommanderBracket, findDeckCombos } from './spellbook.js';

interface MtgJsonEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface MtgJsonDeckListEntryV10 {
  code: string;
  fileName: string;
  name: string;
  releaseDate: string;
  type: string;
}

export interface MtgJsonDeckCardV10 {
  count: number;
  isFoil: boolean;
  name: string;
  number: string;
  setCode: string;
  type?: string;
  subtypes?: string[];
  text?: string;
  colorIdentity?: string[];
}

export interface MtgJsonDeckV10 {
  code: string;
  commander?: MtgJsonDeckCardV10[];
  mainBoard: MtgJsonDeckCardV10[];
  name: string;
  releaseDate: string;
  sealedProductUuids?: string[] | null;
  sideBoard: MtgJsonDeckCardV10[];
  tokens?: unknown[] | null;
  type: string;
}

export type PreconUpgradeProfileV10 = 'light' | 'balanced' | 'strong' | 'optimized' | 'custom';

export interface PreconUpgradeOptionsV10 {
  reference: string;
  profile?: PreconUpgradeProfileV10;
  targetBracket?: number;
  maxUsdPerCard?: number;
  maxSwaps?: number;
  themeQuery?: string;
  excludedCards?: string[];
  protectedCards?: string[];
  allowedSets?: string[];
  printingFamily?: string;
  includePromos?: boolean;
  includeSpecialReleases?: boolean;
  simulationIterations?: number;
  simulationTurns?: number;
  seed?: number;
}

interface CatalogCacheV10 {
  loadedAt: number;
  sourceMeta: Record<string, unknown> | null;
  entries: MtgJsonDeckListEntryV10[];
}

let catalogCache: CatalogCacheV10 | null = null;

const PROFILE_DEFAULTS: Record<Exclude<PreconUpgradeProfileV10, 'custom'>, {
  targetBracket: number;
  maxSwaps: number;
  maxUsdPerCard?: number;
  description: string;
}> = {
  light: {
    targetBracket: 2,
    maxSwaps: 5,
    maxUsdPerCard: 5,
    description: 'A small tune-up that keeps the stock deck very recognizable.',
  },
  balanced: {
    targetBracket: 3,
    maxSwaps: 10,
    maxUsdPerCard: 10,
    description: 'A meaningful upgrade while preserving the precon’s original plan.',
  },
  strong: {
    targetBracket: 4,
    maxSwaps: 15,
    maxUsdPerCard: 20,
    description: 'Push the precon hard while still treating it as the same deck rather than rebuilding from zero.',
  },
  optimized: {
    targetBracket: 4,
    maxSwaps: 15,
    description: 'Choose the strongest supported swaps without a default per-card price cap.',
  },
};

function unwrapData<T>(payload: T | MtgJsonEnvelope<T>): { data: T; meta: Record<string, unknown> | null } {
  if (payload && typeof payload === 'object' && 'data' in (payload as object)) {
    const envelope = payload as MtgJsonEnvelope<T>;
    return { data: envelope.data, meta: envelope.meta ?? null };
  }
  return { data: payload as T, meta: null };
}

export function isCommanderPreconEntryV10(entry: MtgJsonDeckListEntryV10): boolean {
  const type = entry.type.toLocaleLowerCase();
  return type.includes('commander') || /\bedh\b/.test(type);
}

function variantKind(name: string): string {
  if (/collector(?:'s)?\s+edition/i.test(name)) return 'collector-edition';
  if (/foil\s+edition/i.test(name)) return 'foil-edition';
  if (/display commander/i.test(name)) return 'display-commander';
  return 'standard';
}

function canonicalFamilyName(name: string): string {
  return name
    .replace(/\bcollector(?:'s)?\s+edition\b/gi, '')
    .replace(/\bfoil\s+edition\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+-\s+-/g, ' - ')
    .trim();
}

function slug(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[’']/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLocaleLowerCase();
}

export function edhrecPreconUrlV10(name: string): string {
  return `https://edhrec.com/precon/${slug(canonicalFamilyName(name))}`;
}

function deckFileUrl(fileName: string): string {
  const file = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
  return `${config.mtgJsonApiBase}/decks/${encodeURIComponent(file)}`;
}

export async function loadCommanderPreconCatalogV10(forceRefresh = false): Promise<CatalogCacheV10> {
  const now = Date.now();
  if (!forceRefresh && catalogCache && now - catalogCache.loadedAt < config.preconCatalogCacheMs) return catalogCache;

  const payload = await fetchJson<MtgJsonEnvelope<MtgJsonDeckListEntryV10[]> | MtgJsonDeckListEntryV10[]>(
    `${config.mtgJsonApiBase}/DeckList.json`,
  );
  const unwrapped = unwrapData(payload);
  const entries = unwrapped.data
    .filter(isCommanderPreconEntryV10)
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate) || a.name.localeCompare(b.name));

  catalogCache = {
    loadedAt: now,
    sourceMeta: unwrapped.meta,
    entries,
  };
  return catalogCache;
}

export function summarizePreconEntryV10(entry: MtgJsonDeckListEntryV10): Record<string, unknown> {
  return {
    name: entry.name,
    familyName: canonicalFamilyName(entry.name),
    productVariant: variantKind(entry.name),
    code: entry.code,
    fileName: entry.fileName,
    releaseDate: entry.releaseDate,
    year: entry.releaseDate.slice(0, 4),
    type: entry.type,
    mtgJsonDeckUrl: deckFileUrl(entry.fileName),
    edhrecPreconUrl: edhrecPreconUrlV10(entry.name),
  };
}

export async function searchCommanderPreconsV10(options: {
  query?: string;
  year?: number;
  setCode?: string;
  limit?: number;
  forceRefresh?: boolean;
} = {}): Promise<Record<string, unknown>> {
  const catalog = await loadCommanderPreconCatalogV10(options.forceRefresh ?? false);
  const query = options.query?.trim().toLocaleLowerCase() ?? '';
  const setCode = options.setCode?.trim().toLocaleLowerCase() ?? '';
  const year = options.year;
  const limit = Math.max(1, Math.min(500, Math.trunc(options.limit ?? 100)));

  const matches = catalog.entries.filter((entry) => {
    if (query && !`${entry.name} ${entry.code} ${entry.type}`.toLocaleLowerCase().includes(query)) return false;
    if (setCode && entry.code.toLocaleLowerCase() !== setCode) return false;
    if (year !== undefined && entry.releaseDate.slice(0, 4) !== String(year)) return false;
    return true;
  });

  return {
    source: 'MTGJSON DeckList',
    sourceUrl: `${config.mtgJsonApiBase}/DeckList.json`,
    loadedAt: new Date(catalog.loadedAt).toISOString(),
    sourceMeta: catalog.sourceMeta,
    totalCommanderPreconEntries: catalog.entries.length,
    matchCount: matches.length,
    returnedCount: Math.min(matches.length, limit),
    precons: matches.slice(0, limit).map(summarizePreconEntryV10),
    note: 'Product variants such as Collector/foil editions remain separate when MTGJSON lists them separately because their exact physical card printings can differ.',
  };
}

export async function resolvePreconEntryV10(reference: string): Promise<MtgJsonDeckListEntryV10> {
  const catalog = await loadCommanderPreconCatalogV10(false);
  const needle = reference.trim().toLocaleLowerCase();
  if (!needle) throw new Error('Provide a Commander precon name, MTGJSON file name, or deck code.');

  const exactFile = catalog.entries.find((entry) => entry.fileName.toLocaleLowerCase() === needle || `${entry.fileName}.json`.toLocaleLowerCase() === needle);
  if (exactFile) return exactFile;

  const exactName = catalog.entries.filter((entry) => entry.name.toLocaleLowerCase() === needle);
  if (exactName.length === 1 && exactName[0]) return exactName[0];
  if (exactName.length > 1) {
    throw new Error(`Multiple physical-product variants match “${reference}”: ${exactName.map((entry) => `${entry.name} [${entry.fileName}]`).join('; ')}. Use the fileName to choose the exact variant.`);
  }

  const partial = catalog.entries.filter((entry) =>
    entry.name.toLocaleLowerCase().includes(needle) || entry.fileName.toLocaleLowerCase().includes(needle),
  );
  if (partial.length === 1 && partial[0]) return partial[0];
  if (partial.length > 1) {
    throw new Error(`“${reference}” matches multiple precons: ${partial.slice(0, 12).map((entry) => `${entry.name} [${entry.fileName}]`).join('; ')}. Be more specific.`);
  }

  throw new Error(`No Commander precon matching “${reference}” was found in the current MTGJSON Commander deck catalog.`);
}

export function mtgJsonCardLineV10(card: MtgJsonDeckCardV10): string {
  const finish = card.isFoil ? ' *F*' : ' *N*';
  return `${Math.max(1, Math.trunc(card.count))} ${card.name} (${card.setCode.toUpperCase()}) ${card.number}${finish}`;
}

export function mtgJsonDeckToDecklistV10(deck: MtgJsonDeckV10): string {
  const commanders = deck.commander ?? [];
  return [
    '// COMMANDER',
    ...commanders.map(mtgJsonCardLineV10),
    '',
    '// MAIN',
    ...deck.mainBoard.map(mtgJsonCardLineV10),
  ].join('\n');
}

export async function fetchPreconDeckV10(reference: string): Promise<{
  entry: MtgJsonDeckListEntryV10;
  deck: MtgJsonDeckV10;
  decklist: string;
}> {
  const entry = await resolvePreconEntryV10(reference);
  const payload = await fetchJson<MtgJsonEnvelope<MtgJsonDeckV10> | MtgJsonDeckV10>(deckFileUrl(entry.fileName));
  const { data: deck } = unwrapData(payload);
  const decklist = mtgJsonDeckToDecklistV10(deck);
  return { entry, deck, decklist };
}

function identifiersFromParsed(parsed: ParsedDeck): CardIdentifierInput[] {
  return [...parsed.commanders, ...parsed.main].map((entry) => ({
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
  }));
}

async function resolveStockDeck(decklist: string): Promise<{
  parsed: ParsedDeck;
  cards: ScryfallCard[];
  notFound: string[];
}> {
  const parsed = parseDecklist(decklist);
  const resolved = await getCardsByIdentifiers(identifiersFromParsed(parsed));
  return { parsed, cards: resolved.cards, notFound: resolved.notFound };
}

function commanderIdentity(parsed: ParsedDeck, cards: ScryfallCard[]): string[] {
  const names = new Set(parsed.commanders.map((entry) => entry.name.toLocaleLowerCase()));
  return [...new Set(cards.filter((card) => names.has(card.name.toLocaleLowerCase())).flatMap((card) => card.color_identity))].sort();
}

function detectedThemeHints(deck: MtgJsonDeckV10): Array<{ theme: string; evidence: number }> {
  const cards = [...(deck.commander ?? []), ...deck.mainBoard];
  const counts = new Map<string, number>();
  const add = (theme: string, value = 1) => counts.set(theme, (counts.get(theme) ?? 0) + value);

  for (const card of cards) {
    const text = card.text ?? '';
    const type = card.type ?? '';
    for (const subtype of card.subtypes ?? []) add(`kindred:${subtype}`, card.count);
    if (/Equipment/i.test(type)) add('equipment', card.count);
    if (/Aura/i.test(type)) add('auras', card.count);
    if (/Artifact/i.test(type)) add('artifacts', card.count);
    if (/Enchantment/i.test(type)) add('enchantments', card.count);
    if (/\+1\/\+1 counter/i.test(text)) add('+1/+1-counters', card.count);
    if (/create .* token/i.test(text)) add('tokens', card.count);
    if (/graveyard/i.test(text)) add('graveyard', card.count);
    if (/sacrifice/i.test(text)) add('sacrifice', card.count);
  }

  const instantsSorceries = cards.reduce((sum, card) => sum + (/Instant|Sorcery/i.test(card.type ?? '') ? card.count : 0), 0);
  if (instantsSorceries >= 18) add('spellslinger', instantsSorceries);

  return [...counts.entries()]
    .filter(([theme, value]) => value >= (theme.startsWith('kindred:') ? 8 : 6))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([theme, evidence]) => ({ theme, evidence }));
}

export async function getPreconStockV10(reference: string): Promise<Record<string, unknown>> {
  const fetched = await fetchPreconDeckV10(reference);
  const cardCount = [...(fetched.deck.commander ?? []), ...fetched.deck.mainBoard]
    .reduce((sum, card) => sum + Math.max(1, Math.trunc(card.count)), 0);
  return {
    precon: summarizePreconEntryV10(fetched.entry),
    commanderNames: (fetched.deck.commander ?? []).map((card) => card.name),
    cardCount,
    detectedThemeHints: detectedThemeHints(fetched.deck),
    stockDecklist: fetched.decklist,
    exactPrintingNote: 'The stock list preserves MTGJSON set code, collector number and foil/nonfoil status for each listed physical card printing.',
    upgradeReferences: {
      edhrec: edhrecPreconUrlV10(fetched.deck.name),
      widerResearch: buildResearchLinksV09((fetched.deck.commander ?? []).map((card) => card.name)),
    },
  };
}

export async function analyzePreconV10(options: {
  reference: string;
  simulationIterations?: number;
  simulationTurns?: number;
  seed?: number;
}): Promise<Record<string, unknown>> {
  const fetched = await fetchPreconDeckV10(options.reference);
  const stock = await resolveStockDeck(fetched.decklist);
  const commanderRules = validateCommanderDeck(stock.parsed, stock.cards);
  const iterations = Math.max(100, Math.min(5_000, Math.trunc(options.simulationIterations ?? 500)));
  const turns = Math.max(3, Math.min(12, Math.trunc(options.simulationTurns ?? 7)));
  const seed = Math.max(1, Math.min(2_147_483_647, Math.trunc(options.seed ?? 20_260_816)));

  let bracket: Record<string, unknown> | null = null;
  let combos: Record<string, unknown> | null = null;
  const externalErrors: Record<string, string> = {};
  try {
    bracket = await estimateCommanderBracket(fetched.decklist, false);
  } catch (error) {
    externalErrors.bracket = error instanceof Error ? error.message : String(error);
  }
  try {
    combos = await findDeckCombos(fetched.decklist, 20);
  } catch (error) {
    externalErrors.combos = error instanceof Error ? error.message : String(error);
  }

  const simulation = stock.notFound.length === 0 && commanderRules.isLegal
    ? simulateDeckGameplayV06(stock.parsed, stock.cards, {
        iterations,
        advancedIterations: Math.min(iterations, 1_500),
        turns,
        seed,
        pressure: 'casual',
      })
    : null;

  return {
    precon: summarizePreconEntryV10(fetched.entry),
    commanders: (fetched.deck.commander ?? []).map((card) => card.name),
    detectedThemeHints: detectedThemeHints(fetched.deck),
    stockDecklist: fetched.decklist,
    unresolvedCards: stock.notFound,
    commanderRules,
    metrics: stock.notFound.length === 0 ? buildDeckMetrics(stock.parsed, stock.cards) : null,
    bracket,
    knownCombos: combos,
    simulation,
    externalErrors,
    upgradeReferences: {
      edhrec: edhrecPreconUrlV10(fetched.deck.name),
      widerResearch: buildResearchLinksV09((fetched.deck.commander ?? []).map((card) => card.name)),
    },
    responseGuidance: 'Explain the stock deck simply: what it is trying to do, its 2–4 biggest weaknesses, and which upgrade direction makes the most sense. Detailed metrics are supporting evidence, not the answer itself.',
  };
}

function profileOptions(options: PreconUpgradeOptionsV10): {
  profile: PreconUpgradeProfileV10;
  targetBracket: number;
  maxSwaps: number;
  maxUsdPerCard?: number;
  description: string;
} {
  const profile = options.profile ?? 'balanced';
  const defaults = profile === 'custom'
    ? { targetBracket: 3, maxSwaps: 10, description: 'Custom upgrade settings.' }
    : PROFILE_DEFAULTS[profile];
  return {
    profile,
    targetBracket: Math.max(1, Math.min(5, Math.trunc(options.targetBracket ?? defaults.targetBracket))),
    maxSwaps: Math.max(1, Math.min(15, Math.trunc(options.maxSwaps ?? defaults.maxSwaps))),
    ...(options.maxUsdPerCard !== undefined
      ? { maxUsdPerCard: options.maxUsdPerCard }
      : 'maxUsdPerCard' in defaults && defaults.maxUsdPerCard !== undefined
        ? { maxUsdPerCard: defaults.maxUsdPerCard }
        : {}),
    description: defaults.description,
  };
}

export function preconUpgradeProfilesV10(): Record<string, unknown> {
  return {
    light: PROFILE_DEFAULTS.light,
    balanced: PROFILE_DEFAULTS.balanced,
    strong: PROFILE_DEFAULTS.strong,
    optimized: PROFILE_DEFAULTS.optimized,
    custom: { description: 'Supply your own targetBracket, maxSwaps and optional maxUsdPerCard.' },
    note: 'These are starting profiles, not total-budget guarantees. Exact selected printings and prices remain visible so a user can impose a stricter budget.',
  };
}

export async function upgradePreconV10(options: PreconUpgradeOptionsV10): Promise<Record<string, unknown>> {
  const fetched = await fetchPreconDeckV10(options.reference);
  const stock = await resolveStockDeck(fetched.decklist);
  const commanderRules = validateCommanderDeck(stock.parsed, stock.cards);
  if (stock.notFound.length > 0 || !commanderRules.isLegal) {
    return {
      error: 'The stock precon must resolve to a legal Commander deck before automatic upgrades can be generated.',
      precon: summarizePreconEntryV10(fetched.entry),
      unresolvedCards: stock.notFound,
      commanderRules,
    };
  }

  const profile = profileOptions(options);
  const plan = await buildSimulationBackedUpgradePlanV07(
    stock.parsed,
    stock.cards,
    commanderIdentity(stock.parsed, stock.cards),
    {
      targetBracket: profile.targetBracket,
      ...(profile.maxUsdPerCard !== undefined ? { maxUsdPerCard: profile.maxUsdPerCard } : {}),
      ...(options.themeQuery ? { themeQuery: options.themeQuery } : {}),
      excludedCards: options.excludedCards ?? [],
      protectedCards: options.protectedCards ?? [],
      allowedSets: options.allowedSets ?? [],
      ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
      includePromos: options.includePromos ?? true,
      includeSpecialReleases: options.includeSpecialReleases ?? true,
      maxSwaps: profile.maxSwaps,
      simulationIterations: options.simulationIterations ?? 750,
      simulationTurns: options.simulationTurns ?? 7,
      seed: options.seed ?? 20_260_816,
    },
  );

  return {
    precon: summarizePreconEntryV10(fetched.entry),
    stockCommanders: (fetched.deck.commander ?? []).map((card) => card.name),
    stockDetectedThemes: detectedThemeHints(fetched.deck),
    upgradeProfile: profile,
    stockDecklist: fetched.decklist,
    plan,
    evidence: {
      edhrecPreconUpgradePage: edhrecPreconUrlV10(fetched.deck.name),
      widerCrossReferences: buildResearchLinksV09(
        (fetched.deck.commander ?? []).map((card) => card.name),
      ),
      guidance: 'Use EDHREC precon add/cut data as community adoption evidence, then cross-check important swaps against current card rules, simulation, public/tournament references and exact printing price/availability.',
    },
    responseGuidance: 'Lead with exact OUT -> IN swaps and a short reason. Keep the original precon plan recognizable unless the user explicitly asks for a rebuild. Always show the exact recommended printing when price or printing restrictions matter.',
    caveats: [
      'The precon catalog self-refreshes from MTGJSON rather than being a frozen hand-maintained list.',
      '“Best upgrade” depends on target bracket, budget, theme and how much of the stock identity the player wants to preserve.',
      'Community add/cut popularity is evidence, not proof of optimality; simulation and the deck’s actual plan still matter.',
    ],
  };
}
