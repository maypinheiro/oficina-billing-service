import { PaymentGateway, CreatePaymentInput, PaymentResult, PaymentStatus } from "./payment-gateway.js";

type Fetch = typeof globalThis.fetch;
type MpPayment = { id: number | string; status: string; point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } } };

const mapStatus = (status: string): PaymentStatus => {
  if (status === "approved") return "approved";
  if (status === "cancelled") return "cancelled";
  if (status === "refunded") return "refunded";
  if (["rejected", "charged_back"].includes(status)) return "rejected";
  return "pending";
};

export class MercadoPagoGateway implements PaymentGateway {
  constructor(private readonly accessToken: string, private readonly baseUrl = "https://api.mercadopago.com", private readonly request: Fetch = fetch) {
    if (!accessToken) throw new Error("MERCADO_PAGO_ACCESS_TOKEN obrigatorio");
  }
  async create(input: CreatePaymentInput): Promise<PaymentResult> {
    return this.call("/v1/payments", "POST", input.idempotencyKey, { transaction_amount: input.amount, description: input.description, external_reference: input.externalReference, payment_method_id: "pix", payer: { email: input.payerEmail } });
  }
  async get(paymentId: string): Promise<PaymentResult> { return this.call(`/v1/payments/${encodeURIComponent(paymentId)}`, "GET"); }
  async cancel(paymentId: string): Promise<PaymentResult> { return this.call(`/v1/payments/${encodeURIComponent(paymentId)}`, "PUT", undefined, { status: "cancelled" }); }
  async refund(paymentId: string, idempotencyKey: string): Promise<PaymentResult> { return this.call(`/v1/payments/${encodeURIComponent(paymentId)}/refunds`, "POST", idempotencyKey, {}); }
  private async call(path: string, method: string, idempotencyKey?: string, body?: unknown): Promise<PaymentResult> {
    const response = await this.request(`${this.baseUrl}${path}`, { method, signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json", ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (!response.ok) throw new Error(`Mercado Pago respondeu ${response.status}`);
    const data = await response.json() as MpPayment;
    return { id: String(data.id), status: mapStatus(data.status), qrCode: data.point_of_interaction?.transaction_data?.qr_code, qrCodeBase64: data.point_of_interaction?.transaction_data?.qr_code_base64 };
  }
}
