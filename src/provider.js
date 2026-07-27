export class DeterministicProvider {
  async analyze({ utterance, context }) {
    const normalized = utterance.toLowerCase();
    const requestsAccountChange =
      normalized.includes("change my address") ||
      normalized.includes("close my account");
    const requestsPayment =
      normalized.includes("payment") ||
      normalized.includes("refund") ||
      normalized.includes("transfer");
    const requestsAgent =
      normalized.includes("agent") || normalized.includes("representative");

    if (requestsAccountChange) {
      return {
        intent: "account_change",
        summary: "Customer requested an account-level change.",
        response: "I can connect you with a specialist who can verify the request.",
        confidence: 0.92,
        requestedAction: "modify_account",
      };
    }

    if (requestsPayment) {
      return {
        intent: "financial_request",
        summary: "Customer asked about a financial transaction.",
        response: "I can connect you with a specialist for secure assistance.",
        confidence: 0.89,
        requestedAction: "financial_transaction",
      };
    }

    if (requestsAgent) {
      return {
        intent: "agent_request",
        summary: "Customer explicitly requested a human agent.",
        response: "I will connect you with an agent.",
        confidence: 0.99,
        requestedAction: "escalate",
      };
    }

    const segment =
      typeof context.customerSegment === "string"
        ? ` for the ${context.customerSegment} segment`
        : "";

    return {
      intent: "general_support",
      summary: `Customer requested general assistance${segment}.`,
      response: "I can help with that. Please provide one more detail.",
      confidence: 0.86,
      requestedAction: "respond",
    };
  }
}

