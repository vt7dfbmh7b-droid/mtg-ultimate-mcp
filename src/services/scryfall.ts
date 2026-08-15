import { config } from '../config.js';
import { fetchJson } from '../lib/http.js';
import type {
  ScryfallCard,
  ScryfallCollectionResult,
  ScryfallList,
} from '../types/scryfall.js';

export interface CardSummary {
  id: string;
  oracleId?: string;
  name: string;
  manaCost: string;
  manaValue: number;
  typeLine: string;
  oracleText: string;
  colorIdentity: string[];
  keywords: string[];
  roles: string[];
  commanderLegality: string;
  legalities: ScryfallCard['legalities'];
  set: string;
  setName: string;
  collectorNumber: string;
  rarity: string;
  prices: Record<string, string | null>;
  scryfallUrl: string;
  imageUrl?: string;
}

let rateLimitQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;
const MIN_REQUEST_GAP_MS = 120;

async function scryfallRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  let releaseQueue: () => void = () => undefined;
  const previous = rateLimitQueue;
  rateLimitQueue = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });

  await previous;
  try {
    const waitMs = Math.max(0, MIN_REQUEST_GAP_MS - (Date.now() - lastRequestAt));
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    lastRequestAt = Date.now();
    return await fetchJson<T>(url, init);
  } finally {
    releaseQueue();
  }
}

function combinedOracleText(card: ScryfallCard): string {
  if (card.oracle_text) return card.oracle_text;
  return (card.card_faces ?? [])
    .map((face) => [face.name, face.oracle_text].filter(Boolean).join(' — '))
    .filter(Boolean)
    .join('\n');
}

function combinedManaCost(card: ScryfallCard): string {
  if (card.mana_cost) return card.mana_cost;
  return (card.card_faces ?? [])
    .map((face) => face.mana_cost)
    .filter((value): value is string => Boolean(value))
    .join(' // ');
}

export function inferCardRoles(card: ScryfallCard): string[] {
  const text = combinedOracleText(card).toLowerCase();
  const type = card.type_line.toLowerCase();
  const roles = new Set<string>();

  if (/\badd (?:\{|one mana|two mana|three mana|mana)/.test(text)) roles.add('mana acceleration');
  if (/search your library for .*land/.test(text) && /battlefield/.test(text)) roles.add('land ramp');
  if (/draw (?:a|one|two|three|four|five|\d+) cards?/.test(text)) roles.add('card draw');
  if (/search your library for/.test(text)) roles.add('tutor');
  if (/counter target spell/.test(text)) roles.add('countermagic');
  if (/(destroy|exile) target/.test(text) || /return target .* to (?:its|their) owner's hand/.test(text)) {
    roles.add('spot interaction');
  }
  if (/(destroy|exile) (?:all|each) (?:creatures|artifacts|enchantments|nonland permanents|permanents)/.test(text)) {
    roles.add('board wipe');
  }
  if (/create .* token/.test(text)) roles.add('token production');
  if (/sacrifice (?:a|another|target|this)/.test(text)) roles.add('sacrifice synergy');
  if (/from your graveyard/.test(text) || /return .* from .* graveyard/.test(text)) roles.add('graveyard recursion');
  if (/hexproof|indestructible|protection from/.test(text)) roles.add('protection');
  if (/extra turn/.test(text)) roles.add('extra turn');
  if (/extra combat/.test(text) || /additional combat/.test(text)) roles.add('extra combat');
  if (/you win the game|loses the game/.test(text)) roles.add('alternate win condition');
  if (/whenever .* loses? life|deals? damage to each opponent|each opponent loses/.test(text)) roles.add('life drain');
  if (/\+1\/\+1 counter/.test(text)) roles.add('+1/+1 counters');
  if (/equipment|equip /.test(text) || type.includes('equipment')) roles.add('equipment');
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
    manaCost: combinedManaCost(card),
    manaValue: card.cmc,
    typeLine: card.type_line,
    oracleText: combinedOracleText(card),
    colorIdentity: card.color_identity,
    keywords: card.keywords,
    roles: inferCardRoles(card),
    commanderLegality: card.legalities.commander ?? 'unknown',
    legalities: card.legalities,
    set: card.set,
    setName: card.set_name,
    collectorNumber: card.collector_number,
    rarity: card.rarity,
    prices: card.prices ?? {},
    scryfallUrl: card.scryfall_uri,
    ...(imageUrl ? { imageUrl } : {}),
  };
}

export async function lookupCard(name: string, exact = false): Promise<ScryfallCard> {
  const parameter = exact ? 'exact' : 'fuzzy';
  const url = `${config.scryfallApiBase}/cards/named?${parameter}=${encodeURIComponent(name.trim())}`;
  return scryfallRequest<ScryfallCard>(url);
}

export async function searchCards(query: string, limit = 10): Promise<ScryfallCard[]> {
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const url = `${config.scryfallApiBase}/cards/search?q=${encodeURIComponent(query.trim())}&unique=cards&order=edhrec`;
  const result = await scryfallRequest<ScryfallList<ScryfallCard>>(url);
  return result.data.slice(0, safeLimit);
}

export async function getCardsByNames(names: string[]): Promise<{
  cards: ScryfallCard[];
  notFound: string[];
}> {
  const uniqueNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  const cards: ScryfallCard[] = [];
  const notFound: string[] = [];

  for (let index = 0; index < uniqueNames.length; index += 75) {
    const batch = uniqueNames.slice(index, index + 75);
    const result = await scryfallRequest<ScryfallCollectionResult>(
      `${config.scryfallApiBase}/cards/collection`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers: batch.map((name) => ({ name })) }),
      },
    );
    cards.push(...result.data);
    notFound.push(...result.not_found.map((entry) => entry.name ?? JSON.stringify(entry)));
  }

  return { cards, notFound };
}
