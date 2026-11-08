export type PaymentStatus = "pending" | "approved" | "rejected" | "cancelled" | "refunded";
export interface CreatePaymentInput { amount: number; description: string; externalReference: string; idempotencyKey: string; payerEmail: string }
export interface PaymentResult { id: string; status: PaymentStatus; qrCode?: string; qrCodeBase64?: string }
export interface PaymentGateway {
  create(input: CreatePaymentInput): Promise<PaymentResult>;
  get(paymentId: string): Promise<PaymentResult>;
  cancel(paymentId: string): Promise<PaymentResult>;
  refund(paymentId: string, idempotencyKey: string): Promise<PaymentResult>;
}
