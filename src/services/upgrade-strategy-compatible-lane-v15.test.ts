import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compoundComponentCandidateLanesV15,
  requestedIdentityRoleSearchEnabledV15,
  strategyCompatibleCandidateLanesV15,
  upgradeStrategySearchClausesV15,
} from './upgrade.js';

type Candidate = {
  name: string;
  identityFit: boolean;
  componentFit?: boolean;
  strategyFit?: boolean;
  printingEligible?: boolean;
  anchorFit?: boolean;
};

test('typal role candidates use aligned normal lane before generic fallback', () => {
  const aligned = { name: 'Typal draw engine', identityFit: true };
  const generic = { name: 'Generic draw spell', identityFit: false };
  assert.deepEqual(
    strategyCompatibleCandidateLanesV15([generic, aligned], (candidate) => candidate.identityFit),
    [[aligned], [generic]],
  );
});

test('non-typal spells strategy uses the same aligned-first behavior', () => {
  const aligned = { name: 'Spellslinger interaction', identityFit: true };
  const generic = { name: 'Generic removal', identityFit: false };
  assert.deepEqual(
    strategyCompatibleCandidateLanesV15([generic, aligned], (candidate) => candidate.identityFit),
    [[aligned], [generic]],
  );
});

test('generic structural candidates remain available when no aligned option exists', () => {
  const first = { name: 'Generic ramp A', identityFit: false };
  const second = { name: 'Generic ramp B', identityFit: false };
  assert.deepEqual(
    strategyCompatibleCandidateLanesV15([first, second], (candidate) => candidate.identityFit),
    [[first, second]],
  );
});

test('generic fallback is entered only when aligned lane yields zero eligible printings', () => {
  const unavailable: Candidate = { name: 'Aligned unavailable', identityFit: true, printingEligible: false };
  const generic: Candidate = { name: 'Generic available', identityFit: false, printingEligible: true };
  const choose = (pool: Candidate[]) => {
    const out: Candidate[] = [];
    for (const lane of strategyCompatibleCandidateLanesV15(pool, (candidate) => candidate.identityFit)) {
      const before = out.length;
      out.push(...lane.filter((candidate) => candidate.printingEligible));
      if (out.length > before) break;
    }
    return out;
  };

  assert.deepEqual(choose([generic, unavailable]), [generic]);
  const available: Candidate = { name: 'Aligned available', identityFit: true, printingEligible: true };
  assert.deepEqual(choose([generic, available]), [available]);
});

test('explicit compound component is a distinct lane ahead of inferred strategy and generic utility', () => {
  const component: Candidate = { name: 'Requested mechanism', identityFit: true, componentFit: true, strategyFit: false };
  const strategy: Candidate = { name: 'Generic archetype payoff', identityFit: true, componentFit: false, strategyFit: true };
  const generic: Candidate = { name: 'Generic role card', identityFit: false, componentFit: false, strategyFit: false };
  assert.deepEqual(
    compoundComponentCandidateLanesV15(
      [strategy, generic, component],
      (candidate) => Boolean(candidate.componentFit),
      (candidate) => Boolean(candidate.strategyFit),
    ),
    [[component], [strategy], [generic]],
  );
});

test('compound component fallback advances to inferred strategy only when component printings are unavailable', () => {
  const component: Candidate = {
    name: 'Unavailable requested mechanism',
    identityFit: true,
    componentFit: true,
    strategyFit: false,
    printingEligible: false,
  };
  const strategy: Candidate = {
    name: 'Available inferred strategy',
    identityFit: true,
    componentFit: false,
    strategyFit: true,
    printingEligible: true,
  };
  const generic: Candidate = {
    name: 'Available generic role',
    identityFit: false,
    componentFit: false,
    strategyFit: false,
    printingEligible: true,
  };
  const lanes = compoundComponentCandidateLanesV15(
    [generic, strategy, component],
    (candidate) => Boolean(candidate.componentFit),
    (candidate) => Boolean(candidate.strategyFit),
  );
  const chosen: Candidate[] = [];
  for (const lane of lanes) {
    const before = chosen.length;
    chosen.push(...lane.filter((candidate) => candidate.printingEligible));
    if (chosen.length > before) break;
  }
  assert.deepEqual(chosen, [strategy]);
});

test('compound component fallback still reaches generic structural cards when neither aligned lane has an eligible printing', () => {
  const component: Candidate = {
    name: 'Unavailable requested mechanism', identityFit: true, componentFit: true, strategyFit: false, printingEligible: false,
  };
  const strategy: Candidate = {
    name: 'Unavailable inferred strategy', identityFit: true, componentFit: false, strategyFit: true, printingEligible: false,
  };
  const generic: Candidate = {
    name: 'Available generic role', identityFit: false, componentFit: false, strategyFit: false, printingEligible: true,
  };
  const lanes = compoundComponentCandidateLanesV15(
    [component, strategy, generic],
    (candidate) => Boolean(candidate.componentFit),
    (candidate) => Boolean(candidate.strategyFit),
  );
  const chosen: Candidate[] = [];
  for (const lane of lanes) {
    const before = chosen.length;
    chosen.push(...lane.filter((candidate) => candidate.printingEligible));
    if (chosen.length > before) break;
  }
  assert.deepEqual(chosen, [generic]);
});

test('spells-control supplemental recall includes actual Instant and Sorcery card types', () => {
  const clauses = upgradeStrategySearchClausesV15({
    commanderNames: ['Synthetic Commander'],
    strategies: [{ archetype: 'spells-control', score: 999, evidence: [] }],
  } as never);
  const clause = clauses.find((entry) => entry.archetype === 'spells-control')?.clause ?? '';
  assert.match(clause, /t:instant/);
  assert.match(clause, /t:sorcery/);
});


test('dominant compound anchor lane outranks secondary requested components without removing fallback', () => {
  const anchor: Candidate = { name: 'Identity anchor', identityFit: true, componentFit: true, anchorFit: true };
  const secondary: Candidate = { name: 'Secondary requested support', identityFit: true, componentFit: true, anchorFit: false };
  const strategy: Candidate = { name: 'Inferred strategy support', identityFit: true, componentFit: false, strategyFit: true };
  const generic: Candidate = { name: 'Generic role support', identityFit: false, componentFit: false };
  assert.deepEqual(compoundComponentCandidateLanesV15(
    [secondary, strategy, generic, anchor],
    (candidate) => Boolean(candidate.componentFit),
    (candidate) => Boolean(candidate.strategyFit),
    (candidate) => Boolean(candidate.anchorFit),
  ), [[anchor], [secondary], [strategy], [generic]]);
});

test('secondary requested component remains reachable when dominant anchor has no eligible printing', () => {
  const anchor: Candidate = { name: 'Unavailable anchor', identityFit: true, componentFit: true, anchorFit: true, printingEligible: false };
  const secondary: Candidate = { name: 'Available secondary', identityFit: true, componentFit: true, anchorFit: false, printingEligible: true };
  const generic: Candidate = { name: 'Available generic', identityFit: false, componentFit: false, printingEligible: true };
  const chosen: Candidate[] = [];
  for (const lane of compoundComponentCandidateLanesV15(
    [anchor, secondary, generic],
    (candidate) => Boolean(candidate.componentFit),
    (candidate) => Boolean(candidate.strategyFit),
    (candidate) => Boolean(candidate.anchorFit),
  )) {
    const before = chosen.length;
    chosen.push(...lane.filter((candidate) => candidate.printingEligible));
    if (chosen.length > before) break;
  }
  assert.deepEqual(chosen, [secondary]);
});


test('requested identity role discovery stays enabled after a theme minimum is already satisfied', () => {
  // Density satisfaction must not disable discovery of on-plan role replacements.
  assert.equal(requestedIdentityRoleSearchEnabledV15('t:elf'), true);
  assert.equal(requestedIdentityRoleSearchEnabledV15('t:instant OR t:sorcery'), true);
  assert.equal(requestedIdentityRoleSearchEnabledV15('t:enchantment'), true);
  assert.equal(requestedIdentityRoleSearchEnabledV15('(t:artifact OR t:enchantment) mv>=4'), true);
});

test('requested identity role discovery remains disabled when no explicit controlled identity exists', () => {
  assert.equal(requestedIdentityRoleSearchEnabledV15(''), false);
  assert.equal(requestedIdentityRoleSearchEnabledV15('   '), false);
});
