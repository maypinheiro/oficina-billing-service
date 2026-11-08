import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { log } from "../observability/logger.js";

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class SqsMessageWorker {
  private running = false;

  constructor(
    private readonly client: SQSClient,
    private readonly queueUrl: string,
    private readonly processMessage: (body: string) => Promise<unknown>,
  ) {}

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    log("info", "sqs_worker_started", { queueUrl: this.queueUrl });

    while (this.running) {
      try {
        const result = await this.client.send(new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20,
          VisibilityTimeout: 60,
          MessageAttributeNames: ["All"],
        }));

        for (const message of result.Messages ?? []) {
          if (!message.Body || !message.ReceiptHandle) continue;
          await this.processMessage(message.Body);
          await this.client.send(new DeleteMessageCommand({ QueueUrl: this.queueUrl, ReceiptHandle: message.ReceiptHandle }));
        }
      } catch (error) {
        log("error", "sqs_worker_iteration_failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
        if (this.running) await wait(1000);
      }
    }
  }

  stop(): void {
    this.running = false;
    log("info", "sqs_worker_stopping");
  }
}
