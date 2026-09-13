import { spawn } from 'node:child_process';

/** The deadline lives outside the worker's event loop; it also stops CPU-bound or leaked work. */
export async function runBoundedProcessV15(command: string, args: string[], options: {
  deadlineMs: number;
  graceMs?: number;
  env?: NodeJS.ProcessEnv;
  onTimeout?: () => void;
}): Promise<{ code: number | null; signal: NodeJS.Signals | null; timedOut: boolean }> {
  if (!Number.isFinite(options.deadlineMs) || options.deadlineMs <= 0) throw new Error('Process deadline must be positive and finite.');
  const grouped = process.platform !== 'win32';
  const child = spawn(command, args, { env: options.env ?? process.env, stdio: 'inherit', detached: grouped });
  let timedOut = false;
  let escalation: NodeJS.Timeout | undefined;
  const kill = (signal: NodeJS.Signals): void => {
    try { if (grouped && child.pid) process.kill(-child.pid, signal); else child.kill(signal); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  };
  const timer = setTimeout(() => {
    timedOut = true;
    try { options.onTimeout?.(); } finally {
      kill('SIGTERM');
      escalation = setTimeout(() => kill('SIGKILL'), options.graceMs ?? 1_000);
    }
  }, options.deadlineMs);
  return new Promise((resolve, reject) => {
    const cleanup = (): void => { clearTimeout(timer); if (escalation) clearTimeout(escalation); };
    child.on('error', error => { cleanup(); reject(error); });
    child.on('close', (code, signal) => { cleanup(); resolve({ code, signal, timedOut }); });
  });
}
