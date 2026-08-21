import fs from 'node:fs';
import {
  PROJECT_STATE_PATH,
  readProjectState,
  validateProjectState,
  writeGeneratedProjectDocs,
} from './project-state-lib.js';

function valueAfter(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  return process.argv[index + 1] ?? null;
}

function boolValue(value: string | null): boolean | null {
  if (value === null) return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`Expected true/false, received ${value}`);
}

const state = readProjectState();
const activeMilestone = valueAfter('--active-milestone');
const checkpointSha = valueAfter('--checkpoint-sha');
const activeBranchStatus = valueAfter('--validation-status');
const marvelSourceSha = valueAfter('--marvel-source-sha');
const marvelOutcome = valueAfter('--marvel-outcome');
const marvelNote = valueAfter('--marvel-note');
const pause = boolValue(valueAfter('--pause-intelligence'));

if (activeMilestone !== null) {
  const target = state.milestones.find((milestone) => milestone.id === activeMilestone);
  if (!target) throw new Error(`Unknown milestone ${activeMilestone}`);
  for (const milestone of state.milestones) {
    if (milestone.status === 'active') milestone.status = 'paused';
  }
  target.status = 'active';
  state.workMode.activeMilestone = activeMilestone;
}
if (checkpointSha !== null) state.experimental.developmentCheckpointSha = checkpointSha;
if (activeBranchStatus !== null) state.validation.activeBranchStatus = activeBranchStatus;
if (marvelSourceSha !== null) state.validation.latestPersistedMarvelControl.sourceSha = marvelSourceSha;
if (marvelOutcome !== null) state.validation.latestPersistedMarvelControl.outcome = marvelOutcome;
if (marvelNote !== null) state.validation.latestPersistedMarvelControl.note = marvelNote;
if (pause !== null) state.workMode.intelligenceDevelopmentPaused = pause;

state.updatedAt = new Date().toISOString();
const errors = validateProjectState(state);
if (errors.length > 0) throw new Error(`Refusing invalid project-state update:\n${errors.map((error) => `- ${error}`).join('\n')}`);

fs.writeFileSync(PROJECT_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
writeGeneratedProjectDocs(state);
console.log(`Updated ${PROJECT_STATE_PATH} and generated recovery docs.`);
