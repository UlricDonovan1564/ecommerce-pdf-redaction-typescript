import assert from "node:assert/strict";
import { test } from "node:test";
import { archiveOrder } from "./receipt_archiver.ts";

test("a receipt is redacted before it is marked ready for archive", async () => {
  process.env.INFRAI_API_KEY = "test-key";
  let requestBody: Record<string, unknown> | undefined;
  const fetcher = async (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ ok: true, data: { pdf: "redacted-pdf" }, metadata: {} }), { status: 200 });
  };

  const result = await archiveOrder({
    orderId: "order-7",
    customerEmail: "student@example.com",
    receiptPdf: "receipt-pdf",
    archive: true
  }, fetcher);

  assert.deepEqual(result, { orderId: "order-7", state: "redacted", pdf: "redacted-pdf" });
  assert.deepEqual(requestBody, { pdf: "receipt-pdf", patterns: ["email", "phone", "address"] });
});

test("an order marked for live retention is not sent to the redaction service", async () => {
  process.env.INFRAI_API_KEY = "test-key";
  let called = false;
  const fetcher = async (): Promise<Response> => {
    called = true;
    return new Response();
  };
  const result = await archiveOrder({ orderId: "order-8", customerEmail: "student@example.com", receiptPdf: "receipt-pdf", archive: false }, fetcher);
  assert.deepEqual(result, { orderId: "order-8", state: "skipped" });
  assert.equal(called, false);
});
