export type EvidenceFocusV09 =
  | 'rules'
  | 'cards'
  | 'combos'
  | 'community'
  | 'competitive'
  | 'recorded-games'
  | 'decklists'
  | 'deck-analysis'
  | 'pricing'
  | 'nz-availability';

export interface EvidenceSourceV09 {
  id: string;
  name: string;
  url: string;
  focuses: EvidenceFocusV09[];
  access: 'live-api' | 'existing-integration' | 'public-reference' | 'manual-reference';
  evidenceClass: 'official' | 'structured-data' | 'observed-results' | 'curated' | 'community' | 'market' | 'analysis-tool';
  weight: number;
  bestFor: string;
  caution: string;
}

export const EVIDENCE_SOURCES_V09: EvidenceSourceV09[] = [
  { id: 'wizards', name: 'Wizards of the Coast', url: 'https://magic.wizards.com/', focuses: ['rules', 'cards'], access: 'public-reference', evidenceClass: 'official', weight: 1, bestFor: 'Official rules, product announcements, ban/restriction and release information.', caution: 'Official product/rules source, not a deck-performance database.' },
  { id: 'scryfall', name: 'Scryfall', url: 'https://scryfall.com/', focuses: ['cards', 'pricing'], access: 'existing-integration', evidenceClass: 'structured-data', weight: 0.98, bestFor: 'Oracle identity, legalities, printings, set codes, collector numbers and reference prices.', caution: 'Reference prices are not guaranteed local checkout prices.' },
  { id: 'spellbook', name: 'Commander Spellbook', url: 'https://commanderspellbook.com/', focuses: ['combos'], access: 'existing-integration', evidenceClass: 'curated', weight: 0.96, bestFor: 'Known Commander combos and near-combos.', caution: 'Combo presence does not by itself prove a deck is consistent or well-positioned.' },
  { id: 'topdeck', name: 'TopDeck.gg', url: 'https://topdeck.gg/', focuses: ['competitive', 'decklists'], access: 'existing-integration', evidenceClass: 'observed-results', weight: 0.94, bestFor: 'Tournament standings, records and submitted EDH decklists.', caution: 'Results include pilot, pod, seat, matchup and tournament effects.' },
  { id: 'edhtop16', name: 'EDHTop16', url: 'https://edhtop16.com/', focuses: ['competitive', 'decklists'], access: 'public-reference', evidenceClass: 'observed-results', weight: 0.9, bestFor: 'Independent cEDH meta, conversion, tournament entries and decklist links through the public site.', caution: 'Live testing found the legacy filtered POST API routes now redirect to the website instead of returning structured JSON, so MTG Ultimate treats EDHTop16 as attributed public reference evidence unless a current stable API is verified.' },
  { id: 'playgroup', name: 'Playgroup.gg', url: 'https://playgroup.gg/', focuses: ['recorded-games', 'community'], access: 'public-reference', evidenceClass: 'observed-results', weight: 0.9, bestFor: 'Recorded paper Commander outcomes, turn length, win rates and public deck performance.', caution: 'Self-selected tracked games and playgroup composition can bias results.' },
  { id: 'edhrec', name: 'EDHREC', url: 'https://edhrec.com/', focuses: ['community', 'decklists'], access: 'public-reference', evidenceClass: 'community', weight: 0.86, bestFor: 'Commander card adoption, synergy, themes and broad community deck trends.', caution: 'Popularity is not proof of optimality and can lag new tech.' },
  { id: 'cedh-ddb', name: 'cEDH Decklist Database', url: 'https://cedh-decklist-database.com/', focuses: ['competitive', 'decklists'], access: 'public-reference', evidenceClass: 'curated', weight: 0.86, bestFor: 'Reviewer-curated cEDH archetype examples, primers and strategy references.', caution: 'The DDB explicitly is not a tier list or tournament ranking.' },
  { id: 'archidekt', name: 'Archidekt', url: 'https://archidekt.com/', focuses: ['decklists', 'community'], access: 'existing-integration', evidenceClass: 'community', weight: 0.8, bestFor: 'Public decklists, creators, tags and reference-list comparisons.', caution: 'Public deck presence and views are not match results.' },
  { id: 'moxfield', name: 'Moxfield', url: 'https://www.moxfield.com/', focuses: ['decklists', 'community'], access: 'public-reference', evidenceClass: 'community', weight: 0.8, bestFor: 'Public lists, detailed primers and maintained competitive deck references.', caution: 'No undocumented private endpoint is treated as a stable API dependency.' },
  { id: 'mtggoldfish', name: 'MTGGoldfish', url: 'https://www.mtggoldfish.com/', focuses: ['decklists', 'pricing', 'community'], access: 'public-reference', evidenceClass: 'market', weight: 0.76, bestFor: 'Commander decklists, metagame browsing, deck pricing and price-history cross-checks.', caution: 'Commander listings mix many intents and power levels; prices are not NZ-specific.' },
  { id: 'aetherhub', name: 'AetherHub', url: 'https://aetherhub.com/', focuses: ['decklists', 'deck-analysis', 'community'], access: 'public-reference', evidenceClass: 'community', weight: 0.74, bestFor: 'Public decklists, deck-building tools, simulations and additional community references.', caution: 'Community decklists are evidence of usage, not proof of performance.' },
  { id: 'deckcheck', name: 'DeckCheck', url: 'https://deckcheck.co/', focuses: ['deck-analysis', 'community'], access: 'manual-reference', evidenceClass: 'analysis-tool', weight: 0.72, bestFor: 'CRISPI, PowerTune, DeckTrim and an independent deck-analysis opinion.', caution: 'Use as a second opinion; do not tune solely to one proprietary analysis score.' },
  { id: 'tcgfind-nz', name: 'TCGfind NZ', url: 'https://tcgfind.co.nz/', focuses: ['pricing', 'nz-availability'], access: 'manual-reference', evidenceClass: 'market', weight: 0.82, bestFor: 'New Zealand card availability and local-price cross-checking.', caution: 'Inventory and prices change quickly; verify the exact printing and seller at purchase time.' },
  { id: 'tcgplayer', name: 'TCGplayer', url: 'https://www.tcgplayer.com/', focuses: ['pricing'], access: 'public-reference', evidenceClass: 'market', weight: 0.7, bestFor: 'Large US-market printing-price reference.', caution: 'US pricing, shipping and condition can differ substantially from NZ purchase cost.' },
  { id: 'cardmarket', name: 'Cardmarket', url: 'https://www.cardmarket.com/en/Magic', focuses: ['pricing'], access: 'public-reference', evidenceClass: 'market', weight: 0.68, bestFor: 'European-market printing-price reference.', caution: 'European pricing is useful as a cross-check, not a direct NZ landed price.' },
];

function commanderKey(commanders: string[]): string {
  return commanders.map((name) => name.trim()).filter(Boolean).join(' / ');
}

function slug(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[’']/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function evidenceSourcesForV09(focuses: EvidenceFocusV09[] = []): EvidenceSourceV09[] {
  if (focuses.length === 0) return [...EVIDENCE_SOURCES_V09];
  const wanted = new Set(focuses);
  return EVIDENCE_SOURCES_V09
    .filter((source) => source.focuses.some((focus) => wanted.has(focus)))
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));
}

export function buildResearchLinksV09(commanders: string[], cards: string[] = []): Array<Record<string, unknown>> {
  const combined = commanderKey(commanders);
  const first = commanders[0]?.trim() ?? '';
  const card = cards[0]?.trim() ?? '';
  return [
    { source: 'EDHREC', url: first ? `https://edhrec.com/commanders/${slug(first)}` : 'https://edhrec.com/', query: combined || card, useFor: 'community adoption, synergy and themes' },
    { source: 'EDHTop16', url: combined ? `https://edhtop16.com/commander/${encodeURIComponent(combined)}` : 'https://edhtop16.com/', query: combined, useFor: 'competitive entries, conversion and cEDH staples; use as an attributed public reference rather than assuming the legacy filtered API still works' },
    { source: 'cEDH Decklist Database', url: 'https://cedh-decklist-database.com/', query: combined, useFor: 'curated cEDH archetypes and primers' },
    { source: 'Moxfield', url: 'https://www.moxfield.com/decks/public/advanced', query: combined, useFor: 'maintained public lists and primers' },
    { source: 'MTGGoldfish', url: 'https://www.mtggoldfish.com/metagame/commander/full', query: combined || card, useFor: 'decklists and secondary price/meta cross-checks' },
    { source: 'AetherHub', url: 'https://aetherhub.com/Decks/', query: combined, useFor: 'additional public decklists and simulations' },
    { source: 'Playgroup.gg', url: 'https://playgroup.gg/', query: combined, useFor: 'recorded paper Commander outcomes; use the site search rather than assuming a private query route' },
    { source: 'DeckCheck', url: 'https://deckcheck.co/', query: combined || card, useFor: 'independent CRISPI/PowerTune-style analysis; use the site UI for the supplied query/deck' },
    { source: 'TCGfind NZ', url: 'https://tcgfind.co.nz/', query: card || combined, useFor: 'NZ availability and local-price checking; search the exact printing in the site UI' },
  ];
}

/**
 * Compatibility helper retained for V0.9/V0.12 callers.
 *
 * Live smoke testing in August 2026 showed the legacy EDHTop16 filtered POST
 * endpoints redirecting to the public website and returning HTML rather than
 * structured JSON. Returning an explicit reference packet is safer than
 * fabricating entries or repeatedly calling a retired endpoint.
 */
export async function fetchEdhTop16CommanderEntriesV09(options: {
  commanders: string[];
  lastDays?: number;
  minTournamentSize?: number;
  maxStanding?: number;
  limit?: number;
}): Promise<Record<string, unknown>> {
  const commander = commanderKey(options.commanders);
  if (!commander) throw new Error('Provide at least one commander name for EDHTop16 research.');
  return {
    source: 'EDHTop16',
    sourceMode: 'public-reference',
    sourceUrl: `https://edhtop16.com/commander/${encodeURIComponent(commander)}`,
    commander,
    requestedFilters: {
      lastDays: options.lastDays ?? 180,
      minTournamentSize: options.minTournamentSize ?? 32,
      maxStanding: options.maxStanding ?? 16,
      limit: options.limit ?? 30,
    },
    entryCount: null,
    entries: [],
    structuredDataAvailable: false,
    note: 'The public EDHTop16 site remains a useful competitive reference, but the legacy filtered POST API was not returning structured JSON during live integration testing. MTG Ultimate will not invent tournament rows.',
  };
}

export function evidenceWeightingGuideV09(): Record<string, unknown> {
  return {
    ruleQuestions: ['Wizards', 'Scryfall'],
    cardIdentityAndPrintings: ['Scryfall'],
    comboClaims: ['Commander Spellbook', 'Scryfall Oracle text'],
    competitivePerformance: ['TopDeck.gg structured results when configured', 'EDHTop16 public reference', 'cEDH Decklist Database as curated context'],
    broadCommanderBuilding: ['EDHREC', 'Archidekt', 'Moxfield', 'MTGGoldfish', 'AetherHub'],
    realPaperGameSignals: ['Playgroup.gg'],
    independentDeckAnalysis: ['DeckCheck'],
    nzShopping: ['TCGfind NZ', 'Scryfall printing identity', 'MTGGoldfish/TCGplayer/Cardmarket as secondary market references'],
    principle: 'Prefer agreement across different evidence classes. Never convert community popularity, one analysis score, or one tournament finish into a claim that a card is universally optimal.',
  };
}
