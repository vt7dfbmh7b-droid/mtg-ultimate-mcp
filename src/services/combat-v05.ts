import type { ScryfallCard } from '../types/scryfall.js';
import { getCardOracleText } from './scryfall.js';

export interface CombatCreatureV05 {
  name: string;
  power: number | null;
  toughness: number | null;
  keywords: string[];
  flying: boolean;
  reach: boolean;
  menace: boolean;
  trample: boolean;
  doubleStrike: boolean;
  firstStrike: boolean;
  deathtouch: boolean;
  lifelink: boolean;
  vigilance: boolean;
  unblockable: boolean;
  variableStats: boolean;
}

export interface CommanderDependencyV05 {
  name: string;
  dependsOnCommander: boolean;
  dependencyKind: string | null;
  oracleFragment: string | null;
}

export interface CombatSnapshotResultV05 {
  attackers: CombatCreatureV05[];
  blockers: CombatCreatureV05[];
  assignments: Array<{
    attacker: string;
    blockers: string[];
    attackerPower: number | null;
    damageToPlayer: number | null;
    attackerLikelyDies: boolean | null;
    blockersLikelyDie: string[];
    notes: string[];
  }>;
  estimatedDamageToDefender: number;
  estimatedCommanderDamage: Record<string, number>;
  unresolvedCombatMath: string[];
  caveats: string[];
}

function numericStat(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && String(parsed) === value.trim() ? parsed : null;
}

function normalizedKeywords(card: ScryfallCard): Set<string> {
  const combined = `${(card.keywords ?? []).join('\n')}\n${getCardOracleText(card)}`.toLowerCase();
  const output = new Set<string>();
  for (const keyword of [
    'flying', 'reach', 'menace', 'trample', 'double strike', 'first strike', 'deathtouch', 'lifelink', 'vigilance',
  ]) {
    if (new RegExp(`\\b${keyword.replace(' ', '\\s+')}\\b`, 'i').test(combined)) output.add(keyword);
  }
  return output;
}

export function toCombatCreatureV05(card: ScryfallCard): CombatCreatureV05 {
  const keywords = normalizedKeywords(card);
  const text = getCardOracleText(card);
  const power = numericStat(card.power ?? card.card_faces?.find((face) => face.power)?.power);
  const toughness = numericStat(card.toughness ?? card.card_faces?.find((face) => face.toughness)?.toughness);
  const variableStats = power === null || toughness === null;
  return {
    name: card.name,
    power,
    toughness,
    keywords: [...keywords],
    flying: keywords.has('flying'),
    reach: keywords.has('reach'),
    menace: keywords.has('menace'),
    trample: keywords.has('trample'),
    doubleStrike: keywords.has('double strike'),
    firstStrike: keywords.has('first strike'),
    deathtouch: keywords.has('deathtouch'),
    lifelink: keywords.has('lifelink'),
    vigilance: keywords.has('vigilance'),
    unblockable: /can['’]t be blocked|is unblockable/i.test(text),
    variableStats,
  };
}

export function analyzeCommanderDependencyV05(card: ScryfallCard): CommanderDependencyV05 {
  const text = getCardOracleText(card);
  const fragments = text.split(/\n|(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  const commanderFragment = fragments.find((fragment) => /\bcommander\b/i.test(fragment)) ?? null;
  if (!commanderFragment) {
    return { name: card.name, dependsOnCommander: false, dependencyKind: null, oracleFragment: null };
  }

  let dependencyKind = 'mentions commander';
  if (/if you control your commander/i.test(commanderFragment)) dependencyKind = 'requires commander controlled';
  else if (/as long as you control your commander/i.test(commanderFragment)) dependencyKind = 'requires commander controlled';
  else if (/commander you control/i.test(commanderFragment)) dependencyKind = 'affects commander you control';
  else if (/your commander/i.test(commanderFragment)) dependencyKind = 'references your commander';
  else if (/commander damage/i.test(commanderFragment)) dependencyKind = 'commander damage';

  return { name: card.name, dependsOnCommander: true, dependencyKind, oracleFragment: commanderFragment };
}

function canBlock(attacker: CombatCreatureV05, blocker: CombatCreatureV05): boolean {
  if (attacker.unblockable) return false;
  if (attacker.flying && !(blocker.flying || blocker.reach)) return false;
  return true;
}

function blockerToughness(blocker: CombatCreatureV05, attacker: CombatCreatureV05): number | null {
  if (blocker.toughness === null) return null;
  if (attacker.deathtouch) return blocker.toughness > 0 ? 1 : blocker.toughness;
  return blocker.toughness;
}

function attackerToughness(attacker: CombatCreatureV05, blockers: CombatCreatureV05[]): number | null {
  if (attacker.toughness === null) return null;
  if (blockers.some((blocker) => blocker.deathtouch)) return attacker.toughness > 0 ? 1 : attacker.toughness;
  return attacker.toughness;
}

function effectiveStrikeMultiplier(attacker: CombatCreatureV05): number {
  return attacker.doubleStrike ? 2 : 1;
}

function chooseBlockers(attacker: CombatCreatureV05, available: CombatCreatureV05[]): CombatCreatureV05[] {
  const legal = available.filter((blocker) => canBlock(attacker, blocker));
  if (legal.length === 0) return [];
  const needed = attacker.menace ? 2 : 1;
  if (legal.length < needed) return [];
  return legal
    .slice()
    .sort((a, b) => (b.power ?? 0) - (a.power ?? 0) || (b.toughness ?? 0) - (a.toughness ?? 0))
    .slice(0, needed);
}

export function simulateCombatSnapshotV05(
  attackerCards: ScryfallCard[],
  blockerCards: ScryfallCard[],
  commanderAttackers: string[] = [],
): CombatSnapshotResultV05 {
  const attackers = attackerCards.map(toCombatCreatureV05);
  const blockers = blockerCards.map(toCombatCreatureV05);
  const availableBlockers = [...blockers];
  const assignments: CombatSnapshotResultV05['assignments'] = [];
  const unresolvedCombatMath: string[] = [];
  let estimatedDamageToDefender = 0;
  const estimatedCommanderDamage: Record<string, number> = {};

  const orderedAttackers = attackers
    .slice()
    .sort((a, b) => (b.power ?? 0) - (a.power ?? 0));

  for (const attacker of orderedAttackers) {
    const chosen = chooseBlockers(attacker, availableBlockers);
    for (const blocker of chosen) {
      const index = availableBlockers.findIndex((candidate) => candidate.name === blocker.name);
      if (index >= 0) availableBlockers.splice(index, 1);
    }

    const notes: string[] = [];
    if (attacker.variableStats || chosen.some((blocker) => blocker.variableStats)) {
      unresolvedCombatMath.push(`${attacker.name}: variable or nonnumeric power/toughness requires board-state evaluation.`);
    }

    const attackerPower = attacker.power;
    let damageToPlayer: number | null = 0;
    let attackerLikelyDies: boolean | null = false;
    const blockersLikelyDie: string[] = [];

    if (chosen.length === 0) {
      damageToPlayer = attackerPower === null ? null : attackerPower * effectiveStrikeMultiplier(attacker);
      notes.push(attacker.unblockable ? 'No legal blocks because the attacker is unblockable.' : attacker.menace ? 'Fewer than two legal blockers were available for menace.' : 'No legal blocker was assigned.');
    } else if (attackerPower === null || chosen.some((blocker) => blocker.toughness === null || blocker.power === null)) {
      damageToPlayer = null;
      attackerLikelyDies = null;
      notes.push('Combat damage could not be fully resolved because at least one combatant has variable/non-numeric stats.');
    } else {
      let remainingPower = attackerPower;
      for (const blocker of chosen) {
        const lethal = blockerToughness(blocker, attacker);
        if (lethal === null) continue;
        if (remainingPower >= lethal) {
          blockersLikelyDie.push(blocker.name);
          remainingPower -= lethal;
        } else {
          remainingPower = 0;
        }
      }

      if (attacker.trample) {
        const strikeMultiplier = effectiveStrikeMultiplier(attacker);
        damageToPlayer = Math.max(0, remainingPower) * strikeMultiplier;
        notes.push('Trample assigns estimated excess damage to the defending player after lethal damage to assigned blockers.');
      } else {
        damageToPlayer = 0;
      }

      const incomingPower = chosen.reduce((sum, blocker) => sum + (blocker.power ?? 0), 0);
      const lethalToAttacker = attackerToughness(attacker, chosen);
      attackerLikelyDies = lethalToAttacker === null ? null : incomingPower >= lethalToAttacker;
      if (attacker.firstStrike || attacker.doubleStrike || chosen.some((blocker) => blocker.firstStrike || blocker.doubleStrike)) {
        notes.push('First/double strike is simplified in casualty ordering; exact survival can differ when first-strike damage removes creatures before normal damage.');
      }
    }

    if (damageToPlayer !== null) {
      estimatedDamageToDefender += damageToPlayer;
      if (commanderAttackers.some((name) => name.toLocaleLowerCase() === attacker.name.toLocaleLowerCase())) {
        estimatedCommanderDamage[attacker.name] = (estimatedCommanderDamage[attacker.name] ?? 0) + damageToPlayer;
      }
    }

    assignments.push({
      attacker: attacker.name,
      blockers: chosen.map((blocker) => blocker.name),
      attackerPower,
      damageToPlayer,
      attackerLikelyDies,
      blockersLikelyDie,
      notes,
    });
  }

  return {
    attackers,
    blockers,
    assignments,
    estimatedDamageToDefender,
    estimatedCommanderDamage,
    unresolvedCombatMath,
    caveats: [
      'V0.5 combat uses a greedy blocking heuristic rather than an optimal game-theoretic blocker assignment.',
      'Pump spells, activated abilities, damage prevention, replacement effects, goad, myriad, myriad-like copies, extra combats, attack taxes, annihilator, myriad triggers, and complex first/double-strike ordering require deeper state modeling.',
      'Variable power/toughness, characteristic-defining abilities, counters, equipment, auras, continuous effects, and lord effects must be supplied by a richer battlefield state before exact combat math is possible.',
    ],
  };
}
