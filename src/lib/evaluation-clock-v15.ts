import { AsyncLocalStorage } from 'node:async_hooks';

const clock = new AsyncLocalStorage<string>();
export function evaluationTimeV15(): string { return clock.getStore() ?? new Date().toISOString(); }
export function withEvaluationTimeV15<T>(time: string, run: () => T): T {
  if (!Number.isFinite(Date.parse(time))) throw new Error('Evaluation time must be a valid ISO timestamp.');
  return clock.run(new Date(time).toISOString(), run);
}
