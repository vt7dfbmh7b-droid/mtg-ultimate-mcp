import { config } from '../config.js';
import type { ScryfallCard } from '../types/scryfall.js';

type Row = { card: ScryfallCard; name: string; names: string[]; oracle: string; type: string; mana: string; keywords: string[] };
type Predicate = (row: Row) => boolean;
const lower = (value: string): string => value.trim().toLowerCase();
const cmp = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

/** Unsupported replay semantics are an evidence failure, never a match-all filter. */
export class RetainedScryfallQueryErrorV15 extends Error {
  constructor(message: string) { super(message); this.name = 'RetainedScryfallQueryErrorV15'; }
}
function unsupported(value: string): never {
  throw new RetainedScryfallQueryErrorV15(`Unsupported or malformed retained Scryfall query: ${value}`);
}

function tokens(query: string): string[] {
  if (!query.trim() || query.length > 16_384) return unsupported(query);
  const result: string[] = [];
  let token = '', quoted = false, escaped = false;
  const flush = (): void => { if (token) result.push(token); token = ''; };
  for (const ch of query) {
    if (escaped) { token += ch; escaped = false; continue; }
    if (quoted && ch === '\\') { token += ch; escaped = true; continue; }
    if (ch === '"') { token += ch; quoted = !quoted; continue; }
    if (!quoted && /\s/.test(ch)) { flush(); continue; }
    if (!quoted && (ch === '(' || ch === ')')) { flush(); result.push(ch); continue; }
    token += ch;
  }
  if (quoted || escaped) return unsupported(query);
  flush();
  if (result.length > 1_024) return unsupported('query exceeds token ceiling');
  return result;
}

function unquote(value: string): string {
  if (value.startsWith('"')) {
    try { return lower(JSON.parse(value) as string); } catch { return unsupported(value); }
  }
  if (!value || value.includes('"') || value.startsWith('/')) return unsupported(value);
  return lower(value);
}

function compareNumber(a: number, op: string, b: number): boolean {
  switch (op) {
    case ':': case '=': return a === b;
    case '<': return a < b;
    case '>': return a > b;
    case '<=': return a <= b;
    case '>=': return a >= b;
    case '!=': return a !== b;
    default: return unsupported(op);
  }
}

function atom(value: string): Predicate {
  if (value.startsWith('-')) { const match = atom(value.slice(1)); return row => !match(row); }
  if (value.startsWith('!')) { const name = unquote(value.slice(1)); return row => row.name === name; }
  const parts = /^([a-z]+)(<=|>=|!=|:|=|<|>)(.+)$/i.exec(value);
  if (!parts) {
    if (/[<>=:]/.test(value)) return unsupported(value);
    const name = unquote(value);
    return row => row.name.includes(name);
  }
  const field = lower(parts[1]!), op = parts[2]!, needle = unquote(parts[3]!);
  if (['mv', 'cmc', 'usd', 'eur', 'tix', 'edhrec'].includes(field)) {
    const number = Number(needle);
    if (!Number.isFinite(number)) return unsupported(value);
    return row => {
      const actual = field === 'mv' || field === 'cmc' ? row.card.cmc
        : field === 'edhrec' ? row.card.edhrec_rank : row.card.prices?.[field];
      return actual !== undefined && actual !== null && Number.isFinite(Number(actual)) && compareNumber(Number(actual), op, number);
    };
  }
  if (['id', 'identity', 'ci', 'c', 'color'].includes(field)) {
    const numeric = /^\d+$/.test(needle);
    const aliases: Record<string, string> = { white: 'w', blue: 'u', black: 'b', red: 'r', green: 'g', colorless: '', c: '' };
    const colors = aliases[needle] ?? needle;
    if (!numeric && !/^[wubrg]*$/.test(colors)) return unsupported(value);
    const requested = new Set(colors);
    return row => {
      const actual = new Set((field === 'c' || field === 'color' ? row.card.colors ?? [] : row.card.color_identity).map(lower));
      if (numeric) return compareNumber(actual.size, op, Number(needle));
      const subset = [...actual].every(color => requested.has(color));
      const superset = [...requested].every(color => actual.has(color));
      switch (op) {
        case ':': return requested.size === 0 ? actual.size === 0 : superset;
        case '=': return subset && superset;
        case '!=': return !(subset && superset);
        case '<=': return subset;
        case '>=': return superset;
        case '<': return subset && actual.size < requested.size;
        case '>': return superset && actual.size > requested.size;
        default: return unsupported(value);
      }
    };
  }
  if (op !== ':' && op !== '=') return unsupported(value);
  switch (field) {
    case 'o': case 'oracle': return row => row.oracle.includes(needle);
    case 't': case 'type': return row => row.type.includes(needle);
    case 'n': case 'name': return row => op === '=' ? row.name === needle : row.name.includes(needle);
    case 'kw': case 'keyword': return row => row.keywords.includes(needle);
    case 'set': case 's': case 'e': return row => lower(row.card.set) === needle;
    case 'f': case 'format': case 'legal': return row => row.card.legalities[needle] === 'legal';
    case 'game': return row => row.card.games?.includes(needle) === true;
    case 'lang': case 'language': return row => lower(row.card.lang) === needle;
    case 'is':
      if (needle === 'phyrexian') return row => /\{[^}]*\/p\}/.test(row.mana);
      if (needle === 'promo') return row => row.card.promo === true;
      if (needle === 'digital') return row => row.card.digital === true;
      return unsupported(value);
    default: return unsupported(value);
  }
}

/** A deliberately bounded subset of the API grammar used by product discovery. */
export function compileRetainedScryfallQueryV15(query: string): Predicate {
  const input = tokens(query);
  let at = 0;
  const primary = (depth: number): Predicate => {
    if (depth > 64) return unsupported('group nesting exceeds ceiling');
    const token = input[at++];
    if (token === '-' || token?.toUpperCase() === 'NOT') { const child = primary(depth + 1); return row => !child(row); }
    if (token === '(') {
      const child = expression(depth + 1);
      if (input[at++] !== ')') return unsupported(query);
      return child;
    }
    if (!token || token === ')' || /^(OR|AND)$/i.test(token)) return unsupported(query);
    return atom(token);
  };
  const conjunction = (depth: number): Predicate => {
    const terms = [primary(depth)];
    while (at < input.length && input[at] !== ')' && input[at]?.toUpperCase() !== 'OR') {
      if (input[at]?.toUpperCase() === 'AND') at++;
      terms.push(primary(depth));
    }
    return row => terms.every(term => term(row));
  };
  const expression = (depth: number): Predicate => {
    const terms = [conjunction(depth)];
    while (input[at]?.toUpperCase() === 'OR') { at++; terms.push(conjunction(depth)); }
    return row => terms.some(term => term(row));
  };
  const result = expression(0);
  if (at !== input.length) return unsupported(query);
  return result;
}

class RetainedCardIndex {
  readonly rows: Row[];
  readonly byName = new Map<string, Row[]>();
  readonly byPrinting = new Map<string, Row[]>();
  readonly queries = new Map<string, ScryfallCard[]>();
  readonly failures = new Set<string>();
  searches = 0;
  constructor(cards: ScryfallCard[]) {
    if (cards.length === 0) throw new Error('Retained Scryfall card-data override cannot be empty.');
    this.rows = cards.map(card => ({
      card, name: lower(card.name), names: [card.name, ...(card.card_faces ?? []).map(face => face.name)].map(lower),
      oracle: lower(card.oracle_text ?? (card.card_faces ?? []).map(face => face.oracle_text ?? '').join('\n')),
      type: lower(card.type_line), mana: lower(card.mana_cost ?? (card.card_faces ?? []).map(face => face.mana_cost ?? '').join(' ')),
      keywords: card.keywords.map(lower),
    })).sort((a, b) => cmp(b.card.released_at ?? '', a.card.released_at ?? '') || cmp(a.card.id, b.card.id));
    for (const row of this.rows) {
      for (const name of new Set(row.names)) this.byName.set(name, [...(this.byName.get(name) ?? []), row]);
      const key = `${lower(row.card.set)}|${lower(row.card.collector_number)}`;
      this.byPrinting.set(key, [...(this.byPrinting.get(key) ?? []), row]);
    }
  }
  search(url: URL): unknown {
    const query = url.searchParams.get('q') ?? '';
    const unique = url.searchParams.get('unique') ?? 'cards';
    const order = url.searchParams.get('order') ?? 'name';
    const dir = url.searchParams.get('dir') ?? (order === 'released' ? 'desc' : 'asc');
    const page = Number(url.searchParams.get('page') ?? '1');
    if (!['cards', 'prints'].includes(unique) || !['name', 'edhrec', 'released', 'cmc', 'usd'].includes(order)
      || !['asc', 'desc'].includes(dir) || !Number.isSafeInteger(page) || page < 1) return unsupported(url.href);
    for (const key of url.searchParams.keys()) if (!['q', 'unique', 'order', 'dir', 'page'].includes(key)) return unsupported(url.href);
    const key = JSON.stringify([query, unique, order, dir]);
    let results = this.queries.get(key);
    if (!results) {
      const match = compileRetainedScryfallQueryV15(query);
      this.searches++;
      results = this.rows.filter(match).map(row => row.card).sort((a, b) => {
        const first = order === 'edhrec' ? (a.edhrec_rank ?? Infinity) - (b.edhrec_rank ?? Infinity)
          : order === 'released' ? cmp(a.released_at ?? '', b.released_at ?? '')
          : order === 'cmc' ? a.cmc - b.cmc
          : order === 'usd' ? Number(a.prices?.usd ?? Infinity) - Number(b.prices?.usd ?? Infinity)
          : cmp(a.name, b.name);
        return (Number.isNaN(first) ? 0 : first) * (dir === 'desc' ? -1 : 1)
          || cmp(a.name, b.name) || cmp(b.released_at ?? '', a.released_at ?? '') || cmp(a.id, b.id);
      });
      if (unique === 'cards') {
        const seen = new Set<string>();
        results = results.filter(card => {
          const id = card.oracle_id ?? lower(card.name);
          if (seen.has(id)) return false;
          seen.add(id); return true;
        });
      }
      if (this.queries.size >= 256) this.queries.delete(this.queries.keys().next().value!);
      this.queries.set(key, results);
    }
    const size = 175, hasMore = page * size < results.length;
    const next = new URL(url); next.searchParams.set('page', String(page + 1));
    return { object: 'list', data: results.slice((page - 1) * size, page * size), total_cards: results.length, has_more: hasMore,
      ...(hasMore ? { next_page: next.href } : {}) };
  }
  identifier(entry: { name?: string; set?: string; collector_number?: string; lang?: string }): ScryfallCard | undefined {
    const rows = entry.set && entry.collector_number
      ? this.byPrinting.get(`${lower(entry.set)}|${lower(entry.collector_number)}`) ?? []
      : this.byName.get(lower(entry.name ?? '')) ?? [];
    return rows.find(row => (!entry.name || row.names.includes(lower(entry.name)))
      && (!entry.set || lower(row.card.set) === lower(entry.set))
      && (!entry.lang || lower(row.card.lang) === lower(entry.lang)))?.card;
  }
}

let retained: RetainedCardIndex | null = null;
export function installRetainedCardIndexV15(cards: ScryfallCard[]): void { retained = new RetainedCardIndex(cards); }
export function clearRetainedCardIndexV15(): void { retained = null; }
export function isRetainedScryfallCardDataInstalledV15(): boolean { return retained !== null; }
export function retainedScryfallDiagnosticsV15(): { queryEvaluations: number; failures: string[] } {
  return { queryEvaluations: retained?.searches ?? 0, failures: [...(retained?.failures ?? [])] };
}
export function assertRetainedScryfallReplayCompleteV15(): void {
  if (retained?.failures.size) throw new Error(`Retained Scryfall replay incomplete: ${[...retained.failures].join('; ')}`);
}

/** Shared HTTP boundary: covers ordinary, paged, and unrestricted card discovery. Sets/catalogs
 * remain real provider responses and must come from the separately retained HTTP session. */
export function retainedScryfallResponseV15(url: string, init: RequestInit = {}): unknown | undefined {
  if (!retained) return undefined;
  const target = new URL(url), base = new URL(config.scryfallApiBase);
  if (target.origin !== base.origin || !target.pathname.startsWith(`${base.pathname.replace(/\/$/, '')}/cards/`)) return undefined;
  const path = target.pathname.slice(base.pathname.replace(/\/$/, '').length);
  try {
    if (path === '/cards/search') return retained.search(target);
    if (path === '/cards/collection') {
      const body = JSON.parse(String(init.body)) as { identifiers: Array<{ name?: string; set?: string; collector_number?: string }> };
      const data: ScryfallCard[] = [], notFound: typeof body.identifiers = [];
      for (const entry of body.identifiers) { const card = retained.identifier(entry); if (card) data.push(card); else notFound.push(entry); }
      return { object: 'list', data, not_found: notFound };
    }
    if (path === '/cards/named') {
      const name = target.searchParams.get('exact') ?? target.searchParams.get('fuzzy') ?? '';
      const card = retained.identifier({ name, ...(target.searchParams.has('set') ? { set: target.searchParams.get('set')! } : {}) });
      if (card) return card;
      return unsupported(`named lookup requires a resolved exact name: ${name}`);
    }
    const printing = /^\/cards\/([^/]+)\/([^/]+)(?:\/([^/]+))?$/.exec(path);
    if (printing) {
      const card = retained.identifier({ set: decodeURIComponent(printing[1]!), collector_number: decodeURIComponent(printing[2]!),
        ...(printing[3] ? { lang: decodeURIComponent(printing[3]) } : {}) });
      if (card) return card;
    }
    return unsupported(url);
  } catch (error) {
    retained.failures.add(error instanceof Error ? error.message : String(error));
    throw error;
  }
}
