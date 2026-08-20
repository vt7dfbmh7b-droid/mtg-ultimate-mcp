import type { ScryfallCard } from '../types/scryfall.js';
import { getCardOracleText, inferCardRoles } from './scryfall.js';

export type WinRouteProviderSetupStatusV15 = 'provider-explicit' | 'provider-partial' | 'provider-absent';

export type WinRouteZoneV15 =
  | 'battlefield'
  | 'graveyard'
  | 'hand'
  | 'library'
  | 'exile'
  | 'command-zone'
  | 'stack';

export type WinRouteInterruptionSurfaceV15 =
  | 'creature-removal'
  | 'artifact-removal'
  | 'enchantment-removal'
  | 'planeswalker-removal'
  | 'battle-removal'
  | 'land-interaction'
  | 'graveyard-interaction'
  | 'hand-disruption'
  | 'stack-interaction'
  | 'triggered-ability-interaction'
  | 'delayed-win-window';

export interface WinRouteSetupInputV15 {
  comboId: string;
  comboCardNames: string[];
  seedNames: string[];
  requirementNames?: string[];
  manaNeeded?: unknown;
  otherPrerequisites?: unknown;
  description?: unknown;
  closureTiming: 'immediate' | 'delayed' | 'not-proven';
}

export interface WinRouteInterruptionEvidenceV15 {
  surface: WinRouteInterruptionSurfaceV15;
  basedOn: string[];
  evidenceClass: 'provider-explicit' | 'card-structure' | 'oracle-structural' | 'closure-structural';
}

export interface WinRouteDeckSupportSignalsV15 {
  evidenceClass: 'role-level-advisory';
  genericTutorCount: number;
  protectionCount: number;
  graveyardRecursionCount: number;
  countermagicCount: number;
  freeInteractionCount: number;
  caveat: string;
}

export interface WinRouteSetupInterruptionAuditV15 {
  comboId: string;
  providerSetupStatus: WinRouteProviderSetupStatusV15;
  manaEvidence: string[];
  prerequisiteEvidence: string[];
  descriptionEvidence: string[];
  explicitZoneMentions: WinRouteZoneV15[];
  commanderDependent: boolean;
  commanderDependencyNames: string[];
  templateRequirementNames: string[];
  resolvedComboPieceCount: number;
  unresolvedComboPieceNames: string[];
  interruptionSurfaces: WinRouteInterruptionEvidenceV15[];
  setupFlags: string[];
  deckSupport: WinRouteDeckSupportSignalsV15;
  providerCaveat: string;
  advisoryCaveat: string;
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function flattenEvidence(value: unknown, depth = 0, prefix = ''): string[] {
  if (value === null || value === undefined || depth > 4) return [];
  if (typeof value === 'string') {
    const text = value.trim();
    return text ? [prefix ? `${prefix}: ${text}` : text] : [];
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value);
    return [prefix ? `${prefix}: ${text}` : text];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => flattenEvidence(entry, depth + 1, prefix));
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort((a, b) => a.localeCompare(b))
      .flatMap((key) => flattenEvidence(record[key], depth + 1, prefix ? `${prefix}.${key}` : key));
  }
  return [];
}

function combinedText(values: readonly string[]): string {
  return values
    .join(' ')
    .toLocaleLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

const ZONE_PATTERNS: Array<{ zone: WinRouteZoneV15; pattern: RegExp }> = [
  { zone: 'battlefield', pattern: /\bbattlefield\b/ },
  { zone: 'graveyard', pattern: /\bgraveyards?\b/ },
  { zone: 'hand', pattern: /\bhands?\b/ },
  { zone: 'library', pattern: /\b(?:library|libraries)\b/ },
  { zone: 'exile', pattern: /\b(?:exile|exiled)\b/ },
  { zone: 'command-zone', pattern: /\bcommand zone\b/ },
  { zone: 'stack', pattern: /\bstack\b/ },
];

function explicitZones(values: readonly string[]): WinRouteZoneV15[] {
  const text = combinedText(values);
  return ZONE_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ zone }) => zone);
}

function cardByName(cards: readonly ScryfallCard[]): Map<string, ScryfallCard> {
  return new Map(cards.map((card) => [normalizeName(card.name), card]));
}

function addSurface(
  map: Map<WinRouteInterruptionSurfaceV15, WinRouteInterruptionEvidenceV15>,
  surface: WinRouteInterruptionSurfaceV15,
  basedOn: string,
  evidenceClass: WinRouteInterruptionEvidenceV15['evidenceClass'],
): void {
  const current = map.get(surface);
  if (!current) {
    map.set(surface, { surface, basedOn: [basedOn], evidenceClass });
    return;
  }
  current.basedOn = uniqueSorted([...current.basedOn, basedOn]);
  const priority: Record<WinRouteInterruptionEvidenceV15['evidenceClass'], number> = {
    'provider-explicit': 4,
    'card-structure': 3,
    'oracle-structural': 2,
    'closure-structural': 1,
  };
  if (priority[evidenceClass] > priority[current.evidenceClass]) current.evidenceClass = evidenceClass;
}

function buildInterruptionSurfaces(
  input: WinRouteSetupInputV15,
  comboCards: readonly ScryfallCard[],
  zones: readonly WinRouteZoneV15[],
): WinRouteInterruptionEvidenceV15[] {
  const surfaces = new Map<WinRouteInterruptionSurfaceV15, WinRouteInterruptionEvidenceV15>();

  for (const card of comboCards) {
    const type = card.type_line.toLocaleLowerCase();
    if (type.includes('creature')) addSurface(surfaces, 'creature-removal', card.name, 'card-structure');
    if (type.includes('artifact')) addSurface(surfaces, 'artifact-removal', card.name, 'card-structure');
    if (type.includes('enchantment')) addSurface(surfaces, 'enchantment-removal', card.name, 'card-structure');
    if (type.includes('planeswalker')) addSurface(surfaces, 'planeswalker-removal', card.name, 'card-structure');
    if (type.includes('battle')) addSurface(surfaces, 'battle-removal', card.name, 'card-structure');
    if (type.includes('land')) addSurface(surfaces, 'land-interaction', card.name, 'card-structure');
    if (type.includes('instant') || type.includes('sorcery')) {
      addSurface(surfaces, 'stack-interaction', card.name, 'card-structure');
    }

    const oracle = getCardOracleText(card).toLocaleLowerCase();
    if (/\bwhen(?:ever)?\b|\bat the beginning of\b/.test(oracle)) {
      addSurface(surfaces, 'triggered-ability-interaction', card.name, 'oracle-structural');
    }
  }

  if (zones.includes('graveyard')) addSurface(surfaces, 'graveyard-interaction', 'provider zone: graveyard', 'provider-explicit');
  if (zones.includes('hand')) addSurface(surfaces, 'hand-disruption', 'provider zone: hand', 'provider-explicit');
  if (zones.includes('stack')) addSurface(surfaces, 'stack-interaction', 'provider zone: stack', 'provider-explicit');
  if (input.closureTiming === 'delayed') {
    addSurface(surfaces, 'delayed-win-window', 'verified closure timing is delayed', 'closure-structural');
  }

  return [...surfaces.values()]
    .map((entry) => ({ ...entry, basedOn: uniqueSorted(entry.basedOn) }))
    .sort((a, b) => a.surface.localeCompare(b.surface));
}

function deckSupportSignals(cards: readonly ScryfallCard[]): WinRouteDeckSupportSignalsV15 {
  let genericTutorCount = 0;
  let protectionCount = 0;
  let graveyardRecursionCount = 0;
  let countermagicCount = 0;
  let freeInteractionCount = 0;

  for (const card of cards) {
    const roles = new Set(inferCardRoles(card));
    if (roles.has('tutor')) genericTutorCount += 1;
    if (roles.has('protection') || roles.has('board protection')) protectionCount += 1;
    if (roles.has('graveyard recursion')) graveyardRecursionCount += 1;
    if (roles.has('countermagic')) countermagicCount += 1;
    if (roles.has('free interaction')) freeInteractionCount += 1;
  }

  return {
    evidenceClass: 'role-level-advisory',
    genericTutorCount,
    protectionCount,
    graveyardRecursionCount,
    countermagicCount,
    freeInteractionCount,
    caveat: 'These are deck-level role signals only. They do not prove that a particular tutor can find every combo piece, that protection covers every interruption surface, or that recursion can recover the exact failed line.',
  };
}

/**
 * Audits a verified route without promoting heuristic setup claims into hard combo truth.
 * Provider fields are preserved as evidence. Card/type and Oracle-derived interruption surfaces
 * are structural/advisory observations only, while deck support is deliberately role-level until
 * exact tutor-target and recovery matching are independently verified.
 */
export function auditWinRouteSetupInterruptionV15(input: {
  route: WinRouteSetupInputV15;
  resolvedCards: readonly ScryfallCard[];
}): WinRouteSetupInterruptionAuditV15 {
  const route = input.route;
  const manaEvidence = uniqueSorted(flattenEvidence(route.manaNeeded));
  const prerequisiteEvidence = uniqueSorted([
    ...flattenEvidence(route.otherPrerequisites),
    ...(route.requirementNames ?? []),
  ]);
  const descriptionEvidence = uniqueSorted(flattenEvidence(route.description));
  const providerFieldsPresent = [manaEvidence, prerequisiteEvidence, descriptionEvidence].filter((values) => values.length > 0).length;
  const providerSetupStatus: WinRouteProviderSetupStatusV15 = providerFieldsPresent >= 2
    ? 'provider-explicit'
    : providerFieldsPresent === 1
      ? 'provider-partial'
      : 'provider-absent';

  const zones = explicitZones([...prerequisiteEvidence, ...descriptionEvidence]);
  const seedSet = new Set(route.seedNames.map(normalizeName));
  const commanderDependencyNames = uniqueSorted(route.comboCardNames.filter((name) => !seedSet.has(normalizeName(name))));
  const byName = cardByName(input.resolvedCards);
  const comboCards = route.comboCardNames
    .map((name) => byName.get(normalizeName(name)))
    .filter((card): card is ScryfallCard => Boolean(card));
  const resolvedNames = new Set(comboCards.map((card) => normalizeName(card.name)));
  const unresolvedComboPieceNames = uniqueSorted(route.comboCardNames.filter((name) => !resolvedNames.has(normalizeName(name))));
  const templateRequirementNames = uniqueSorted(route.requirementNames ?? []);
  const interruptionSurfaces = buildInterruptionSurfaces(route, comboCards, zones);

  const setupFlags: string[] = [];
  if (manaEvidence.length > 0) setupFlags.push('mana-requirement-specified');
  if (prerequisiteEvidence.length > 0) setupFlags.push('provider-prerequisites-present');
  if (zones.length > 0) setupFlags.push('zone-sensitive-setup');
  if (commanderDependencyNames.length > 0) setupFlags.push('commander-dependent');
  if (templateRequirementNames.length > 0) setupFlags.push('template-requirement-unresolved-to-exact-card');
  if (route.closureTiming === 'delayed') setupFlags.push('delayed-closure');
  if (unresolvedComboPieceNames.length > 0) setupFlags.push('unresolved-combo-piece-profile');

  return {
    comboId: route.comboId,
    providerSetupStatus,
    manaEvidence,
    prerequisiteEvidence,
    descriptionEvidence,
    explicitZoneMentions: zones,
    commanderDependent: commanderDependencyNames.length > 0,
    commanderDependencyNames,
    templateRequirementNames,
    resolvedComboPieceCount: comboCards.length,
    unresolvedComboPieceNames,
    interruptionSurfaces,
    setupFlags,
    deckSupport: deckSupportSignals(input.resolvedCards),
    providerCaveat: providerSetupStatus === 'provider-absent'
      ? 'Commander Spellbook supplied no normalized mana/prerequisite/description setup evidence for this route. Absence of fields is treated as unknown setup detail, not proof that setup is free or trivial.'
      : 'Provider setup fields are retained as evidence, but they are not converted into unsupported turn-speed or resilience claims.',
    advisoryCaveat: 'Interruption surfaces are conservative structural observations from resolved card types, Oracle text, explicit provider zone mentions, and closure timing. They identify plausible interaction windows but do not prove that every listed interaction stops every sequencing of the combo.',
  };
}
