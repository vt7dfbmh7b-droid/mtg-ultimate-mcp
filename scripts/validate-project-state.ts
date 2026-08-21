import { generatedDocsMatch, readProjectState, validateProjectState } from './project-state-lib.js';

const state = readProjectState();
const errors = [...validateProjectState(state), ...generatedDocsMatch(state)];
if (errors.length > 0) {
  console.error('Project-management integrity check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Project-management integrity OK. Active milestone=${state.workMode.activeMilestone}; branch=${state.experimental.activeBranch}.`);
