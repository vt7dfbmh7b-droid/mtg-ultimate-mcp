export interface ClosableHttpServer {
  close(callback: (error?: Error) => void): void;
  closeIdleConnections?: () => void;
  closeAllConnections?: () => void;
}

export interface GracefulShutdownOptions {
  server: ClosableHttpServer;
  closeMcp: () => Promise<void>;
  timeoutMs: number;
}

export interface GracefulShutdownResult {
  forcedHttpClose: boolean;
  mcpCloseTimedOut: boolean;
  httpCloseError?: Error;
  mcpCloseError?: Error;
}

type CloseOutcome = 'closed' | 'timed-out';

function positiveTimeout(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 1;
}

function isAlreadyClosedError(error: Error): boolean {
  return (error as NodeJS.ErrnoException).code === 'ERR_SERVER_NOT_RUNNING';
}

function closeHttpServer(server: ClosableHttpServer): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      server.close((error?: Error) => {
        if (!error || isAlreadyClosedError(error)) resolve();
        else reject(error);
      });
    } catch (error) {
      if (error instanceof Error && isAlreadyClosedError(error)) resolve();
      else reject(error);
    }
  });
}

async function waitForClose(
  close: Promise<void>,
  timeoutMs: number,
): Promise<CloseOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timed-out'>((resolve) => {
    timer = setTimeout(() => resolve('timed-out'), positiveTimeout(timeoutMs));
  });
  try {
    const outcome = await Promise.race([
      close.then(() => 'closed' as const),
      timeout,
    ]);
    return outcome;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Stop accepting HTTP work, drain existing connections, and close the MCP
 * handler within one bounded shutdown budget. A stuck HTTP connection is
 * force-closed after the deadline so deployments cannot hang indefinitely.
 */
export async function gracefulShutdown(
  options: GracefulShutdownOptions,
): Promise<GracefulShutdownResult> {
  const timeoutMs = positiveTimeout(options.timeoutMs);
  const deadline = Date.now() + timeoutMs;
  // Invoke close first so the listener stops accepting new work immediately;
  // then drop keep-alive sockets while existing requests drain.
  const httpClose = closeHttpServer(options.server);
  options.server.closeIdleConnections?.();

  let httpOutcome: CloseOutcome = 'closed';
  let httpCloseError: Error | undefined;
  try {
    httpOutcome = await waitForClose(httpClose, timeoutMs);
  } catch (error) {
    httpCloseError = error instanceof Error ? error : new Error(String(error));
  }
  if (httpOutcome === 'timed-out' || httpCloseError) options.server.closeAllConnections?.();

  const remainingMs = Math.max(1, deadline - Date.now());
  let mcpOutcome: CloseOutcome = 'closed';
  let mcpCloseError: Error | undefined;
  try {
    mcpOutcome = await waitForClose(options.closeMcp(), remainingMs);
  } catch (error) {
    mcpCloseError = error instanceof Error ? error : new Error(String(error));
  }
  return {
    forcedHttpClose: httpOutcome === 'timed-out' || Boolean(httpCloseError),
    mcpCloseTimedOut: mcpOutcome === 'timed-out',
    ...(httpCloseError ? { httpCloseError } : {}),
    ...(mcpCloseError ? { mcpCloseError } : {}),
  };
}
