import type { ScryfallCard } from '../types/scryfall.js';
import { parseDecklist } from './deck.js';
import { getCardOracleText } from './scryfall.js';

export interface EfficientWinPlanEvidenceV15 {
  supported: boolean;
  archetype: 'cheap-repeatable-commander-combat-engine' | 'unverified';
  commanderName: string | null;
  commanderManaValue: number | null;
  checks: {
    oneCommander: boolean;
    commanderResolved: boolean;
    cheapCommander: boolean;
    createsAttackingBodiesFromAttacks: boolean;
    untapsAttackers: boolean;
    grantsAdditionalCombat: boolean;
    combatRepeatableActivation: boolean;
    activationNotExplicitlyOncePerTurn: boolean;
  };
  evidence: string[];
  blockers: string[];
  guidance: string;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function resolvedCommander(decklist: string, cards: readonly ScryfallCard[]): {
  commanderName: string | null;
  card: ScryfallCard | null;
  oneCommander: boolean;
} {
  const parsed = parseDecklist(decklist);
  const oneCommander = parsed.commanders.length === 1 && parsed.commanders[0]?.quantity === 1;
  const commanderName = oneCommander ? parsed.commanders[0]?.name ?? null : null;
  if (!commanderName) return { commanderName: null, card: null, oneCommander };
  const card = cards.find((candidate) => normalize(candidate.name) === normalize(commanderName)) ?? null;
  return { commanderName, card, oneCommander };
}

/**
 * Deck-intrinsic proof for a narrow class of efficient commander-centric non-combo wins.
 *
 * This deliberately does not award a bracket. It only proves that the commander itself
 * supplies a cheap, snowballing combat engine: attacks create additional attacking bodies,
 * and a repeatable combat activation untaps attackers and grants another combat. The
 * bracket assessor must still independently prove that the surrounding 99 is optimized.
 *
 * The verifier is semantic rather than name-based so a commander name alone can never be
 * used as a shortcut to Bracket 4. If Oracle text changes or a lookalike lacks one of the
 * required properties, evidence fails closed.
 */
export function deriveEfficientCommanderWinPlanV15(
  decklist: string,
  cards: readonly ScryfallCard[],
): EfficientWinPlanEvidenceV15 {
  const resolved = resolvedCommander(decklist, cards);
  const commander = resolved.card;
  const oracle = commander ? getCardOracleText(commander) : '';
  const compactOracle = oracle.replace(/\s+/g, ' ').trim();

  const cheapCommander = Boolean(commander && commander.cmc <= 3);
  const createsAttackingBodiesFromAttacks = /whenever [^.]* attacks[^.]*create [^.]*creature token[^.]*tapped and attacking/i.test(compactOracle);
  const untapsAttackers = /untap all attacking creatures/i.test(compactOracle);
  const grantsAdditionalCombat = /additional combat phase/i.test(compactOracle);
  const combatRepeatableActivation = /activate only during combat/i.test(compactOracle);
  const activationNotExplicitlyOncePerTurn = !/activate only once (?:each|per) (?:turn|combat)/i.test(compactOracle);
  const commanderResolved = commander !== null;

  const checks = {
    oneCommander: resolved.oneCommander,
    commanderResolved,
    cheapCommander,
    createsAttackingBodiesFromAttacks,
    untapsAttackers,
    grantsAdditionalCombat,
    combatRepeatableActivation,
    activationNotExplicitlyOncePerTurn,
  };

  const supported = Object.values(checks).every(Boolean);
  const evidence: string[] = [];
  const blockers: string[] = [];

  if (resolved.oneCommander) evidence.push('The deck has exactly one singleton commander for this commander-centric proof path.');
  else blockers.push('This proof path currently requires exactly one singleton commander.');

  if (commanderResolved) evidence.push(`Commander ${resolved.commanderName ?? commander?.name ?? 'unknown'} resolved to card data.`);
  else blockers.push('The commander did not resolve to supplied card data.');

  if (cheapCommander) evidence.push(`Commander mana value ${String(commander?.cmc ?? '?')} is within the verifier's efficient-command-zone threshold of 3 or less.`);
  else blockers.push('The commander is unresolved or costs more than three mana, so this narrow efficient-combat proof does not apply.');

  if (createsAttackingBodiesFromAttacks) evidence.push('Commander Oracle text turns attacks into additional tapped-and-attacking creature bodies.');
  else blockers.push('Commander Oracle text does not prove an attack-to-attacking-body snowball engine.');

  if (untapsAttackers) evidence.push('Commander Oracle text untaps attacking creatures as part of its combat engine.');
  else blockers.push('Commander Oracle text does not prove attacker untapping.');

  if (grantsAdditionalCombat) evidence.push('Commander Oracle text explicitly grants an additional combat phase.');
  else blockers.push('Commander Oracle text does not explicitly grant an additional combat phase.');

  if (combatRepeatableActivation) evidence.push('The additional-combat ability is an activation available during combat rather than a one-shot decklist assumption.');
  else blockers.push('The verifier cannot prove a combat-activated repeatable route from Oracle text.');

  if (activationNotExplicitlyOncePerTurn) evidence.push('Oracle text does not explicitly cap that activation at once per turn/combat.');
  else blockers.push('Oracle text explicitly limits the activation to once per turn/combat.');

  return {
    supported,
    archetype: supported ? 'cheap-repeatable-commander-combat-engine' : 'unverified',
    commanderName: resolved.commanderName,
    commanderManaValue: commander?.cmc ?? null,
    checks,
    evidence,
    blockers,
    guidance: supported
      ? 'This proves only an efficient commander-centric non-combo win condition. Bracket 4 still requires the surrounding deck to independently demonstrate optimized construction; this evidence never satisfies Bracket 5 combo/metagame gates by itself.'
      : 'Do not infer an efficient non-combo win condition from commander reputation or name. Use another objective win-plan proof path or leave the evidence false.',
  };
}
