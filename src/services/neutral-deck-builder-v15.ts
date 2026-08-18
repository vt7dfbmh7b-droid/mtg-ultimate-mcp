import type { ScryfallCard } from '../types/scryfall.js';
import { selectBudgetEligiblePrintingV15 } from './budget-printing-selector-v15.js';
import { validateCommanderDeck } from './commander-rules.js';
import { parseDecklist, type DeckFinish } from './deck.js';
import {
  auditExactPerCardBudgetV15,
  exactPrintingBudgetWitnessV15,
} from './exact-printing-budget-v15.js';
import type { NeutralArchetypeV15 } from './neutral-commander-selection-v15.js';
import { discoverNeutralUnrestrictedPoolV15 } from './neutral-unrestricted-pool-v15.js';
import {
  describePrintingPolicyV08,
  printingMatchesPolicyV08,
  resolvePrintingPolicyV08,
  selectEligiblePrintingV08,
  type EligiblePrintingChoiceV08,
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
  /** User-visible hard cap. Applies to commanders, must-includes, and optional cards. */
  maxUsdPerCard?: number;
  /** Search-only cap for optional candidates/lands. May tighten but never loosen maxUsdPerCard. */
  candidateMaxUsdPerCard?: number;
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

interface BasicAllocationV15 {
  card: ScryfallCard;
  quantity: number;
  required: boolean;
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

const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'] as const;
const BASIC_FOR_COLOR: Record<string, string> = {
  W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest',
};

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function positiveCap(label: string, value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be positive and finite when supplied.`);
  return value;
}

export function neutralCandidatePriceCapV15(options: Pick<NeutralDeckBuildOptionsV15, 'maxUsdPerCard' | 'candidateMaxUsdPerCard'>): number | undefined {
  const userCap = positiveCap('maxUsdPerCard', options.maxUsdPerCard);
  const candidateCap = positiveCap('candidateMaxUsdPerCard', options.candidateMaxUsdPerCard);
  if (candidateCap === undefined) return userCap;
  return userCap === undefined ? candidateCap : Math.min(userCap, candidateCap);
}

/** Normalize only the lookup key for transform/modal DFC commanders; canonical identity is rechecked afterward. */
export function neutralCommanderLookupNameV15(value: string): string {
  const trimmed = value.trim();
  const [front] = trimmed.split(/\s+\/\/\s+/, 2);
  return front?.trim() || trimmed;
}

function commanderNameMatches(requested: string, card: ScryfallCard): boolean {
  if (normalize(requested) === normalize(card.name)) return true;
  return normalize(neutralCommanderLookupNameV15(requested)) === normalize(neutralCommanderLookupNameV15(card.name));
}

function exactPrintingKey(set: string, collectorNumber: string): string {
  return `${set.trim().toLocaleLowerCase()}|${collectorNumber.replace(/^0+/, '') || '0'}`;
}

function oracleKey(card: ScryfallCard): string {
  return card.oracle_id ?? normalize(card.name);
}

function identity(commanders: readonly ScryfallCard[]): string[] {
  const present = new Set(commanders.flatMap((card) => card.color_identity.map((color) => color.toUpperCase())));
  return COLOR_ORDER.filter((color) => present.has(color));
}

function legalIdentity(card: ScryfallCard, colors: readonly string[]): boolean {
  const allowed = new Set(colors.map((color) => color.toUpperCase()));
  return card.legalities.commander === 'legal' && card.color_identity.every((color) => allowed.has(color.toUpperCase()));
}

function identityQuery(colors: readonly string[]): string {
  return colors.length === 0 ? 'id:c' : `id<=${colors.join('').toLocaleLowerCase()}`;
}

function finishSuffix(finish: DeckFinish | null | undefined): string {
  return finish === 'foil' ? ' *F*' : finish === 'etched' ? ' *E*' : finish === 'nonfoil' ? ' *N*' : '';
}

function budgetFinish(card: ScryfallCard, cap: number | undefined): DeckFinish | null {
  if (cap === undefined) return null;
  const witness = exactPrintingBudgetWitnessV15(card, cap);
  if (witness.status !== 'within-cap' || witness.finish === null) {
    throw new Error(`Exact printing ${card.name} (${card.set.toUpperCase()}) ${card.collector_number} lost its required US$${cap} budget witness during emission.`);
  }
  return witness.finish;
}

function printingLine(quantity: number, card: ScryfallCard, cap?: number): string {
  return `${quantity} ${card.name} (${card.set.toUpperCase()}) ${card.collector_number}${finishSuffix(budgetFinish(card, cap))}`;
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
  for (const key of Object.keys(counts) as Array<keyof NeutralRoleTargetsV15>) counts[key] += contribution[key] ?? 0;
}

function strategyAffinity(card: ScryfallCard, archetype: NeutralArchetypeV15): number {
  const roles = new Set(inferCardRoles(card));
  const text = getCardOracleText(card).toLocaleLowerCase();
  let score = 0;
  const add = (condition: boolean, points: number): void => { if (condition) score += points; };
  switch (archetype) {
    case 'combat-tokens':
      add(roles.has('token production'), 5); add(roles.has('extra combat'), 6); add(roles.has('haste'), 2); add(/attacks|attacking|combat damage/.test(text), 3); break;
    case 'equipment-voltron':
      add(roles.has('equipment'), 7); add(roles.has('protection'), 3); add(/equip |equipped creature|attach/.test(text), 5); add(/double strike|trample|first strike/.test(text), 2); break;
    case 'counters':
      add(roles.has('+1/+1 counters'), 7); add(/proliferate/.test(text), 6); add(/counter is put|counters? are put|move .*counter/.test(text), 4); break;
    case 'graveyard-reanimator':
      add(roles.has('graveyard recursion'), 7); add(/graveyard/.test(text), 4); add(/mill|surveil|discard/.test(text), 3); break;
    case 'aristocrats':
      add(roles.has('sacrifice synergy'), 6); add(roles.has('sacrifice outlet'), 7); add(roles.has('life drain'), 6); add(/dies|sacrifice/.test(text), 4); break;
    case 'spells-control':
      add(roles.has('countermagic'), 6); add(roles.has('stax/control'), 5); add(roles.has('copy effect'), 4); add(/instant|sorcery|noncreature spell|whenever you cast/.test(text), 4); break;
    case 'value-engine':
      add(roles.has('repeatable draw'), 7); add(roles.has('card draw'), 4); add(roles.has('card selection'), 3); add(roles.has('treasure'), 4); add(roles.has('etb synergy'), 3); add(/you may cast|you may play|exile the top/.test(text), 4); break;
    case 'big-mana':
      add(roles.has('mana acceleration'), 6); add(roles.has('cost reduction'), 6); add(roles.has('untap engine'), 3); add(/add .*mana|costs? .*less to cast/.test(text), 4); break;
  }
  return score;
}

function dynamicCandidateScore(card: ScryfallCard, archetype: NeutralArchetypeV15, counts: NeutralRoleTargetsV15, targets: NeutralRoleTargetsV15): number {
  const contribution = roleContribution(card);
  let score = strategyAffinity(card, archetype) * 6;
  for (const key of Object.keys(targets) as Array<keyof NeutralRoleTargetsV15>) {
    if (!contribution[key]) continue;
    score += Math.min(5, Math.max(0, targets[key] - counts[key])) * 5;
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

async function requiredPrinting(
  card: ScryfallCard,
  policy: ResolvedPrintingPolicyV08,
  maxUsdPerCard: number | undefined,
  label: string,
): Promise<EligiblePrintingChoiceV08> {
  if (maxUsdPerCard === undefined) {
    const uncapped = await selectEligiblePrintingV08(card, policy);
    if (!uncapped) throw new Error(`No eligible physical printing of ${label} ${card.name} satisfies the neutral printing policy.`);
    return uncapped;
  }
  const capped = await selectBudgetEligiblePrintingV15(card, policy, maxUsdPerCard);
  if (capped) return capped;
  throw new Error(`${label} ${card.name} has no verified eligible physical printing/finish at or below the US$${maxUsdPerCard} hard per-card cap after bounded physical-printing exhaustion.`);
}

async function resolveExactCommanders(commanderNames: string[], policy: ResolvedPrintingPolicyV08, maxUsdPerCard: number | undefined): Promise<EligiblePrintingChoiceV08[]> {
  const lookupNames = commanderNames.map(neutralCommanderLookupNameV15);
  const oracleCards = await getCardsByNames(lookupNames);
  if (oracleCards.notFound.length > 0) throw new Error(`Neutral commander resolution failed: ${oracleCards.notFound.join(', ')}`);
  const exact: EligiblePrintingChoiceV08[] = [];
  const consumed = new Set<string>();
  for (const requested of commanderNames) {
    const card = oracleCards.cards.find((candidate) => !consumed.has(oracleKey(candidate)) && commanderNameMatches(requested, candidate));
    if (!card) throw new Error(`Neutral commander resolution failed to match canonical card data for ${requested}.`);
    consumed.add(oracleKey(card));
    exact.push(await requiredPrinting(card, policy, maxUsdPerCard, 'Commander'));
  }
  return exact;
}

async function exactSpecialCards(policy: ResolvedPrintingPolicyV08): Promise<ScryfallCard[]> {
  const selectors = [...new Map(policy.exactSpecialPrintings.map((entry) => [exactPrintingKey(entry.set, entry.collectorNumber), entry])).values()];
  if (selectors.length === 0) return [];
  const resolved = await getCardsByIdentifiers(selectors.map((entry): CardIdentifierInput => ({ name: entry.oracleName, set: entry.set, collectorNumber: entry.collectorNumber })));
  if (resolved.notFound.length > 0) throw new Error(`One or more curated special printings could not be resolved for neutral deck construction: ${resolved.notFound.join(', ')}`);
  return resolved.cards;
}

function exactCandidateWithinCap(card: ScryfallCard, cap: number | undefined): boolean {
  return cap === undefined || exactPrintingBudgetWitnessV15(card, cap).status === 'within-cap';
}

async function discoverEligiblePool(colors: readonly string[], policy: ResolvedPrintingPolicyV08, candidateCap: number | undefined): Promise<ScryfallCard[]> {
  if (policy.family && policy.familyMatchedSetCodes.length === 0) throw new Error(`Printing-family discovery for ${policy.family} returned no matching set codes; neutral construction fails closed.`);
  const cards: ScryfallCard[] = [];
  if (policy.allowedSetCodes.length > 0) {
    const setClause = `(${policy.allowedSetCodes.map((set) => `set:${set}`).join(' OR ')})`;
    const result = await boundedScryfallSearchV15(`${setClause} f:commander ${identityQuery(colors)} game:paper`, {
      maxCards: 2_000,
      maxPages: 50,
      minRequestGapMs: 300,
      unique: candidateCap === undefined ? 'cards' : 'prints',
    });
    cards.push(...result.cards);
  }
  cards.push(...await exactSpecialCards(policy));
  const eligible = cards
    .filter((card) => printingMatchesPolicyV08(card, policy))
    .filter((card) => legalIdentity(card, colors))
    .filter((card) => exactCandidateWithinCap(card, candidateCap));
  const byOracle = new Map<string, ScryfallCard>();
  for (const card of eligible) {
    const key = oracleKey(card);
    const current = byOracle.get(key);
    if (!current) { byOracle.set(key, card); continue; }
    const cardWitness = candidateCap === undefined ? null : exactPrintingBudgetWitnessV15(card, candidateCap);
    const currentWitness = candidateCap === undefined ? null : exactPrintingBudgetWitnessV15(current, candidateCap);
    const priceDelta = cardWitness?.priceUsd !== null && cardWitness?.priceUsd !== undefined && currentWitness?.priceUsd !== null && currentWitness?.priceUsd !== undefined
      ? cardWitness.priceUsd - currentWitness.priceUsd
      : 0;
    if (priceDelta < 0 || (priceDelta === 0 && `${card.set}|${card.collector_number}`.localeCompare(`${current.set}|${current.collector_number}`) < 0)) byOracle.set(key, card);
  }
  return [...byOracle.values()];
}

async function resolveMustIncludes(names: string[], colors: readonly string[], policy: ResolvedPrintingPolicyV08, maxUsdPerCard: number | undefined): Promise<EligiblePrintingChoiceV08[]> {
  if (names.length === 0) return [];
  const result = await getCardsByNames(names);
  if (result.notFound.length > 0) throw new Error(`Neutral must-include resolution failed: ${result.notFound.join(', ')}`);
  const selected: EligiblePrintingChoiceV08[] = [];
  for (const card of result.cards) {
    if (!legalIdentity(card, colors)) throw new Error(`Must-include ${card.name} is outside the selected commander's color identity.`);
    selected.push(await requiredPrinting(card, policy, maxUsdPerCard, 'Must-include'));
  }
  return selected;
}

/** Strategy-first neutral deck construction. There is intentionally no targetBracket option. */
export async function buildNeutralCommanderDeckV15(commanderNames: string[], options: NeutralDeckBuildOptionsV15): Promise<Record<string, unknown>> {
  const requested = commanderNames.map((name) => name.trim()).filter(Boolean);
  if (requested.length < 1 || requested.length > 2) throw new Error('Neutral deck construction requires one or two commander names.');
  const userCap = positiveCap('maxUsdPerCard', options.maxUsdPerCard);
  const candidateCap = neutralCandidatePriceCapV15(options);
  const excludedNames = new Set((options.excludedCards ?? []).map(normalize));
  const mustNames = [...new Set((options.mustInclude ?? []).map((name) => name.trim()).filter(Boolean))];
  const conflicts = mustNames.filter((name) => excludedNames.has(normalize(name)));
  if (conflicts.length > 0) throw new Error(`Neutral constraints conflict: cards cannot be both must-include and excluded: ${conflicts.join(', ')}.`);

  const policy = await resolvePrintingPolicyV08(options);
  const commanderChoices = await resolveExactCommanders(requested, policy, userCap);
  const commanders = commanderChoices.map((choice) => choice.card);
  const colors = identity(commanders);
  const profile = NEUTRAL_PROFILES[options.archetype];
  const landsWanted = Math.max(30, Math.min(42, Math.trunc(options.landCount ?? profile.lands)));
  const nonlandSlots = 100 - commanders.length - landsWanted;
  if (nonlandSlots < 1) throw new Error('Neutral land plan leaves no nonland deck slots.');

  const unrestricted = !policy.family && policy.allowedSetCodes.length === 0 && policy.exactSpecialPrintings.length === 0;
  const unrestrictedPool = unrestricted
    ? await discoverNeutralUnrestrictedPoolV15(colors, options.archetype, policy, { ...(candidateCap !== undefined ? { maxUsdPerCard: candidateCap } : {}) })
    : null;
  const pool = unrestrictedPool?.cards ?? await discoverEligiblePool(colors, policy, candidateCap);
  const candidatePoolProvenance: Record<string, unknown> = unrestrictedPool?.provenance ?? {
    mode: 'exhaustive-bounded-printing-policy',
    exhaustive: true,
    edhrecOrderedInput: true,
    rankingUsesPopularity: false,
    budgetCapUsd: candidateCap ?? null,
    budgetFilterMode: candidateCap === undefined ? 'not-requested' : 'exact-physical-printing',
    note: 'The bounded printing-family/set search is exhausted inside explicit safety ceilings; EDHREC ordering only affects uncapped fetch order, not candidate scoring. With a candidate cap, physical printings are exhausted inside the same ceilings before Oracle deduplication so an affordable eligible printing is not hidden by a different Oracle representative.',
  };

  const commanderOracleKeys = new Set(commanders.map(oracleKey));
  const mustChoices = await resolveMustIncludes(mustNames, colors, policy, userCap);
  const mustCards = mustChoices.map((choice) => choice.card);
  const requiredOracleKeys = new Set(mustCards.map(oracleKey));
  const requiredNonCommanders = mustCards.filter((card) => !commanderOracleKeys.has(oracleKey(card)) && !excludedNames.has(normalize(card.name)));
  const requiredNonlands = requiredNonCommanders.filter((card) => !card.type_line.toLocaleLowerCase().includes('land'));
  const requiredLands = requiredNonCommanders.filter((card) => card.type_line.toLocaleLowerCase().includes('land'));
  if (requiredNonlands.length > nonlandSlots) throw new Error(`The ${requiredNonlands.length} required nonland cards exceed the ${nonlandSlots} available nonland slots.`);
  if (requiredLands.length > landsWanted) throw new Error(`The ${requiredLands.length} required lands exceed the ${landsWanted} configured land slots.`);

  const nonlands = pool
    .filter((card) => !card.type_line.toLocaleLowerCase().includes('land'))
    .filter((card) => !commanderOracleKeys.has(oracleKey(card)))
    .filter((card) => !requiredOracleKeys.has(oracleKey(card)))
    .filter((card) => !excludedNames.has(normalize(card.name)))
    .filter((card) => exactCandidateWithinCap(card, candidateCap));
  const selected: ScryfallCard[] = [];
  const selectedKeys = new Set<string>();
  const counts = emptyCounts();
  for (const card of requiredNonlands) {
    const key = oracleKey(card);
    if (selectedKeys.has(key)) continue;
    selected.push(card); selectedKeys.add(key); incrementCounts(counts, card);
  }
  const remaining = nonlands.filter((card) => !selectedKeys.has(oracleKey(card)));
  while (selected.length < nonlandSlots && remaining.length > 0) {
    remaining.sort((a, b) => dynamicCandidateScore(b, options.archetype, counts, profile.roles) - dynamicCandidateScore(a, options.archetype, counts, profile.roles) || a.name.localeCompare(b.name));
    const best = remaining.shift();
    if (!best) break;
    selected.push(best); selectedKeys.add(oracleKey(best)); incrementCounts(counts, best);
  }

  const candidateLands = pool
    .filter((card) => card.type_line.toLocaleLowerCase().includes('land'))
    .filter((card) => !requiredOracleKeys.has(oracleKey(card)))
    .filter((card) => !excludedNames.has(normalize(card.name)))
    .filter((card) => exactCandidateWithinCap(card, candidateCap));
  const requiredNonbasics = requiredLands.filter((card) => !/basic land/i.test(card.type_line));
  const requiredBasics = requiredLands.filter((card) => /basic land/i.test(card.type_line));
  const nonbasicLimit = Math.max(0, Math.min(landsWanted, Math.trunc(options.maxNonbasicLands ?? Math.max(10, colors.length * 5))));
  if (requiredNonbasics.length > nonbasicLimit) {
    throw new Error(`The ${requiredNonbasics.length} required nonbasic lands exceed maxNonbasicLands=${nonbasicLimit}.`);
  }
  const optionalNonbasics = candidateLands
    .filter((card) => !/basic land/i.test(card.type_line))
    .sort((a, b) => landScore(b, colors) - landScore(a, colors) || a.name.localeCompare(b.name));
  const chosenOptionalNonbasics = optionalNonbasics.slice(0, Math.max(0, nonbasicLimit - requiredNonbasics.length));
  const chosenNonbasics = [...requiredNonbasics, ...chosenOptionalNonbasics];
  const basicsNeeded = landsWanted - chosenNonbasics.length;
  if (requiredBasics.length > basicsNeeded) {
    throw new Error(`The ${requiredBasics.length} required basic lands cannot fit into the ${basicsNeeded} basic-land slots remaining after required/nonbasic lands.`);
  }

  const optionalBasics = candidateLands.filter((card) => /basic land/i.test(card.type_line));
  const optionalBasicByName = new Map(optionalBasics.map((card) => [normalize(card.name), card]));
  const desiredBasicNames = colors.length > 0 ? colors.map((color) => BASIC_FOR_COLOR[color]).filter((name): name is string => Boolean(name)) : ['Wastes'];
  const distributionBasics = desiredBasicNames
    .map((name) => optionalBasicByName.get(normalize(name)))
    .filter((card): card is ScryfallCard => Boolean(card));
  const basicAllocations: BasicAllocationV15[] = requiredBasics.map((card) => ({ card, quantity: 1, required: true }));
  const optionalBasicsNeeded = basicsNeeded - requiredBasics.length;
  if (optionalBasicsNeeded > 0 && distributionBasics.length === 0) {
    throw new Error(`Neutral land construction needs ${optionalBasicsNeeded} optional basic-land slots, but no candidate basic printing satisfies the active identity/printing/budget constraints.`);
  }
  const optionalBasicQuantities = new Map<string, number>();
  for (let index = 0; index < optionalBasicsNeeded; index += 1) {
    const basic = distributionBasics[index % distributionBasics.length]!;
    const key = exactPrintingKey(basic.set, basic.collector_number);
    optionalBasicQuantities.set(key, (optionalBasicQuantities.get(key) ?? 0) + 1);
  }
  for (const basic of distributionBasics) {
    const quantity = optionalBasicQuantities.get(exactPrintingKey(basic.set, basic.collector_number)) ?? 0;
    if (quantity > 0) basicAllocations.push({ card: basic, quantity, required: false });
  }

  const commanderLines = commanderChoices.map((choice) => printingLine(1, choice.card, userCap));
  const mainLines = [
    ...selected.map((card) => printingLine(1, card, requiredOracleKeys.has(oracleKey(card)) ? userCap : candidateCap)),
    ...chosenNonbasics.map((card) => printingLine(1, card, requiredOracleKeys.has(oracleKey(card)) ? userCap : candidateCap)),
    ...basicAllocations.map((allocation) => printingLine(allocation.quantity, allocation.card, allocation.required ? userCap : candidateCap)),
  ];
  const decklist = ['// COMMANDER', ...commanderLines, '', '// MAIN', ...mainLines].join('\n');
  const parsed = parseDecklist(decklist);
  const validationCards = [...commanders, ...selected, ...chosenNonbasics, ...basicAllocations.map((allocation) => allocation.card)];
  const rules = validateCommanderDeck(parsed, validationCards);
  const printingPolicySatisfied = validationCards.every((card) => printingMatchesPolicyV08(card, policy));
  const enoughNonlands = selected.length === nonlandSlots;
  const totalBasics = basicAllocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
  const enoughLands = chosenNonbasics.length + totalBasics === landsWanted;
  const perCardBudgetAudit = auditExactPerCardBudgetV15(parsed, validationCards, userCap);
  const optionalCards = [
    ...selected.filter((card) => !requiredOracleKeys.has(oracleKey(card))),
    ...chosenOptionalNonbasics,
    ...basicAllocations.filter((allocation) => !allocation.required).map((allocation) => allocation.card),
  ];
  const candidateBudgetSatisfied = candidateCap === undefined || optionalCards.every((card) => exactPrintingBudgetWitnessV15(card, candidateCap).status === 'within-cap');
  const complete = parsed.totalCards === 100 && rules.isLegal && printingPolicySatisfied && enoughNonlands && enoughLands && perCardBudgetAudit.satisfied && candidateBudgetSatisfied;
  const roleDeficits = Object.fromEntries((Object.keys(profile.roles) as Array<keyof NeutralRoleTargetsV15>).map((key) => [key, Math.max(0, profile.roles[key] - counts[key])]));

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
    perCardBudgetAudit,
    candidateBudgetSatisfied,
    candidatePoolProvenance,
    roleTargets: profile.roles,
    detectedRoleCounts: counts,
    remainingRoleDeficits: roleDeficits,
    eligiblePoolSize: pool.length,
    selectedStrategyAffinity: selected.reduce((sum, card) => sum + strategyAffinity(card, options.archetype), 0),
    landPlan: {
      targetLands: landsWanted,
      selectedNonbasicLands: chosenNonbasics.length,
      requiredNonbasicLands: requiredNonbasics.map((card) => card.name),
      requiredBasicLands: requiredBasics.map((card) => card.name),
      selectedBasics: basicAllocations.map((allocation) => ({
        name: allocation.card.name,
        set: allocation.card.set.toUpperCase(),
        collectorNumber: allocation.card.collector_number,
        quantity: allocation.quantity,
        required: allocation.required,
      })),
    },
    constraints: {
      printingFamily: options.printingFamily ?? null,
      allowedSets: options.allowedSets ?? [],
      includePromos: options.includePromos ?? true,
      includeSpecialReleases: options.includeSpecialReleases ?? true,
      maxUsdPerCard: userCap ?? null,
      candidateMaxUsdPerCard: options.candidateMaxUsdPerCard ?? null,
      effectiveCandidateMaxUsdPerCard: candidateCap ?? null,
      excludedCards: options.excludedCards ?? [],
      mustInclude: mustNames,
    },
    constructionExplanation: [
      'No bracket target is accepted or inferred by this builder.',
      `The ${options.archetype} identity was chosen before construction from commander semantics.`,
      unrestricted
        ? 'With no printing-family/set restriction, candidate discovery uses an explicitly bounded stratified Scryfall sample across mana bands, lands, and archetype signals; it does not pretend to exhaust every Commander-legal card.'
        : 'With a bounded printing-family/set restriction, the eligible physical-printing pool is exhausted inside explicit safety ceilings before strategy scoring; budgeted restricted pools inspect physical printings before Oracle deduplication.',
      'Card selection balances archetype affinity with ordinary ramp/draw/interaction/protection/recursion needs; it does not award EDHREC popularity, cEDH intent, Game Changer count, or famous-card-name points.',
      'Must-includes are resolved independently under the user hard cap. Required lands consume real land slots; required nonbasics also consume the configured nonbasic-land allowance instead of being silently dropped.',
      userCap === undefined
        ? 'No user hard per-card USD cap was requested.'
        : `Every final exact printing is independently audited against the US$${userCap} user hard per-card cap; missing price evidence does not count as zero.`,
      candidateCap === undefined
        ? 'No optional candidate-only price cap is active.'
        : `Optional candidates and lands must carry an exact priced finish at or below the effective US$${candidateCap} search cap; this cap may tighten but never loosen the user hard cap.`,
      'Every emitted card line carries an exact set code and collector number; when a budget cap proves a specific finish, the deck line also records that finish marker.',
      'Bracket assessment belongs after this construction stage.',
    ],
  };
}
