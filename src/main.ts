import { createServer } from "node:http";
import { createRequestHandler } from "./app.js";
import { PrismaClient } from "@prisma/client";
import { MercadoPagoGateway } from "./payment/mercado-pago-gateway.js";
import { MockPaymentGateway } from "./payment/mock-payment-gateway.js";
import { PaymentWebhookService } from "./payment/payment-webhook-service.js";
import { observeHttp } from "./observability/http.js";
import { log } from "./observability/logger.js";

const port = Number(process.env.PORT ?? 3000);
const prisma = new PrismaClient();
const gateway = process.env.PAYMENT_PROVIDER === "mercado-pago"
  ? new MercadoPagoGateway(process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "")
  : new MockPaymentGateway();
const handler = observeHttp(createRequestHandler(new PaymentWebhookService(prisma, gateway), process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? "mock-secret"));
createServer(handler).listen(port, "0.0.0.0", () => {
  log("info", "service_started", { port });
});
