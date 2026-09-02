import type { ScryfallCard } from '../types/scryfall.js';
import { getCardManaCost, getCardOracleText, inferCardRoles } from './scryfall.js';

export interface ManaRoleTruthV15 {
  addsMana: boolean;
  delayed: boolean;
  externalBoardPrerequisite: boolean;
  grantsManaAbilityToAnotherPermanent: boolean;
  paidActivationBeforeMana: boolean;
  createsManaToken: boolean;
  triggeredMana: boolean;
  variableStateMana: boolean;
  tapActivationBeforeMana: boolean;
  summoningSicknessDelay: boolean;
  spendingRestriction: boolean;
  fixedManaOutput: number | null;
  positiveActivationManaProfit: boolean;
  manaFilteringOnly: boolean;
  positiveImmediateManaProfit: boolean;
  manaNeutralOneShot: boolean;
  reliableImmediateFastMana: boolean;
  reliableLowCostManaAcceleration: boolean;
  reasons: string[];
}

export interface InteractionRoleTruthV15 {
  genericDirectInteraction: boolean;
  graveyardOnlyInteraction: boolean;
  activatedOnlyInteraction: boolean;
  minimumActivationManaCost: number | null;
  reliableFreeInteraction: boolean;
  cheapInteraction: boolean;
  reasons: string[];
}

export interface SacrificeRoleTruthV15 {
  repeatableTargets: string[];
  genericOutlet: boolean;
  creatureOutlet: boolean;
  artifactOutlet: boolean;
  narrowOutlet: boolean;
  reasons: string[];
}

export interface TutorRoleTruthV15 {
  searchesLibrary: boolean;
  randomOutcomeGated: boolean;
  reliableStructuralTutor: boolean;
  reasons: string[];
}

function text(card: ScryfallCard): string {
  return getCardOracleText(card).toLocaleLowerCase();
}

function addsMana(textValue: string): boolean {
  return /\badd (?:\{|one mana|two mana|three mana|four mana|five mana|six mana|seven mana|eight mana|nine mana|ten mana|mana)/.test(textValue);
}

function hasExternalBoardPrerequisite(textValue: string): boolean {
  return /\bactivate only if\b/.test(textValue)
    || /\bonly if you control\b/.test(textValue)
    || /\bamong colors of [^.]{0,120} you control\b/.test(textValue)
    || /\btap an untapped [^.]{0,100} you control\b/.test(textValue)
    || /\bsacrifice (?:another|a|an) [^:,.\n]{1,80}\s*:\s*add\b/.test(textValue)
    || /\bas long as you control [^.]{0,100},?\s*\{t\}:?\s*add\b/.test(textValue);
}

function grantsManaAbilityToAnotherPermanent(textValue: string): boolean {
  return /\b(?:equipped|enchanted) (?:creature|permanent|land)[^.]{0,160}\b(?:has|gains?)\b[^.]{0,120}\badd\b/.test(textValue);
}

function paidActivationBeforeMana(textValue: string): boolean {
  return /\{(?:[1-9]\d*|x)\}[^:]{0,40}\{t\}[^:]{0,20}:\s*add\b/.test(textValue)
    || /\{t\}[^:]{0,40}pay \{(?:[1-9]\d*|x)\}[^:]{0,20}:\s*add\b/.test(textValue);
}

function createsManaToken(textValue: string): boolean {
  return /\bcreate [^.\n]{0,140}\b(?:treasure|gold|powerstone) tokens?\b/.test(textValue)
    || /\bcreate [^.\n]{0,180}\bcreature tokens?\b[^.\n]{0,80}\.\s*(?:it|they|those tokens?) (?:has|have) ["“]?sacrifice (?:this|these|those) (?:creature|token|tokens?)[^"”\n]{0,80}\badd\b/.test(textValue)
    || /\bcreate [^.\n]{0,180}\bcreature tokens?\b[^.\n]{0,180}\b(?:it|they|those tokens?) (?:has|have) ["“]?sacrifice (?:this|these|those) (?:creature|token|tokens?)[^"”\n]{0,80}\badd\b/.test(textValue)
    || /\bcreate [^.\n]{0,180}\bcreature tokens?\b[^.\n]{0,180}\bsacrifice (?:this|these|those) (?:creature|token|tokens?)[^"”\n]{0,80}\badd\b/.test(textValue);
}

function hasTriggeredMana(textValue: string): boolean {
  return /\b(?:when|whenever|at the beginning of|at the start of) [^.\n]{0,180}\badd\b/.test(textValue);
}

function hasVariableStateMana(textValue: string): boolean {
  return /\badd [^.\n]{0,140}\bfor each\b/.test(textValue)
    || /\badd [^.\n]{0,140}\bequal to (?:the )?(?:number|amount)\b/.test(textValue)
    || /\badd [^.\n]{0,140}\bwhere x is\b/.test(textValue);
}

function hasTapManaActivation(textValue: string): boolean {
  return /\{t\}[^:]{0,100}:\s*add\b/.test(textValue)
    || /\{t\}\s*,[^:]{0,100}:\s*add\b/.test(textValue);
}

function hasSpendingRestriction(textValue: string): boolean {
  return /\bspend this mana only (?:to|on|for)\b/.test(textValue)
    || /\bthis mana can't be spent to\b/.test(textValue)
    || /\bspend this mana only as though\b/.test(textValue);
}

function fixedManaOutput(textValue: string): number | null {
  const outputs: number[] = [];
  for (const match of textValue.matchAll(/\badd\s+((?:\{[wubrgc]\}){1,12})/gi)) {
    const symbols = match[1]?.match(/\{[wubrgc]\}/gi) ?? [];
    if (symbols.length > 0) outputs.push(symbols.length);
  }
  const wordValues: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  for (const match of textValue.matchAll(/\badd\s+(one|two|three|four|five|six|seven|eight|nine|ten)\s+mana\b/gi)) {
    const value = match[1] ? wordValues[match[1].toLocaleLowerCase()] : undefined;
    if (value !== undefined) outputs.push(value);
  }
  return outputs.length > 0 ? Math.max(...outputs) : null;
}

function manaCostValue(cost: string): number | null {
  let total = 0;
  for (const match of cost.matchAll(/\{([^}]+)\}/g)) {
    const symbol = match[1]?.trim().toLocaleUpperCase() ?? '';
    if (!symbol || ['T', 'Q', 'E'].includes(symbol)) continue;
    if (symbol === 'X') return null;
    if (/^\d+$/.test(symbol)) {
      total += Number.parseInt(symbol, 10);
      continue;
    }
    if (/^[WUBRGCS]$/.test(symbol)) {
      total += 1;
      continue;
    }
    if (/^[WUBRGCSP]\/[WUBRGCSP]$/.test(symbol)) {
      total += symbol.includes('P') ? 0 : 1;
      continue;
    }
    if (/^2\/[WUBRGCSP]$/.test(symbol)) {
      total += symbol.endsWith('/P') ? 0 : 1;
      continue;
    }
    return null;
  }
  return total;
}

function activatedManaEconomy(textValue: string): {
  positiveProfit: boolean;
  filteringOnly: boolean;
} {
  const resolved: Array<{ input: number; output: number }> = [];
  for (const match of textValue.matchAll(/(?:^|\n)([^:\n]{0,220}):\s*([^\n]{0,300}\badd\b[^\n]*)/g)) {
    const input = manaCostValue(match[1] ?? '');
    const output = fixedManaOutput(match[2] ?? '');
    if (input === null || output === null) continue;
    resolved.push({ input, output });
  }
  return {
    positiveProfit: resolved.some((ability) => ability.output > ability.input),
    filteringOnly: resolved.length > 0 && resolved.every((ability) => ability.output <= ability.input),
  };
}

function hasGenericDirectInteraction(textValue: string): boolean {
  const withoutGraveyardExile = textValue
    .replace(/\bexile (?:up to [^.]{0,80})?target [^.]{0,120}\b(?:from|in) (?:a|the|target player's|that player's|your) graveyard\b[^.]*/g, '')
    .replace(/\bexile target player's graveyard\b[^.]*/g, '');
  return /\bcounter target (?:spell|activated ability|triggered ability)\b/.test(withoutGraveyardExile)
    || /\b(?:destroy|exile)(?: up to [^.]{0,80})? target\b/.test(withoutGraveyardExile)
    || /\breturn target [^.]{0,120} to (?:its|their) owner's hand\b/.test(withoutGraveyardExile)
    || /\btap target (?:artifact|creature|permanent)\b/.test(withoutGraveyardExile)
    || /\btarget [^.]{0,100}(?:creature|planeswalker)[^.]{0,60}gets? -(?:x|\d+)\/-(?:x|\d+)\b/.test(withoutGraveyardExile)
    || /\bdeals? [^.]{0,120} damage (?:to )?(?:any |up to one )?target\b/.test(withoutGraveyardExile);
}

function activatedInteractionCosts(textValue: string): number[] {
  const costs: number[] = [];
  for (const match of textValue.matchAll(/(?:^|\n)([^:\n]{0,220}):\s*([^\n]{0,400})/g)) {
    if (!hasGenericDirectInteraction(match[2] ?? '')) continue;
    const cost = manaCostValue(match[1] ?? '');
    if (cost !== null) costs.push(cost);
  }
  return costs;
}

function interactionOutsideActivatedAbilities(textValue: string): boolean {
  const withoutActivatedAbilities = textValue.replace(/(?:^|\n)[^:\n]{0,220}:\s*[^\n]{0,400}/g, '\n');
  return hasGenericDirectInteraction(withoutActivatedAbilities);
}

function selfSacrificeManaConversion(card: ScryfallCard, textValue: string): boolean {
  const names = [card.name, ...(card.card_faces ?? []).map((face) => face.name)]
    .flatMap((name) => name.split('//'))
    .map((name) => name.trim().toLocaleLowerCase())
    .filter(Boolean);
  if (/\bsacrifice this (?:artifact|creature|permanent|card)\s*:\s*add\b/.test(textValue)) return true;
  return names.some((name) => textValue.includes(`sacrifice ${name}: add`));
}

function repeatableSacrificeTargets(textValue: string): string[] {
  return [...textValue.matchAll(
    /\bsacrifice (?:a|an|another|target|one or more|any number of|x\b)\s+([^.,:;\n]{1,80})\s*:/g,
  )]
    .map((match) => match[1]?.trim() ?? '')
    .filter(Boolean);
}

function hasActionableGraveyardRecursion(textValue: string): boolean {
  return /\breturn [^.\n]{0,180}\bfrom (?:a|the|your) graveyard\b/.test(textValue)
    || /\bput [^.\n]{0,180}\bfrom (?:a|the|your) graveyard onto the battlefield\b/.test(textValue)
    || /\b(?:cast|play) [^.\n]{0,180}\bfrom (?:a|the|your) graveyard\b/.test(textValue)
    || /\byou may (?:cast|play) [^.\n]{0,180}\bfrom (?:a|the|your) graveyard\b/.test(textValue)
    || /\b(?:choose|target)\b[^.\n]{0,220}\b(?:cards?|creatures?)\b[^.\n]{0,180}\bin your graveyard\b[^.\n]*\.\s*\breturn (?:each(?: of them)?|them|those cards?)\b[^.\n]{0,120}\bto the battlefield\b/.test(textValue)
    || /\b(?:when|whenever) [^.\n]{0,120}\bdies?\b[^.\n]{0,180}\breturn (?:it|that card|that creature|them) to the battlefield\b/.test(textValue);
}

function hasRandomOutcomeGatedLibrarySearch(textValue: string): boolean {
  if (!/\bsearch your library for\b/.test(textValue)) return false;
  const dieRoll = /\broll (?:a |one |two |three |four )?d(?:4|6|8|10|12|20|100)\b/.test(textValue)
    || /\broll (?:a |one |two |three |four |\d+ )?dice?\b/.test(textValue);
  const dieBranchSearch = /(?:\d{1,3}(?:\s*[–—-]\s*\d{1,3})?|\d+\+)\s*(?:\||[–—-])\s*[^.\n]{0,240}\bsearch your library for\b/.test(textValue);
  const conditionalRollSearch = /\bif (?:the )?(?:result|roll) (?:is|was)\b[^.\n]{0,180}\bsearch your library for\b/.test(textValue);
  const coinFlipSearch = /\bflip a coin\b[\s\S]{0,500}\bif you (?:win|lose) (?:the )?flip\b[^.\n]{0,220}\bsearch your library for\b/.test(textValue);
  return (dieRoll && (dieBranchSearch || conditionalRollSearch)) || coinFlipSearch;
}

export function tutorRoleTruthV15(card: ScryfallCard): TutorRoleTruthV15 {
  const oracle = text(card);
  const inferred = new Set(inferCardRoles(card));
  const searchesLibrary = /\bsearch your library for\b/.test(oracle);
  const randomOutcomeGated = inferred.has('tutor') && hasRandomOutcomeGatedLibrarySearch(oracle);
  const reliableStructuralTutor = inferred.has('tutor') && !randomOutcomeGated;
  const reasons: string[] = [];
  if (randomOutcomeGated) reasons.push('library search is only available through a random die/coin outcome rather than reliable tutor access');
  return {
    searchesLibrary,
    randomOutcomeGated,
    reliableStructuralTutor,
    reasons,
  };
}

export function sacrificeRoleTruthV15(card: ScryfallCard): SacrificeRoleTruthV15 {
  const targets = repeatableSacrificeTargets(text(card));
  const genericOutlet = targets.some((target) => /^(?:(?:nonland|nontoken|other)\s+)*(?:creature|permanent|artifact|enchantment|token)s?\b/.test(target));
  const creatureOutlet = targets.some((target) => /^(?:(?:nonland|nontoken|other)\s+)*(?:creature|permanent)s?\b/.test(target));
  const artifactOutlet = targets.some((target) => /^(?:(?:nonland|nontoken|other)\s+)*(?:artifact|permanent)s?\b/.test(target));
  const narrowOutlet = targets.length > 0 && !genericOutlet;
  const reasons: string[] = [];
  if (creatureOutlet) reasons.push('can repeatedly sacrifice generic creatures/permanents');
  else if (artifactOutlet) reasons.push('can repeatedly sacrifice generic artifacts/permanents');
  else if (narrowOutlet) reasons.push(`sacrifice cost is restricted to named/narrow objects: ${targets.join(', ')}`);
  return {
    repeatableTargets: targets,
    genericOutlet,
    creatureOutlet,
    artifactOutlet,
    narrowOutlet,
    reasons,
  };
}

export function manaRoleTruthV15(card: ScryfallCard): ManaRoleTruthV15 {
  const oracle = text(card);
  const manaCost = getCardManaCost(card);
  const typeLine = card.type_line.toLocaleLowerCase();
  const isLand = typeLine.includes('land');
  const isCreature = typeLine.includes('creature');
  const mana = addsMana(oracle);
  const delayed = /\bsuspend\b/.test(oracle);
  const externalBoardPrerequisite = hasExternalBoardPrerequisite(oracle);
  const grantsManaAbility = grantsManaAbilityToAnotherPermanent(oracle);
  const paidActivation = paidActivationBeforeMana(oracle);
  const manaToken = createsManaToken(oracle);
  const triggered = hasTriggeredMana(oracle);
  const variableStateMana = hasVariableStateMana(oracle);
  const tapActivationBeforeMana = hasTapManaActivation(oracle);
  const hasHaste = /\bhaste\b/.test(oracle) || (card.keywords ?? []).some((keyword) => keyword.toLocaleLowerCase() === 'haste');
  const summoningSicknessDelay = isCreature && tapActivationBeforeMana && !hasHaste;
  const spendingRestriction = hasSpendingRestriction(oracle);
  const fixedOutput = fixedManaOutput(oracle);
  const activationEconomy = activatedManaEconomy(oracle);
  const selfSacrificeConversion = selfSacrificeManaConversion(card, oracle);
  const positiveImmediateManaProfit = fixedOutput !== null && fixedOutput > card.cmc;
  const manaNeutralOneShot = selfSacrificeConversion
    && fixedOutput !== null
    && fixedOutput <= card.cmc;
  const variableSpellCost = /\{x\}/i.test(manaCost) || /\b(?:multi)?kicker\b/.test(oracle);
  const reasons: string[] = [];

  if (delayed) reasons.push('mana access is delayed by suspend or another explicit delay');
  if (externalBoardPrerequisite) reasons.push('mana ability requires another board-state prerequisite');
  if (grantsManaAbility) reasons.push('card grants mana production to another permanent instead of producing mana immediately itself');
  if (paidActivation) reasons.push('mana ability requires paid mana before it produces mana');
  if (manaToken) reasons.push('mana comes indirectly from creating a mana-producing token rather than immediate card-native production');
  if (triggered) reasons.push('mana production is gated behind a triggered event');
  if (variableStateMana) reasons.push('mana output scales from another zone/board/game-state quantity and may produce little or no acceleration');
  if (summoningSicknessDelay) reasons.push('tap-based creature mana is not immediately available without haste');
  if (spendingRestriction) reasons.push('mana output has an explicit spending restriction');
  if (manaNeutralOneShot) reasons.push('one-shot self-sacrifice mana output does not exceed the mana spent to cast the card');
  if (activationEconomy.filteringOnly) reasons.push('activated mana output does not exceed the mana paid into the ability');
  if (variableSpellCost) reasons.push('mana production depends on an X/kicker-style paid setup');

  const reliableLowCostManaAcceleration = mana
    && !isLand
    && card.cmc <= 2
    && !delayed
    && !externalBoardPrerequisite
    && !grantsManaAbility
    && !paidActivation
    && !manaToken
    && !triggered
    && !variableStateMana
    && !spendingRestriction
    && !manaNeutralOneShot
    && !variableSpellCost;
  const reliableImmediateFastMana = reliableLowCostManaAcceleration
    && card.cmc <= 1
    && !summoningSicknessDelay
    && positiveImmediateManaProfit;

  return {
    addsMana: mana,
    delayed,
    externalBoardPrerequisite,
    grantsManaAbilityToAnotherPermanent: grantsManaAbility,
    paidActivationBeforeMana: paidActivation,
    createsManaToken: manaToken,
    triggeredMana: triggered,
    variableStateMana,
    tapActivationBeforeMana,
    summoningSicknessDelay,
    spendingRestriction,
    fixedManaOutput: fixedOutput,
    positiveActivationManaProfit: activationEconomy.positiveProfit,
    manaFilteringOnly: activationEconomy.filteringOnly,
    positiveImmediateManaProfit,
    manaNeutralOneShot,
    reliableImmediateFastMana,
    reliableLowCostManaAcceleration,
    reasons,
  };
}

export function interactionRoleTruthV15(card: ScryfallCard): InteractionRoleTruthV15 {
  const oracle = text(card);
  const inferred = new Set(inferCardRoles(card));
  const genericDirectInteraction = hasGenericDirectInteraction(oracle);
  const graveyardOnlyInteraction = inferred.has('graveyard hate')
    && (inferred.has('spot interaction') || inferred.has('free interaction'))
    && !genericDirectInteraction;
  const activationCosts = activatedInteractionCosts(oracle);
  const hasInteractionOutsideActivation = interactionOutsideActivatedAbilities(oracle);
  const activatedOnlyInteraction = genericDirectInteraction
    && activationCosts.length > 0
    && !hasInteractionOutsideActivation;
  const minimumActivationManaCost = activationCosts.length > 0 ? Math.min(...activationCosts) : null;
  const reliableFreeInteraction = inferred.has('free interaction')
    && genericDirectInteraction
    && !graveyardOnlyInteraction
    && !activatedOnlyInteraction;
  const cheapInteraction = genericDirectInteraction
    && card.cmc <= 2
    && (reliableFreeInteraction || !activatedOnlyInteraction || (minimumActivationManaCost ?? Number.POSITIVE_INFINITY) <= 2);
  const reasons: string[] = [];
  if (graveyardOnlyInteraction) reasons.push('interaction is restricted to graveyard cards or graveyards rather than generic battlefield/stack targets');
  if (activatedOnlyInteraction && minimumActivationManaCost !== null) {
    reasons.push(`generic interaction requires an activated mana cost of ${minimumActivationManaCost}`);
  }
  if (inferred.has('free interaction') && !reliableFreeInteraction) reasons.push('zero mana value or a free cast does not make an activated or graveyard-only effect free generic interaction');
  return {
    genericDirectInteraction,
    graveyardOnlyInteraction,
    activatedOnlyInteraction,
    minimumActivationManaCost,
    reliableFreeInteraction,
    cheapInteraction,
    reasons,
  };
}

/**
 * Fail-closed role truth for consumers that use generic Scryfall role inference as evidence.
 * Conditional, indirect, triggered, variable, mana-neutral one-shot, restricted, summoning-sick,
 * or delayed mana may still be useful in a supported deck, but it cannot impersonate reliable fast
 * mana merely because its text contains a mana ability or creates a mana-producing token. Likewise,
 * a card that sacrifices only a named narrow object (for example a Clue or Saproling) cannot
 * impersonate a generic sacrifice outlet, merely moving cards into/out of a graveyard is not
 * recursion unless the card can actually recover, replay, or reanimate them, and a lottery-gated
 * library search cannot impersonate reliable structural tutor consistency.
 */
export function effectiveCardRolesV15(card: ScryfallCard): string[] {
  const roles = new Set(inferCardRoles(card));
  const oracle = text(card);
  const manaTruth = manaRoleTruthV15(card);
  const interactionTruth = interactionRoleTruthV15(card);
  const sacrificeTruth = sacrificeRoleTruthV15(card);
  const tutorTruth = tutorRoleTruthV15(card);
  const landReplacementOnly = roles.has('land ramp')
    && /\bas an additional cost to cast this spell, sacrifice a land\b/.test(oracle);
  if (landReplacementOnly) {
    roles.delete('land ramp');
    roles.delete('persistent colored mana source');
    roles.add('land replacement');
  }
  if (roles.has('fast mana') && !manaTruth.reliableImmediateFastMana) {
    roles.delete('fast mana');
    roles.add(manaTruth.delayed || manaTruth.summoningSicknessDelay ? 'delayed mana acceleration' : 'conditional mana acceleration');
  }
  if (roles.has('mana acceleration') && !manaTruth.reliableLowCostManaAcceleration) {
    if (manaTruth.manaFilteringOnly) {
      roles.delete('mana acceleration');
      roles.delete('mana rock');
      roles.delete('mana dork');
      roles.delete('persistent colored mana source');
      roles.add('mana filtering');
    } else if (manaTruth.manaNeutralOneShot) {
      roles.delete('mana acceleration');
      roles.add('mana storage');
    } else if (manaTruth.spendingRestriction || manaTruth.externalBoardPrerequisite || manaTruth.createsManaToken) {
      roles.delete('mana acceleration');
      roles.add('conditional mana acceleration');
    }
  }
  if (roles.has('persistent colored mana source') && (
    manaTruth.manaFilteringOnly
    || manaTruth.delayed
    || manaTruth.externalBoardPrerequisite
    || manaTruth.grantsManaAbilityToAnotherPermanent
    || manaTruth.createsManaToken
    || manaTruth.triggeredMana
    || manaTruth.variableStateMana
    || manaTruth.spendingRestriction
    || manaTruth.manaNeutralOneShot
  )) {
    roles.delete('persistent colored mana source');
  }
  if (interactionTruth.graveyardOnlyInteraction) {
    roles.delete('spot interaction');
    roles.delete('free interaction');
    roles.add('graveyard interaction');
  } else if (roles.has('free interaction') && !interactionTruth.reliableFreeInteraction) {
    roles.delete('free interaction');
  }
  if (
    interactionTruth.cheapInteraction
    || card.cmc <= 2 && (roles.has('countermagic') || roles.has('board wipe'))
  ) {
    roles.add('cheap interaction');
  }
  if (roles.has('tutor') && !tutorTruth.reliableStructuralTutor) {
    roles.delete('tutor');
    if (tutorTruth.randomOutcomeGated) roles.add('random tutor');
  }
  if (roles.has('graveyard recursion') && !hasActionableGraveyardRecursion(oracle)) {
    roles.delete('graveyard recursion');
    roles.add('graveyard utility');
  }
  if (sacrificeTruth.narrowOutlet) {
    roles.delete('sacrifice outlet');
    roles.add('narrow sacrifice outlet');
  } else if (roles.has('sacrifice outlet')) {
    if (!sacrificeTruth.genericOutlet) {
      roles.delete('sacrifice outlet');
    } else {
      if (sacrificeTruth.creatureOutlet) roles.add('creature sacrifice outlet');
      if (sacrificeTruth.artifactOutlet) roles.add('artifact sacrifice outlet');
    }
  }
  return [...roles];
}
