import { config } from '../config.js';
import { fetchJson } from '../lib/http.js';
import type { ScryfallCard } from '../types/scryfall.js';
import { getCardOracleText, inferCardRoles } from './scryfall.js';

export type NeutralThemeKindV15 =
  | 'creature-type'
  | 'mechanic'
  | 'card-type'
  | 'oracle-text'
  | 'printing-family'
  | 'unsupported';

export type NeutralThemeEnforceabilityV15 = 'full' | 'delegated-printing-policy' | 'unsupported';

export type NeutralThemeMatchRuleV15 =
  | { type: 'creature-type'; creatureType: string }
  | { type: 'role-any'; roles: string[]; oracleFallbacks: string[] }
  | { type: 'card-type'; cardType: string }
  | { type: 'oracle-substring'; phrase: string }
  | { type: 'printing-family'; family: string }
  | { type: 'none' };

export interface NeutralThemeIntentV15 {
  original: string;
  normalizedInput: string;
  kind: NeutralThemeKindV15;
  enforceability: NeutralThemeEnforceabilityV15;
  canonicalLabel: string | null;
  queryClause: string | null;
  minimumMainMatches: number;
  printingFamily: string | null;
  matchRule: NeutralThemeMatchRuleV15;
  explanation: string;
}

export interface NeutralThemeAuditEntryV15 {
  name: string;
  quantity: number;
  zone: 'commander' | 'main';
  matches: boolean;
}

export interface NeutralThemeAuditV15 {
  status: 'satisfied' | 'under-minimum' | 'printing-policy-failed' | 'unsupported';
  satisfied: boolean;
  original: string;
  kind: NeutralThemeKindV15;
  canonicalLabel: string | null;
  requiredMainMatches: number;
  matchedMainCards: number;
  totalMainCards: number;
  mainCoverage: number;
  matchingCardNames: string[];
  entries: NeutralThemeAuditEntryV15[];
  explanation: string;
}

interface ScryfallCatalogV15 {
  object: 'catalog';
  uri?: string;
  total_values?: number;
  data: string[];
}

interface MechanicalThemeDefinitionV15 {
  id: string;
  label: string;
  aliases: string[];
  queryClause: string;
  minimumMainMatches: number;
  roles: string[];
  oracleFallbacks: string[];
}

interface CardTypeThemeDefinitionV15 {
  id: string;
  label: string;
  aliases: string[];
  queryClause: string;
  minimumMainMatches: number;
  typeNeedle: string;
}

const MECHANICAL_THEMES: MechanicalThemeDefinitionV15[] = [
  {
    id: 'tokens',
    label: 'Tokens',
    aliases: ['token', 'tokens', 'token matters', 'token synergy'],
    queryClause: 'o:token',
    minimumMainMatches: 15,
    roles: ['token production'],
    oracleFallbacks: ['token'],
  },
  {
    id: 'plus-one-counters',
    label: '+1/+1 counters',
    aliases: ['+1/+1 counter', '+1/+1 counters', 'plus one counters', 'plus one plus one counters'],
    queryClause: 'o:"+1/+1 counter"',
    minimumMainMatches: 15,
    roles: ['+1/+1 counters'],
    oracleFallbacks: ['+1/+1 counter'],
  },
  {
    id: 'sacrifice',
    label: 'Sacrifice / aristocrats',
    aliases: ['sacrifice', 'sacrifice synergy', 'aristocrat', 'aristocrats'],
    queryClause: '(o:sacrifice OR o:dies)',
    minimumMainMatches: 15,
    roles: ['sacrifice synergy', 'sacrifice outlet', 'life drain'],
    oracleFallbacks: ['sacrifice', 'dies'],
  },
  {
    id: 'graveyard',
    label: 'Graveyard / reanimator',
    aliases: ['graveyard', 'graveyard matters', 'reanimator', 'reanimation', 'self mill'],
    queryClause: 'o:graveyard',
    minimumMainMatches: 15,
    roles: ['graveyard recursion'],
    oracleFallbacks: ['graveyard', 'mill', 'surveil'],
  },
  {
    id: 'equipment',
    label: 'Equipment / Voltron',
    aliases: ['equipment', 'equipment matters', 'voltron'],
    queryClause: '(t:equipment OR o:equip)',
    minimumMainMatches: 15,
    roles: ['equipment'],
    oracleFallbacks: ['equip ', 'equipped creature', 'attach'],
  },
  {
    id: 'spellslinger',
    label: 'Instants and sorceries / spellslinger',
    aliases: ['spellslinger', 'spell slinger', 'instants and sorceries', 'instant and sorcery', 'spells matter'],
    queryClause: '(t:instant OR t:sorcery OR o:"whenever you cast")',
    minimumMainMatches: 18,
    roles: ['countermagic', 'copy effect'],
    oracleFallbacks: ['instant', 'sorcery', 'whenever you cast'],
  },
  {
    id: 'treasure',
    label: 'Treasure',
    aliases: ['treasure', 'treasures', 'treasure matters'],
    queryClause: 'o:treasure',
    minimumMainMatches: 12,
    roles: ['treasure'],
    oracleFallbacks: ['treasure'],
  },
  {
    id: 'proliferate',
    label: 'Proliferate',
    aliases: ['proliferate', 'proliferation'],
    queryClause: 'o:proliferate',
    minimumMainMatches: 10,
    roles: [],
    oracleFallbacks: ['proliferate'],
  },
];

const CARD_TYPE_THEMES: CardTypeThemeDefinitionV15[] = [
  { id: 'artifact', label: 'Artifacts', aliases: ['artifact', 'artifacts', 'artifact matters'], queryClause: 't:artifact', minimumMainMatches: 18, typeNeedle: 'artifact' },
  { id: 'enchantment', label: 'Enchantments', aliases: ['enchantment', 'enchantments', 'enchantress'], queryClause: 't:enchantment', minimumMainMatches: 18, typeNeedle: 'enchantment' },
  { id: 'planeswalker', label: 'Planeswalkers', aliases: ['planeswalker', 'planeswalkers', 'superfriends'], queryClause: 't:planeswalker', minimumMainMatches: 12, typeNeedle: 'planeswalker' },
  { id: 'instant', label: 'Instants', aliases: ['instant', 'instants'], queryClause: 't:instant', minimumMainMatches: 18, typeNeedle: 'instant' },
  { id: 'sorcery', label: 'Sorceries', aliases: ['sorcery', 'sorceries'], queryClause: 't:sorcery', minimumMainMatches: 18, typeNeedle: 'sorcery' },
  { id: 'creature', label: 'Creatures', aliases: ['creature', 'creatures', 'creature heavy'], queryClause: 't:creature', minimumMainMatches: 25, typeNeedle: 'creature' },
];

const FINAL_FANTASY_ALIASES = new Set([
  'final fantasy',
  'ff',
  'mtg final fantasy',
  'magic final fantasy',
  'final fantasy printings',
  'final fantasy cards',
]);

const THEME_WRAPPERS = /\b(?:theme|themed|deck|commander deck|tribal|typal|matters)\b/g;
const CATALOG_TTL_MS = 6 * 60 * 60 * 1_000;
let creatureTypeCatalog: { loadedAt: number; values: string[] } | null = null;

function normalize(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[™®]/g, '')
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9+/' -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripThemeWrappers(value: string): string {
  return value
    .replace(THEME_WRAPPERS, ' ')
    .replace(/\bonly\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeScryfallLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function pluralizeCreatureType(value: string): string {
  const normalized = normalize(value);
  if (normalized.endsWith('fe')) return `${normalized.slice(0, -2)}ves`;
  if (normalized.endsWith('f')) return `${normalized.slice(0, -1)}ves`;
  if (normalized.endsWith('y') && !/[aeiou]y$/.test(normalized)) return `${normalized.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(normalized)) return `${normalized}es`;
  return `${normalized}s`;
}

async function loadCreatureTypes(supplied?: string[]): Promise<string[]> {
  if (supplied) return supplied;
  if (creatureTypeCatalog && Date.now() - creatureTypeCatalog.loadedAt < CATALOG_TTL_MS) return creatureTypeCatalog.values;
  const catalog = await fetchJson<ScryfallCatalogV15>(`${config.scryfallApiBase}/catalog/creature-types`);
  if (!catalog || catalog.object !== 'catalog' || !Array.isArray(catalog.data)) {
    throw new Error('Scryfall creature-type catalog returned a malformed response.');
  }
  const values = catalog.data.map((value) => value.trim()).filter(Boolean);
  creatureTypeCatalog = { loadedAt: Date.now(), values };
  return values;
}

function mechanicIntent(original: string, normalizedInput: string, cleaned: string): NeutralThemeIntentV15 | null {
  const definition = MECHANICAL_THEMES.find((item) => item.aliases.some((alias) => normalize(alias) === cleaned));
  if (!definition) return null;
  return {
    original,
    normalizedInput,
    kind: 'mechanic',
    enforceability: 'full',
    canonicalLabel: definition.label,
    queryClause: definition.queryClause,
    minimumMainMatches: definition.minimumMainMatches,
    printingFamily: null,
    matchRule: {
      type: 'role-any',
      roles: definition.roles,
      oracleFallbacks: definition.oracleFallbacks,
    },
    explanation: `The user theme is normalized to the controlled ${definition.label} mechanical theme. Candidate discovery uses only the generated bounded clause ${definition.queryClause}; the original user text is never executed as Scryfall grammar.`,
  };
}

function cardTypeIntent(original: string, normalizedInput: string, cleaned: string): NeutralThemeIntentV15 | null {
  const definition = CARD_TYPE_THEMES.find((item) => item.aliases.some((alias) => normalize(alias) === cleaned));
  if (!definition) return null;
  return {
    original,
    normalizedInput,
    kind: 'card-type',
    enforceability: 'full',
    canonicalLabel: definition.label,
    queryClause: definition.queryClause,
    minimumMainMatches: definition.minimumMainMatches,
    printingFamily: null,
    matchRule: { type: 'card-type', cardType: definition.typeNeedle },
    explanation: `The user theme is normalized to the controlled ${definition.label} card-type theme. Candidate discovery and final audit both enforce the card type rather than relying on popularity or a free-form search string.`,
  };
}

function explicitOraclePhrase(original: string): string | null {
  const trimmed = original.trim();
  const patterns = [
    /^(?:oracle(?: text)?|text)\s*[:=-]\s*["']?(.+?)["']?$/i,
    /^(?:mentions?|cards? that (?:mention|say))\s+["']?(.+?)["']?$/i,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function oracleIntent(original: string, normalizedInput: string, phrase: string): NeutralThemeIntentV15 {
  const normalizedPhrase = phrase.replace(/\s+/g, ' ').trim();
  if (normalizedPhrase.length < 3 || normalizedPhrase.length > 80) {
    return unsupportedTheme(original, normalizedInput, 'Explicit Oracle-text themes must contain a literal phrase between 3 and 80 characters.');
  }
  if (!/^[A-Za-z0-9 +/{}'’.,-]+$/.test(normalizedPhrase)) {
    return unsupportedTheme(original, normalizedInput, 'The requested Oracle-text phrase contains query-grammar characters that are not accepted by the safe literal theme adapter.');
  }
  return {
    original,
    normalizedInput,
    kind: 'oracle-text',
    enforceability: 'full',
    canonicalLabel: `Oracle text contains “${normalizedPhrase}”`,
    queryClause: `o:"${escapeScryfallLiteral(normalizedPhrase)}"`,
    minimumMainMatches: 12,
    printingFamily: null,
    matchRule: { type: 'oracle-substring', phrase: normalizedPhrase.toLocaleLowerCase() },
    explanation: 'The user explicitly requested a literal Oracle-text phrase. It is length-bounded, grammar-restricted, quoted by the adapter, and independently rechecked against resolved Oracle text after construction.',
  };
}

function unsupportedTheme(original: string, normalizedInput: string, explanation: string): NeutralThemeIntentV15 {
  return {
    original,
    normalizedInput,
    kind: 'unsupported',
    enforceability: 'unsupported',
    canonicalLabel: null,
    queryClause: null,
    minimumMainMatches: 0,
    printingFamily: null,
    matchRule: { type: 'none' },
    explanation,
  };
}

export async function resolveNeutralThemeIntentV15(
  themeQuery: string,
  options: { creatureTypes?: string[] } = {},
): Promise<NeutralThemeIntentV15> {
  const original = themeQuery;
  const normalizedInput = normalize(themeQuery);
  if (!normalizedInput) return unsupportedTheme(original, normalizedInput, 'A neutral theme must contain non-empty enforceable intent.');

  const oraclePhrase = explicitOraclePhrase(themeQuery);
  if (oraclePhrase !== null) return oracleIntent(original, normalizedInput, oraclePhrase);

  const cleaned = stripThemeWrappers(normalizedInput);
  if (FINAL_FANTASY_ALIASES.has(cleaned)) {
    return {
      original,
      normalizedInput,
      kind: 'printing-family',
      enforceability: 'delegated-printing-policy',
      canonicalLabel: 'Final Fantasy physical printings',
      queryClause: null,
      minimumMainMatches: 0,
      printingFamily: 'Final Fantasy',
      matchRule: { type: 'printing-family', family: 'Final Fantasy' },
      explanation: 'The free-form theme resolves to the existing exact Final Fantasy physical-printing policy. Oracle-card similarity is not enough; every final exact printing remains subject to that policy.',
    };
  }

  const mechanic = mechanicIntent(original, normalizedInput, cleaned);
  if (mechanic) return mechanic;
  const cardType = cardTypeIntent(original, normalizedInput, cleaned);
  if (cardType) return cardType;

  if (/\b(?:and|with)\b|[&+]/.test(cleaned)) {
    return unsupportedTheme(original, normalizedInput, 'Compound free-form themes are not yet losslessly enforceable. Supply one primary theme or use explicit structured constraints instead.');
  }
  if (cleaned === 'land' || cleaned === 'lands' || cleaned === 'landfall') {
    return unsupportedTheme(original, normalizedInput, 'Land-centric themes require land-plan-specific density semantics and remain fail-closed until that adapter is implemented.');
  }

  let creatureTypes: string[];
  try {
    creatureTypes = await loadCreatureTypes(options.creatureTypes);
  } catch (error) {
    return unsupportedTheme(
      original,
      normalizedInput,
      `Creature-type verification is currently unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const aliases = new Map<string, string>();
  for (const creatureType of creatureTypes) {
    const canonical = creatureType.trim();
    if (!canonical) continue;
    const normalized = normalize(canonical);
    aliases.set(normalized, canonical);
    aliases.set(pluralizeCreatureType(normalized), canonical);
  }
  const creatureType = aliases.get(cleaned);
  if (creatureType) {
    return {
      original,
      normalizedInput,
      kind: 'creature-type',
      enforceability: 'full',
      canonicalLabel: `${creatureType} typal`,
      queryClause: `t:"${escapeScryfallLiteral(creatureType)}"`,
      minimumMainMatches: 20,
      printingFamily: null,
      matchRule: { type: 'creature-type', creatureType },
      explanation: `The requested typal theme is verified against Scryfall's creature-type catalog as ${creatureType}. Discovery uses a generated quoted type clause and the final audit checks resolved type/rules data, including Changeling.`,
    };
  }

  return unsupportedTheme(
    original,
    normalizedInput,
    'The free-form theme could not be mapped to one supported creature type, mechanic, card type, printing family, or explicit Oracle-text phrase. It is not silently ignored or executed as raw Scryfall grammar.',
  );
}

function typeContainsWord(typeLine: string, needle: string): boolean {
  return typeLine.toLocaleLowerCase().split(/[^a-z0-9]+/).filter(Boolean).includes(needle.toLocaleLowerCase());
}

export function cardMatchesNeutralThemeV15(card: ScryfallCard, intent: NeutralThemeIntentV15): boolean {
  switch (intent.matchRule.type) {
    case 'creature-type': {
      if (typeContainsWord(card.type_line, intent.matchRule.creatureType)) return true;
      const keywords = new Set((card.keywords ?? []).map((value) => value.toLocaleLowerCase()));
      return keywords.has('changeling') || /this card is every creature type/i.test(getCardOracleText(card));
    }
    case 'role-any': {
      const roles = new Set(inferCardRoles(card));
      if (intent.matchRule.roles.some((role) => roles.has(role))) return true;
      const oracle = getCardOracleText(card).toLocaleLowerCase();
      return intent.matchRule.oracleFallbacks.some((phrase) => oracle.includes(phrase.toLocaleLowerCase()));
    }
    case 'card-type':
      return typeContainsWord(card.type_line, intent.matchRule.cardType);
    case 'oracle-substring':
      return getCardOracleText(card).toLocaleLowerCase().includes(intent.matchRule.phrase);
    case 'printing-family':
      return false;
    case 'none':
      return false;
  }
}

export function auditNeutralThemeV15(
  entries: Array<{ card: ScryfallCard; quantity: number; zone: 'commander' | 'main' }>,
  intent: NeutralThemeIntentV15,
  options: { printingPolicySatisfied?: boolean; activePrintingFamily?: string | null } = {},
): NeutralThemeAuditV15 {
  const totalMainCards = entries.filter((entry) => entry.zone === 'main').reduce((sum, entry) => sum + entry.quantity, 0);
  if (intent.enforceability === 'unsupported') {
    return {
      status: 'unsupported',
      satisfied: false,
      original: intent.original,
      kind: intent.kind,
      canonicalLabel: intent.canonicalLabel,
      requiredMainMatches: intent.minimumMainMatches,
      matchedMainCards: 0,
      totalMainCards,
      mainCoverage: 0,
      matchingCardNames: [],
      entries: [],
      explanation: intent.explanation,
    };
  }
  if (intent.kind === 'printing-family') {
    const familyMatches = normalize(options.activePrintingFamily ?? '') === normalize(intent.printingFamily ?? '');
    const satisfied = familyMatches && options.printingPolicySatisfied === true;
    return {
      status: satisfied ? 'satisfied' : 'printing-policy-failed',
      satisfied,
      original: intent.original,
      kind: intent.kind,
      canonicalLabel: intent.canonicalLabel,
      requiredMainMatches: 0,
      matchedMainCards: satisfied ? totalMainCards : 0,
      totalMainCards,
      mainCoverage: satisfied && totalMainCards > 0 ? 1 : 0,
      matchingCardNames: satisfied
        ? [...new Set(entries.filter((entry) => entry.zone === 'main').map((entry) => entry.card.name))].sort((a, b) => a.localeCompare(b))
        : [],
      entries: [],
      explanation: satisfied
        ? `${intent.explanation} The active exact-printing policy independently passed.`
        : `${intent.explanation} The active exact-printing policy did not prove this printing-family theme.`,
    };
  }

  const auditedEntries = entries.map((entry): NeutralThemeAuditEntryV15 => ({
    name: entry.card.name,
    quantity: entry.quantity,
    zone: entry.zone,
    matches: cardMatchesNeutralThemeV15(entry.card, intent),
  }));
  const matchedMainCards = auditedEntries
    .filter((entry) => entry.zone === 'main' && entry.matches)
    .reduce((sum, entry) => sum + entry.quantity, 0);
  const satisfied = matchedMainCards >= intent.minimumMainMatches;
  return {
    status: satisfied ? 'satisfied' : 'under-minimum',
    satisfied,
    original: intent.original,
    kind: intent.kind,
    canonicalLabel: intent.canonicalLabel,
    requiredMainMatches: intent.minimumMainMatches,
    matchedMainCards,
    totalMainCards,
    mainCoverage: totalMainCards > 0 ? matchedMainCards / totalMainCards : 0,
    matchingCardNames: [...new Set(auditedEntries.filter((entry) => entry.zone === 'main' && entry.matches).map((entry) => entry.name))].sort((a, b) => a.localeCompare(b)),
    entries: auditedEntries,
    explanation: satisfied
      ? `${intent.explanation} The finished main deck meets the minimum of ${intent.minimumMainMatches} matching cards.`
      : `${intent.explanation} The finished main deck has ${matchedMainCards} matching cards, below the required ${intent.minimumMainMatches}; the theme constraint fails closed.`,
  };
}
