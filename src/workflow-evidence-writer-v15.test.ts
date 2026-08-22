import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const activeWriterPaths = [
  '.github/workflows/marvel-bracket5-live.yml',
  '.github/workflows/marvel-bracket5-refine-live.yml',
  '.github/workflows/middle-earth-bracket5-expanded-live.yml',
  '.github/workflows/middle-earth-precon-refine-live.yml',
  '.github/workflows/project-state-integrity.yml',
] as const;

function workflow(path: string): string {
  return readFileSync(path, 'utf8');
}

test('active evidence writers execute independently instead of sharing a cancelling pending queue', () => {
  const groups = activeWriterPaths.map((path) => {
    const source = workflow(path);
    const match = source.match(/^concurrency:\n  group: (.+)\n  cancel-in-progress: false$/m);
    assert.ok(match, `${path} must use a non-cancelling workflow concurrency group`);
    assert.doesNotMatch(source, /ultimate-mtg-evidence-writer/);
    return match[1];
  });

  assert.equal(new Set(groups).size, activeWriterPaths.length, 'active writers must not share one pending-run concurrency group');
});

test('every active evidence push retries from the latest branch head', () => {
  for (const path of activeWriterPaths) {
    const source = workflow(path);
    const pushCount = [...source.matchAll(/git push origin "HEAD:\$\{GITHUB_REF_NAME\}"/g)].length;
    const retryCount = [...source.matchAll(/for attempt in 1 2 3 4 5 6 7 8; do/g)].length;

    assert.ok(pushCount > 0, `${path} must persist at least one evidence commit`);
    assert.equal(retryCount, pushCount, `${path} must wrap every evidence push in its own bounded retry loop`);
    assert.match(source, /git fetch origin "refs\/heads\/\$\{GITHUB_REF_NAME\}:refs\/remotes\/origin\/\$\{GITHUB_REF_NAME\}"/);
    assert.match(source, /git reset --hard "origin\/\$\{GITHUB_REF_NAME\}"/);
    assert.match(source, /exhausted eight branch-race retries/);
  }
});

test('live controls gate intelligence and persistence independently', () => {
  const focused = workflow('.github/workflows/marvel-bracket5-refine-live.yml');
  const broad = workflow('.github/workflows/marvel-bracket5-live.yml');
  const middleEarth = workflow('.github/workflows/middle-earth-bracket5-expanded-live.yml');
  const middleEarthPrecon = workflow('.github/workflows/middle-earth-precon-refine-live.yml');

  assert.match(focused, /name: Require checked-in-source scenario intelligence/);
  assert.match(focused, /name: Require checked-in-source result persistence/);
  assert.match(broad, /name: Require Marvel controls to execute successfully/);
  assert.match(broad, /name: Require live-result persistence/);
  assert.match(middleEarth, /name: Require expanded control success/);
  assert.match(middleEarth, /name: Require evidence persistence/);
  assert.match(middleEarthPrecon, /name: Require checked-in-source precon intelligence/);
  assert.match(middleEarthPrecon, /name: Require checked-in-source precon evidence persistence/);
});

test('focused Marvel live refinement allows bounded provider backoff to finish', () => {
  const source = readFileSync('scripts/e2e-marvel-bracket5-refine-v15.ts', 'utf8');
  assert.match(source, /timeout: 15 \* 60_000/);
  assert.doesNotMatch(source, /timeout: 10 \* 60_000/);
});

test('Middle-earth precon evidence separates execution, hard truth, target quality and strategy quality', () => {
  const workflowSource = workflow('.github/workflows/middle-earth-precon-refine-live.yml');
  const controlSource = readFileSync('scripts/e2e-middle-earth-precon-refine-v15.ts', 'utf8');

  assert.match(controlSource, /timeout: 15 \* 60_000/);
  assert.match(workflowSource, /execution_outcome=%s/);
  assert.match(workflowSource, /hard_truth_outcome=%s/);
  assert.match(workflowSource, /target_quality_outcome=%s/);
  assert.match(workflowSource, /strategy_preservation_outcome=%s/);
  assert.match(workflowSource, /progress\.regressedStructuralFloor/);
  assert.match(workflowSource, /after\.foodLifegainSupportCount/);
  assert.match(workflowSource, /food_lifegain_identity_required=true/);
  assert.match(workflowSource, /structural_floors_required=true/);
  assert.match(workflowSource, /persistent_colored_mana_floor=true/);
  assert.match(workflowSource, /negative_win_evidence_complete=true/);
});

test('Marvel controls fail closed on whole-deck quality and persistent colored-mana access', () => {
  const focused = workflow('.github/workflows/marvel-bracket5-refine-live.yml');
  const broad = workflow('.github/workflows/marvel-bracket5-live.yml');

  assert.match(focused, /persistent_colored_mana_floor=true/);
  assert.match(focused, /Number\.isFinite\(startingColoredMana\)/);
  assert.match(focused, /Number\.isFinite\(afterSources\)/);

  assert.match(broad, /name: Require broad whole-deck target and mana quality/);
  assert.match(broad, /name: Require broad cut-strategy evidence/);
  assert.match(broad, /target_quality_outcome=%s/);
  assert.match(broad, /strategy_preservation_outcome=%s/);
  assert.match(broad, /persistent_colored_mana_floor=true/);
  assert.match(broad, /Number\.isFinite\(beforeValue\)/);
  assert.match(broad, /Number\.isFinite\(afterSources\)/);
});
