import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { ContractError, parseInteraction } from "../src/contracts.js";
import { handler } from "../src/handler.js";
import { DeterministicProvider } from "../src/provider.js";
import {
  allowlistedContext,
  sanitizeUtterance,
  verifySignature,
} from "../src/security.js";
import {
  ContactCenterAiService,
  decideDisposition,
} from "../src/service.js";

test("parses a valid interaction contract", () => {
  const result = parseInteraction({
    interactionId: "interaction-1",
    channel: "VOICE",
    utterance: "Help me",
  });
  assert.equal(result.channel, "voice");
  assert.deepEqual(result.context, {});
});

test("rejects unsupported channels", () => {
  assert.throws(
    () =>
      parseInteraction({
        interactionId: "interaction-1",
        channel: "fax",
        utterance: "Help",
      }),
    ContractError,
  );
});

test("redacts email, phone, and valid payment card data", () => {
  const sanitized = sanitizeUtterance(
    "Email me at person@example.com or 303-555-0123 about 4111 1111 1111 1111.",
  );
  assert.equal(
    sanitized,
    "Email me at [REDACTED_EMAIL] or [REDACTED_PHONE] about [REDACTED_PAYMENT_CARD].",
  );
});

test("forwards only allowlisted scalar context", () => {
  assert.deepEqual(
    allowlistedContext({
      customerSegment: "preferred",
      authenticated: true,
      internalCustomerId: "secret",
      nested: { private: true },
    }),
    { customerSegment: "preferred", authenticated: true },
  );
});

test("verifies signed payloads with constant-time comparison", () => {
  const body = '{"interactionId":"i-1"}';
  const secret = "test-secret";
  const signature = `sha256=${createHmac("sha256", secret)
    .update(body)
    .digest("hex")}`;
  assert.equal(verifySignature(body, signature, secret), true);
  assert.equal(verifySignature(`${body}x`, signature, secret), false);
});

test("requires human handoff for restricted actions", () => {
  assert.deepEqual(
    decideDisposition(
      {
        requestedAction: "financial_transaction",
        confidence: 0.99,
      },
      0.8,
    ),
    { disposition: "human_handoff", reason: "restricted_action" },
  );
});

test("requires human handoff for low confidence", () => {
  assert.deepEqual(
    decideDisposition(
      { requestedAction: "respond", confidence: 0.6 },
      0.8,
    ),
    { disposition: "human_handoff", reason: "low_confidence" },
  );
});

test("returns AI assistance for policy-approved requests", async () => {
  const events = [];
  const service = new ContactCenterAiService({
    provider: new DeterministicProvider(),
    audit: (event) => events.push(event),
  });

  const result = await service.assist(
    {
      interactionId: "interaction-1",
      channel: "chat",
      utterance: "Please explain my statement.",
      context: { customerSegment: "preferred" },
    },
    "correlation-1",
  );

  assert.equal(result.disposition, "ai_assist");
  assert.equal(result.correlationId, "correlation-1");
  assert.equal(events.length, 1);
  assert.equal(events[0].event, "ai_assistance_completed");
});

test("keeps restricted context and PII outside the provider boundary", async () => {
  let received;
  const service = new ContactCenterAiService({
    provider: {
      async analyze(input) {
        received = input;
        return {
          intent: "general_support",
          summary: "Safe summary",
          response: "Safe response",
          confidence: 0.9,
          requestedAction: "respond",
        };
      },
    },
    audit: () => {},
  });

  await service.assist(
    {
      interactionId: "interaction-1",
      channel: "voice",
      utterance: "Call me at 303-555-0123.",
      context: {
        queue: "care",
        accountBalance: "1000",
        internalCustomerId: "private-id",
      },
    },
    "correlation-2",
  );

  assert.equal(received.utterance, "Call me at [REDACTED_PHONE].");
  assert.deepEqual(received.context, { queue: "care" });
});

test("Lambda handler returns a stable response contract", async () => {
  const response = await handler({
    rawPath: "/v1/interactions/assist",
    requestContext: { http: { method: "POST" } },
    headers: { "x-correlation-id": "correlation-3" },
    body: JSON.stringify({
      interactionId: "interaction-3",
      channel: "message",
      utterance: "I need a representative.",
    }),
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.disposition, "human_handoff");
  assert.equal(body.reason, "customer_requested_agent");
});

test("Lambda handler rejects invalid JSON", async () => {
  const response = await handler({
    rawPath: "/v1/interactions/assist",
    requestContext: { http: { method: "POST" } },
    body: "{not-json",
  });
  assert.equal(response.statusCode, 400);
});

