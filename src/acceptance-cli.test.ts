import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

// Exercise the existing update/validate entry points in isolated copies only.
// The documented tsx loader runs directly under Node; no tsx CLI IPC socket is needed.
function copyState(t: test.TestContext): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mtg-state-cli-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const file of ['project-state.json', 'acceptance-policy.json', 'PROJECT_HANDOFF.md', 'validation-index.json', 'validation-registry.json', 'ULTIMATE_MTG_SPEC.md', 'docs']) {
    fs.cpSync(file, path.join(root, file), { recursive: true });
  }
  return root;
}
function run(root: string, script: string, args: string[] = []) {
  return spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), path.resolve(`scripts/${script}.ts`), ...args], { cwd: root, encoding: 'utf8', timeout: 30_000 });
}
function saved(root: string): string[] {
  return ['project-state.json', 'PROJECT_HANDOFF.md', 'docs/PROJECT-STATE.md', 'validation-index.json', 'docs/VALIDATION-STATE.md'].map(f => fs.readFileSync(path.join(root, f), 'utf8'));
}
test('existing project:update refuses unsupported checkpoint before writing any state surface', t => {
  const root = copyState(t); const before = saved(root);
  const result = run(root, 'update-project-state', ['--checkpoint-sha', 'a'.repeat(40)]);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /checkpoint acceptance blocked/);
  assert.deepEqual(saved(root), before);
});
test('existing project:validate catches direct accepted-state edits', t => {
  const root = copyState(t);
  const state = JSON.parse(fs.readFileSync(path.join(root, 'project-state.json'), 'utf8'));
  state.experimental.lastFullyValidatedExperimentalBaseline.sha = 'a'.repeat(40);
  fs.writeFileSync(path.join(root, 'project-state.json'), JSON.stringify(state));
  const result = run(root, 'validate-project-state');
  assert.equal(result.status, 1, result.stderr); assert.match(result.stderr, /baseline acceptance blocked/);
});
test('interrupted policy write blocks normal updater without altering state', t => {
  const root = copyState(t); const before = saved(root);
  fs.writeFileSync(path.join(root, 'acceptance-policy.json'), '{');
  const result = run(root, 'update-project-state', ['--validation-status', 'candidate']);
  assert.equal(result.status, 1, result.stderr); assert.match(result.stderr, /acceptance policy/);
  assert.deepEqual(saved(root), before);
});
test('interrupted project-state persistence is rejected, not regenerated as accepted', t => {
  const root = copyState(t); fs.writeFileSync(path.join(root, 'project-state.json'), '{');
  const before = saved(root);
  assert.equal(run(root, 'update-project-state', ['--validation-status', 'candidate']).status, 1);
  assert.deepEqual(saved(root), before);
});
