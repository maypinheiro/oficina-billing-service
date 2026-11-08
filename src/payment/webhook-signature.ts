import { createHmac, timingSafeEqual } from "node:crypto";
export interface WebhookSignatureInput { xSignature: string; xRequestId: string; dataId: string; secret: string }
export function validateWebhookSignature(input: WebhookSignatureInput): boolean {
  const parts = Object.fromEntries(input.xSignature.split(",").map((part) => part.trim().split("=", 2)));
  if (!parts.ts || !parts.v1 || !input.xRequestId || !input.dataId || !input.secret) return false;
  const manifest = `id:${input.dataId};request-id:${input.xRequestId};ts:${parts.ts};`;
  const expected = createHmac("sha256", input.secret).update(manifest).digest("hex");
  const received = Buffer.from(parts.v1, "utf8"); const calculated = Buffer.from(expected, "utf8");
  return received.length === calculated.length && timingSafeEqual(received, calculated);
}
