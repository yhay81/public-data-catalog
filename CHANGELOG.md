# Changelog

All notable changes to this project are documented here.

## Unreleased

## 0.5.0 - 2026-08-03

### Added

- A browser-based public-statistics research workflow for five reviewed questions.
- A same-origin `/api/research` endpoint that returns readable answers, provenance, usage terms, interpretation notes, and verification summaries.
- A PDC brand guide, trust-model documentation, and Hayate compatibility path.
- An evidence-gated product roadmap from independent activation through repeat use, operational trust, interoperability, and optional federation.
- Parameter-bound response assertions and complete bounded-integer range probes.
- Strict receipt 1.1 validation with separate reviewed and final request URLs.

### Changed

- Repositioned PDC from a catalog-first MCP demo to a concrete evidence-backed public-statistics research service.
- Made the MCP endpoint a secondary automation path instead of the primary website action.
- Normalized transforms across Python and TypeScript so equivalent results produce the same result hash.
- Made the e-Gov population recipe deterministic and actionable with dataset and resource identifiers, metadata, URL, format, and licence ID.

### Fixed

- Rejected rehashed receipts that substitute an unreviewed same-host request URL or contain schema-invalid evidence fields.
- Rejected upstream responses whose returned time code does not match the requested year.
- Repaired the landing-page link to the catalog and recipe inventory.

## 0.4.0 - 2026-07-24

### Added

- A bounded year parameter for Tokyo population, with versioned retrieval contracts.
- Execution integrity receipts and local consistency verification.
- A three-tool MCP server for search, reviewed execution, and receipt verification over stdio and Cloudflare Streamable HTTP.
- Deterministic runtime bundle, DCAT 3 JSON-LD export, MCP Registry metadata, and Cloudflare Worker reference deployment.
- Cross-runtime MCP integration tests and TypeScript CI.

### Changed

- Raised the catalog and runner versions to 0.4.0 and expanded the reviewed corpus to six recipes.

## 0.3.1 - 2026-07-24

### Added

- A concise `--format text` view that keeps values, interpretation, provenance, and licensing visible.
- An English quick start, OSS adoption strategy, and support routing guide.

### Changed

- Expanded the primary quick start into a complete clone-to-result path.

## 0.3.0 - 2026-07-24

### Added

- Five verified, executable retrieval recipes focused on Japanese public-data questions.
- A dependency-free recipe runner with bounded HTTPS GET requests, host allowlists, response assertions, provenance, and attribution output.
- A registration-free Statistics Dashboard Web API source profile.
- Unit tests, pull-request validation, and weekly live recipe probes.
- Recipe request, failure, and external-test forms; an onboarding test protocol; a pull-request checklist; a code of conduct; and a security policy.

### Changed

- Reframed the project from catalog growth toward reproducible, source-attributed retrieval.
- Strengthened validation so the dependency-free validator enforces the catalog contract and validates recipes.
