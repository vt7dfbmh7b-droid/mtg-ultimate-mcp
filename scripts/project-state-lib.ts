import fs from 'node:fs';
import path from 'node:path';

export type MilestoneStatus =
  | 'planned'
  | 'active'
  | 'paused'
  | 'paused-validation-pending'
  | 'blocked'
  | 'implemented-validation-pending'
  | 'validated'
  | 'superseded';

export interface ProjectMilestone {
  id: string;
  name: string;
  status: MilestoneStatus;
  goal: string;
}

export interface ProjectState {
  schemaVersion: number;
  updatedAt: string;
  repository: string;
  northStar: string;
  stable: {
    branch: string;
    version: string;
    serverCurrent: string;
    promotionAuthorized: boolean;
  };
  experimental: {
    activeBranch: string;
    activePullRequest: number | null;
    developmentCheckpointSha: string;
    developmentCheckpointNote: string;
    lastFullyValidatedExperimentalBaseline: {
      branch: string;
      sha: string;
      scope: string;
    };
  };
  workMode: {
    intelligenceDevelopmentPaused: boolean;
    activeMilestone: string;
    reason: string;
  };
  milestones: ProjectMilestone[];
  validation: {
    activeBranchStatus: string;
    latestPersistedMarvelControl: {
      sourceSha: string;
      outcome: string;
      note: string;
    };
    requiredBeforeResumingIntelligenceClaims: string[];
  };
  truthBoundary: string[];
  nextActions: string[];
  handoffProtocol: {
    readFirst: string[];
    then: string;
    compatibilityEntryPoint: string;
  };
}

export const PROJECT_STATE_PATH = 'project-state.json';
export const GENERATED_STATE_PATH = 'docs/PROJECT-STATE.md';
export const GENERATED_HANDOFF_PATH = 'PROJECT_HANDOFF.md';

const GENERATED_HEADER = '<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->';

export function readProjectState(root = process.cwd()): ProjectState {
  const filename = path.join(root, PROJECT_STATE_PATH);
  return JSON.parse(fs.readFileSync(filename, 'utf8')) as ProjectState;
}

function bullets(values: readonly string[]): string {
  return values.length > 0 ? values.map((value) => `- ${value}`).join('\n') : '- None recorded.';
}

function milestoneTable(state: ProjectState): string {
  const rows = state.milestones.map((m) => `| ${m.id} | ${m.name} | ${m.status} | ${m.goal} |`);
  return ['| ID | Milestone | Status | Goal |', '|---|---|---|---|', ...rows].join('\n');
}

export function renderProjectState(state: ProjectState): string {
  return `${GENERATED_HEADER}\n# Ultimate MTG — Project State\n\nGenerated from \`project-state.json\`. Last state update: **${state.updatedAt}**.\n\n## Current mode\n\n- Repository: \`${state.repository}\`\n- Active experimental branch: \`${state.experimental.activeBranch}\`\n- Active PR: ${state.experimental.activePullRequest === null ? 'none' : `#${state.experimental.activePullRequest}`}\n- Active milestone: **${state.workMode.activeMilestone}**\n- Intelligence development paused: **${state.workMode.intelligenceDevelopmentPaused ? 'yes' : 'no'}**\n- Reason: ${state.workMode.reason}\n\n## Stable boundary\n\n- Branch: \`${state.stable.branch}\`\n- Version: \`${state.stable.version}\`\n- \`server-current\`: ${state.stable.serverCurrent}\n- Stable promotion authorized: **${state.stable.promotionAuthorized ? 'yes' : 'no'}**\n\n## Experimental checkpoints\n\nDevelopment checkpoint at pause: \`${state.experimental.developmentCheckpointSha}\`\n\n${state.experimental.developmentCheckpointNote}\n\nLatest fully validated executable experimental baseline recorded by project state:\n\n- Branch: \`${state.experimental.lastFullyValidatedExperimentalBaseline.branch}\`\n- SHA: \`${state.experimental.lastFullyValidatedExperimentalBaseline.sha}\`\n- Scope: ${state.experimental.lastFullyValidatedExperimentalBaseline.scope}\n\nAlways inspect the live active-branch head before editing. A later documentation/project-management commit is not automatically a new executable validation milestone.\n\n## Milestones\n\n${milestoneTable(state)}\n\n## Current validation status\n\n- Active branch status: **${state.validation.activeBranchStatus}**\n- Last persisted Marvel control source: \`${state.validation.latestPersistedMarvelControl.sourceSha}\`\n- Last persisted Marvel control outcome: **${state.validation.latestPersistedMarvelControl.outcome}**\n- Note: ${state.validation.latestPersistedMarvelControl.note}\n\nRequired before resuming broad INTEL-01/INTEL-02 claims:\n\n${bullets(state.validation.requiredBeforeResumingIntelligenceClaims)}\n\n## Next actions\n\n${state.nextActions.map((value, index) => `${index + 1}. ${value}`).join('\n')}\n\n## Permanent truth boundary\n\n${bullets(state.truthBoundary)}\n\n## Fresh-chat recovery\n\nRead in this order:\n\n${state.handoffProtocol.readFirst.map((value, index) => `${index + 1}. \`${value}\``).join('\n')}\n\nThen: ${state.handoffProtocol.then}\n`;
}

export function renderHandoff(state: ProjectState): string {
  const active = state.milestones.find((m) => m.id === state.workMode.activeMilestone);
  return `${GENERATED_HEADER}\n# Ultimate MTG — Project Handoff\n\nThis is the short compatibility handoff. **\`project-state.json\` is the authoritative current-state source.**\n\n## Resume in under five minutes\n\n1. Read \`project-state.json\` and \`docs/PROJECT-STATE.md\`.\n2. Read \`validation-index.json\` and \`docs/VALIDATION-STATE.md\` to identify current versus stale registered evidence.\n3. Inspect live head of \`${state.experimental.activeBranch}\` and PR ${state.experimental.activePullRequest === null ? '(none)' : `#${state.experimental.activePullRequest}`}.\n4. Read \`ULTIMATE_MTG_SPEC.md\`, then only the decision/failure/validation docs relevant to the active milestone.\n5. Continue from the Next actions below. Do not reconstruct old chats unless state integrity fails.\n\n## Current mode\n\n- Active milestone: **${state.workMode.activeMilestone}${active ? ` — ${active.name}` : ''}**\n- Intelligence development paused: **${state.workMode.intelligenceDevelopmentPaused ? 'yes' : 'no'}**\n- Experimental branch: \`${state.experimental.activeBranch}\`\n- Development checkpoint at pause: \`${state.experimental.developmentCheckpointSha}\`\n- Active branch validation: **${state.validation.activeBranchStatus}**\n\n## Audit reuse rule

${state.handoffProtocol.then}

## Stable safety boundary\n\nStable remains **${state.stable.serverCurrent} / ${state.stable.version}** on \`${state.stable.branch}\`. No merge, stable/current promotion, version bump or release is authorized by this handoff.\n\n## Latest fully validated executable experimental baseline\n\n\`${state.experimental.lastFullyValidatedExperimentalBaseline.sha}\` on \`${state.experimental.lastFullyValidatedExperimentalBaseline.branch}\`.\n\n${state.experimental.lastFullyValidatedExperimentalBaseline.scope}\n\n## Important pending validation\n\nThe last persisted Marvel control is \`${state.validation.latestPersistedMarvelControl.sourceSha}\` with outcome **${state.validation.latestPersistedMarvelControl.outcome}**. ${state.validation.latestPersistedMarvelControl.note}\n\n## Next actions\n\n${state.nextActions.map((value, index) => `${index + 1}. ${value}`).join('\n')}\n\n## Permanent recovery references\n\n- \`validation-index.json\` / \`docs/VALIDATION-STATE.md\` — consolidated registered validation status.\n- \`ULTIMATE_MTG_SPEC.md\` — north-star behavior.\n- \`docs/ROADMAP.md\` — milestone plan.\n- \`docs/DECISIONS.md\` — durable architectural decisions.\n- \`docs/KNOWN-FAILURES.md\` — failures that must remain prevented.\n- \`docs/VALIDATION-MATRIX.md\` — what each test/control actually proves.\n- \`docs/PROJECT-MANAGEMENT.md\` — recovery/update protocol.\n`;
}

export function writeGeneratedProjectDocs(state: ProjectState, root = process.cwd()): void {
  fs.writeFileSync(path.join(root, GENERATED_STATE_PATH), renderProjectState(state));
  fs.writeFileSync(path.join(root, GENERATED_HANDOFF_PATH), renderHandoff(state));
}

function isSha(value: string): boolean {
  return /^[0-9a-f]{40}$/i.test(value);
}

export function validateProjectState(state: ProjectState, root = process.cwd()): string[] {
  const errors: string[] = [];
  if (state.schemaVersion !== 1) errors.push(`Unsupported schemaVersion=${state.schemaVersion}; expected 1.`);
  if (!state.repository.includes('/')) errors.push('repository must use owner/name form.');
  if (!state.experimental.activeBranch.trim()) errors.push('experimental.activeBranch is required.');
  if (!isSha(state.experimental.developmentCheckpointSha)) errors.push('developmentCheckpointSha must be a full 40-character Git SHA.');
  if (!isSha(state.experimental.lastFullyValidatedExperimentalBaseline.sha)) errors.push('validated baseline SHA must be a full 40-character Git SHA.');
  if (state.stable.promotionAuthorized) errors.push('Stable promotion must remain false unless explicitly authorized by the user.');
  const ids = state.milestones.map((m) => m.id);
  if (new Set(ids).size !== ids.length) errors.push('Milestone IDs must be unique.');
  const active = state.milestones.filter((m) => m.status === 'active');
  if (active.length !== 1) errors.push(`Exactly one active milestone is required; found ${active.length}.`);
  if (!ids.includes(state.workMode.activeMilestone)) errors.push(`Active milestone ${state.workMode.activeMilestone} is not present in milestones.`);
  if (active[0]?.id !== state.workMode.activeMilestone) errors.push('workMode.activeMilestone must match the milestone whose status is active.');
  if (state.nextActions.length === 0) errors.push('At least one next action is required.');
  if (state.handoffProtocol.readFirst[0] !== PROJECT_STATE_PATH) errors.push('Fresh-chat recovery must read project-state.json first.');
  if (!state.handoffProtocol.readFirst.includes('validation-index.json')) errors.push('Fresh-chat recovery must include validation-index.json.');
  if (!state.handoffProtocol.readFirst.includes('docs/VALIDATION-STATE.md')) errors.push('Fresh-chat recovery must include docs/VALIDATION-STATE.md.');
  for (const filename of [
    'ULTIMATE_MTG_SPEC.md',
    'validation-registry.json',
    'validation-index.json',
    'docs/VALIDATION-STATE.md',
    'docs/ROADMAP.md',
    'docs/DECISIONS.md',
    'docs/VALIDATION-MATRIX.md',
    'docs/KNOWN-FAILURES.md',
    'docs/PROJECT-MANAGEMENT.md',
  ]) {
    if (!fs.existsSync(path.join(root, filename))) errors.push(`Required recovery file missing: ${filename}`);
  }
  return errors;
}

export function generatedDocsMatch(state: ProjectState, root = process.cwd()): string[] {
  const mismatches: string[] = [];
  const expected = new Map<string, string>([
    [GENERATED_STATE_PATH, renderProjectState(state)],
    [GENERATED_HANDOFF_PATH, renderHandoff(state)],
  ]);
  for (const [filename, content] of expected) {
    const full = path.join(root, filename);
    if (!fs.existsSync(full)) {
      mismatches.push(`${filename} is missing; run npm run project:handoff.`);
      continue;
    }
    if (fs.readFileSync(full, 'utf8') !== content) mismatches.push(`${filename} is stale; run npm run project:handoff.`);
  }
  return mismatches;
}
