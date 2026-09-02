import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

type ValidationControl = {
  id: string;
  metadataPath: string;
};

function workflowSources(): Array<{ path: string; source: string }> {
  return readdirSync('.github/workflows')
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map((name) => {
      const path = `.github/workflows/${name}`;
      return { path, source: readFileSync(path, 'utf8') };
    });
}

test('workflow actions are immutable and validation never mutates checked-in TypeScript', () => {
  for (const { path, source } of workflowSources()) {
    for (const match of source.matchAll(/^\s*uses:\s*([^\s#]+).*$/gm)) {
      const action = match[1];
      assert.ok(action, `${path} contains an empty action reference`);
      if (action.startsWith('./')) continue;
      assert.match(action, /^[^@\s]+@[0-9a-f]{40}$/, `${path} must pin ${action} to a full commit SHA`);
    }

    assert.doesNotMatch(
      source,
      /(?:Path\(['"](?:src|scripts)\/|(?:src|scripts)\/[^\s'"]+).*?(?:write_text|sed\s+-i)/s,
      `${path} must execute checked-in source instead of patching TypeScript during validation`,
    );
  }
});

test('every registered evidence writer regenerates and stages derived validation state', () => {
  const registry = JSON.parse(readFileSync('validation-registry.json', 'utf8')) as { controls: ValidationControl[] };
  const workflows = workflowSources();

  for (const control of registry.controls) {
    const writers = workflows.filter(({ source }) => source.includes(control.metadataPath));
    assert.ok(writers.length > 0, `${control.id} must have an evidence writer for ${control.metadataPath}`);
    for (const { path, source } of writers) {
      assert.match(source, /npm run validation:index/, `${path} must regenerate validation-index.json`);
      assert.match(source, /git add --[^\n]*validation-index\.json[^\n]*docs\/VALIDATION-STATE\.md/, `${path} must stage both generated validation views`);
    }
  }
});

test('the environment template documents every runtime configuration variable', () => {
  const configSource = readFileSync('src/config.ts', 'utf8');
  const template = readFileSync('.env.example', 'utf8');
  const configured = new Set([...configSource.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].map((match) => match[1]));
  const documented = new Set([...template.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]));
  const missing = [...configured].filter((name) => !documented.has(name));

  assert.deepEqual(missing, [], `undocumented runtime variables: ${missing.join(', ')}`);
});
