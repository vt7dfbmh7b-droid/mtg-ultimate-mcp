import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScryfallCard } from '../types/scryfall.js';
import { oracleMechanismSynergiesV15 } from './oracle-mechanism-synergy-v15.js';

function card(name: string, oracleText: string): ScryfallCard {
  return { name, oracle_text: oracleText } as ScryfallCard;
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
