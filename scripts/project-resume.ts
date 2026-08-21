import fs from 'node:fs';
import { readProjectState } from './project-state-lib.js';
import { VALIDATION_INDEX_PATH, type ValidationIndex } from './validation-index-lib.js';

const state = readProjectState();
const index = JSON.parse(fs.readFileSync(VALIDATION_INDEX_PATH, 'utf8')) as ValidationIndex;
const active = state.milestones.find((milestone) => milestone.id === state.workMode.activeMilestone);
if (!active) throw new Error(`Active milestone ${state.workMode.activeMilestone} is missing from project state.`);
if (index.developmentCheckpointSha !== state.experimental.developmentCheckpointSha) {
  throw new Error('Validation index checkpoint does not match project-state development checkpoint.');
}

const pass = index.records.filter((record) => record.outcome === 'pass').map((record) => record.id);
const fail = index.records.filter((record) => record.outcome === 'fail').map((record) => record.id);
const unknown = index.records.filter((record) => record.outcome === 'unknown').map((record) => record.id);
const stale = index.records
  .filter((record) => record.sourceSha !== null && record.matchesDevelopmentCheckpoint === false)
  .map((record) => ({ id: record.id, sourceSha: record.sourceSha, outcome: record.outcome }));
const currentCheckpointEvidence = index.records
  .filter((record) => record.matchesDevelopmentCheckpoint === true)
  .map((record) => ({ id: record.id, outcome: record.outcome }));
const blockingScenarioEvidence = index.records
  .filter((record) => record.claimLevel === 'scenario-intelligence' && record.outcome !== 'pass')
  .map((record) => ({
    id: record.id,
    outcome: record.outcome,
    sourceSha: record.sourceSha,
    matchesDevelopmentCheckpoint: record.matchesDevelopmentCheckpoint,
    unmetPassConditions: record.unmetPassConditions,
  }));

const brief = {
  repository: state.repository,
  stable: {
    branch: state.stable.branch,
    version: state.stable.version,
    serverCurrent: state.stable.serverCurrent,
    promotionAuthorized: state.stable.promotionAuthorized,
  },
  experimental: {
    activeBranch: state.experimental.activeBranch,
    activePullRequest: state.experimental.activePullRequest,
    developmentCheckpointSha: state.experimental.developmentCheckpointSha,
    lastFullyValidatedExperimentalBaseline: state.experimental.lastFullyValidatedExperimentalBaseline,
  },
  workMode: {
    activeMilestone: active,
    intelligenceDevelopmentPaused: state.workMode.intelligenceDevelopmentPaused,
    reason: state.workMode.reason,
  },
  validation: {
    pass,
    fail,
    unknown,
    stale,
    currentCheckpointEvidence,
    blockingScenarioEvidence,
  },
  nextActions: state.nextActions,
};

console.log(JSON.stringify(brief, null, 2));
