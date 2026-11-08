export type LogFields = Record<string, unknown>;

const sensitiveKeys = /authorization|token|secret|password|cpf|connection|string|database_url/i;

export function log(level: "info" | "warn" | "error", message: string, fields: LogFields = {}): void {
  const safeFields = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, sensitiveKeys.test(key) ? "[REDACTED]" : value]));
  const line = JSON.stringify({
    timestamp: new Date().toISOString(), level,
    service: process.env.DD_SERVICE ?? "oficina-billing-service",
    environment: process.env.DD_ENV ?? process.env.NODE_ENV ?? "local",
    version: process.env.DD_VERSION, message, ...safeFields
  });
  if (level === "error") console.error(line); else if (level === "warn") console.warn(line); else console.info(line);
}
