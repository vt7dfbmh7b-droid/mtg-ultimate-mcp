import { config } from '../config.js';
import { fetchJson } from '../lib/http.js';
import type {
  ScryfallCard,
  ScryfallCollectionResult,
  ScryfallList,
  ScryfallSet,
} from '../types/scryfall.js';

export interface CardIdentifierInput {
  name: string;
  set?: string;
  collectorNumber?: string;
}

export interface CardSummary {
  id: string;
  oracleId?: string;
  name: string;
  printedName?: string;
  flavorName?: string;
  manaCost: string;
  manaValue: number;
  typeLine: string;
  oracleText: string;
  colorIdentity: string[];
  keywords: string[];
  roles: string[];
  commanderLegality: string;
  legalities: ScryfallCard['legalities'];
  edhrecRank?: number;
  producedMana?: string[];
  set: string;
  setName: string;
  collectorNumber: string;
  releaseDate?: string;
  rarity: string;
  finishes: string[];
  foil: boolean;
  nonfoil: boolean;
  promo: boolean;
  promoTypes: string[];
  digital: boolean;
  fullArt: boolean;
  frame?: string;
  frameEffects: string[];
  borderColor?: string;
  tcgplayerId?: number;
  cardmarketId?: number;
  prices: Record<string, string | null>;
  purchaseUris: Record<string, string>;
  scryfallUrl: string;
  imageUrl?: string;
}

let rateLimitQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;
const MIN_REQUEST_GAP_MS = 120;
let setCache: ScryfallSet[] | null = null;
let setCacheAt = 0;
const SET_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;

async function scryfallRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  let releaseQueue: () => void = () => undefined;
  const previous = rateLimitQueue;
  rateLimitQueue = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });

  await previous;
  try {
    const waitMs = Math.max(0, MIN_REQUEST_GAP_MS - (Date.now() - lastRequestAt));
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastRequestAt = Date.now();
    return await fetchJson<T>(url, init);
  } finally {
    releaseQueue();
  }
}

export function getCardOracleText(card: ScryfallCard): string {
  if (card.oracle_text) return card.oracle_text;
  return (card.card_faces ?? [])
    .map((face) => [face.name, face.oracle_text].filter(Boolean).join(' — '))
    .filter(Boolean)
    .join('\n');
}

export function getCardManaCost(card: ScryfallCard): string {
  if (card.mana_cost) return card.mana_cost;
  return (card.card_faces ?? [])
    .map((face) => face.mana_cost)
    .filter((value): value is string => Boolean(value))
    .join(' // ');
}

export function inferCardRoles(card: ScryfallCard): string[] {
  const text = getCardOracleText(card).toLowerCase();
  const type = card.type_line.toLowerCase();
  const manaCost = getCardManaCost(card);
  const roles = new Set<string>();

  const addsMana = /\badd (?:\{|one mana|two mana|three mana|four mana|five mana|mana)/.test(text);
  if (addsMana) roles.add('mana acceleration');
  if (type.includes('artifact') && addsMana && !type.includes('creature')) roles.add('mana rock');
  if (type.includes('creature') && /\{t\}:\s*add|whenever .* add .* mana/.test(text)) roles.add('mana dork');
  if (card.cmc <= 1 && addsMana && !type.includes('land')) roles.add('fast mana');
  if (/search your library for .*land/.test(text) && /battlefield/.test(text)) roles.add('land ramp');
  if (/costs? .* less to cast/.test(text)) roles.add('cost reduction');
  if (/create .* treasure token/.test(text)) roles.add('treasure');

  if (/draw (?:a|one|two|three|four|five|\d+) cards?/.test(text)) roles.add('card draw');
  if (/whenever .* draw a card|at the beginning of .* draw|whenever .* deals? combat damage .* draw/.test(text)) roles.add('repeatable draw');
  if (/scry|surveil|look at the top .* cards|exile the top .* you may play/.test(text)) roles.add('card selection');
  if (/discard your hand.*draw|each player discards .* hand.*draw/.test(text)) roles.add('wheel');

  if (/search your library for/.test(text)) roles.add('tutor');
  if (/search your library for .*creature/.test(text)) roles.add('creature tutor');
  if (/search your library for .*land/.test(text)) roles.add('land tutor');

  if (/counter target spell/.test(text)) roles.add('countermagic');
  if ((manaCost === '' || /\{0\}/.test(manaCost) || /rather than pay .* mana cost/.test(text)) && /counter target|destroy target|exile target/.test(text)) roles.add('free interaction');
  if (/(destroy|exile) target/.test(text) || /return target .* to (?:its|their) owner's hand/.test(text)) roles.add('spot interaction');
  if (/destroy target artifact|destroy target enchantment|exile target artifact|exile target enchantment/.test(text)) roles.add('artifact/enchantment interaction');
  if (/exile .* graveyard|cards? in graveyards? can't|players? can't cast .* graveyards?/.test(text)) roles.add('graveyard hate');
  if (/(destroy|exile) (?:all|each) (?:creatures|artifacts|enchantments|nonland permanents|permanents)/.test(text)) roles.add('board wipe');

  if (/create .* token/.test(text)) roles.add('token production');
  if (/sacrifice (?:a|another|target|this)/.test(text)) roles.add('sacrifice synergy');
  if (/sacrifice (?:a|another) creature\s*:|sacrifice (?:a|another) permanent\s*:/.test(text)) roles.add('sacrifice outlet');
  if (/from your graveyard/.test(text) || /return .* from .* graveyard/.test(text)) roles.add('graveyard recursion');
  if (/hexproof|indestructible|protection from|phase out/.test(text)) roles.add('protection');
  if (/other .* you control (?:have|gain) hexproof|permanents? you control .* indestructible/.test(text)) roles.add('board protection');
  if (/haste/.test(text)) roles.add('haste');
  if (/can't cast|can't activate|players can't|opponents can't|doesn't untap|enter the battlefield tapped/.test(text)) roles.add('stax/control');
  if (/extra turn/.test(text)) roles.add('extra turn');
  if (/extra combat/.test(text) || /additional combat/.test(text)) roles.add('extra combat');
  if (/you win the game|loses the game/.test(text)) roles.add('alternate win condition');
  if (/whenever .* loses? life|deals? damage to each opponent|each opponent loses/.test(text)) roles.add('life drain');
  if (/\+1\/\+1 counter/.test(text)) roles.add('+1/+1 counters');
  if (/equipment|equip /.test(text) || type.includes('equipment')) roles.add('equipment');
  if (/copy target .* spell|copy .* triggered ability|copy .* activated ability/.test(text)) roles.add('copy effect');
  if (/untap target|untap all|untap another/.test(text)) roles.add('untap engine');
  if (/whenever .* enters|enters the battlefield/.test(text)) roles.add('etb synergy');
  if (type.includes('land')) roles.add('land');
  if (type.includes('creature')) roles.add('creature');

  return [...roles];
}

export function summarizeCard(card: ScryfallCard): CardSummary {
  const imageUrl = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal;
  return {
    id: card.id,
    ...(card.oracle_id ? { oracleId: card.oracle_id } : {}),
    name: card.name,
    ...(card.printed_name ? { printedName: card.printed_name } : {}),
    ...(card.flavor_name ? { flavorName: card.flavor_name } : {}),
    manaCost: getCardManaCost(card),
    manaValue: card.cmc,
    typeLine: card.type_line,
    oracleText: getCardOracleText(card),
    colorIdentity: card.color_identity,
    keywords: card.keywords,
    roles: inferCardRoles(card),
    commanderLegality: card.legalities.commander ?? 'unknown',
    legalities: card.legalities,
    ...(card.edhrec_rank !== undefined ? { edhrecRank: card.edhrec_rank } : {}),
    ...(card.produced_mana ? { producedMana: card.produced_mana } : {}),
    set: card.set.toUpperCase(),
    setName: card.set_name,
    collectorNumber: card.collector_number,
    ...(card.released_at ? { releaseDate: card.released_at } : {}),
    rarity: card.rarity,
    finishes: card.finishes ?? [card.foil ? 'foil' : '', card.nonfoil ? 'nonfoil' : ''].filter(Boolean),
    foil: Boolean(card.foil),
    nonfoil: Boolean(card.nonfoil),
    promo: Boolean(card.promo),
    promoTypes: card.promo_types ?? [],
    digital: Boolean(card.digital),
    fullArt: Boolean(card.full_art),
    ...(card.frame ? { frame: card.frame } : {}),
    frameEffects: card.frame_effects ?? [],
    ...(card.border_color ? { borderColor: card.border_color } : {}),
    ...(card.tcgplayer_id !== undefined ? { tcgplayerId: card.tcgplayer_id } : {}),
    ...(card.cardmarket_id !== undefined ? { cardmarketId: card.cardmarket_id } : {}),
    prices: card.prices ?? {},
    purchaseUris: card.purchase_uris ?? {},
    scryfallUrl: card.scryfall_uri,
    ...(imageUrl ? { imageUrl } : {}),
  };
}

export async function lookupCard(name: string, exact = false, set?: string): Promise<ScryfallCard> {
  const parameter = exact ? 'exact' : 'fuzzy';
  const setPart = set?.trim() ? `&set=${encodeURIComponent(set.trim().toLowerCase())}` : '';
  const url = `${config.scryfallApiBase}/cards/named?${parameter}=${encodeURIComponent(name.trim())}${setPart}`;
  return scryfallRequest<ScryfallCard>(url);
}

export async function lookupPrinting(set: string, collectorNumber: string, lang?: string): Promise<ScryfallCard> {
  const language = lang?.trim() ? `/${encodeURIComponent(lang.trim().toLowerCase())}` : '';
  const url = `${config.scryfallApiBase}/cards/${encodeURIComponent(set.trim().toLowerCase())}/${encodeURIComponent(collectorNumber.trim())}${language}`;
  return scryfallRequest<ScryfallCard>(url);
}

export async function searchCards(query: string, limit = 10): Promise<ScryfallCard[]> {
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const url = `${config.scryfallApiBase}/cards/search?q=${encodeURIComponent(query.trim())}&unique=cards&order=edhrec`;
  const result = await scryfallRequest<ScryfallList<ScryfallCard>>(url);
  return result.data.slice(0, safeLimit);
}

export async function getScryfallSets(forceRefresh = false): Promise<ScryfallSet[]> {
  const now = Date.now();
  if (!forceRefresh && setCache && now - setCacheAt < SET_CACHE_TTL_MS) return setCache;
  const result = await scryfallRequest<ScryfallList<ScryfallSet>>(`${config.scryfallApiBase}/sets`);
  setCache = result.data;
  setCacheAt = now;
  return setCache;
}

export async function getCardPrintings(name: string, limit = 100): Promise<ScryfallCard[]> {
  const safeLimit = Math.max(1, Math.min(limit, 250));
  const cards: ScryfallCard[] = [];
  const escapedName = name.trim().replace(/"/g, '\\"');
  let nextUrl: string | undefined = `${config.scryfallApiBase}/cards/search?q=${encodeURIComponent(`!"${escapedName}"`)}&unique=prints&order=released&dir=desc`;

  while (nextUrl && cards.length < safeLimit) {
    const page: ScryfallList<ScryfallCard> = await scryfallRequest<ScryfallList<ScryfallCard>>(nextUrl);
    cards.push(...page.data.slice(0, safeLimit - cards.length));
    nextUrl = page.has_more ? page.next_page : undefined;
  }

  return cards;
}

function identifierKey(identifier: CardIdentifierInput): string {
  return [identifier.name.toLocaleLowerCase(), identifier.set?.toLocaleLowerCase() ?? '', identifier.collectorNumber ?? ''].join('|');
}

export async function getCardsByIdentifiers(identifiers: CardIdentifierInput[]): Promise<{
  cards: ScryfallCard[];
  notFound: string[];
}> {
  const unique = [...new Map(
    identifiers
      .filter((identifier) => identifier.name.trim())
      .map((identifier) => [identifierKey(identifier), identifier]),
  ).values()];
  const cards: ScryfallCard[] = [];
  const notFound: string[] = [];

  for (let index = 0; index < unique.length; index += 75) {
    const batch = unique.slice(index, index + 75);
    const apiIdentifiers = batch.map((identifier) => {
      if (identifier.set && identifier.collectorNumber) {
        return {
          set: identifier.set.toLowerCase(),
          collector_number: identifier.collectorNumber,
        };
      }
      if (identifier.set) return { name: identifier.name, set: identifier.set.toLowerCase() };
      return { name: identifier.name };
    });

    const result = await scryfallRequest<ScryfallCollectionResult>(
      `${config.scryfallApiBase}/cards/collection`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers: apiIdentifiers }),
      },
    );
    cards.push(...result.data);
    notFound.push(
      ...result.not_found.map((entry) =>
        [entry.name, entry.set, entry.collector_number].filter(Boolean).join(' ') || JSON.stringify(entry),
      ),
    );
  }

  return { cards, notFound };
}

export async function getCardsByNames(names: string[]): Promise<{
  cards: ScryfallCard[];
  notFound: string[];
}> {
  return getCardsByIdentifiers(names.map((name) => ({ name })));
}
