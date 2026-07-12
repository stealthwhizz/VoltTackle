import { AsyncLocalStorage } from "node:async_hooks";

interface CorrelationContext {
  correlationId: string;
  incidentId?: string;
}

const storage = new AsyncLocalStorage<CorrelationContext>();

export function runWithCorrelation<T>(context: CorrelationContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getCorrelationContext(): CorrelationContext | undefined {
  return storage.getStore();
}

export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}
