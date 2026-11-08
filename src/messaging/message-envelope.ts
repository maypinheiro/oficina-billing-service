import { createHash, randomUUID } from "node:crypto";

export const MESSAGE_ENVELOPE_VERSION = 1 as const;
export type MessageKind = "command" | "event";
export interface MessageEnvelope<TPayload = unknown> {
  messageId: string; messageType: string; messageKind: MessageKind; version: number;
  occurredAt: string; source: string; aggregateId: string; correlationId: string;
  causationId?: string; sagaId?: string; payload: TPayload;
}
export type NewMessage<T> = Omit<MessageEnvelope<T>, "messageId" | "occurredAt" | "version"> & { messageId?: string; occurredAt?: string; version?: number };
export function createMessageEnvelope<T>(input: NewMessage<T>): MessageEnvelope<T> {
  const value = { ...input, messageId: input.messageId ?? randomUUID(), occurredAt: input.occurredAt ?? new Date().toISOString(), version: input.version ?? MESSAGE_ENVELOPE_VERSION };
  assertMessageEnvelope(value); return value;
}
export function assertMessageEnvelope(value: unknown): asserts value is MessageEnvelope {
  if (!value || typeof value !== "object") throw new Error("Invalid message envelope");
  const item = value as Record<string, unknown>;
  if (["messageId", "messageType", "occurredAt", "source", "aggregateId", "correlationId"].some((key) => typeof item[key] !== "string" || item[key] === "")) throw new Error("Incomplete message envelope");
  if (item.messageKind !== "command" && item.messageKind !== "event") throw new Error("Invalid message kind");
  if (!Number.isInteger(item.version) || Number(item.version) < 1) throw new Error("Invalid message version");
  if (Number.isNaN(Date.parse(String(item.occurredAt))) || !("payload" in item)) throw new Error("Invalid message content");
}
export function parseQueueBody(body: string): MessageEnvelope {
  const parsed = JSON.parse(body) as Record<string, unknown>;
  const value = typeof parsed.Message === "string" ? JSON.parse(parsed.Message) : parsed;
  assertMessageEnvelope(value); return value;
}
export const payloadHash = (message: MessageEnvelope): string => createHash("sha256").update(JSON.stringify(message.payload)).digest("hex");
