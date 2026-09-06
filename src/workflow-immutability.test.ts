import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const workflowsDir = resolve(process.cwd(), '.github', 'workflows');

const forbiddenSourceMutationPatterns: Array<{ label: string; pattern: RegExp }> = [
  {
    label: 'Python pathlib targets checked-in source',
    pattern: /\bPath\(\s*['"]src\//,
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
];

test('workflow actions validate checked-in source instead of generating or patching src/**', () => {
  const violations: string[] = [];

  for (const entry of readdirSync(workflowsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.ya?ml$/i.test(entry.name)) continue;

    const workflow = readFileSync(resolve(workflowsDir, entry.name), 'utf8');
    for (const { label, pattern } of forbiddenSourceMutationPatterns) {
      if (pattern.test(workflow)) {
        violations.push(`${entry.name}: ${label}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `GitHub Actions must execute checked-in Commander source. Move product edits onto the active branch before validation.\n${violations.join('\n')}`,
  );
});
