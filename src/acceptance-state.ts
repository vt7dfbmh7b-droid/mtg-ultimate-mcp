import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { digest, evaluateAcceptance, receiptSchema } from './acceptance-gate.js';

export const ACCEPTANCE_POLICY_SHA256 = '15a2181489a6713f0b794fc8a930cdd972c50b155f9e102b4780cd156b981216';
const stateSchema = z.object({
  stable: z.object({ branch: z.string(), version: z.string(), serverCurrent: z.string(), promotionAuthorized: z.boolean() }).strict(),
  experimental: z.object({ developmentCheckpointSha: z.string(), lastFullyValidatedExperimentalBaseline: z.object({ branch: z.string(), sha: z.string(), scope: z.string() }).strict() }),
  milestones: z.array(z.object({ id: z.string(), status: z.string() })),
  acceptanceReceipts: z.record(z.string(), receiptSchema).optional(),
});
const policySchema = z.object({
  schemaVersion: z.literal(1), revision: z.literal('stage2-v1'),
  stable: stateSchema.shape.stable,
  checkpoint: z.string().regex(/^[0-9a-f]{40}$/),
  baseline: stateSchema.shape.experimental.shape.lastFullyValidatedExperimentalBaseline,
  validatedMilestones: z.array(z.string()),
  approvedContracts: z.record(z.string(), z.string().regex(/^[0-9a-f]{64}$/)),
}).strict();
export type AcceptancePolicy = z.infer<typeof policySchema>;

export function loadAcceptancePolicy(root = process.cwd()): AcceptancePolicy {
  const bytes = fs.readFileSync(path.join(root, 'acceptance-policy.json'));
  if (digest(bytes) !== ACCEPTANCE_POLICY_SHA256) throw new Error('unapproved acceptance policy change');
  return policySchema.parse(JSON.parse(bytes.toString('utf8')));
}

/** The same check runs before project:update writes and in project:validate (including CI). */
export function validateAcceptedState(input: unknown, root: string, policy: AcceptancePolicy): string[] {
  const parsed = stateSchema.safeParse(input);
  if (!parsed.success) return ['invalid acceptance state structure'];
  const state = parsed.data;
  const errors: string[] = [];
  if (!isDeepStrictEqual(state.stable, policy.stable)) errors.push('stable changes require separate maintenance authority');
  function requireClaim(key: string, source: string | null, scope: 'narrow' | 'broad'): void {
    const receipt = state.acceptanceReceipts?.[key];
    const result = evaluateAcceptance(root, receipt, policy.approvedContracts);
    if (result.outcome !== 'pass') {
      errors.push(`${key} acceptance blocked (${result.outcome}): ${result.reasons.join('; ')}`);
      return;
    }
    if (result.claimId !== key || (source !== null && result.productSourceSha !== source) || result.scope !== scope) {
      errors.push(`${key} acceptance claim scope/source mismatch`);
    }
  }
  if (state.experimental.developmentCheckpointSha !== policy.checkpoint) requireClaim('checkpoint', state.experimental.developmentCheckpointSha, 'narrow');
  const baseline = state.experimental.lastFullyValidatedExperimentalBaseline;
  if (!isDeepStrictEqual(baseline, policy.baseline)) requireClaim('baseline', baseline.sha, 'broad');
  for (const milestone of state.milestones) {
    if (milestone.status === 'validated' && !policy.validatedMilestones.includes(milestone.id)) requireClaim(`milestone:${milestone.id}`, null, 'broad');
  }
  return errors;
}

export function acceptanceStateErrors(input: unknown, root = process.cwd()): string[] {
  try { return validateAcceptedState(input, root, loadAcceptancePolicy(root)); }
  catch (error) { return [`acceptance policy unavailable or invalid: ${String(error)}`]; }
}
