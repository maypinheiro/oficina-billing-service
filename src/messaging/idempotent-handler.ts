import { MessageEnvelope, payloadHash } from "./message-envelope.js";
export interface MessageInbox { claim(message: MessageEnvelope, hash: string): Promise<boolean> }
export class IdempotentMessageHandler {
  constructor(private readonly inbox: MessageInbox) {}
  async handle(message: MessageEnvelope, action: (item: MessageEnvelope) => Promise<void>): Promise<"processed" | "duplicate"> {
    if (!(await this.inbox.claim(message, payloadHash(message)))) return "duplicate";
    await action(message); return "processed";
  }
}
