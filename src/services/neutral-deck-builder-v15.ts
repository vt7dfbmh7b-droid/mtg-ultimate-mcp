import type { ScryfallCard } from '../types/scryfall.js';
import { validateCommanderDeck } from './commander-rules.js';
import { parseDecklist } from './deck.js';
import type { NeutralArchetypeV15 } from './neutral-commander-selection-v15.js';
import {
  describePrintingPolicyV08,
  printingMatchesPolicyV08,
  resolvePrintingPolicyV08,
  selectEligiblePrintingV08,
  type PrintingPolicyInputV08,
  type ResolvedPrintingPolicyV08,
} from './printing-policy-v08.js';
import { boundedScryfallSearchV15 } from './scryfall-paged-search-v15.js';
import {
  getCardOracleText,
  getCardsByIdentifiers,
  getCardsByNames,
  inferCardRoles,
  type CardIdentifierInput,
} from './scryfall.js';

export interface NeutralDeckBuildOptionsV15 extends PrintingPolicyInputV08 {
  archetype: NeutralArchetypeV15;
  landCount?: number;
  maxNonbasicLands?: number;
  excludedCards?: string[];
  mustInclude?: string[];
}

interface NeutralRoleTargetsV15 {
  ramp: number;
  draw: number;
  interaction: number;
  protection: number;
  tutors: number;
  recursion: number;
  boardWipes: number;
  early: number;
}

interface NeutralProfileV15 {
  lands: number;
  roles: NeutralRoleTargetsV15;
}

const NEUTRAL_PROFILES: Record<NeutralArchetypeV15, NeutralProfileV15> = {
  'combat-tokens': { lands: 35, roles: { ramp: 10, draw: 10, interaction: 8, protection: 5, tutors: 1, recursion: 2, boardWipes: 1, early: 12 } },
  'equipment-voltron': { lands: 35, roles: { ramp: 10, draw: 10, interaction: 8, protection: 7, tutors: 2, recursion: 2, boardWipes: 1, early: 11 } },
  counters: { lands: 36, roles: { ramp: 9, draw: 10, interaction: 8, protection: 5, tutors: 1, recursion: 2, boardWipes: 1, early: 12 } },
  'graveyard-reanimator': { lands: 36, roles: { ramp: 9, draw: 10, interaction: 8, protection: 3, tutors: 2, recursion: 7, boardWipes: 2, early: 10 } },
  aristocrats: { lands: 36, roles: { ramp: 9, draw: 10, interaction: 8, protection: 3, tutors: 1, recursion: 5, boardWipes: 2, early: 12 } },
  'spells-control': { lands: 35, roles: { ramp: 9, draw: 12, interaction: 14, protection: 4, tutors: 2, recursion: 2, boardWipes: 3, early: 14 } },
  'value-engine': { lands: 36, roles: { ramp: 10, draw: 12, interaction: 9, protection: 4, tutors: 1, recursion: 3, boardWipes: 2, early: 11 } },
  'big-mana': { lands: 37, roles: { ramp: 14, draw: 10, interaction: 8, protection: 4, tutors: 1, recursion: 2, boardWipes: 2, early: 8 } },
};

const BASIC_FOR_COLOR: Record<string, string> = {
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
};

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function exactPrintingKey(set: string, collectorNumber: string): string {
  return `${set.trim().toLocaleLowerCase()}|${collectorNumber.replace(/^0+/, '') || '0'}`;
}

function oracleKey(card: ScryfallCard): string {
  return card.oracle_id ?? normalize(card.name);
}

function identity(commanders: readonly ScryfallCard[]): string[] {
  return [...new Set(commanders.flatMap((card) => card.color_identity))].sort();
}

function legalIdentity(card: ScryfallCard, colors: readonly string[]): boolean {
  const allowed = new Set(colors);
  return card.legalities.commander === 'legal' && card.color_identity.every((color) => allowed.has(color));
}

function identityQuery(colors: readonly string[]): string {
  return colors.length === 0 ? 'id:c' : `id<=${colors.join('').toLocaleLowerCase()}`;
}

function printingLine(quantity: number, card: ScryfallCard): string {
  return `${quantity} ${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`;
}

function emptyCounts(): NeutralRoleTargetsV15 {
  return { ramp: 0, draw: 0, interaction: 0, protection: 0, tutors: 0, recursion: 0, boardWipes: 0, early: 0 };
}

function roleContribution(card: ScryfallCard): Partial<Record<keyof NeutralRoleTargetsV15, number>> {
  const roles = new Set(inferCardRoles(card));
  const output: Partial<Record<keyof NeutralRoleTargetsV15, number>> = {};
  if (roles.has('mana acceleration') || roles.has('land ramp') || roles.has('cost reduction') || roles.has('fast mana')) output.ramp = 1;
  if (roles.has('card draw') || roles.has('repeatable draw') || roles.has('card selection')) output.draw = 1;
  if (roles.has('spot interaction') || roles.has('countermagic') || roles.has('board wipe') || roles.has('free interaction')) output.interaction = 1;
  if (roles.has('protection') || roles.has('board protection')) output.protection = 1;
  if (roles.has('tutor')) output.tutors = 1;
  if (roles.has('graveyard recursion')) output.recursion = 1;
  if (roles.has('board wipe')) output.boardWipes = 1;
  if (!card.type_line.toLocaleLowerCase().includes('land') && card.cmc <= 2) output.early = 1;
  return output;
}

function incrementCounts(counts: NeutralRoleTargetsV15, card: ScryfallCard): void {
  const contribution = roleContribution(card);
  for (const key of Object.keys(counts) as Array<keyof NeutralRoleTargetsV15>) {
    counts[key] += contribution[key] ?? 0;
  }
}

function strategyAffinity(card: ScryfallCard, archetype: NeutralArchetypeV15): number {
  const roles = new Set(inferCardRoles(card));
  const text = getCardOracleText(card).toLocaleLowerCase();
  let score = 0;
  const add = (condition: boolean, points: number): void => { if (condition) score += points; };
  switch (archetype) {
    case 'combat-tokens':
      add(roles.has('token production'), 5);
      add(roles.has('extra combat'), 6);
      add(roles.has('haste'), 2);
      add(/attacks|attacking|combat damage/.test(text), 3);
      break;
    case 'equipment-voltron':
      add(roles.has('equipment'), 7);
      add(roles.has('protection'), 3);
      add(/equip |equipped creature|attach/.test(text), 5);
      add(/double strike|trample|first strike/.test(text), 2);
      break;
    case 'counters':
      add(roles.has('+1/+1 counters'), 7);
      add(/proliferate/.test(text), 6);
      add(/counter is put|counters? are put|move .*counter/.test(text), 4);
      break;
    case 'graveyard-reanimator':
      add(roles.has('graveyard recursion'), 7);
      add(/graveyard/.test(text), 4);
      add(/mill|surveil|discard/.test(text), 3);
      break;
    case 'aristocrats':
      add(roles.has('sacrifice synergy'), 6);
      add(roles.has('sacrifice outlet'), 7);
      add(roles.has('life drain'), 6);
      add(/dies|sacrifice/.test(text), 4);
      break;
    case 'spells-control':
      add(roles.has('countermagic'), 6);
      add(roles.has('stax/control'), 5);
      add(roles.has('copy effect'), 4);
      add(/instant|sorcery|noncreature spell|whenever you cast/.test(text), 4);
      break;
    case 'value-engine':
      add(roles.has('repeatable draw'), 7);
      add(roles.has('card draw'), 4);
      add(roles.has('card selection'), 3);
      add(roles.has('treasure'), 4);
      add(roles.has('etb synergy'), 3);
      add(/you may cast|you may play|exile the top/.test(text), 4);
      break;
    case 'big-mana':
      add(roles.has('mana acceleration'), 6);
      add(roles.has('cost reduction'), 6);
      add(roles.has('untap engine'), 3);
      add(/add .*mana|costs? .*less to cast/.test(text), 4);
      break;
  }
  return score;
}

function dynamicCandidateScore(
  card: ScryfallCard,
  archetype: NeutralArchetypeV15,
  counts: NeutralRoleTargetsV15,
  targets: NeutralRoleTargetsV15,
): number {
  const contribution = roleContribution(card);
  let score = strategyAffinity(card, archetype) * 6;
  for (const key of Object.keys(targets) as Array<keyof NeutralRoleTargetsV15>) {
    if (!contribution[key]) continue;
    const deficit = Math.max(0, targets[key] - counts[key]);
    score += Math.min(5, deficit) * 5;
  }
  if (card.cmc <= 2) score += 2;
  else if (card.cmc <= 4) score += 1;
  else if (card.cmc >= 8) score -= 2;
  return score;
}

function landScore(card: ScryfallCard, colors: readonly string[]): number {
  const produced = new Set((card.produced_mana ?? []).map((color) => color.toUpperCase()));
  const coverage = colors.filter((color) => produced.has(color)).length;
  const text = getCardOracleText(card);
  let score = coverage * 12;
  if (/enters tapped/i.test(text)) score -= 3;
  if (/search your library/i.test(text)) score += 3;
  return score;
}

async function resolveExactCommanders(
  commanderNames: string[],
  policy: ResolvedPrintingPolicyV08,
): Promise<ScryfallCard[]> {
  const oracleCards = await getCardsByNames(commanderNames);
  if (oracleCards.notFound.length > 0 || oracleCards.cards.length !== commanderNames.length) {
    throw new Error(`Neutral commander resolution failed: ${oracleCards.notFound.join(', ') || 'card-count mismatch'}`);
  }
  const exact: ScryfallCard[] = [];
  for (const card of oracleCards.cards) {
    const printing = await selectEligiblePrintingV08(card, policy);
    if (!printing) throw new Error(`No eligible physical printing of commander ${card.name} satisfies the neutral printing policy.`);
    exact.push(printing.card);
  }
  return exact;
}

async function exactSpecialCards(policy: ResolvedPrintingPolicyV08): Promise<ScryfallCard[]> {
  const selectors = [...new Map(
    policy.exactSpecialPrintings.map((entry) => [exactPrintingKey(entry.set, entry.collectorNumber), entry]),
  ).values()];
  if (selectors.length === 0) return [];
  const resolved = await getCardsByIdentifiers(selectors.map((entry): CardIdentifierInput => ({
    name: entry.oracleName,
    set: entry.set,
    collectorNumber: entry.collectorNumber,
  })));
  if (resolved.notFound.length > 0) {
    throw new Error(`One or more curated special printings could not be resolved for neutral deck construction: ${resolved.notFound.join(', ')}`);
  }
  return resolved.cards;
}

async function discoverEligiblePool(
  colors: readonly string[],
  policy: ResolvedPrintingPolicyV08,
): Promise<ScryfallCard[]> {
  if (policy.family && policy.familyMatchedSetCodes.length === 0) {
    throw new Error(`Printing-family discovery for ${policy.family} returned no matching set codes; neutral construction fails closed.`);
  }
  const cards: ScryfallCard[] = [];
  if (policy.allowedSetCodes.length > 0) {
    const setClause = `(${policy.allowedSetCodes.map((set) => `set:${set}`).join(' OR ')})`;
    const result = await boundedScryfallSearchV15(`${setClause} f:commander ${identityQuery(colors)} game:paper`, {
      maxCards: 2_000,
      maxPages: 50,
      minRequestGapMs: 300,
    });
    cards.push(...result.cards);
  }
  cards.push(...await exactSpecialCards(policy));
  const eligible = cards
    .filter((card) => printingMatchesPolicyV08(card, policy))
    .filter((card) => legalIdentity(card, colors));
  const byOracle = new Map<string, ScryfallCard>();
  for (const card of eligible) {
    const key = oracleKey(card);
    const current = byOracle.get(key);
    if (!current || `${card.set}|${card.collector_number}`.localeCompare(`${current.set}|${current.collector_number}`) < 0) {
      byOracle.set(key, card);
    }
  }
  return [...byOracle.values()];
}

async function resolveMustIncludes(
  names: string[],
  colors: readonly string[],
  policy: ResolvedPrintingPolicyV08,
): Promise<ScryfallCard[]> {
  if (names.length === 0) return [];
  const result = await getCardsByNames(names);
  if (result.notFound.length > 0) throw new Error(`Neutral must-include resolution failed: ${result.notFound.join(', ')}`);
  const selected: ScryfallCard[] = [];
  for (const card of result.cards) {
    if (!legalIdentity(card, colors)) throw new Error(`Must-include ${card.name} is outside the selected commander's color identity.`);
    const printing = await selectEligiblePrintingV08(card, policy);
    if (!printing) throw new Error(`Must-include ${card.name} has no eligible physical printing under the neutral policy.`);
    selected.push(printing.card);
  }
  return selected;
}

/**
 * Strategy-first neutral deck construction. There is intentionally no targetBracket option.
 * Role targets are archetype-specific deck-function heuristics, not bracket profiles, and the
 * finished deck must be independently assessed after construction.
 */
export async function buildNeutralCommanderDeckV15(
  commanderNames: string[],
  options: NeutralDeckBuildOptionsV15,
): Promise<Record<string, unknown>> {
  const requested = commanderNames.map((name) => name.trim()).filter(Boolean);
  if (requested.length < 1 || requested.length > 2) throw new Error('Neutral deck construction requires one or two commander names.');
  const policy = await resolvePrintingPolicyV08(options);
  if (!policy.family && policy.allowedSetCodes.length === 0 && policy.exactSpecialPrintings.length === 0) {
    throw new Error('Neutral themed construction requires a bounded printing policy.');
  }
  const commanders = await resolveExactCommanders(requested, policy);
  const colors = identity(commanders);
  const profile = NEUTRAL_PROFILES[options.archetype];
  const landsWanted = Math.max(30, Math.min(42, Math.trunc(options.landCount ?? profile.lands)));
  const nonlandSlots = 100 - commanders.length - landsWanted;
  if (nonlandSlots < 1) throw new Error('Neutral land plan leaves no nonland deck slots.');

  const pool = await discoverEligiblePool(colors, policy);
  const commanderOracleKeys = new Set(commanders.map(oracleKey));
  const excluded = new Set((options.excludedCards ?? []).map(normalize));
  const nonlands = pool
    .filter((card) => !card.type_line.toLocaleLowerCase().includes('land'))
    .filter((card) => !commanderOracleKeys.has(oracleKey(card)))
    .filter((card) => !excluded.has(normalize(card.name)));
  const mustInclude = await resolveMustIncludes(options.mustInclude ?? [], colors, policy);
  const selected: ScryfallCard[] = [];
  const selectedKeys = new Set<string>();
  const counts = emptyCounts();
  for (const card of mustInclude) {
    const key = oracleKey(card);
    if (selectedKeys.has(key) || commanderOracleKeys.has(key) || excluded.has(normalize(card.name))) continue;
    selected.push(card);
    selectedKeys.add(key);
    incrementCounts(counts, card);
  }

  const remaining = nonlands.filter((card) => !selectedKeys.has(oracleKey(card)));
  while (selected.length < nonlandSlots && remaining.length > 0) {
    remaining.sort((a, b) =>
      dynamicCandidateScore(b, options.archetype, counts, profile.roles)
      - dynamicCandidateScore(a, options.archetype, counts, profile.roles)
      || a.name.localeCompare(b.name));
    const best = remaining.shift();
    if (!best) break;
    selected.push(best);
    selectedKeys.add(oracleKey(best));
    incrementCounts(counts, best);
  }

  const lands = pool
    .filter((card) => card.type_line.toLocaleLowerCase().includes('land'))
    .filter((card) => !excluded.has(normalize(card.name)));
  const basics = lands.filter((card) => /basic land/i.test(card.type_line));
  const nonbasics = lands
    .filter((card) => !/basic land/i.test(card.type_line))
    .sort((a, b) => landScore(b, colors) - landScore(a, colors) || a.name.localeCompare(b.name));
  const nonbasicLimit = Math.max(0, Math.min(
    landsWanted,
    Math.trunc(options.maxNonbasicLands ?? Math.max(10, colors.length * 5)),
  ));
  const chosenNonbasics = nonbasics.slice(0, nonbasicLimit);
  const basicsNeeded = Math.max(0, landsWanted - chosenNonbasics.length);
  const basicByName = new Map(basics.map((card) => [normalize(card.name), card]));
  const desiredBasicNames = colors.length > 0
    ? colors.map((color) => BASIC_FOR_COLOR[color]).filter((name): name is string => Boolean(name))
    : ['Wastes'];
  const availableBasics = desiredBasicNames
    .map((name) => basicByName.get(normalize(name)))
    .filter((card): card is ScryfallCard => Boolean(card));
  const basicQuantities = new Map<string, number>();
  for (let index = 0; index < basicsNeeded && availableBasics.length > 0; index += 1) {
    const basic = availableBasics[index % availableBasics.length]!;
    basicQuantities.set(basic.name, (basicQuantities.get(basic.name) ?? 0) + 1);
  }

  const commanderLines = commanders.map((card) => printingLine(1, card));
  const mainLines = [
    ...selected.map((card) => printingLine(1, card)),
    ...chosenNonbasics.map((card) => printingLine(1, card)),
    ...availableBasics
      .filter((card) => (basicQuantities.get(card.name) ?? 0) > 0)
      .map((card) => printingLine(basicQuantities.get(card.name) ?? 0, card)),
  ];
  const decklist = ['// COMMANDER', ...commanderLines, '', '// MAIN', ...mainLines].join('\n');
  const parsed = parseDecklist(decklist);
  const validationCards = [...commanders, ...selected, ...chosenNonbasics, ...availableBasics];
  const rules = validateCommanderDeck(parsed, validationCards);
  const printingPolicySatisfied = validationCards.every((card) => printingMatchesPolicyV08(card, policy));
  const enoughNonlands = selected.length === nonlandSlots;
  const enoughLands = chosenNonbasics.length + [...basicQuantities.values()].reduce((sum, quantity) => sum + quantity, 0) === landsWanted;
  const complete = parsed.totalCards === 100 && rules.isLegal && printingPolicySatisfied && enoughNonlands && enoughLands;
  const roleDeficits = Object.fromEntries(
    (Object.keys(profile.roles) as Array<keyof NeutralRoleTargetsV15>)
      .map((key) => [key, Math.max(0, profile.roles[key] - counts[key])]),
  );

  return {
    status: complete ? 'complete-neutral-draft' : 'incomplete-neutral-draft',
    constructionIntent: 'neutral',
    targetBracket: null,
    commanderNames: commanders.map((card) => card.name),
    archetype: options.archetype,
    decklist,
    cardCount: parsed.totalCards,
    commanderRules: rules,
    printingPolicySatisfied,
    printingPolicy: describePrintingPolicyV08(policy),
    roleTargets: profile.roles,
    detectedRoleCounts: counts,
    remainingRoleDeficits: roleDeficits,
    eligiblePoolSize: pool.length,
    selectedStrategyAffinity: selected.reduce((sum, card) => sum + strategyAffinity(card, options.archetype), 0),
    landPlan: {
      targetLands: landsWanted,
      selectedNonbasicLands: chosenNonbasics.length,
      selectedBasics: [...basicQuantities.entries()].map(([name, quantity]) => ({ name, quantity })),
    },
    constraints: {
      printingFamily: options.printingFamily ?? null,
      allowedSets: options.allowedSets ?? [],
      includePromos: options.includePromos ?? true,
      includeSpecialReleases: options.includeSpecialReleases ?? true,
      excludedCards: options.excludedCards ?? [],
      mustInclude: options.mustInclude ?? [],
    },
    constructionExplanation: [
      'No bracket target is accepted or inferred by this builder.',
      `The ${options.archetype} identity was chosen before construction from commander semantics.`,
      'Card selection balances archetype affinity with ordinary ramp/draw/interaction/protection/recursion needs; it does not award EDHREC popularity, cEDH intent, Game Changer count, or famous-card-name points.',
      'Every emitted card line carries an exact set code and collector number and is independently checked against the active printing policy.',
      'Bracket assessment belongs after this construction stage.',
    ],
  };
}
