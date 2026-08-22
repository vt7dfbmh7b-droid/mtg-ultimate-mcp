import type { ScryfallCard } from '../types/scryfall.js';
import type { NeutralArchetypeV15 } from './neutral-commander-selection-v15.js';
import { getCardOracleText, inferCardRoles } from './scryfall.js';

export interface NeutralWinRouteV15 {
  kind: 'commander-engine' | 'combat' | 'drain' | 'recursion' | 'control-value' | 'big-mana' | 'verified-combo';
  label: string;
  evidence: string[];
}

export interface NeutralWinRouteAssessmentV15 {
  primary: NeutralWinRouteV15;
  backup: NeutralWinRouteV15 | null;
  verifiedWinningCombos: number;
  caveat: string;
}

function roleCount(cards: readonly ScryfallCard[], role: string): number {
  return cards.reduce((count, card) => count + (inferCardRoles(card).includes(role) ? 1 : 0), 0);
}

function foodTextCount(cards: readonly ScryfallCard[]): number {
  return cards.reduce((count, card) => count + (/\bfoods?\b/i.test(getCardOracleText(card)) ? 1 : 0), 0);
}

function artifactCount(cards: readonly ScryfallCard[]): number {
  return cards.reduce((count, card) => count + (/\bartifact\b/i.test(card.type_line) ? 1 : 0), 0);
}

function strategyPrimary(
  archetype: NeutralArchetypeV15,
  cards: readonly ScryfallCard[],
  efficientWinPlanSupported: boolean,
): NeutralWinRouteV15 {
  if (efficientWinPlanSupported) {
    return {
      kind: 'commander-engine',
      label: 'Commander-centric repeatable combat engine',
      evidence: ['Independent semantic verifier supports an efficient repeatable commander combat route.'],
    };
  }
  switch (archetype) {
    case 'combat-tokens':
      return {
        kind: 'combat',
        label: 'Go-wide attack and token pressure',
        evidence: [`${roleCount(cards, 'token production')} token-production cards`, `${roleCount(cards, 'extra combat')} extra-combat cards`],
      };
    case 'equipment-voltron':
      return {
        kind: 'combat',
        label: 'Equipment-backed commander/combat damage',
        evidence: [`${roleCount(cards, 'equipment')} equipment-role cards`, `${roleCount(cards, 'protection')} protection cards`],
      };
    case 'counters':
      return {
        kind: 'combat',
        label: 'Counter-amplified creature combat',
        evidence: [`${roleCount(cards, '+1/+1 counters')} +1/+1-counter cards`, `${roleCount(cards, 'protection')} protection cards`],
      };
    case 'graveyard-reanimator':
      return {
        kind: 'recursion',
        label: 'Recursive graveyard threats and reanimation pressure',
        evidence: [`${roleCount(cards, 'graveyard recursion')} graveyard-recursion cards`],
      };
    case 'artifact-engine':
      return {
        kind: 'control-value',
        label: 'Artifact engine pressure backed by recursive value',
        evidence: [`${artifactCount(cards)} artifact cards`, `${roleCount(cards, 'graveyard recursion')} graveyard-recursion cards`],
      };
    case 'aristocrats':
      return {
        kind: 'drain',
        label: 'Sacrifice/death-trigger life drain',
        evidence: [`${roleCount(cards, 'sacrifice synergy')} sacrifice-synergy cards`, `${roleCount(cards, 'life drain')} life-drain cards`],
      };
    case 'food-lifegain':
      return {
        kind: 'drain',
        label: 'Food and repeatable lifegain converted into opponent pressure',
        evidence: [`${foodTextCount(cards)} Food-text cards`, `${roleCount(cards, 'life drain')} life-drain payoffs`],
      };
    case 'spells-control':
      return {
        kind: 'control-value',
        label: 'Control the table, then convert spell/card advantage into a win',
        evidence: [`${roleCount(cards, 'countermagic')} countermagic cards`, `${roleCount(cards, 'card draw')} card-draw cards`],
      };
    case 'big-mana':
      return {
        kind: 'big-mana',
        label: 'Mana acceleration into high-impact threats',
        evidence: [`${roleCount(cards, 'mana acceleration')} mana-acceleration cards`, `${roleCount(cards, 'cost reduction')} cost-reduction cards`],
      };
    case 'value-engine':
      return {
        kind: 'control-value',
        label: 'Accumulate cards/resources and win through sustained board pressure',
        evidence: [`${roleCount(cards, 'repeatable draw')} repeatable-draw cards`, `${roleCount(cards, 'treasure')} Treasure cards`],
      };
  }
}

function naturalBackup(archetype: NeutralArchetypeV15, cards: readonly ScryfallCard[]): NeutralWinRouteV15 | null {
  const lifeDrain = roleCount(cards, 'life drain');
  const recursion = roleCount(cards, 'graveyard recursion');
  const tokens = roleCount(cards, 'token production');
  const equipment = roleCount(cards, 'equipment');
  if (archetype !== 'aristocrats' && archetype !== 'food-lifegain' && lifeDrain >= 2) {
    return { kind: 'drain', label: 'Incremental opponent life drain', evidence: [`${lifeDrain} life-drain cards`] };
  }
  if (archetype !== 'graveyard-reanimator' && recursion >= 3) {
    return { kind: 'recursion', label: 'Recover and replay threats through graveyard recursion', evidence: [`${recursion} graveyard-recursion cards`] };
  }
  if (archetype !== 'combat-tokens' && tokens >= 4) {
    return { kind: 'combat', label: 'Token-backed combat pressure', evidence: [`${tokens} token-production cards`] };
  }
  if (archetype !== 'equipment-voltron' && equipment >= 3) {
    return { kind: 'combat', label: 'Equipment-backed creature pressure', evidence: [`${equipment} equipment-role cards`] };
  }
  return null;
}

/**
 * Primary route follows the identity selected before deck construction. A verified combo is
 * a backup unless the user explicitly requested combo-first construction, which the neutral
 * workflow does not. No unverified interaction is promoted to a deterministic win.
 */
export function deriveNeutralWinRoutesV15(input: {
  archetype: NeutralArchetypeV15;
  cards: readonly ScryfallCard[];
  verifiedWinningCombos: number;
  efficientWinPlanSupported: boolean;
}): NeutralWinRouteAssessmentV15 {
  const winningCombos = Math.max(0, Math.trunc(input.verifiedWinningCombos));
  const primary = strategyPrimary(input.archetype, input.cards, input.efficientWinPlanSupported);
  const backup = winningCombos > 0
    ? {
      kind: 'verified-combo' as const,
      label: 'Verified deterministic combo route',
      evidence: [`Commander Spellbook verification found ${winningCombos} complete win-oriented combo${winningCombos === 1 ? '' : 's'} in the finished 100.`],
    }
    : naturalBackup(input.archetype, input.cards);
  return {
    primary,
    backup,
    verifiedWinningCombos: winningCombos,
    caveat: backup
      ? 'Primary and backup routes are reported from finished-deck evidence; only explicitly verified combo results are called deterministic combos.'
      : 'No second route met the neutral workflow’s evidence threshold. The result is reported as a single-route deck rather than inventing a backup win condition.',
  };
}
