import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  PROMOTION_EVALUATOR_CONTRACT_V15,
  assertEvaluationCodeIdentityV15,
  type EvaluationCodeIdentityV15,
} from './future-holdout-seal-v15.js';

function required(name: string, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  return value.trim();
}

/**
 * Derives the exact code/dependency identity used by a promotion workflow.
 * MTG_PROMOTION_CODE_SHA is preferred because a workflow may deliberately check
 * out the sealed revision after the GitHub event itself was created at another ref.
 */
export async function currentPromotionRuntimeIdentityV15(): Promise<EvaluationCodeIdentityV15> {
  const repositoryFullName = required('GITHUB_REPOSITORY', process.env.GITHUB_REPOSITORY).toLocaleLowerCase();
  const gitCommitSha = required(
    'MTG_PROMOTION_CODE_SHA or GITHUB_SHA',
    process.env.MTG_PROMOTION_CODE_SHA ?? process.env.GITHUB_SHA,
  ).toLocaleLowerCase();
  const packageLockBytes = await readFile('package-lock.json');
  const nodeVersion = (await readFile('.node-version', 'utf8')).trim();
  return assertEvaluationCodeIdentityV15({
    repositoryFullName,
    gitCommitSha,
    packageLockSha256: createHash('sha256').update(packageLockBytes).digest('hex'),
    nodeVersion,
    evaluatorContract: PROMOTION_EVALUATOR_CONTRACT_V15,
  });
}
