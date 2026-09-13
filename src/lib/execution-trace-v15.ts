import { AsyncLocalStorage } from 'node:async_hooks';

type Trace = (event: Record<string, unknown>) => void;
const sink = new AsyncLocalStorage<Trace>();
export function withExecutionTraceV15<T>(trace: Trace, run: () => T): T { return sink.run(trace, run); }
export function executionTraceV15(event: Record<string, unknown>): void { sink.getStore()?.(event); }
