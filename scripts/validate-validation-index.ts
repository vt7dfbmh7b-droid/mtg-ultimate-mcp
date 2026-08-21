import fs from 'node:fs';
import path from 'node:path';
import { readProjectState } from './project-state-lib.js';
import {
  VALIDATION_INDEX_PATH,
  VALIDATION_STATE_DOC_PATH,
  buildValidationIndex,
  readValidationRegistry,
  renderValidationState,
  validateValidationRegistry,
} from './validation-index-lib.js';

const state = readProjectState();
const registry = readValidationRegistry();
const errors = validateValidationRegistry(registry);
if (errors.length > 0) {
  console.error('Validation registry is invalid:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const expected = buildValidationIndex(state, registry);
const expectedJson = `${JSON.stringify(expected, null, 2)}\n`;
const expectedDoc = renderValidationState(expected);
const mismatches: string[] = [];
for (const [filename, content] of [
  [VALIDATION_INDEX_PATH, expectedJson],
  [VALIDATION_STATE_DOC_PATH, expectedDoc],
] as const) {
  const full = path.join(process.cwd(), filename);
  if (!fs.existsSync(full)) mismatches.push(`${filename} is missing; run npm run validation:index.`);
  else if (fs.readFileSync(full, 'utf8') !== content) mismatches.push(`${filename} is stale; run npm run validation:index.`);
}

if (mismatches.length > 0) {
  console.error('Validation index integrity failed:');
  for (const mismatch of mismatches) console.error(`- ${mismatch}`);
  process.exit(1);
}

console.log(`Validation index integrity OK for ${expected.records.length} registered controls.`);
