import tracer from "dd-trace";
import StatsD from "hot-shots";

export const metrics = new StatsD({ host: process.env.DD_AGENT_HOST ?? "127.0.0.1", port: Number(process.env.DD_DOGSTATSD_PORT ?? 8125), prefix: "oficina.", globalTags: { service: process.env.DD_SERVICE ?? "oficina-billing-service", env: process.env.DD_ENV ?? "local" }, errorHandler: () => undefined });

export function activeTraceId(): string | undefined { return tracer.scope().active()?.context().toTraceId(); }
export function trace<T>(name: string, tags: Record<string, string | undefined>, operation: () => Promise<T>): Promise<T> {
  return tracer.trace(name, { tags }, operation);
}
