import { parseInteraction, validateProviderResult } from "./contracts.js";
import { allowlistedContext, sanitizeUtterance } from "./security.js";

const RESTRICTED_ACTIONS = new Set([
  "financial_transaction",
  "modify_account",
]);

export class ContactCenterAiService {
  constructor({
    provider,
    confidenceThreshold = 0.8,
    audit = defaultAudit,
  }) {
    if (!provider || typeof provider.analyze !== "function") {
      throw new TypeError("provider.analyze is required.");
    }
    this.provider = provider;
    this.confidenceThreshold = confidenceThreshold;
    this.audit = audit;
  }

  async assist(input, correlationId) {
    const interaction = parseInteraction(input);
    const providerRequest = {
      interactionId: interaction.interactionId,
      channel: interaction.channel,
      utterance: sanitizeUtterance(interaction.utterance),
      context: allowlistedContext(interaction.context),
    };

    const result = validateProviderResult(
      await this.provider.analyze(providerRequest),
    );
    const decision = decideDisposition(result, this.confidenceThreshold);

    this.audit({
      event: "ai_assistance_completed",
      correlationId,
      interactionId: interaction.interactionId,
      channel: interaction.channel,
      intent: result.intent,
      confidence: result.confidence,
      disposition: decision.disposition,
      reason: decision.reason,
    });

    return {
      interactionId: interaction.interactionId,
      correlationId,
      intent: result.intent,
      summary: result.summary,
      suggestedResponse: result.response,
      confidence: result.confidence,
      ...decision,
    };
  }
}

export function decideDisposition(result, threshold = 0.8) {
  if (result.requestedAction === "escalate") {
    return {
      disposition: "human_handoff",
      reason: "customer_requested_agent",
    };
  }

  if (RESTRICTED_ACTIONS.has(result.requestedAction)) {
    return {
      disposition: "human_handoff",
      reason: "restricted_action",
    };
  }

  if (result.confidence < threshold) {
    return {
      disposition: "human_handoff",
      reason: "low_confidence",
    };
  }

  return {
    disposition: "ai_assist",
    reason: "policy_approved",
  };
}

function defaultAudit(event) {
  console.log(JSON.stringify(event));
}

