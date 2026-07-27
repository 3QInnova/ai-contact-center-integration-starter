import { randomUUID } from "node:crypto";
import { ContractError } from "./contracts.js";
import { DeterministicProvider } from "./provider.js";
import { ContactCenterAiService } from "./service.js";
import { verifySignature } from "./security.js";

const service = new ContactCenterAiService({
  provider: new DeterministicProvider(),
  confidenceThreshold: Number(process.env.AI_CONFIDENCE_THRESHOLD ?? "0.80"),
});

export async function handler(event) {
  const path = event.rawPath ?? event.requestContext?.http?.path ?? "/";
  const method =
    event.requestContext?.http?.method ?? event.httpMethod ?? "UNKNOWN";

  if (path === "/health" && method === "GET") {
    return json(200, {
      status: "ok",
      service: "ai-contact-center-integration-starter",
      stage: process.env.STAGE ?? "dev",
    });
  }

  if (path !== "/v1/interactions/assist" || method !== "POST") {
    return json(404, { error: "not_found" });
  }

  const correlationId =
    header(event.headers, "x-correlation-id") ?? randomUUID();
  const rawBody = event.body ?? "";
  const signature = header(event.headers, "x-signature");

  if (
    !verifySignature(
      rawBody,
      signature,
      process.env.SIGNING_SECRET ?? "",
    )
  ) {
    return json(401, { error: "invalid_signature", correlationId });
  }

  try {
    const input = JSON.parse(rawBody);
    const result = await service.assist(input, correlationId);
    return json(200, result, correlationId);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return json(400, { error: "invalid_json", correlationId });
    }
    if (error instanceof ContractError) {
      return json(error.statusCode, {
        error: "invalid_contract",
        message: error.message,
        correlationId,
      });
    }

    console.error(
      JSON.stringify({
        event: "ai_assistance_failed",
        correlationId,
        errorName: error?.name ?? "Error",
      }),
    );
    return json(500, { error: "internal_error", correlationId });
  }
}

function header(headers = {}, name) {
  const match = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );
  return match?.[1];
}

function json(statusCode, body, correlationId) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      ...(correlationId ? { "x-correlation-id": correlationId } : {}),
    },
    body: JSON.stringify(body),
  };
}

