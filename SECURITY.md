# Security guidance

This repository is a public reference implementation, not a complete production
security boundary.

Before production use:

- require authenticated API Gateway routes and least-privilege IAM;
- retrieve signing secrets and provider credentials from AWS Secrets Manager;
- rotate credentials and reject unsigned or replayed requests;
- replace the demonstration provider with an approved private gateway or SDK;
- maintain explicit field allowlists for every customer-context contract;
- apply organization-specific PII, PCI, privacy, retention, and model-risk policy;
- encrypt logs and audit events, and never log utterances or unrestricted context;
- enforce rate limits, WAF rules, timeouts, circuit breakers, and provider allowlists;
- require human approval for financial, identity, account, or other consequential actions;
- monitor confidence, escalation, latency, error, and policy-violation metrics;
- perform threat modeling, penetration testing, and incident-response exercises.

Report suspected vulnerabilities privately to the repository owner. Do not open
a public issue containing exploit details, credentials, or customer data.

