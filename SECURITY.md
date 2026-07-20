# Security policy

Mr.H Academy treats account, payment, classroom, and uploaded-document data as
security-sensitive. Please report suspected vulnerabilities privately rather
than opening a public issue.

## Supported versions

Only the default branch and the most recent production release are supported
with security fixes. Older deployments should be upgraded before investigation
or remediation can be guaranteed.

## Reporting a vulnerability

Email a reproducible report to `security@mrh-academy.example` with:

- a concise description and affected component or endpoint;
- reproduction steps or a minimal proof of concept;
- impact, required privileges, and any suggested mitigation; and
- the version, commit, or deployment where the issue was observed.

Do not include real passwords, access tokens, personal data, payment details, or
production database exports. Encrypt sensitive attachments before sending them.

We aim to acknowledge reports within five business days, provide an initial
assessment within ten business days, and coordinate disclosure after a fix or
mitigation is available. We will credit researchers who follow responsible
disclosure unless they prefer to remain anonymous.

## Operational controls

Production credentials must be supplied through the deployment environment, not
committed files. The API uses Argon2id passwords, HttpOnly cookies, CSRF and
Origin checks, explicit JWT validation, refresh-token rotation, and signed
private object delivery. Run the documented type-check, test, build, migration
validation, and secret-scan checks before deployment.
