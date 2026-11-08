import assert from "node:assert/strict";
import test from "node:test";
import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { SqsMessageWorker } from "../../src/messaging/sqs-worker.js";

test("processes and deletes a successful SQS delivery", async () => {
  const commands: unknown[] = [];
  const client = { send: async (command: unknown) => {
    commands.push(command);
    if (command instanceof ReceiveMessageCommand) return { Messages: [{ Body: "payload", ReceiptHandle: "receipt-1" }] };
    return {};
  } } as SQSClient;
  let processed = "";
  let worker: SqsMessageWorker;
  worker = new SqsMessageWorker(client, "queue-url", async (body) => { processed = body; worker.stop(); });

  await worker.start();

  assert.equal(processed, "payload");
  assert.equal(commands.some((command) => command instanceof DeleteMessageCommand), true);
});
