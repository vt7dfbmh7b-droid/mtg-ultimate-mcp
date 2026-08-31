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
  reliableImmediateFastMana: boolean;
  reliableLowCostManaAcceleration: boolean;
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
  return /\bcreate [^.\n]{0,140}\b(?:treasure|gold|powerstone) tokens?\b/.test(textValue);
}

function hasTriggeredMana(textValue: string): boolean {
  return /\b(?:when|whenever|at the beginning of|at the start of) [^.\n]{0,180}\badd\b/.test(textValue);
}

export function manaRoleTruthV15(card: ScryfallCard): ManaRoleTruthV15 {
  const oracle = text(card);
  const manaCost = getCardManaCost(card);
  const isLand = card.type_line.toLocaleLowerCase().includes('land');
  const mana = addsMana(oracle);
  const delayed = /\bsuspend\b/.test(oracle);
  const externalBoardPrerequisite = hasExternalBoardPrerequisite(oracle);
  const grantsManaAbility = grantsManaAbilityToAnotherPermanent(oracle);
  const paidActivation = paidActivationBeforeMana(oracle);
  const manaToken = createsManaToken(oracle);
  const triggered = hasTriggeredMana(oracle);
  const variableSpellCost = /\{x\}/i.test(manaCost) || /\b(?:multi)?kicker\b/.test(oracle);
  const reasons: string[] = [];

  if (delayed) reasons.push('mana access is delayed by suspend or another explicit delay');
  if (externalBoardPrerequisite) reasons.push('mana ability requires another board-state prerequisite');
  if (grantsManaAbility) reasons.push('card grants mana production to another permanent instead of producing mana immediately itself');
  if (paidActivation) reasons.push('mana ability requires paid mana before it produces mana');
  if (manaToken) reasons.push('mana comes indirectly from creating a Treasure/Gold/Powerstone rather than immediate card-native production');
  if (triggered) reasons.push('mana production is gated behind a triggered event');
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
    && !variableSpellCost;
  const reliableImmediateFastMana = reliableLowCostManaAcceleration && card.cmc <= 1;

  return {
    addsMana: mana,
    delayed,
    externalBoardPrerequisite,
    grantsManaAbilityToAnotherPermanent: grantsManaAbility,
    paidActivationBeforeMana: paidActivation,
    createsManaToken: manaToken,
    triggeredMana: triggered,
    reliableImmediateFastMana,
    reliableLowCostManaAcceleration,
    reasons,
  };
}

/**
 * Fail-closed role truth for consumers that use generic Scryfall role inference as evidence.
 * Conditional, indirect, triggered, or delayed mana may still be useful in a supported deck, but
 * it cannot impersonate reliable fast mana merely because its Oracle text/reminder text contains
 * a mana ability or creates a mana-producing token.
 */
export function effectiveCardRolesV15(card: ScryfallCard): string[] {
  const roles = new Set(inferCardRoles(card));
  const manaTruth = manaRoleTruthV15(card);
  if (roles.has('fast mana') && !manaTruth.reliableImmediateFastMana) {
    roles.delete('fast mana');
    roles.add(manaTruth.delayed ? 'delayed mana acceleration' : 'conditional mana acceleration');
  }
  return [...roles];
}
