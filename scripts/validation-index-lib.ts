import fs from 'node:fs';
import path from 'node:path';
import type { ProjectState } from './project-state-lib.js';

export interface ValidationControlRegistration {
  id: string;
  label: string;
  claimLevel: string;
  milestones: string[];
  metadataPath: string;
  sourceKeys: string[];
  passWhen: Record<string, string>;
}

export interface ValidationRegistry {
  schemaVersion: number;
  controls: ValidationControlRegistration[];
}

export interface ValidationIndexRecord {
  id: string;
  label: string;
  claimLevel: string;
  milestones: string[];
  metadataPath: string;
  exists: boolean;
  sourceSha: string | null;
  outcome: 'pass' | 'fail' | 'unknown';
  matchesDevelopmentCheckpoint: boolean | null;
  metadata: Record<string, string>;
  unmetPassConditions: string[];
}

export interface ValidationIndex {
  schemaVersion: number;
  generatedFromProjectStateUpdatedAt: string;
  developmentCheckpointSha: string;
  records: ValidationIndexRecord[];
}

export const VALIDATION_REGISTRY_PATH = 'validation-registry.json';
export const VALIDATION_INDEX_PATH = 'validation-index.json';
export const VALIDATION_STATE_DOC_PATH = 'docs/VALIDATION-STATE.md';

function parseKeyValueFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index <= 0) continue;
    result[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return result;
}

export function readValidationRegistry(root = process.cwd()): ValidationRegistry {
  return JSON.parse(fs.readFileSync(path.join(root, VALIDATION_REGISTRY_PATH), 'utf8')) as ValidationRegistry;
}

export function buildValidationIndex(
  state: ProjectState,
  registry: ValidationRegistry,
  root = process.cwd(),
): ValidationIndex {
  const records = registry.controls.map((control): ValidationIndexRecord => {
    const filename = path.join(root, control.metadataPath);
    if (!fs.existsSync(filename)) {
      return {
        id: control.id,
        label: control.label,
        claimLevel: control.claimLevel,
        milestones: control.milestones,
        metadataPath: control.metadataPath,
        exists: false,
        sourceSha: null,
        outcome: 'unknown',
        matchesDevelopmentCheckpoint: null,
        metadata: {},
        unmetPassConditions: Object.entries(control.passWhen).map(([key, value]) => `${key}=${value}`),
      };
    }

    const metadata = parseKeyValueFile(fs.readFileSync(filename, 'utf8'));
    const sourceSha = control.sourceKeys.map((key) => metadata[key]).find((value): value is string => Boolean(value)) ?? null;
    const unmetPassConditions = Object.entries(control.passWhen)
      .filter(([key, value]) => metadata[key] !== value)
      .map(([key, value]) => `${key}=${value}`);
    const outcome: ValidationIndexRecord['outcome'] = unmetPassConditions.length === 0 ? 'pass' : 'fail';
    return {
      id: control.id,
      label: control.label,
      claimLevel: control.claimLevel,
      milestones: control.milestones,
      metadataPath: control.metadataPath,
      exists: true,
      sourceSha,
      outcome,
      matchesDevelopmentCheckpoint: sourceSha === null ? null : sourceSha === state.experimental.developmentCheckpointSha,
      metadata,
      unmetPassConditions,
    };
  });

  return {
    schemaVersion: 1,
    generatedFromProjectStateUpdatedAt: state.updatedAt,
    developmentCheckpointSha: state.experimental.developmentCheckpointSha,
    records,
  };
}

export function renderValidationState(index: ValidationIndex): string {
  const rows = index.records.map((record) => {
    const source = record.sourceSha ? `\`${record.sourceSha}\`` : 'unknown';
    const checkpoint = record.matchesDevelopmentCheckpoint === null
      ? 'unknown'
      : record.matchesDevelopmentCheckpoint ? 'yes' : 'no';
    return `| ${record.id} | ${record.claimLevel} | ${record.outcome} | ${source} | ${checkpoint} | \`${record.metadataPath}\` |`;
  });
  return `<!-- GENERATED FROM validation-registry.json + test-results + project-state.json. DO NOT EDIT BY HAND. -->\n# Ultimate MTG — Validation State\n\nDevelopment checkpoint: \`${index.developmentCheckpointSha}\`\n\n| Control | Claim level | Outcome | Tested source | Matches checkpoint | Metadata |\n|---|---|---|---|---|---|\n${rows.join('\n')}\n\n## Interpretation\n\n- **pass** means the registered pass conditions in that control's persisted metadata are satisfied.\n- **fail** means persisted metadata exists but one or more registered pass conditions are not satisfied.\n- **unknown** means the registered metadata file does not exist.\n- A pass whose tested source does not match the current development checkpoint is historical evidence, not proof of the checkpoint.\n- Scenario-intelligence controls must still be interpreted according to \`docs/VALIDATION-MATRIX.md\`; a passing process does not automatically prove broad Commander intelligence.\n`;
}

export function writeValidationIndex(index: ValidationIndex, root = process.cwd()): void {
  fs.writeFileSync(path.join(root, VALIDATION_INDEX_PATH), `${JSON.stringify(index, null, 2)}\n`);
  fs.writeFileSync(path.join(root, VALIDATION_STATE_DOC_PATH), renderValidationState(index));
}

export function validateValidationRegistry(registry: ValidationRegistry): string[] {
  const errors: string[] = [];
  if (registry.schemaVersion !== 1) errors.push(`Unsupported validation registry schemaVersion=${registry.schemaVersion}.`);
  const ids = registry.controls.map((control) => control.id);
  if (new Set(ids).size !== ids.length) errors.push('Validation control IDs must be unique.');
  for (const control of registry.controls) {
    if (!control.id.trim()) errors.push('Validation control ID is required.');
    if (!control.metadataPath.startsWith('test-results/')) errors.push(`${control.id} metadataPath must live under test-results/.`);
    if (control.sourceKeys.length === 0) errors.push(`${control.id} requires at least one source key.`);
    if (Object.keys(control.passWhen).length === 0) errors.push(`${control.id} requires at least one pass condition.`);
  }
  return errors;
}
