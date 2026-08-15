import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { analyzeCommanderDependencyV05, simulateCombatSnapshotV05, toCombatCreatureV05 } from './combat-v05.js';

let collector = 1;
function creature(name: string, power: string, toughness: string, oracleText = '', keywords: string[] = []): ScryfallCard {
  return {
    id: `${name}-${collector}`,
    name,
    lang: 'en',
    mana_cost: '{2}{G}',
    cmc: 3,
    type_line: 'Creature — Test',
    oracle_text: oracleText,
    color_identity: ['G'],
    keywords,
    legalities: { commander: 'legal' },
    power,
    toughness,
    set: 'tst',
    set_name: 'Test',
    collector_number: String(collector++),
    rarity: 'rare',
    prices: { usd: '1.00' },
    scryfall_uri: 'https://scryfall.com',
  };
}

test('flying attacker cannot be blocked by a ground creature', () => {
  const flyer = creature('Flyer', '3', '3', 'Flying', ['Flying']);
  const ground = creature('Ground', '4', '4');
  const result = simulateCombatSnapshotV05([flyer], [ground]);
  assert.equal(result.assignments[0]?.blockers.length, 0);
  assert.equal(result.estimatedDamageToDefender, 3);
});

test('reach can block flying', () => {
  const flyer = creature('Flyer', '3', '3', 'Flying', ['Flying']);
  const reach = creature('Reach', '2', '4', 'Reach', ['Reach']);
  const result = simulateCombatSnapshotV05([flyer], [reach]);
  assert.deepEqual(result.assignments[0]?.blockers, ['Reach']);
  assert.equal(result.estimatedDamageToDefender, 0);
});

test('menace needs two legal blockers', () => {
  const menace = creature('Menace', '4', '4', 'Menace', ['Menace']);
  const one = creature('One Blocker', '2', '2');
  const result = simulateCombatSnapshotV05([menace], [one]);
  assert.equal(result.assignments[0]?.blockers.length, 0);
  assert.equal(result.estimatedDamageToDefender, 4);
});

test('trample assigns excess damage after lethal', () => {
  const trampler = creature('Trampler', '6', '6', 'Trample', ['Trample']);
  const blocker = creature('Blocker', '2', '2');
  const result = simulateCombatSnapshotV05([trampler], [blocker]);
  assert.equal(result.estimatedDamageToDefender, 4);
  assert.deepEqual(result.assignments[0]?.blockersLikelyDie, ['Blocker']);
});

test('commander damage is tracked separately', () => {
  const commander = creature('Commander', '7', '7');
  const result = simulateCombatSnapshotV05([commander], [], ['Commander']);
  assert.equal(result.estimatedCommanderDamage.Commander, 7);
});

test('variable stats are not silently treated as zero', () => {
  const variable = creature('Variable', '*', '*');
  const profile = toCombatCreatureV05(variable);
  const result = simulateCombatSnapshotV05([variable], []);
  assert.equal(profile.variableStats, true);
  assert.equal(result.assignments[0]?.damageToPlayer, null);
  assert.equal(result.unresolvedCombatMath.length, 1);
});

test('commander-dependent text is surfaced', () => {
  const card = creature('Commander Helper', '2', '2', 'As long as you control your commander, Commander Helper gets +2/+2.');
  const dependency = analyzeCommanderDependencyV05(card);
  assert.equal(dependency.dependsOnCommander, true);
  assert.equal(dependency.dependencyKind, 'requires commander controlled');
});
