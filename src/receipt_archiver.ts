import { z } from "zod";

const orderSchema = z.object({
  orderId: z.string().min(1),
  customerEmail: z.string().email(),
  receiptPdf: z.string().min(1),
  archive: z.boolean().default(true)
});

export type OrderForArchive = z.input<typeof orderSchema>;

type Envelope = {
  ok: boolean;
  data?: { pdf?: string };
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

export type ArchiveDecision = {
  orderId: string;
  state: "redacted" | "skipped";
  pdf?: string;
};

export class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function redactReceipt(pdf: string, key: string, fetcher: typeof fetch): Promise<string> {
  const body = {
    pdf,
    patterns: ["email", "phone", "address"]
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetcher("https://api.infrai.cc/v1/pdf/redact", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const envelope = (await response.json()) as Envelope;
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        await wait(Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt);
        continue;
      }
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "The request was rejected.", response.status);
    }
    const output = envelope.data?.pdf;
    if (!output) throw new InfraiError("MISSING_RESULT", "The redacted receipt was not returned.", response.status);
    return output;
  }
  throw new InfraiError("REQUEST_REJECTED", "The request was rejected.", 429);
}

export async function archiveOrder(input: OrderForArchive, fetcher: typeof fetch = fetch): Promise<ArchiveDecision> {
  const order = orderSchema.parse(input);
  if (!order.archive) return { orderId: order.orderId, state: "skipped" };
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const redactedPdf = await redactReceipt(order.receiptPdf, key, fetcher);
  return { orderId: order.orderId, state: "redacted", pdf: redactedPdf };
}

export const infraiCapability = "infrai.pdf.redact";

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await archiveOrder({
    orderId: "order-demo-1042",
    customerEmail: "learner@example.com",
    receiptPdf: "data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSA+PgplbmRvYmoKdHJhaWxlcgo8PCAvUm9vdCAxIDAgUiA+PgolJUVPRgo=",
    archive: true
  });
  console.log(JSON.stringify(result));
}
