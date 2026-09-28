import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { z } from 'zod';

// This is a software gate, not a substitute for separately owned server policy.
export const EVALUATOR_REVISION = 'acceptance-v1';
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const sha = z.string().regex(/^[0-9a-f]{40}$/);
const name = z.string().trim().min(1);
const dimension = z.enum(['engineering', 'truth', 'deckQuality', 'target']);
const scalar = z.union([z.boolean(), z.number().finite(), z.string(), z.null()]);
const file = z.object({ path: name, sha256 }).strict();
const observation = z.object({
  id: name, dimension, artifact: name, pointer: z.string().startsWith('/'), equals: scalar,
}).strict();
const binding = z.object({
  field: z.enum(['productSourceSha', 'fixture', 'runtime', 'inputSha256', 'snapshotSha256']),
  artifact: name, pointer: z.string().startsWith('/'),
}).strict();
export const contractSchema = z.object({
  schemaVersion: z.literal(1), claimId: name, revision: name,
  evaluatorRevision: z.literal(EVALUATOR_REVISION),
  scope: z.enum(['narrow', 'broad', 'target']), productSourceSha: sha,
  fixture: name, runtime: name, inputSha256: sha256, snapshotSha256: sha256,
  artifacts: z.array(file.extend({ id: name, format: z.enum(['json', 'json-gzip', 'text']) })).min(1),
  bindings: z.array(binding).min(5), observations: z.array(observation).min(3),
  fullDeckArtifactId: name,
}).strict();
export type AcceptanceContract = z.infer<typeof contractSchema>;
export const receiptSchema = z.object({ contract: file, review: file }).strict();
export type AcceptanceReceipt = z.infer<typeof receiptSchema>;
const reviewSchema = z.object({
  schemaVersion: z.literal(1), claimId: name, productSourceSha: sha,
  contractSha256: sha256, decision: z.enum(['accept', 'reject']),
  reviewer: name, reviewerKind: z.enum(['agent', 'human']),
  reviewedArtifacts: z.record(z.string(), sha256), narrative: file,
}).strict();
export type Outcome = 'pass' | 'fail' | 'unknown';
export interface AcceptanceResult {
  claimId: string | null;
  productSourceSha: string | null;
  scope: AcceptanceContract['scope'] | null;
  outcome: Outcome;
  dimensions: Record<z.infer<typeof dimension>, Outcome>;
  reasons: string[];
}
export function digest(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}
function localFile(root: string, relative: string): string {
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) throw new Error('unsafe evidence path');
  const base = fs.realpathSync(root);
  const actual = fs.realpathSync(path.resolve(base, relative));
  if (!actual.startsWith(base + path.sep)) throw new Error('evidence path escapes repository');
  return actual;
}
function checkedRead(root: string, ref: z.infer<typeof file>): Buffer {
  const content = fs.readFileSync(localFile(root, ref.path));
  if (digest(content) !== ref.sha256) throw new Error(`artifact hash mismatch: ${ref.path}`);
  return content;
}
function pointer(value: unknown, location: string): unknown {
  return location.slice(1).split('/').reduce<unknown>((current, raw) => {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (current === null || typeof current !== 'object' || !Object.hasOwn(current, key)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}
const fields = ['productSourceSha', 'fixture', 'runtime', 'inputSha256', 'snapshotSha256'] as const;
const dimensions = ['engineering', 'truth', 'deckQuality', 'target'] as const;
function contractErrors(contract: AcceptanceContract): string[] {
  const errors: string[] = [];
  const ids = contract.artifacts.map(a => a.id);
  if (new Set(ids).size !== ids.length) errors.push('duplicate artifact IDs');
  if (new Set(contract.observations.map(o => o.id)).size !== contract.observations.length) errors.push('duplicate observation IDs');
  if (!ids.includes(contract.fullDeckArtifactId)) errors.push('missing full-deck artifact');
  for (const field of fields) if (contract.bindings.filter(b => b.field === field).length !== 1) errors.push(`require exactly one ${field} binding`);
  for (const dimension of dimensions) {
    if (dimension === 'target' && contract.scope === 'narrow') continue;
    if (!contract.observations.some(o => o.dimension === dimension)) errors.push(`missing ${dimension} requirements`);
  }
  for (const o of [...contract.bindings, ...contract.observations]) {
    if (!contract.artifacts.some(a => a.id === o.artifact && a.format !== 'text')) errors.push(`invalid structured artifact: ${o.artifact}`);
  }
  return errors;
}

/** approvedContracts must come from reviewed policy, never from the evidence submission. */
export function evaluateAcceptance(root: string, input: unknown, approvedContracts: Readonly<Record<string, string>>): AcceptanceResult {
  const result: AcceptanceResult = { claimId: null, productSourceSha: null, scope: null, outcome: 'unknown', dimensions: { engineering: 'unknown', truth: 'unknown', deckQuality: 'unknown', target: 'unknown' }, reasons: [] };
  const reject = (reason: string): AcceptanceResult => ({ ...result, outcome: 'fail', reasons: [...result.reasons, reason] });
  const receipt = receiptSchema.safeParse(input);
  if (!receipt.success) return reject('invalid acceptance receipt');
  let contract: AcceptanceContract;
  try {
    contract = contractSchema.parse(JSON.parse(checkedRead(root, receipt.data.contract).toString('utf8')));
  } catch (error) {
    result.reasons.push(`contract unavailable, corrupt or incompatible: ${String(error)}`);
    return result;
  }
  result.claimId = contract.claimId;
  result.productSourceSha = contract.productSourceSha;
  result.scope = contract.scope;
  if (approvedContracts[contract.claimId] !== receipt.data.contract.sha256) return reject('contract is not approved by acceptance policy');
  const errors = contractErrors(contract);
  if (errors.length) return reject(errors.join('; '));
  const artifacts = new Map<string, unknown>();
  let unknown = false;
  let failed = false;
  for (const artifact of contract.artifacts) {
    try {
      const bytes = checkedRead(root, artifact);
      const decoded = artifact.format === 'json-gzip' ? gunzipSync(bytes, { maxOutputLength: 32 * 1024 * 1024 }) : bytes;
      artifacts.set(artifact.id, artifact.format === 'text' ? decoded.toString('utf8') : JSON.parse(decoded.toString('utf8')));
    } catch (error) {
      unknown = true;
      result.reasons.push(`unusable evidence ${artifact.id}: ${String(error)}`);
    }
  }
  for (const binding of contract.bindings) {
    const actual = pointer(artifacts.get(binding.artifact), binding.pointer);
    if (actual === undefined) { unknown = true; result.reasons.push(`missing provenance: ${binding.field}`); }
    else if (actual !== contract[binding.field]) { failed = true; result.reasons.push(`provenance mismatch: ${binding.field}`); }
  }
  for (const dimension of dimensions) {
    const checks = contract.observations.filter(o => o.dimension === dimension);
    if (!checks.length) continue; // An unclaimed target stays unknown, never an implied pass.
    const outcomes = checks.map(o => {
      const actual = pointer(artifacts.get(o.artifact), o.pointer);
      if (actual === undefined) { result.reasons.push(`missing observation: ${o.id}`); return 'unknown'; }
      if (actual !== o.equals) { result.reasons.push(`failed observation: ${o.id}`); return 'fail'; }
      return 'pass';
    });
    result.dimensions[dimension] = outcomes.includes('fail') ? 'fail' : outcomes.includes('unknown') ? 'unknown' : 'pass';
    failed ||= result.dimensions[dimension] === 'fail';
    unknown ||= result.dimensions[dimension] === 'unknown';
  }
  try {
    const review = reviewSchema.parse(JSON.parse(checkedRead(root, receipt.data.review).toString('utf8')));
    if (review.claimId !== contract.claimId || review.productSourceSha !== contract.productSourceSha || review.contractSha256 !== receipt.data.contract.sha256) {
      failed = true; result.reasons.push('whole-deck review provenance mismatch');
    }
    for (const artifact of contract.artifacts) {
      if (review.reviewedArtifacts[artifact.id] !== artifact.sha256) { failed = true; result.reasons.push(`review did not cover exact artifact: ${artifact.id}`); }
    }
    if (!checkedRead(root, review.narrative).toString('utf8').trim()) throw new Error('empty complete-deck review');
    if (review.decision !== 'accept') { failed = true; result.reasons.push('whole-deck review rejected claim'); }
  } catch (error) {
    unknown = true; result.reasons.push(`whole-deck review unavailable or incomplete: ${String(error)}`);
  }
  result.outcome = failed ? 'fail' : unknown ? 'unknown' : 'pass';
  return result;
}
