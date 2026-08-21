import { readProjectState } from './project-state-lib.js';
import {
  buildValidationIndex,
  readValidationRegistry,
  validateValidationRegistry,
  writeValidationIndex,
} from './validation-index-lib.js';

const state = readProjectState();
const registry = readValidationRegistry();
const errors = validateValidationRegistry(registry);
if (errors.length > 0) {
  console.error('Validation registry is invalid:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const index = buildValidationIndex(state, registry);
writeValidationIndex(index);
console.log(`Built validation-index.json with ${index.records.length} registered controls.`);
