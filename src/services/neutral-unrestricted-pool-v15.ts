import { config } from '../config.js';
import { fetchJson, HttpError } from '../lib/http.js';
import type { ScryfallCard, ScryfallList } from '../types/scryfall.js';
import { selectBudgetEligiblePrintingV15 } from './budget-printing-selector-v15.js';
import { exactPrintingBudgetWitnessV15 } from './exact-printing-budget-v15.js';
import type { NeutralArchetypeV15 } from './neutral-commander-selection-v15.js';
import {
  printingMatchesPolicyV08,
  selectEligiblePrintingV08,
  type ResolvedPrintingPolicyV08,
} from './printing-policy-v08.js';
import { getCardsByNames } from './scryfall.js';

const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'] as const;
const BASIC_FOR_COLOR: Record<string, string> = {
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
};

export const NEUTRAL_UNRESTRICTED_MIN_REQUEST_GAP_MS_V15 = 300;

export type NeutralSampleOrderV15 = 'name' | 'released';
export type NeutralSampleDirectionV15 = 'asc' | 'desc';

export interface NeutralUnrestrictedStratumV15 {
  family: 'early' | 'mid' | 'late' | 'lands' | 'archetype';
  query: string;
  order: NeutralSampleOrderV15;
  direction: NeutralSampleDirectionV15;
}

export interface NeutralUnrestrictedStratumAuditV15 {
  family: NeutralUnrestrictedStratumV15['family'];
  query: string;
  order: NeutralSampleOrderV15;
  direction: NeutralSampleDirectionV15;
  providerTotalCards: number | null;
  providerPageCards: number;
  sampledCards: number;
  exhaustive: boolean;
}

export interface NeutralUnrestrictedPoolV15 {
  cards: ScryfallCard[];
  provenance: {
    mode: 'bounded-stratified-neutral-sample';
    exhaustive: boolean;
    popularityOrdered: false;
    edhrecOrdered: false;
    strata: NeutralUnrestrictedStratumAuditV15[];
    sampledCardsBeforeDeduplication: number;
    uniqueEligibleCards: number;
    uniqueEligibleNonlands: number;
    uniqueEligibleLands: number;
    basicLandNames: string[];
    budgetCapUsd: number | null;
    budgetFilterMode: 'not-requested' | 'exact-sampled-printing';
    budgetRejectedOverCap: number;
    budgetRejectedUnknownPrice: number;
    budgetRejectedUnavailableFinish: number;
    note: string;
  };
}

type SearchRequesterV15 = (url: string) => Promise<ScryfallList<ScryfallCard>>;

export interface NeutralUnrestrictedSamplingOptionsV15 {
  maxCardsPerStratum?: number;
  minRequestGapMs?: number;
  requestSearch?: SearchRequesterV15;
}

export interface NeutralUnrestrictedPoolOptionsV15 extends NeutralUnrestrictedSamplingOptionsV15 {
  minEligibleNonlands?: number;
  minEligibleLands?: number;
  basicCards?: ScryfallCard[];
  maxUsdPerCard?: number;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function oracleKey(card: ScryfallCard): string {
  return card.oracle_id ?? normalize(card.name);
}

function sleep(ms: number): Promise<void> {
  return ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));
}

function canonicalColors(colors: readonly string[]): string[] {
  const present = new Set(colors.map((color) => color.trim().toUpperCase()));
  return COLOR_ORDER.filter((color) => present.has(color));
}

function canonicalIdentity(colors: readonly string[]): string {
  return canonicalColors(colors).join('').toLocaleLowerCase();
}

function identityClause(colors: readonly string[]): string {
  const canonical = canonicalIdentity(colors);
  return canonical ? `id<=${canonical}` : 'id:c';
}

function archetypeClause(archetype: NeutralArchetypeV15): string {
  switch (archetype) {
    case 'combat-tokens': return '-t:land o:token';
    case 'equipment-voltron': return '-t:land (t:equipment OR o:equip)';
    case 'counters': return '-t:land o:"+1/+1 counter"';
    case 'graveyard-reanimator': return '-t:land o:graveyard';
    case 'aristocrats': return '-t:land (o:sacrifice OR o:dies)';
    case 'food-lifegain': return '-t:land (o:Food OR o:"gain life" OR o:"gained life")';
    case 'spells-control': return '-t:land (t:instant OR t:sorcery OR o:counter)';
    case 'value-engine': return '-t:land (o:"draw a card" OR o:"you may play" OR o:"you may cast")';
    case 'big-mana': return '-t:land o:mana';
  }
}

export function neutralUnrestrictedStrataV15(
  colors: readonly string[],
  archetype: NeutralArchetypeV15,
  includePromos = true,
): NeutralUnrestrictedStratumV15[] {
  const common = `f:commander game:paper ${identityClause(colors)}${includePromos ? '' : ' -is:promo'}`;
  const families: Array<{ family: NeutralUnrestrictedStratumV15['family']; clause: string }> = [
    { family: 'early', clause: '-t:land mv<=2' },
    { family: 'mid', clause: '-t:land mv>=3 mv<=4' },
    { family: 'late', clause: '-t:land mv>=5' },
    { family: 'lands', clause: 't:land' },
    { family: 'archetype', clause: archetypeClause(archetype) },
  ];
  const views: Array<Pick<NeutralUnrestrictedStratumV15, 'order' | 'direction'>> = [
    { order: 'name', direction: 'asc' },
    { order: 'released', direction: 'asc' },
    { order: 'released', direction: 'desc' },
  ];
  return families.flatMap(({ family, clause }) => views.map((view) => ({
    family,
    query: `${common} ${clause}`.replace(/\s+/g, ' ').trim(),
    ...view,
  })));
}

export function neutralUnrestrictedSearchUrlV15(stratum: NeutralUnrestrictedStratumV15): string {
  return `${config.scryfallApiBase}/cards/search?q=${encodeURIComponent(stratum.query)}`
    + `&unique=cards&order=${encodeURIComponent(stratum.order)}&dir=${encodeURIComponent(stratum.direction)}`;
}

async function defaultRequestSearch(url: string): Promise<ScryfallList<ScryfallCard>> {
  try {
    return await fetchJson<ScryfallList<ScryfallCard>>(url);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return { object: 'list', has_more: false, data: [] };
    }
    throw error;
  }
}

export async function sampleNeutralUnrestrictedStrataV15(
  strata: readonly NeutralUnrestrictedStratumV15[],
  options: NeutralUnrestrictedSamplingOptionsV15 = {},
): Promise<{ cards: ScryfallCard[]; audit: NeutralUnrestrictedStratumAuditV15[] }> {
  const maxCardsPerStratum = Math.max(10, Math.min(120, Math.trunc(options.maxCardsPerStratum ?? 60)));
  const minRequestGapMs = Math.max(
    0,
    Math.min(1_000, Math.trunc(options.minRequestGapMs ?? NEUTRAL_UNRESTRICTED_MIN_REQUEST_GAP_MS_V15)),
  );
  const requestSearch = options.requestSearch ?? defaultRequestSearch;
  const cards: ScryfallCard[] = [];
  const audit: NeutralUnrestrictedStratumAuditV15[] = [];

  for (let index = 0; index < strata.length; index += 1) {
    if (minRequestGapMs > 0) await sleep(minRequestGapMs);
    const stratum = strata[index]!;
    const page = await requestSearch(neutralUnrestrictedSearchUrlV15(stratum));
    if (!Array.isArray(page.data)) throw new Error(`Malformed Scryfall neutral sample response for ${stratum.query}.`);
    const sampled = page.data.slice(0, maxCardsPerStratum);
    cards.push(...sampled);
    audit.push({
      family: stratum.family,
      query: stratum.query,
      order: stratum.order,
      direction: stratum.direction,
      providerTotalCards: typeof page.total_cards === 'number' ? page.total_cards : null,
      providerPageCards: page.data.length,
      sampledCards: sampled.length,
      exhaustive: page.has_more !== true && page.data.length <= maxCardsPerStratum,
    });
  }
  return { cards, audit };
}

async function resolveBasicLands(
  colors: readonly string[],
  policy: ResolvedPrintingPolicyV08,
  maxUsdPerCard: number | undefined,
  supplied?: ScryfallCard[],
): Promise<ScryfallCard[]> {
  if (supplied) return supplied;
  const canonical = canonicalColors(colors);
  const names = canonical.length > 0
    ? canonical.map((color) => BASIC_FOR_COLOR[color]!).filter(Boolean)
    : ['Wastes'];
  const lookup = await getCardsByNames(names);
  if (lookup.notFound.length > 0) throw new Error(`Neutral unrestricted basic-land resolution failed: ${lookup.notFound.join(', ')}`);
  const basics: ScryfallCard[] = [];
  for (const card of lookup.cards) {
    const printing = maxUsdPerCard === undefined
      ? await selectEligiblePrintingV08(card, policy)
      : await selectBudgetEligiblePrintingV15(card, policy, maxUsdPerCard);
    if (!printing) {
      throw new Error(
        maxUsdPerCard === undefined
          ? `No eligible physical printing found for required basic land ${card.name}.`
          : `No priced eligible physical printing found for required basic land ${card.name} at or below US$${maxUsdPerCard} after bounded physical-printing exhaustion.`,
      );
    }
    basics.push(printing.card);
  }
  return basics;
}

function budgetStatus(card: ScryfallCard, maxUsdPerCard: number | undefined): 'within-cap' | 'over-cap' | 'price-unavailable' | 'finish-unavailable' | 'not-requested' {
  return maxUsdPerCard === undefined
    ? 'not-requested'
    : exactPrintingBudgetWitnessV15(card, maxUsdPerCard).status;
}

function exactPrice(card: ScryfallCard, maxUsdPerCard: number | undefined): number | null {
  if (maxUsdPerCard === undefined) return null;
  const witness = exactPrintingBudgetWitnessV15(card, maxUsdPerCard);
  return witness.status === 'within-cap' ? witness.priceUsd : null;
}

export async function discoverNeutralUnrestrictedPoolV15(
  colors: readonly string[],
  archetype: NeutralArchetypeV15,
  policy: ResolvedPrintingPolicyV08,
  options: NeutralUnrestrictedPoolOptionsV15 = {},
): Promise<NeutralUnrestrictedPoolV15> {
  if (policy.family || policy.allowedSetCodes.length > 0 || policy.exactSpecialPrintings.length > 0) {
    throw new Error('Neutral unrestricted pool discovery is only for policies without a bounded family/set/special-printing pool.');
  }
  if (options.maxUsdPerCard !== undefined && (!Number.isFinite(options.maxUsdPerCard) || options.maxUsdPerCard <= 0)) {
    throw new Error('Neutral unrestricted maxUsdPerCard must be positive and finite when supplied.');
  }
  const strata = neutralUnrestrictedStrataV15(colors, archetype, policy.includePromos);
  const sampled = await sampleNeutralUnrestrictedStrataV15(strata, options);
  const basics = await resolveBasicLands(colors, policy, options.maxUsdPerCard, options.basicCards);
  const allowedColors = new Set(canonicalColors(colors));
  let budgetRejectedOverCap = 0;
  let budgetRejectedUnknownPrice = 0;
  let budgetRejectedUnavailableFinish = 0;
  const eligible: ScryfallCard[] = [];

  for (const card of [...sampled.cards, ...basics]) {
    if (card.legalities.commander !== 'legal') continue;
    if (!card.color_identity.every((color) => allowedColors.has(color.toUpperCase()))) continue;
    if (!printingMatchesPolicyV08(card, policy)) continue;
    const status = budgetStatus(card, options.maxUsdPerCard);
    if (status === 'over-cap') {
      budgetRejectedOverCap += 1;
      continue;
    }
    if (status === 'price-unavailable') {
      budgetRejectedUnknownPrice += 1;
      continue;
    }
    if (status === 'finish-unavailable') {
      budgetRejectedUnavailableFinish += 1;
      continue;
    }
    eligible.push(card);
  }

  const byOracle = new Map<string, ScryfallCard>();
  for (const card of eligible) {
    const key = oracleKey(card);
    const current = byOracle.get(key);
    if (!current) {
      byOracle.set(key, card);
      continue;
    }
    const cardPrice = exactPrice(card, options.maxUsdPerCard);
    const currentPrice = exactPrice(current, options.maxUsdPerCard);
    const budgetPreference = cardPrice !== null && currentPrice !== null && cardPrice !== currentPrice
      ? cardPrice - currentPrice
      : 0;
    if (budgetPreference < 0 || (budgetPreference === 0 && `${card.set}|${card.collector_number}`.localeCompare(`${current.set}|${current.collector_number}`) < 0)) {
      byOracle.set(key, card);
    }
  }
  const cards = [...byOracle.values()];
  const nonlands = cards.filter((card) => !card.type_line.toLocaleLowerCase().includes('land')).length;
  const lands = cards.length - nonlands;
  const minEligibleNonlands = Math.max(0, Math.min(500, Math.trunc(options.minEligibleNonlands ?? 80)));
  const minEligibleLands = Math.max(0, Math.min(200, Math.trunc(options.minEligibleLands ?? 20)));
  if (nonlands < minEligibleNonlands || lands < minEligibleLands) {
    throw new Error(
      `Neutral unrestricted sampling produced insufficient eligible candidates: ${nonlands} nonlands/${lands} lands; `
      + `required at least ${minEligibleNonlands}/${minEligibleLands}`
      + `${options.maxUsdPerCard !== undefined ? ` after exact sampled-printing budget filtering at US$${options.maxUsdPerCard}` : ''}.`,
    );
  }
  const basicsNames = basics.map((card) => card.name);
  return {
    cards,
    provenance: {
      mode: 'bounded-stratified-neutral-sample',
      exhaustive: sampled.audit.every((item) => item.exhaustive),
      popularityOrdered: false,
      edhrecOrdered: false,
      strata: sampled.audit,
      sampledCardsBeforeDeduplication: sampled.cards.length,
      uniqueEligibleCards: cards.length,
      uniqueEligibleNonlands: nonlands,
      uniqueEligibleLands: lands,
      basicLandNames: basicsNames,
      budgetCapUsd: options.maxUsdPerCard ?? null,
      budgetFilterMode: options.maxUsdPerCard === undefined ? 'not-requested' : 'exact-sampled-printing',
      budgetRejectedOverCap,
      budgetRejectedUnknownPrice,
      budgetRejectedUnavailableFinish,
      note: options.maxUsdPerCard === undefined
        ? 'Unrestricted neutral discovery uses bounded deterministic name/release views rather than EDHREC ordering. The result is sampled, not a claim that every legal card was exhaustively searched.'
        : 'Unrestricted neutral discovery uses bounded deterministic physical-printing samples rather than EDHREC ordering; only sampled exact printings with verifiable finish-aware USD evidence under the candidate cap survive. This is sampled, not an exhaustive cheapest-printing claim for the entire unrestricted card pool.',
    },
  };
}
