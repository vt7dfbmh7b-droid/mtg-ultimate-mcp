import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const workflowsDir = resolve(process.cwd(), '.github', 'workflows');

// Policy epoch: explicit interactive maintenance moved BENCH replay selection
// out of workflow edits and into an external request file. Autonomous descendants
// must not change .github/workflows/** at all. A future explicit interactive
// maintenance action may deliberately advance this SHA after reviewing the new
// workflow tree.
const workflowPolicyEpochSha = '7662e6adb4d1f6df931cfc8b477cb7994bbb3aba';

const forbiddenSourceMutationPatterns: Array<{ label: string; pattern: RegExp }> = [
  {
    label: 'Python pathlib targets checked-in source',
    pattern: /\bPath\(\s*['"]src\//,
  },
  {
    label: 'Python open targets checked-in source',
    pattern: /\bopen\(\s*['"]src\//,
  },
  {
    label: 'shell redirects output into checked-in source',
    pattern: /(?:^|\s)(?:>|>>)\s*['"]?src\//m,
  },
  {
    label: 'tee writes into checked-in source',
    pattern: /\btee\s+(?:-a\s+)?['"]?src\//,
  },
  {
    label: 'in-place shell editing targets checked-in source',
    pattern: /\b(?:sed\s+-i|perl\s+-pi(?:e)?)\b[^\n]*\bsrc\//,
  },
  {
    label: 'workflow stages checked-in source for a generated commit',
    pattern: /\bgit\s+add\b[^\n]*\bsrc(?:\/|\s|$)/m,
  },
  {
    label: 'workflow deletes workflow files during its own run',
    pattern: /\b(?:rm|git\s+rm)\b[^\n]*\.github\/workflows\//m,
  },
];

function workflowViolations(workflowName: string, workflow: string): string[] {
  const violations: string[] = [];
  for (const { label, pattern } of forbiddenSourceMutationPatterns) {
    if (pattern.test(workflow)) violations.push(`${workflowName}: ${label}`);
  }
  return violations;
}

function git(args: string[], allowFailure = false): string {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    if (allowFailure) return '';
    throw error;
  }
}

function gitSucceeded(args: string[]): boolean {
  return spawnSync('git', args, { stdio: 'ignore' }).status === 0;
}

test('workflow actions validate checked-in source instead of generating or patching src/**', () => {
  const violations: string[] = [];

  for (const entry of readdirSync(workflowsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.ya?ml$/i.test(entry.name)) continue;
    const workflow = readFileSync(resolve(workflowsDir, entry.name), 'utf8');
    violations.push(...workflowViolations(entry.name, workflow));
  }

  assert.deepEqual(
    violations,
    [],
    `GitHub Actions must execute checked-in Commander source. Move product edits onto the active branch before validation.\n${violations.join('\n')}`,
  );
});

test('autonomous lineage cannot change workflow files after the approved maintenance epoch', () => {
  assert.equal(
    gitSucceeded(['cat-file', '-e', `${workflowPolicyEpochSha}^{commit}`]),
    true,
    `Workflow policy epoch ${workflowPolicyEpochSha} must exist in the checkout.`,
  );
  assert.equal(
    gitSucceeded(['merge-base', '--is-ancestor', workflowPolicyEpochSha, 'HEAD']),
    true,
    `Workflow policy epoch ${workflowPolicyEpochSha} must remain an ancestor of HEAD.`,
  );

  const workflowChangingCommits = git([
    'rev-list',
    '--reverse',
    `${workflowPolicyEpochSha}..HEAD`,
    '--',
    '.github/workflows',
  ]);

  assert.equal(
    workflowChangingCommits,
    '',
    `No descendant of the approved workflow-policy epoch may change .github/workflows/** during autonomous development.\n` +
      `Observed workflow-changing commits:\n${workflowChangingCommits}\n` +
      `Only an explicit interactive repository-maintenance action may review the workflow change and deliberately advance workflowPolicyEpochSha.`,
  );

  const approvedWorkflowTree = git(['rev-parse', `${workflowPolicyEpochSha}:.github/workflows`]);
  const currentWorkflowTree = git(['rev-parse', 'HEAD:.github/workflows']);
  assert.equal(
    currentWorkflowTree,
    approvedWorkflowTree,
    'The current workflow tree must exactly match the explicitly approved maintenance epoch.',
  );
});
