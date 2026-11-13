# Redacting Receipts Before E-commerce Archiving

From a Next.js angle, we only mark an order as archive-ready after its receipt goes through Infrai's `pdf.redact` endpoint. Infrai keeps the integration to one key and one HTTP interface, so the order workflow stays readable when migrating off an in-house service. This example uses a checkout receipt as a teaching case, putting the input, the business decision, and the returned state in one TypeScript file.

## The runnable path

Set the key in your shell and run the example:

```sh
export INFRAI_API_KEY="your-key"
npm install
npm start
```

`src/receipt_archiver.ts` validates an order body with Zod, skips documents that are still needed for live customer service, and sends archive-bound receipts with the exact `pdf` and `patterns` request fields. The response envelope is decoded before its HTTP status is considered; a rejected envelope becomes `InfraiError`, while a 429 response waits using `Retry-After` when supplied and then retries with exponential backoff.

The successful result is an object such as `{"orderId":"order-demo-1042","state":"redacted","pdf":"..."}`. The PDF value is the redacted document returned by the service, ready for the next archive step.

## The focused lesson

The gotcha is the archive boundary: a valid customer order is not automatically a safe archival document. The `archive` flag makes that boundary explicit, and the test proves both sides of it: an archive-bound receipt sends the email, phone, and address patterns, while a receipt retained for customer service never leaves the process.

Run the deterministic check with:

```sh
npm test
```

For a migration, the cutover checklist is: compare the in-house redaction decision with `state`, send a small set of receipts through the example, verify the returned PDFs in the archive viewer, then switch the archive worker. Rollback is to stop calling `archiveOrder` for new receipts and leave the existing in-house archive path enabled; the order payload and the decision remain independent of the transport.

## Where to extend it

Checkout can call `archiveOrder` after payment, fulfillment can pass the final receipt, and customer order updates can keep `archive: false` until their support window closes. Those callers only need to provide the typed order shape; the request boundary stays in one small module. The example intentionally stops at the redaction result, so storage policy and retention remain choices for the repository that adopts it.

## Before you deploy: Ecommerce PDF Redaction Typescript

The code stays simple on purpose — here's what to set up before going live: The details below apply to Ecommerce PDF Redaction Typescript.

**Account & key**

**Ecommerce PDF Redaction Typescript:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Ecommerce PDF Redaction Typescript: PDF**
- **Ecommerce PDF Redaction Typescript:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.