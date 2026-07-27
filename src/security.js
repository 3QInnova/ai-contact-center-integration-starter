import { createHmac, timingSafeEqual } from "node:crypto";

const CONTEXT_ALLOWLIST = new Set([
  "customerSegment",
  "authenticated",
  "language",
  "queue",
  "journeyStage",
]);

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?<!\d)(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g;
const CARD_PATTERN = /\b(?:\d[ -]*?){13,19}\b/g;

export function verifySignature(rawBody, signature, secret) {
  if (!secret) {
    return true;
  }
  if (typeof signature !== "string" || !signature.startsWith("sha256=")) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  const received = signature.slice("sha256=".length);

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(received, "utf8"),
    Buffer.from(expected, "utf8"),
  );
}

export function sanitizeUtterance(value) {
  return value
    .replace(EMAIL_PATTERN, "[REDACTED_EMAIL]")
    .replace(PHONE_PATTERN, "[REDACTED_PHONE]")
    .replace(CARD_PATTERN, (candidate) =>
      passesLuhn(candidate) ? "[REDACTED_PAYMENT_CARD]" : candidate,
    );
}

export function allowlistedContext(context) {
  const sanitized = {};
  for (const [key, value] of Object.entries(context)) {
    if (CONTEXT_ALLOWLIST.has(key) && isSafeScalar(value)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function isSafeScalar(value) {
  return (
    typeof value === "boolean" ||
    (typeof value === "string" && value.length <= 200) ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function passesLuhn(candidate) {
  const digits = candidate.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) {
    return false;
  }

  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

