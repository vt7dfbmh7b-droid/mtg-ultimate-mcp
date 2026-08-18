import { config } from '../config.js';
import { fetchJson } from '../lib/http.js';
import type { ScryfallCard, ScryfallList } from '../types/scryfall.js';

export interface BoundedScryfallSearchOptionsV15 {
  maxCards?: number;
  maxPages?: number;
  minRequestGapMs?: number;
  unique?: 'cards' | 'prints';
  requestPage?: (url: string) => Promise<ScryfallList<ScryfallCard>>;
}

export interface BoundedScryfallSearchResultV15 {
  cards: ScryfallCard[];
  pagesFetched: number;
  providerTotalCards: number | null;
  exhaustiveWithinBounds: true;
  unique: 'cards' | 'prints';
}

function sleep(ms: number): Promise<void> {
  return ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));
}

function positiveInteger(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value < 1) throw new Error('Bounded Scryfall search limits must be positive finite integers.');
  return Math.min(maximum, Math.trunc(value));
}

function safeProviderUrl(url: string): boolean {
  try {
    const target = new URL(url);
    const base = new URL(config.scryfallApiBase);
    return target.protocol === 'https:' && target.origin === base.origin;
  } catch {
    return false;
  }
}

/**
 * Follow Scryfall list pagination with explicit hard ceilings. The caller may request
 * Oracle-card uniqueness or physical-printing uniqueness; either mode fails closed
 * rather than returning a silently truncated candidate universe.
 */
export async function boundedScryfallSearchV15(
  query: string,
  options: BoundedScryfallSearchOptionsV15 = {},
): Promise<BoundedScryfallSearchResultV15> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) throw new Error('Bounded Scryfall search requires a non-empty query.');
  const maxCards = positiveInteger(options.maxCards, 500, 2_000);
  const maxPages = positiveInteger(options.maxPages, 12, 50);
  const minRequestGapMs = Math.max(0, Math.min(2_000, Math.trunc(options.minRequestGapMs ?? 300)));
  const unique = options.unique ?? 'cards';
  const injected = options.requestPage;
  const requestPage = injected ?? ((url: string) => fetchJson<ScryfallList<ScryfallCard>>(url));

  const cards: ScryfallCard[] = [];
  const seenUrls = new Set<string>();
  let pagesFetched = 0;
  let providerTotalCards: number | null = null;
  let nextUrl: string | undefined = `${config.scryfallApiBase}/cards/search?q=${encodeURIComponent(normalizedQuery)}&unique=${unique}&order=edhrec`;

  while (nextUrl) {
    if (!safeProviderUrl(nextUrl)) throw new Error('Scryfall pagination returned a next-page URL outside the configured Scryfall API origin.');
    if (seenUrls.has(nextUrl)) throw new Error('Scryfall pagination repeated a page URL; refusing an infinite pagination loop.');
    if (pagesFetched >= maxPages) throw new Error(`Scryfall discovery exceeded the ${maxPages}-page safety ceiling before exhaustion.`);
    seenUrls.add(nextUrl);
    if (!injected && pagesFetched > 0) await sleep(minRequestGapMs);

    const page = await requestPage(nextUrl);
    pagesFetched += 1;
    if (!page || page.object !== 'list' || !Array.isArray(page.data) || typeof page.has_more !== 'boolean') {
      throw new Error('Scryfall discovery returned a malformed list page.');
    }
    if (providerTotalCards === null && typeof page.total_cards === 'number' && Number.isFinite(page.total_cards)) {
      providerTotalCards = Math.trunc(page.total_cards);
    }
    if (cards.length + page.data.length > maxCards) {
      throw new Error(`Scryfall discovery exceeded the ${maxCards}-card safety ceiling before exhaustion.`);
    }
    cards.push(...page.data);

    if (!page.has_more) {
      nextUrl = undefined;
      continue;
    }
    if (!page.next_page) throw new Error('Scryfall discovery reported has_more=true without a next_page URL.');
    nextUrl = page.next_page;
  }

  return {
    cards,
    pagesFetched,
    providerTotalCards,
    exhaustiveWithinBounds: true,
    unique,
  };
}
