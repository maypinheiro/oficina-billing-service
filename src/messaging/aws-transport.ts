import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { MessageEnvelope } from "./message-envelope.js";
export class AwsMessageTransport {
  constructor(private readonly sns = new SNSClient({}), private readonly sqs = new SQSClient({})) {}
  async publishEvent(topicArn: string, message: MessageEnvelope): Promise<void> {
    await this.sns.send(new PublishCommand({ TopicArn: topicArn, Message: JSON.stringify(message), MessageAttributes: { messageType: { DataType: "String", StringValue: message.messageType }, version: { DataType: "Number", StringValue: String(message.version) } } }));
  }
  async sendCommand(queueUrl: string, message: MessageEnvelope): Promise<void> {
    await this.sqs.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify(message), MessageAttributes: { correlationId: { DataType: "String", StringValue: message.correlationId }, messageType: { DataType: "String", StringValue: message.messageType } } }));
  }
}
