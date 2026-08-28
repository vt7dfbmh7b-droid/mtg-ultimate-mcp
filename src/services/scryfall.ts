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

interface TimedCardCacheEntry {
  loadedAt: number;
  cards: ScryfallCard[];
}

let rateLimitQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;
const MIN_REQUEST_GAP_MS = 300;
let setCache: ScryfallSet[] | null = null;
let setCacheAt = 0;
const SET_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const QUERY_CACHE_TTL_MS = 5 * 60 * 1_000;
const IDENTIFIER_CACHE_MAX = 5_000;
const searchCache = new Map<string, TimedCardCacheEntry>();
const printingsCache = new Map<string, TimedCardCacheEntry>();
const identifierCache = new Map<string, ScryfallCard>();

const LEGACY_FREE_INTERACTION_SEARCH_CLAUSE_V15 = '((mv=0 OR o:"rather than pay") (o:"counter target" OR o:"destroy target" OR o:"exile target"))';
export const FREE_INTERACTION_SEARCH_CLAUSE_V15 = '((mv=0 OR o:"rather than pay" OR o:"without paying" OR kw:evoke OR is:phyrexian) (o:counter OR o:destroy OR o:exile OR o:"return target" OR o:"choose new targets" OR o:"puts it on the top" OR o:"puts it on the bottom"))';

/** Keep older Build/Upgrade role queries aligned with the shared card-role truth boundary. */
export function normalizeScryfallSearchQueryV15(query: string): string {
  return query.trim().replace(LEGACY_FREE_INTERACTION_SEARCH_CLAUSE_V15, FREE_INTERACTION_SEARCH_CLAUSE_V15);
}

function sleep(ms: number): Promise<void> {
  return ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));
}

async function scryfallRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  let releaseQueue: () => void = () => undefined;
  const previous = rateLimitQueue;
  rateLimitQueue = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });

  await previous;
  try {
    const waitMs = Math.max(0, MIN_REQUEST_GAP_MS - (Date.now() - lastRequestAt));
    if (waitMs > 0) await sleep(waitMs);
    lastRequestAt = Date.now();
    return await fetchJson<T>(url, init);
  } finally {
    releaseQueue();
  }
}

function freshTimedCards(entry: TimedCardCacheEntry | undefined): ScryfallCard[] | null {
  if (!entry || Date.now() - entry.loadedAt >= QUERY_CACHE_TTL_MS) return null;
  return entry.cards;
}

function rememberIdentifier(key: string, card: ScryfallCard): void {
  if (!identifierCache.has(key) && identifierCache.size >= IDENTIFIER_CACHE_MAX) {
    const oldest = identifierCache.keys().next().value as string | undefined;
    if (oldest) identifierCache.delete(oldest);
  }
  identifierCache.set(key, card);
}

function identifierKey(identifier: CardIdentifierInput): string {
  return [identifier.name.toLocaleLowerCase(), identifier.set?.toLocaleLowerCase() ?? '', identifier.collectorNumber ?? ''].join('|');
}

function cacheCardAliases(card: ScryfallCard): void {
  rememberIdentifier(identifierKey({ name: card.name }), card);
  rememberIdentifier(identifierKey({ name: card.name, set: card.set }), card);
  rememberIdentifier(identifierKey({ name: card.name, set: card.set, collectorNumber: card.collector_number }), card);
}

function cardMatchesIdentifier(card: ScryfallCard, identifier: CardIdentifierInput): boolean {
  if (identifier.set && card.set.toLocaleLowerCase() !== identifier.set.toLocaleLowerCase()) return false;
  if (identifier.collectorNumber && card.collector_number.toLocaleLowerCase() !== identifier.collectorNumber.toLocaleLowerCase()) return false;
  return card.name.toLocaleLowerCase() === identifier.name.toLocaleLowerCase();
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

function landProducesExtraMana(text: string): boolean {
  return /\badd \{[^}]+\}\{[^}]+\}/.test(text)
    || /\badd (?:two|three|four|five|six|seven|eight|nine|ten)(?:\s+mana|\s+\{)/.test(text)
    || /\badd [^.]*\bfor each\b/.test(text)
    || /\badd an amount of mana [^.]*\bequal to\b/.test(text)
    || /\badd [^.]*\bequal to\b/.test(text);
}

function basicLandRampOnlySearch(text: string): boolean {
  const fragments = [...text.matchAll(/search your library for ([^.]+)/g)]
    .map((match) => match[1]?.trim() ?? '')
    .filter(Boolean);
  if (fragments.length === 0) return false;
  return fragments.every((fragment) => {
    if (/\b(?:creature|artifact|enchantment|instant|sorcery|planeswalker|battle) cards?\b/.test(fragment)) return false;
    if (/\ba cards?\b/.test(fragment) && !/\b(?:basic )?land cards?\b/.test(fragment)) return false;
    return /\bbasic land cards?\b/.test(fragment)
      || /\b(?:plains|island|swamp|mountain|forest)(?:\s*,|\s+or|\s+and|\s+cards?\b)/.test(fragment);
  });
}

function hasManaFreeEvoke(text: string): boolean {
  const costs = [...text.matchAll(/evoke[—-]([^\n.]+)/g)]
    .map((match) => match[1]?.trim() ?? '')
    .filter(Boolean);
  return costs.some((cost) => !/\{[^}]+\}/.test(cost));
}

function manaCostPayableWithoutMana(manaCost: string): boolean {
  return manaCost.split(/\s*\/\/\s*/).some((faceCost) => {
    const symbols = [...faceCost.matchAll(/\{([^}]+)\}/g)]
      .map((match) => match[1]?.trim().toUpperCase() ?? '')
      .filter(Boolean);
    return symbols.length > 0 && symbols.every((symbol) =>
      symbol === '0' || /^[WUBRG]\/P$/.test(symbol) || /^P\/[WUBRG]$/.test(symbol));
  });
}

function hasFreeCastAlternative(card: ScryfallCard, manaCost: string, text: string, isLand: boolean): boolean {
  if (!isLand && card.cmc === 0 && /\{0\}/.test(manaCost)) return true;
  if (/rather than pay (?:this spell's|its|the)?\s*mana cost/.test(text)) return true;
  if (/cast this spell without paying (?:its|this spell's) mana cost/.test(text)) return true;
  if (!isLand && manaCostPayableWithoutMana(manaCost)) return true;
  return !isLand && hasManaFreeEvoke(text);
}

function hasDirectInteractionText(text: string): boolean {
  return /counter target/.test(text)
    || /(?:destroy|exile)(?: up to [^.]{0,80})? target/.test(text)
    || /exile any number of target/.test(text)
    || /return target .* to (?:its|their) owner's hand/.test(text)
    || /put target [^.]{0,100} on (?:the )?top of (?:its|their) owner's library/.test(text)
    || /choose up to one target (?:creature|planeswalker) spell[\s\S]*owner puts it on the (?:top|bottom)/.test(text)
    || /choose new targets? for target (?:spell|ability)/.test(text)
    || /deals? [^.]{0,120} damage [^.]{0,120} target/.test(text)
    || /target opponent reveals their hand/.test(text)
    || /target player [^.]{0,120}graveyard[^.]{0,120}bottom/.test(text);
}

export function inferCardRoles(card: ScryfallCard): string[] {
  const text = getCardOracleText(card).toLowerCase();
  const type = card.type_line.toLowerCase();
  const manaCost = getCardManaCost(card);
  const roles = new Set<string>();
  const isLand = type.includes('land');

  const addsMana = /\badd (?:\{|one mana|two mana|three mana|four mana|five mana|mana)/.test(text);
  const requiresPaidManaSetup = /\b(?:multi)?kicker\b/.test(text) || /\{x\}/i.test(manaCost);
  if (addsMana && (!isLand || landProducesExtraMana(text))) roles.add('mana acceleration');
  if (type.includes('artifact') && addsMana && !type.includes('creature')) roles.add('mana rock');
  if (type.includes('creature') && /\{t\}:\s*add|whenever .* add .* mana/.test(text)) roles.add('mana dork');
  if (card.cmc <= 1 && addsMana && !isLand && !requiresPaidManaSetup) roles.add('fast mana');
  const nonlandManaMultiplier = /whenever you tap a nonland permanent for mana, add [^.]*mana/.test(text)
    || /if you tap (?:a|an|another) nonland permanent for mana[^.]*add [^.]*additional mana/.test(text)
    || /nonland permanents? you tap for mana produce [^.]*additional mana/.test(text);
  if (nonlandManaMultiplier) {
    roles.add('mana acceleration');
    roles.add('mana multiplier');
  }
  if (card.cmc <= 1 && (roles.has('fast mana') || roles.has('mana dork'))) roles.add('early acceleration');
  if (/search your library for .*land/.test(text) && /battlefield/.test(text)) roles.add('land ramp');
  if (/costs? .* less to cast/.test(text)) roles.add('cost reduction');
  if (/create .* treasure token/.test(text)) roles.add('treasure');
  const producesColoredMana = (card.produced_mana ?? []).some((color) => /^[WUBRG]$/i.test(color));
  const grantsPersistentManaAbility = /(?:enchanted|equipped) (?:land|permanent|creature)[^.]*\badd\b/.test(text);
  if (
    !isLand
    && (
      roles.has('land ramp')
      || (producesColoredMana && (roles.has('mana rock') || roles.has('mana dork') || grantsPersistentManaAbility))
    )
  ) roles.add('persistent colored mana source');

  if (/draw (?:a|one|two|three|four|five|\d+) cards?/.test(text)) roles.add('card draw');
  if (/whenever .* draw a card|at the beginning of .* draw|whenever .* deals? combat damage .* draw/.test(text)) roles.add('repeatable draw');
  if (/scry|surveil|look at the top .* cards|exile the top .* you may play/.test(text)) roles.add('card selection');
  if (/discard your hand.*draw|each player discards .* hand.*draw/.test(text)) roles.add('wheel');

  const searchesLibrary = /search your library for/.test(text);
  if (searchesLibrary && !basicLandRampOnlySearch(text)) roles.add('tutor');
  if (/search your library for .*creature/.test(text)) roles.add('creature tutor');
  if (/search your library for .*land/.test(text)) roles.add('land tutor');

  if (/counter target spell/.test(text)) roles.add('countermagic');
  if (hasFreeCastAlternative(card, manaCost, text, isLand) && hasDirectInteractionText(text)) roles.add('free interaction');
  if (
    /(?:destroy|exile)(?: up to [^.]{0,80})? target/.test(text)
    || /return target .* to (?:its|their) owner's hand/.test(text)
    || /tap target (?:artifact|creature|permanent)/.test(text)
    || /target [^.]{0,100}(?:creature|planeswalker)[^.]{0,60}gets? -(?:x|\d+)\/-(?:x|\d+)/.test(text)
    || /deals? [^.]{0,120} damage (?:to )?(?:any |up to one )?target/.test(text)
  ) roles.add('spot interaction');
  if (/destroy target artifact|destroy target enchantment|exile target artifact|exile target enchantment/.test(text)) roles.add('artifact/enchantment interaction');
  if (/exile .* graveyard|cards? in graveyards? can't|players? can't cast .* graveyards?/.test(text)) roles.add('graveyard hate');
  const massGraveyardExchange = /each player exiles all creature cards from [^.]{0,80}graveyard[^.]{0,120}then sacrifices all creatures[^.]{0,80}then puts all cards [^.]{0,80}exiled this way onto the battlefield/.test(text);
  if (
    /(destroy|exile) (?:all|each) (?:[a-z-]+ ){0,3}(?:creatures|artifacts|enchantments|nonland permanents|permanents)/.test(text)
    || /(?:all creatures get|each creature gets) -(?:x|\d+)\/-(?:x|\d+)/.test(text)
    || /put [^.]*-1\/-1 counters? on each creature/.test(text)
    || /deals? [^.]* damage to each creature/.test(text)
    || /return (?:all|each) (?:creatures|nonland permanents|permanents)[^.]*owners?' hands?/.test(text)
    || /each player sacrifices [^.]*creatures?/.test(text)
    || massGraveyardExchange
  ) roles.add('board wipe');

  const createsOrMultipliesTokens = /create [^.]* tokens?/.test(text)
    || /\bif (?:one or more )?tokens? would be created under your control\b/.test(text)
    || /\bif you would create [^.]{0,80}tokens?\b/.test(text)
    || /\bthose tokens plus\b/.test(text)
    || /\bcreate twice that many [^.]{0,40}tokens?\b/.test(text);
  if (createsOrMultipliesTokens) roles.add('token production');
  const teamWideStatPayoff = /(?<!target )\b(?:other )?(?:creatures|[a-z][a-z'-]*s) you control (?:get|gain) \+\d+\/\+\d+/.test(text);
  const distributedTypalPump = /\b(?:creatures|[a-z][a-z'-]*s) you control have "[^"]{0,100}\btarget (?:creature|[a-z][a-z'-]*) gets? \+\d+\/\+\d+/.test(text);
  const boardScalingEquipment = /\bequipped creature (?:gets?|has) [^.]{0,100}\bfor each (?:other )?creature you control\b/.test(text);
  const boardScalingCreature = type.includes('creature')
    && /\bput (?:a|one|two|three|\d+) \+1\/\+1 counters? on (?:it|this creature)[^.]{0,80}\bfor each (?:other )?[^.]{1,80} you control\b/.test(text);
  const boardScalingCardAdvantage = /\bdraw (?:a card for each|cards equal to (?:the )?number of) creatures? you control\b/.test(text);
  if (teamWideStatPayoff || distributedTypalPump || boardScalingEquipment || boardScalingCreature || boardScalingCardAdvantage) roles.add('go-wide payoff');
  const sacrificeTargets = [...text.matchAll(
    /\bsacrifice (?:a|an|another|target|one or more|any number of|x\b)\s+([^.,:;\n]{1,80})/g,
  )].map((match) => match[1]?.trim() ?? '');
  const sacrificeAction = sacrificeTargets.some((target) => !/^(?:basic )?lands?\b/.test(target));
  const selfReferenceNames = [card.name, ...(card.card_faces ?? []).map((face) => face.name)]
    .flatMap((name) => name.split('//'))
    .map((name) => name.trim().toLocaleLowerCase())
    .filter(Boolean);
  const selfSacrificeAction = /\bsacrifice this (?:artifact|creature|enchantment|permanent|token|card)\b/.test(text)
    || selfReferenceNames.some((name) => text.includes(`sacrifice ${name}:`));
  const repeatableSacrificeCost = /\bsacrifice (?:a|an|another|target|one or more|any number of|x\b)[^.:]{0,80}:/.test(text);
  if (sacrificeAction) roles.add('sacrifice synergy');
  if (selfSacrificeAction) roles.add('self sacrifice');
  if (repeatableSacrificeCost) roles.add('sacrifice outlet');
  const delayedDeathReturn = /(?:when|whenever) [^.]{0,120}\bdies?\b[^.]{0,160}\breturn (?:it|that card|that creature|them) to the battlefield\b/.test(text);
  if (
    /from your graveyard/.test(text)
    || /return .* from .* graveyard/.test(text)
    || /put target [^.]{0,120} from (?:a|the|your) graveyard onto the battlefield/.test(text)
    || delayedDeathReturn
    || massGraveyardExchange
  ) roles.add('graveyard recursion');
  const boardProtection = /(?:other )?(?:creatures|permanents|artifacts|enchantments) you control\s+(?:have|gain)[^.]{0,80}(?:hexproof|indestructible|protection from|shroud)/.test(text)
    || /(?:all |any number of )?(?:permanents|creatures) you control phase out/.test(text);
  const targetedProtection = /(?:target|another target|equipped|enchanted|commander)[^.]{0,100}(?:have|has|gain|gains)[^.]{0,80}(?:hexproof|indestructible|protection from|shroud)/.test(text)
    || /(?:target|another target|any number of target)[^.]{0,100}phases? out/.test(text);
  const conditionalGroupProtection = /(?:creatures|permanents|artifacts|enchantments) you control\s+(?:with|that|if|as long as)[^.]{0,100}(?:have|has|gain|gains)[^.]{0,80}(?:hexproof|indestructible|protection from|shroud)/.test(text);
  const equipmentWearerProtection = type.includes('equipment')
    && /\bequipped creature[^.]{0,120}(?:hexproof|indestructible|protection from|shroud)/.test(text);
  const genericEquipCost = text.match(/\bequip\s*\{(\d+)\}/);
  const expensiveEquipmentProtection = equipmentWearerProtection
    && genericEquipCost !== null
    && Number.parseInt(genericEquipCost[1] ?? '0', 10) > 2
    && !/\battach (?:this equipment|it) to\b/.test(text);
  if ((boardProtection || targetedProtection) && !expensiveEquipmentProtection) roles.add('protection');
  if ((conditionalGroupProtection && !boardProtection) || expensiveEquipmentProtection) roles.add('conditional protection');
  if (boardProtection) roles.add('board protection');
  const proactiveSpellLock = /(?:your )?opponents? can't cast spells? (?:this turn|during your turn)/.test(text)
    || /players? can't cast spells? (?:this turn|during your turn)/.test(text);
  if (proactiveSpellLock) {
    roles.add('stax/control');
    roles.add('combo protection');
  }
  const combatFreeCastEngine = /whenever [^.]{0,140}deals? combat damage to (?:a|one or more )players?[^.]{0,180}draw a card[^.]{0,220}cast a spell from your hand[^.]{0,120}without paying its mana cost/.test(text);
  if (combatFreeCastEngine) {
    roles.add('repeatable draw');
    roles.add('free-cast engine');
    roles.add('combat value engine');
  }
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
  if (isLand) roles.add('land');
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
  const card = await scryfallRequest<ScryfallCard>(url);
  cacheCardAliases(card);
  return card;
}

export async function lookupPrinting(set: string, collectorNumber: string, lang?: string): Promise<ScryfallCard> {
  const language = lang?.trim() ? `/${encodeURIComponent(lang.trim().toLowerCase())}` : '';
  const url = `${config.scryfallApiBase}/cards/${encodeURIComponent(set.trim().toLowerCase())}/${encodeURIComponent(collectorNumber.trim())}${language}`;
  const card = await scryfallRequest<ScryfallCard>(url);
  cacheCardAliases(card);
  return card;
}

export async function searchCards(query: string, limit = 10): Promise<ScryfallCard[]> {
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const normalizedQuery = normalizeScryfallSearchQueryV15(query);
  const cached = freshTimedCards(searchCache.get(normalizedQuery));
  if (cached) return cached.slice(0, safeLimit);

  const url = `${config.scryfallApiBase}/cards/search?q=${encodeURIComponent(normalizedQuery)}&unique=cards&order=edhrec`;
  const result = await scryfallRequest<ScryfallList<ScryfallCard>>(url);
  searchCache.set(normalizedQuery, { loadedAt: Date.now(), cards: result.data });
  for (const card of result.data) cacheCardAliases(card);
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
  const normalizedName = name.trim();
  const cacheKey = `${normalizedName.toLocaleLowerCase()}|${safeLimit}`;
  const cached = freshTimedCards(printingsCache.get(cacheKey));
  if (cached) return cached.slice(0, safeLimit);

  const cards: ScryfallCard[] = [];
  const escapedName = normalizedName.replace(/"/g, '\\"');
  let nextUrl: string | undefined = `${config.scryfallApiBase}/cards/search?q=${encodeURIComponent(`!"${escapedName}"`)}&unique=prints&order=released&dir=desc`;

  while (nextUrl && cards.length < safeLimit) {
    const page: ScryfallList<ScryfallCard> = await scryfallRequest<ScryfallList<ScryfallCard>>(nextUrl);
    cards.push(...page.data.slice(0, safeLimit - cards.length));
    nextUrl = page.has_more ? page.next_page : undefined;
  }

  printingsCache.set(cacheKey, { loadedAt: Date.now(), cards });
  for (const card of cards) cacheCardAliases(card);
  return cards;
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
  const pending: CardIdentifierInput[] = [];
  const notFound: string[] = [];

  for (const identifier of unique) {
    const cached = identifierCache.get(identifierKey(identifier));
    if (cached) cards.push(cached);
    else pending.push(identifier);
  }

  for (let index = 0; index < pending.length; index += 75) {
    const batch = pending.slice(index, index + 75);
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
    for (const card of result.data) cacheCardAliases(card);
    for (const identifier of batch) {
      const match = result.data.find((card) => cardMatchesIdentifier(card, identifier));
      if (match) rememberIdentifier(identifierKey(identifier), match);
    }
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
