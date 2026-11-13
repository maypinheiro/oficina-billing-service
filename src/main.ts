import { createServer } from "node:http";
import { createRequestHandler } from "./app.js";
import { PrismaClient } from "@prisma/client";
import { MercadoPagoGateway } from "./payment/mercado-pago-gateway.js";
import { MockPaymentGateway } from "./payment/mock-payment-gateway.js";
import { PaymentWebhookService } from "./payment/payment-webhook-service.js";
import { observeHttp } from "./observability/http.js";
import { log } from "./observability/logger.js";
import { SQSClient } from "@aws-sdk/client-sqs";
import { AwsMessageTransport } from "./messaging/aws-transport.js";
import { PrismaMessageInbox } from "./messaging/prisma-inbox.js";
import { SqsMessageWorker } from "./messaging/sqs-worker.js";
import { BillingCommandHandler } from "./saga/billing-command-handler.js";
import { BillingMessageProcessor } from "./saga/billing-message-processor.js";
import { PrismaBillingStore } from "./saga/prisma-billing-store.js";
import { BudgetDecisionService } from "./budget/budget-decision-service.js";
import { PaymentSimulationService } from "./payment/payment-simulation-service.js";
import { OutboxPublisher } from "./messaging/outbox-publisher.js";

const port = Number(process.env.PORT ?? 3000);
const prisma = new PrismaClient();
const gateway = process.env.PAYMENT_PROVIDER === "mercado-pago"
  ? new MercadoPagoGateway(process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "")
  : new MockPaymentGateway();
const topicArn = process.env.DOMAIN_EVENTS_TOPIC_ARN;
const transport = new AwsMessageTransport();
const decisions = topicArn ? new BudgetDecisionService(prisma, transport, topicArn) : undefined;
const webhook = new PaymentWebhookService(prisma, gateway);
const simulation = process.env.PAYMENT_SIMULATION_ENABLED === "true" && gateway instanceof MockPaymentGateway
  ? new PaymentSimulationService(prisma, gateway, webhook)
  : undefined;
const handler = observeHttp(createRequestHandler(webhook, process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? "mock-secret", decisions, simulation));
createServer(handler).listen(port, "0.0.0.0", () => {
  log("info", "service_started", { port });
});

const queueUrl = process.env.COMMAND_QUEUE_URL;
if (!queueUrl || !topicArn) {
  log("warn", "saga_worker_disabled", { reason: "COMMAND_QUEUE_URL or DOMAIN_EVENTS_TOPIC_ARN not configured" });
} else {
  const store = new PrismaBillingStore(prisma, gateway, process.env.PAYER_EMAIL ?? "cliente@example.com");
  const processor = new BillingMessageProcessor(
    new PrismaMessageInbox(prisma),
    new BillingCommandHandler(store),
    transport,
    topicArn,
  );
  const worker = new SqsMessageWorker(new SQSClient({}), queueUrl, (body) => processor.process(body));
  void worker.start();
  const outbox = new OutboxPublisher(prisma, transport, topicArn);
  void outbox.start();
  for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, () => { worker.stop(); outbox.stop(); });
}
