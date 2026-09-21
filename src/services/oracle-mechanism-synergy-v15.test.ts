import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { oracleMechanismProtectedCardNamesV15, oracleMechanismSynergiesV15 } from './oracle-mechanism-synergy-v15.js';

function card(name: string, oracleText: string): ScryfallCard {
  return { name, oracle_text: oracleText, type_line: 'Artifact Creature' } as ScryfallCard;
}

test('detects a provider-text lifelink, life-gain counter, and counter-damage loop without card names', () => {
  const support = card('Generic Support', [
    'W, T: Another target creature you control gains lifelink until end of turn.',
    'Whenever you gain life, put a +1/+1 counter on target creature you control.',
  ].join('\n'));
  const outlet = card('Generic Outlet', 'Remove a +1/+1 counter from Generic Outlet: Generic Outlet deals 1 damage to any target.');

  assert.deepEqual(oracleMechanismSynergiesV15(support, [outlet]), [{
    id: 'lifelink-counter-damage-loop',
    partnerName: 'Generic Outlet',
    evidence: {
      candidateGrantsLifelink: true,
      candidateConvertsLifeGainToCounters: true,
      partnerConvertsCountersToDamage: true,
    },
  }]);
});

test('does not infer the loop when any required Oracle mechanism is absent', () => {
  const noLifelink = card('Counter Support', 'Whenever you gain life, put a +1/+1 counter on target creature you control.');
  const noCounterTrigger = card('Lifelink Support', 'T: Target creature you control gains lifelink until end of turn.');
  const wrongOutlet = card('Counter Outlet', 'Remove a +1/+1 counter from Counter Outlet: Draw a card.');
  const damageOutlet = card('Damage Outlet', 'Remove a +1/+1 counter from Damage Outlet: Damage Outlet deals 1 damage to any target.');

  assert.deepEqual(oracleMechanismSynergiesV15(noLifelink, [damageOutlet]), []);
  assert.deepEqual(oracleMechanismSynergiesV15(noCounterTrigger, [damageOutlet]), []);
  assert.deepEqual(oracleMechanismSynergiesV15(noCounterTrigger, [wrongOutlet]), []);
});

test('protects both sides of an already-present Oracle-derived closed mechanism', () => {
  const support = card('Generic Support', 'T: Another target creature you control gains lifelink until end of turn.\nWhenever you gain life, put a +1/+1 counter on target creature you control.');
  const outlet = card('Generic Outlet', 'Remove a +1/+1 counter from Generic Outlet: Generic Outlet deals 1 damage to any target.');

  assert.deepEqual([...oracleMechanismProtectedCardNamesV15([support, outlet])].sort(), ['generic outlet', 'generic support']);
});

test('does not protect false loops with recurring costs, restrictions, or a different damage source', () => {
  const support = card('Support', 'T: Another target creature you control gains lifelink until end of turn.\nWhenever you gain life, put a +1/+1 counter on target creature you control.');
  for (const oracle of [
    '{1}, Remove a +1/+1 counter from Outlet: Outlet deals 1 damage to any target.',
    '{T}, Remove a +1/+1 counter from Outlet: Outlet deals 1 damage to any target.',
    'Remove a +1/+1 counter from another creature: Outlet deals 1 damage to any target.',
    'Remove a +1/+1 counter from Outlet: Another permanent deals 1 damage to any target.',
    'Remove a +1/+1 counter from Outlet: Outlet deals 1 damage to any target. Activate only once each turn.',
  ]) {
    assert.deepEqual([...oracleMechanismProtectedCardNamesV15([support, card('Outlet', oracle)])], [], oracle);
  }
  const outlet = card('Outlet', 'Remove a +1/+1 counter from Outlet: Outlet deals 1 damage to any target.');
  for (const trigger of [
    'Whenever you gain life, if you gained at least 3 life, put a +1/+1 counter on target creature you control.',
    'Whenever you gain life, put a +1/+1 counter on target creature you control. This ability triggers only once each turn.',
  ]) {
    assert.deepEqual(oracleMechanismSynergiesV15(card('Support', `T: Target creature you control gains lifelink.\n${trigger}`), [outlet]), []);
  }
  assert.deepEqual(oracleMechanismSynergiesV15(support, [{ ...outlet, type_line: 'Artifact' }]), []);
  assert.deepEqual(oracleMechanismSynergiesV15({ ...support, card_faces: [{}, {}] as NonNullable<ScryfallCard['card_faces']> }, [outlet]), []);
  const increasedOutput = { ...support, oracle_text: `${support.oracle_text} If you control five creatures, put three +1/+1 counters on that creature instead.` };
  assert.deepEqual([...oracleMechanismProtectedCardNamesV15([increasedOutput, outlet])].sort(), ['outlet', 'support']);
});
