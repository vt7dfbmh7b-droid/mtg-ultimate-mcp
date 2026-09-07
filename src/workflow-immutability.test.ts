import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const workflowsDir = resolve(process.cwd(), '.github', 'workflows');

// Policy epoch: the clean checked-in head immediately after CI was changed to
// fetch full history. Every descendant must preserve workflow immutability even
// if an offending workflow is later deleted from the current tree.
const workflowPolicyEpochSha = '365a4c182a2c64ed91716fce15e173099d66e275';

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

test('self-deleting workflow mutations cannot disappear from validation provenance', () => {
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

  const commitList = git([
    'rev-list',
    '--reverse',
    `${workflowPolicyEpochSha}..HEAD`,
    '--',
    '.github/workflows',
  ]);
  const violations: string[] = [];

  for (const commit of commitList.split(/\s+/).filter(Boolean)) {
    const paths = git([
      'diff-tree',
      '--no-commit-id',
      '--name-only',
      '-r',
      commit,
      '--',
      '.github/workflows',
    ]);

    for (const path of paths.split('\n').map((value) => value.trim()).filter(Boolean)) {
      if (!/\.ya?ml$/i.test(path)) continue;
      const workflow = git(['show', `${commit}:${path}`], true);
      if (!workflow) continue; // deletion; any offending earlier version is scanned at its own commit.
      violations.push(...workflowViolations(`${commit.slice(0, 12)}:${path}`, workflow));
    }
  }

  assert.deepEqual(
    violations,
    [],
    `A workflow that mutates checked-in source or self-deletes remains a provenance failure even after it disappears from HEAD.\n${violations.join('\n')}`,
  );
});
