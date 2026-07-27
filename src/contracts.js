const ALLOWED_CHANNELS = new Set(["voice", "chat", "message", "email"]);

export class ContractError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "ContractError";
    this.statusCode = statusCode;
  }
}

export function parseInteraction(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ContractError("Request body must be a JSON object.");
  }

  const interactionId = requiredString(input.interactionId, "interactionId", 100);
  const channel = requiredString(input.channel, "channel", 20).toLowerCase();
  const utterance = requiredString(input.utterance, "utterance", 4000);

  if (!ALLOWED_CHANNELS.has(channel)) {
    throw new ContractError(
      `channel must be one of: ${[...ALLOWED_CHANNELS].join(", ")}.`,
    );
  }

  if (input.context != null && !isPlainObject(input.context)) {
    throw new ContractError("context must be a JSON object.");
  }

  return {
    interactionId,
    channel,
    utterance,
    context: input.context ?? {},
  };
}

export function validateProviderResult(result) {
  if (!isPlainObject(result)) {
    throw new ContractError("AI provider returned an invalid result.", 502);
  }

  const intent = requiredString(result.intent, "provider.intent", 100);
  const summary = requiredString(result.summary, "provider.summary", 1000);
  const response = requiredString(result.response, "provider.response", 2000);
  const confidence = Number(result.confidence);

  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new ContractError(
      "AI provider confidence must be between 0 and 1.",
      502,
    );
  }

  return {
    intent,
    summary,
    response,
    confidence,
    requestedAction:
      typeof result.requestedAction === "string"
        ? result.requestedAction.slice(0, 100)
        : "respond",
  };
}

function requiredString(value, field, maxLength) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ContractError(`${field} is required.`);
  }
  if (value.length > maxLength) {
    throw new ContractError(`${field} must be ${maxLength} characters or fewer.`);
  }
  return value.trim();
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

