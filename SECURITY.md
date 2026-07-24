# Security Policy

## Supported versions

Security fixes are applied to the current `main` branch. The project has not yet declared a stable release series.

## Reporting a vulnerability

Do not include exploit details, credentials, internal URLs, or personal data in a public issue.

Use GitHub's private vulnerability reporting entry on the repository's **Security** page when it is available. If it is not available, contact the maintainer through a private channel listed on the [maintainer's GitHub profile](https://github.com/yhay81). If no private channel is available, open a minimal public issue asking for a security contact without describing the vulnerability.

Include:

- the affected recipe, script, or workflow;
- the security impact and realistic attack path;
- minimal reproduction steps with secrets removed;
- any suggested mitigation.

The maintainer will acknowledge a report as soon as practical, investigate it, and coordinate disclosure after a fix is available.

## Runner threat model

The recipe runner accepts only reviewed, repository-local recipes. Requests must use HTTPS and GET, use an explicit host allowlist, avoid secret-like query fields, resolve to public network addresses, and remain below a configured response-size limit. These controls reduce risk but do not make arbitrary third-party recipes safe. Review recipe changes before running them.

## Hosted MCP threat model

The public MCP endpoint is unauthenticated and read-only. It accepts only committed recipe IDs and their declared bounded parameters; it does not accept arbitrary URLs, request headers, SQL, code, or credentials. Do not send secrets or personal data in tool arguments. The application does not intentionally persist MCP arguments or upstream responses, although normal Cloudflare operational logs and the upstream provider's access logs may contain request metadata.

Execution receipts check internal consistency and can detect a changed result when the receipt is retained unchanged. They are not digital signatures and do not prove publisher authenticity. Treat the official source and its usage terms as authoritative.
