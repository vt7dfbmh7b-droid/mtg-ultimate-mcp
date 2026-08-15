import type { ScryfallCard } from '../types/scryfall.js';
import { analyzeCastingProfileV05 } from './casting-v05.js';
import { getCardManaCost } from './scryfall.js';

const COLORS = ['W', 'U', 'B', 'R', 'G'] as const;
type Color = (typeof COLORS)[number];

export interface ManaPoolV05 {
  W?: number | undefined;
  U?: number | undefined;
  B?: number | undefined;
  R?: number | undefined;
  G?: number | undefined;
  C?: number | undefined;
  any?: number | undefined;
}

export interface ConvokeCreatureV05 {
  colors: string[];
}

export interface PaymentStateV05 {
  mana?: ManaPoolV05;
  treasures?: number;
  untappedCreatures?: ConvokeCreatureV05[];
  untappedArtifacts?: number;
  graveyardCards?: number;
  affinityCount?: number;
  life?: number;
  commanderTax?: number;
  isCommander?: boolean;
  alternativeResourceReady?: boolean;
}

interface ParsedCost {
  generic: number;
  colored: string[][];
  phyrexian: Color[];
  colorless: number;
}

export interface PaymentLineV05 {
  mode: string;
  manaCostUsed: string;
  castable: boolean;
  conditional: boolean;
  commanderTaxApplied: number;
  genericAfterAffinity: number;
  used: {
    mana: Record<string, number>;
    treasures: number;
    convokeCreatures: number;
    improviseArtifacts: number;
    delvedCards: number;
    phyrexianLife: number;
  };
  remaining: {
    generic: number;
    colored: string[][];
    phyrexian: Color[];
    colorless: number;
  };
  reasons: string[];
}

export interface CastabilityResultV05 {
  card: string;
  printedManaCost: string;
  manaValue: number;
  isCommander: boolean;
  commanderTax: number;
  paymentMechanics: string[];
  lines: PaymentLineV05[];
  castableByAnyLine: boolean;
  caveats: string[];
}

function clampCount(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value ?? 0)) : 0;
}

function parseCost(cost: string): ParsedCost {
  const symbols = cost.match(/\{[^}]+\}/g) ?? [];
  let generic = 0;
  let colorless = 0;
  const colored: string[][] = [];
  const phyrexian: Color[] = [];

  for (const raw of symbols) {
    const symbol = raw.slice(1, -1).toUpperCase();
    if (/^\d+$/.test(symbol)) {
      generic += Number.parseInt(symbol, 10);
      continue;
    }
    if (symbol === 'C') {
      colorless += 1;
      continue;
    }
    const phy = symbol.match(/^([WUBRG])\/P$/)?.[1] as Color | undefined;
    if (phy) {
      phyrexian.push(phy);
      continue;
    }
    const options = symbol
      .split('/')
      .filter((part): part is Color => COLORS.includes(part as Color));
    if (options.length > 0) colored.push([...new Set(options)]);
  }

  return { generic, colored, phyrexian, colorless };
}

function normalizedMana(pool: ManaPoolV05 | undefined): Record<string, number> {
  return {
    W: clampCount(pool?.W),
    U: clampCount(pool?.U),
    B: clampCount(pool?.B),
    R: clampCount(pool?.R),
    G: clampCount(pool?.G),
    C: clampCount(pool?.C),
    any: clampCount(pool?.any),
  };
}

function useManaForOption(
  options: string[],
  mana: Record<string, number>,
  used: Record<string, number>,
  treasures: { value: number },
): boolean {
  const direct = options.find((color) => (mana[color] ?? 0) > 0);
  if (direct) {
    mana[direct] = (mana[direct] ?? 0) - 1;
    used[direct] = (used[direct] ?? 0) + 1;
    return true;
  }
  if ((mana.any ?? 0) > 0) {
    mana.any = (mana.any ?? 0) - 1;
    used.any = (used.any ?? 0) + 1;
    return true;
  }
  if (treasures.value > 0) {
    treasures.value -= 1;
    return true;
  }
  return false;
}

function useColorless(
  mana: Record<string, number>,
  used: Record<string, number>,
  treasures: { value: number },
): boolean {
  if ((mana.C ?? 0) > 0) {
    mana.C = (mana.C ?? 0) - 1;
    used.C = (used.C ?? 0) + 1;
    return true;
  }
  if ((mana.any ?? 0) > 0) {
    mana.any = (mana.any ?? 0) - 1;
    used.any = (used.any ?? 0) + 1;
    return true;
  }
  if (treasures.value > 0) {
    treasures.value -= 1;
    return true;
  }
  return false;
}

function totalMana(mana: Record<string, number>): number {
  return Object.values(mana).reduce((sum, count) => sum + count, 0);
}

function spendGeneric(
  amount: number,
  mana: Record<string, number>,
  used: Record<string, number>,
  treasures: { value: number },
): number {
  let remaining = amount;
  const order = ['C', 'any', 'W', 'U', 'B', 'R', 'G'];
  for (const key of order) {
    while (remaining > 0 && (mana[key] ?? 0) > 0) {
      mana[key] = (mana[key] ?? 0) - 1;
      used[key] = (used[key] ?? 0) + 1;
      remaining -= 1;
    }
  }
  const treasureSpend = Math.min(remaining, treasures.value);
  treasures.value -= treasureSpend;
  remaining -= treasureSpend;
  return remaining;
}

function payWithConvoke(
  requirements: { colored: string[][]; generic: number },
  creatures: ConvokeCreatureV05[],
): { colored: string[][]; generic: number; used: number } {
  const remainingColored = requirements.colored.map((options) => [...options]);
  let generic = requirements.generic;
  let used = 0;
  const available = creatures.map((creature) => ({ colors: creature.colors.map((color) => color.toUpperCase()), used: false }));

  for (let index = remainingColored.length - 1; index >= 0; index -= 1) {
    const options = remainingColored[index] ?? [];
    const creature = available.find((candidate) => !candidate.used && options.some((color) => candidate.colors.includes(color)));
    if (!creature) continue;
    creature.used = true;
    used += 1;
    remainingColored.splice(index, 1);
  }

  for (const creature of available) {
    if (generic <= 0) break;
    if (creature.used) continue;
    creature.used = true;
    used += 1;
    generic -= 1;
  }

  return { colored: remainingColored, generic, used };
}

function buildPaymentLine(
  card: ScryfallCard,
  mode: string,
  manaCost: string,
  state: PaymentStateV05,
  conditional: boolean,
  conditionalReason: string | null,
): PaymentLineV05 {
  const profile = analyzeCastingProfileV05(card);
  const parsed = parseCost(manaCost);
  const commanderTax = state.isCommander ? clampCount(state.commanderTax) : 0;
  let generic = parsed.generic + commanderTax;
  const affinityReduction = profile.paymentMechanics.includes('affinity') ? Math.min(generic, clampCount(state.affinityCount)) : 0;
  generic -= affinityReduction;

  let colored = parsed.colored.map((options) => [...options]);
  const phyrexian = [...parsed.phyrexian];
  let colorless = parsed.colorless;
  const usedMana: Record<string, number> = {};
  const mana = normalizedMana(state.mana);
  const treasures = { value: clampCount(state.treasures) };
  const startingTreasures = treasures.value;
  let convokeCreatures = 0;
  let improviseArtifacts = 0;
  let delvedCards = 0;
  let phyrexianLife = 0;
  const reasons: string[] = [];

  if (profile.paymentMechanics.includes('convoke')) {
    const result = payWithConvoke({ colored, generic }, state.untappedCreatures ?? []);
    colored = result.colored;
    generic = result.generic;
    convokeCreatures = result.used;
  }

  if (profile.paymentMechanics.includes('improvise')) {
    improviseArtifacts = Math.min(generic, clampCount(state.untappedArtifacts));
    generic -= improviseArtifacts;
  }

  if (profile.paymentMechanics.includes('delve')) {
    delvedCards = Math.min(generic, clampCount(state.graveyardCards));
    generic -= delvedCards;
  }

  const remainingColored: string[][] = [];
  for (const options of colored) {
    if (!useManaForOption(options, mana, usedMana, treasures)) remainingColored.push(options);
  }

  const remainingPhyrexian: Color[] = [];
  let life = Number.isFinite(state.life) ? Math.max(0, state.life ?? 0) : 40;
  for (const color of phyrexian) {
    if (useManaForOption([color], mana, usedMana, treasures)) continue;
    if (life >= 2) {
      life -= 2;
      phyrexianLife += 2;
      continue;
    }
    remainingPhyrexian.push(color);
  }

  while (colorless > 0 && useColorless(mana, usedMana, treasures)) colorless -= 1;
  generic = spendGeneric(generic, mana, usedMana, treasures);

  if (conditionalReason) reasons.push(conditionalReason);
  if (remainingColored.length > 0) reasons.push(`Missing ${remainingColored.length} colored/hybrid mana requirement(s).`);
  if (remainingPhyrexian.length > 0) reasons.push(`Unable to pay ${remainingPhyrexian.length} Phyrexian mana symbol(s) with mana or life.`);
  if (colorless > 0) reasons.push(`Missing ${colorless} required colorless mana.`);
  if (generic > 0) reasons.push(`Missing ${generic} generic mana after supported cost-payment mechanics.`);
  if (affinityReduction > 0) reasons.push(`Affinity reduced generic cost by ${affinityReduction}.`);
  if (commanderTax > 0) reasons.push(`Commander tax added {${commanderTax}} to the total cost.`);

  const resourcesPaid = remainingColored.length === 0 && remainingPhyrexian.length === 0 && colorless === 0 && generic === 0;
  const alternativeResourceOkay = !conditional || state.alternativeResourceReady !== false;
  const castable = resourcesPaid && alternativeResourceOkay;
  if (conditional && state.alternativeResourceReady === false) {
    reasons.push('The non-mana requirement/permission for this alternative or free-cast line was marked unavailable.');
  }

  return {
    mode,
    manaCostUsed: manaCost,
    castable,
    conditional,
    commanderTaxApplied: commanderTax,
    genericAfterAffinity: Math.max(0, parsed.generic + commanderTax - affinityReduction),
    used: {
      mana: usedMana,
      treasures: startingTreasures - treasures.value,
      convokeCreatures,
      improviseArtifacts,
      delvedCards,
      phyrexianLife,
    },
    remaining: {
      generic,
      colored: remainingColored,
      phyrexian: remainingPhyrexian,
      colorless,
    },
    reasons,
  };
}

export function evaluateCastabilityV05(card: ScryfallCard, state: PaymentStateV05 = {}): CastabilityResultV05 {
  const profile = analyzeCastingProfileV05(card);
  const isCommander = Boolean(state.isCommander);
  const commanderTax = isCommander ? clampCount(state.commanderTax) : 0;
  const lines: PaymentLineV05[] = [];

  lines.push(buildPaymentLine(card, 'normal', getCardManaCost(card), state, false, null));

  for (const alternative of profile.alternativeCosts) {
    if (!alternative.manaCost) continue;
    lines.push(buildPaymentLine(
      card,
      alternative.kind,
      alternative.manaCost,
      state,
      true,
      alternative.additionalResource
        ? `${alternative.kind} also has a card-specific non-mana requirement: ${alternative.additionalResource}`
        : `${alternative.kind} may have card-specific timing or permission requirements.`,
    ));
  }

  if (profile.freeCastText.length > 0) {
    lines.push(buildPaymentLine(
      card,
      'without-paying-mana-cost',
      '',
      state,
      true,
      'A separate effect/condition must grant permission to cast this spell without paying its mana cost; applicable additional costs such as commander tax still remain.',
    ));
  }

  return {
    card: card.name,
    printedManaCost: getCardManaCost(card),
    manaValue: card.cmc,
    isCommander,
    commanderTax,
    paymentMechanics: profile.paymentMechanics,
    lines,
    castableByAnyLine: lines.some((line) => line.castable),
    caveats: [
      'This V0.5 solver models common mana/payment mechanics, not every cost-changing continuous effect or special action in Magic.',
      'Alternative-cost conditions, exile/discard choices, timing permissions, X values, additional sacrifices, and replacement effects may require explicit state beyond this input.',
      `Unspent ordinary mana after colored payments is ${totalMana(normalizedMana(state.mana))} before considering the line; result lines report what each line actually consumes.`,
    ],
  };
}
