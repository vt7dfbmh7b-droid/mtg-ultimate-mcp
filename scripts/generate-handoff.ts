import { readProjectState, validateProjectState, writeGeneratedProjectDocs } from './project-state-lib.js';

const state = readProjectState();
const errors = validateProjectState(state);
if (errors.length > 0) {
  console.error('Project state is invalid:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

writeGeneratedProjectDocs(state);
console.log('Generated docs/PROJECT-STATE.md and PROJECT_HANDOFF.md from project-state.json.');
