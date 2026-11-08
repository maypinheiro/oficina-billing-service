import { createServer } from "node:http";
import { createRequestHandler } from "./app.js";
import { PrismaClient } from "@prisma/client";
import { MercadoPagoGateway } from "./payment/mercado-pago-gateway.js";
import { MockPaymentGateway } from "./payment/mock-payment-gateway.js";
import { PaymentWebhookService } from "./payment/payment-webhook-service.js";

const port = Number(process.env.PORT ?? 3000);
const prisma = new PrismaClient();
const gateway = process.env.PAYMENT_PROVIDER === "mercado-pago"
  ? new MercadoPagoGateway(process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "")
  : new MockPaymentGateway();
const handler = createRequestHandler(new PaymentWebhookService(prisma, gateway), process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? "mock-secret");
createServer(handler).listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({ level: "info", service: "oficina-billing-service", port }));
});
