import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { gzipSync, gunzipSync } from 'node:zlib';
import { digest, evaluateAcceptance, type AcceptanceContract, type AcceptanceReceipt } from './acceptance-gate.js';
import { acceptanceStateErrors, loadAcceptancePolicy, validateAcceptedState } from './acceptance-state.js';

const source = 'a'.repeat(40);
function fixture(t: test.TestContext, scope: AcceptanceContract['scope'] = 'narrow') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mtg-acceptance-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const data = {
    productSourceSha: source, fixture: 'anonymous-control', runtime: 'node-22.23.2',
    inputSha256: 'b'.repeat(64), snapshotSha256: 'c'.repeat(64),
    engineering: true, truth: true, deckQuality: true, target: false,
  };
  const save = (filename: string, value: unknown) => {
    const bytes = typeof value === 'string' ? value : JSON.stringify(value);
    fs.writeFileSync(path.join(root, filename), bytes);
    return { path: filename, sha256: digest(bytes) };
  };
  const evidence = save('evidence.json', data);
  const deck = save('deck.txt', 'Synthetic complete-deck fixture, not a Commander-quality claim.');
  const contract: AcceptanceContract = {
    schemaVersion: 1, claimId: 'checkpoint', revision: 'synthetic-v1', evaluatorRevision: 'acceptance-v1', scope,
    productSourceSha: source, fixture: data.fixture, runtime: data.runtime, inputSha256: data.inputSha256, snapshotSha256: data.snapshotSha256,
    artifacts: [{ id: 'evidence', format: 'json', ...evidence }, { id: 'deck', format: 'text', ...deck }],
    fullDeckArtifactId: 'deck',
    bindings: (['productSourceSha', 'fixture', 'runtime', 'inputSha256', 'snapshotSha256'] as const).map(field => ({ field, artifact: 'evidence', pointer: `/${field}` })),
    observations: (['engineering', 'truth', 'deckQuality'] as const).map(dimension => ({ id: dimension, dimension, artifact: 'evidence', pointer: `/${dimension}`, equals: true })),
  };
  if (scope !== 'narrow') contract.observations.push({ id: 'target', dimension: 'target', artifact: 'evidence', pointer: '/target', equals: true });
  const narrative = save('review.md', 'Synthetic whole-deck review for regression tests only; no real product acceptance.');
  let receipt: AcceptanceReceipt;
  const review = { schemaVersion: 1, claimId: contract.claimId, productSourceSha: source, contractSha256: '', decision: 'accept', reviewer: 'synthetic-test', reviewerKind: 'agent', reviewedArtifacts: {} as Record<string, string>, narrative };
  const seal = () => {
    const ref = save('contract.json', contract);
    review.contractSha256 = ref.sha256;
    review.reviewedArtifacts = Object.fromEntries(contract.artifacts.map(a => [a.id, a.sha256]));
    receipt = { contract: ref, review: save('review.json', review) };
  };
  seal();
  return { root, contract, data, review, save, seal,
    receipt: () => receipt,
    policy: () => ({ ...loadAcceptancePolicy(), approvedContracts: { [contract.claimId]: receipt.contract.sha256 } }),
    run: () => evaluateAcceptance(root, receipt, { [contract.claimId]: receipt.contract.sha256 }),
  };
}

test('valid narrow repair passes without claiming the unmet target', t => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.outcome, 'pass');
  assert.equal(result.dimensions.target, 'unknown');
  const state = JSON.parse(fs.readFileSync('project-state.json', 'utf8'));
  state.experimental.developmentCheckpointSha = source;
  state.acceptanceReceipts = { checkpoint: f.receipt() };
  assert.deepEqual(validateAcceptedState(state, f.root, f.policy()), []);
  assert.equal(state.experimental.lastFullyValidatedExperimentalBaseline.sha, loadAcceptancePolicy().baseline.sha);
});

for (const field of ['productSourceSha', 'fixture', 'runtime', 'inputSha256', 'snapshotSha256'] as const) {
  test(`mismatched ${field} blocks acceptance even with correctly hashed evidence`, t => {
    const f = fixture(t);
    f.data[field] = 'wrong';
    Object.assign(f.contract.artifacts[0]!, f.save('evidence.json', f.data)); f.seal();
    assert.equal(f.run().outcome, 'fail');
    assert.ok(f.run().reasons.some(r => r.includes(`provenance mismatch: ${field}`)));
  });
}
for (const dimension of ['engineering', 'truth', 'deckQuality'] as const) {
  test(`failed ${dimension} is not masked by other passing dimensions`, t => {
    const f = fixture(t); f.data[dimension] = false;
    Object.assign(f.contract.artifacts[0]!, f.save('evidence.json', f.data)); f.seal();
    assert.equal(f.run().outcome, 'fail'); assert.equal(f.run().dimensions[dimension], 'fail');
  });
}
test('broad and target claims cannot omit target achievement', t => {
  for (const scope of ['broad', 'target'] as const) {
    const f = fixture(t, scope); assert.equal(f.run().outcome, 'fail');
    f.contract.observations.pop(); f.seal();
    assert.ok(f.run().reasons.some(r => r.includes('missing target')));
  }
});
for (const filename of ['evidence.json', 'deck.txt', 'review.json', 'review.md', 'contract.json']) {
  test(`missing ${filename} blocks acceptance`, t => {
    const f = fixture(t); fs.unlinkSync(path.join(f.root, filename));
    assert.equal(f.run().outcome, 'unknown');
  });
}
test('interrupted evidence persistence and edited summaries fail closed', t => {
  const f = fixture(t); f.save('evidence.json', '{"engineering":true');
  assert.equal(f.run().outcome, 'unknown');
  Object.assign(f.contract.artifacts[0]!, f.save('evidence.json', '{"engineering":true')); f.seal();
  assert.equal(f.run().outcome, 'unknown');
});
test('a missing required observation stays unknown, not false or pass', t => {
  const f = fixture(t); f.contract.observations[0]!.pointer = '/missing'; f.seal();
  assert.equal(f.run().outcome, 'unknown');
});
test('review must accept the exact claim, source, contract and artifacts', t => {
  const f = fixture(t); f.review.decision = 'reject'; f.seal(); assert.equal(f.run().outcome, 'fail');
  f.review.decision = 'accept'; f.review.productSourceSha = 'd'.repeat(40); f.seal(); assert.equal(f.run().outcome, 'fail');
  f.review.productSourceSha = source; f.seal();
  f.review.reviewedArtifacts.deck = 'e'.repeat(64);
  f.receipt().review = f.save('review.json', f.review);
  assert.equal(f.run().outcome, 'fail');
});
test('contract self-approval and removing requirements cannot evade pinned policy', t => {
  const f = fixture(t); const trusted = { checkpoint: f.receipt().contract.sha256 };
  f.contract.observations = f.contract.observations.map(o => ({ ...o, dimension: 'engineering' })); f.seal();
  assert.equal(evaluateAcceptance(f.root, f.receipt(), trusted).outcome, 'fail');
  assert.equal(f.run().outcome, 'fail');
});
test('path traversal and symlink evidence escapes are rejected', t => {
  const f = fixture(t); f.contract.artifacts[0]!.path = '../outside.json'; f.seal();
  assert.equal(f.run().outcome, 'unknown');
  fs.symlinkSync(path.resolve('project-state.json'), path.join(f.root, 'outside.json'));
  f.contract.artifacts[0]!.path = 'outside.json'; f.seal(); assert.equal(f.run().outcome, 'unknown');
});
test('gzip artifacts are verified before decoding', t => {
  const f = fixture(t); const bytes = gzipSync(JSON.stringify(f.data));
  fs.writeFileSync(path.join(f.root, 'data.json.gz'), bytes);
  Object.assign(f.contract.artifacts[0]!, { path: 'data.json.gz', sha256: digest(bytes), format: 'json-gzip' });
  f.seal(); assert.equal(f.run().outcome, 'pass');
});
test('existing B4 raw result remains target-failed even without a new complete review', t => {
  const f = fixture(t, 'target');
  const existing = fs.readFileSync('test-results/bench01-bracket4-comparison/8606761c4d2e29cebb980bb06520b6aced459a1b/bench01-counter-blitz-result.json.gz');
  const raw = JSON.parse(gunzipSync(existing).toString('utf8'));
  fs.writeFileSync(path.join(f.root, 'historical.json.gz'), existing);
  f.contract.artifacts.push({ id: 'historical', path: 'historical.json.gz', sha256: digest(existing), format: 'json-gzip' });
  f.contract.productSourceSha = raw.provenance.sourceSha;
  f.contract.bindings[0] = { field: 'productSourceSha', artifact: 'historical', pointer: '/provenance/sourceSha' };
  f.contract.observations.find(o => o.dimension === 'target')!.artifact = 'historical';
  f.contract.observations.find(o => o.dimension === 'target')!.pointer = '/qualityVerdict/achieved';
  f.seal(); fs.unlinkSync(path.join(f.root, 'review.json'));
  const result = f.run(); assert.equal(result.outcome, 'fail'); assert.equal(result.dimensions.target, 'fail');
  assert.ok(result.reasons.some(r => r.includes('whole-deck review unavailable')));
  // This is an adapter regression over preserved bytes, not new validation of historical runtime or deck quality.
});
test('accepted-state guard preserves current state and blocks unsupported promotions', () => {
  const state = JSON.parse(fs.readFileSync('project-state.json', 'utf8'));
  assert.deepEqual(acceptanceStateErrors(state), []);
  for (const change of [
    (s: typeof state) => { s.experimental.developmentCheckpointSha = source; },
    (s: typeof state) => { s.experimental.lastFullyValidatedExperimentalBaseline.sha = source; },
    (s: typeof state) => { s.stable.promotionAuthorized = true; },
    (s: typeof state) => { s.milestones.find((m: { id: string }) => m.id === 'INTEL-02').status = 'validated'; },
  ]) {
    const candidate = structuredClone(state); change(candidate);
    assert.ok(acceptanceStateErrors(candidate).length > 0);
  }
});
test('unapproved or interrupted policy persistence blocks all state validation', t => {
  const f = fixture(t); f.save('acceptance-policy.json', { ...loadAcceptancePolicy(), approvedContracts: { checkpoint: f.receipt().contract.sha256 } });
  assert.ok(acceptanceStateErrors(JSON.parse(fs.readFileSync('project-state.json', 'utf8')), f.root).some(e => e.includes('unapproved acceptance policy')));
});
