# Public Data Catalog — Verified Recipes for Japan

[日本語](./README.md)

[![CI](https://github.com/yhay81/public-data-catalog/actions/workflows/ci.yml/badge.svg)](https://github.com/yhay81/public-data-catalog/actions/workflows/ci.yml)
[![Recipe probes](https://github.com/yhay81/public-data-catalog/actions/workflows/recipe-probes.yml/badge.svg)](https://github.com/yhay81/public-data-catalog/actions/workflows/recipe-probes.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

![PDC brand visual showing three verification checkpoints inside a closed audit circuit](./public/og.png)

Japanese-first, tested retrieval recipes that help developers and AI agents move from a concrete public-data question to a small, reproducible, attributable result.

Brand site: [PDC — Verified routes to official public data](https://public-data-catalog-mcp.yusuke8h.workers.dev/) · [Brand guide](./docs/brand.md)

This is not another exhaustive link list or a mirror of government data. Each recipe keeps a bounded request, response assertions, extracted values, interpretation notes, provenance, license, and verification date together.

## Try it in one minute

The runner has no third-party runtime dependencies and requires Python 3.11 or newer.

```sh
git clone --depth 1 https://github.com/yhay81/public-data-catalog.git
cd public-data-catalog
python3 scripts/recipe_tool.py run tokyo-population-2023 --format text
```

The text view makes the value, context, source, and license easy to inspect. The default output is full JSON for agents and downstream tools:

```sh
python3 scripts/recipe_tool.py run tokyo-population-2023
```

Published values can be revised by the source. Every successful result includes the retrieval time, final request URL, interpretation notes, official evidence, attribution text, and license URL.

## Connect an AI agent

The public server uses the current MCP Streamable HTTP transport:

```sh
# Codex
codex mcp add public-data-catalog \
  --url https://public-data-catalog-mcp.yusuke8h.workers.dev/mcp

# Claude Code
claude mcp add --transport http public-data-catalog \
  https://public-data-catalog-mcp.yusuke8h.workers.dev/mcp
```

It exposes only three tools: `search_data` discovers sources and contracts, `execute` runs a reviewed contract, and `verify` checks execution-receipt integrity. It does not accept arbitrary URLs, SQL, or code. The Cloudflare Workers deployment is a reference service without an availability guarantee.

The [client setup guide](./docs/client-setup.md) covers UI setup, a one-minute connection check, removal, and troubleshooting. For local stdio use with Node.js 24 or newer, run `npm ci && npm run mcp`. See the [architecture](./docs/architecture.md) for trust boundaries, the [compatibility matrix](./docs/compatibility.md) for proven surfaces, and [`server.json`](./server.json) for MCP Registry metadata.

## Verified recipes

| ID | Question | Source | Authentication |
| --- | --- | --- | --- |
| `tokyo-population-by-year` | What was Tokyo's population in a selected year from 2015–2025? | Statistics Dashboard | None |
| `tokyo-population-2023` | What was Tokyo's total population in 2023? | Statistics Dashboard | None |
| `japan-unemployment-rate-2023` | What was Japan's unemployment rate in 2023? | Statistics Dashboard | None |
| `egov-population-dataset-search` | Can e-Gov locate a population dataset and its resource? | e-Gov Data Portal | None |
| `world-bank-japan-population-2023` | What was Japan's 2023 population according to the World Bank? | World Bank | None |
| `usgs-noto-earthquake-2024` | How does USGS record the 2024 Noto Peninsula earthquake? | USGS | None |

List and inspect the available contracts:

```sh
python3 scripts/recipe_tool.py list
python3 scripts/recipe_tool.py list --json
python3 scripts/recipe_tool.py show usgs-noto-earthquake-2024
python3 scripts/recipe_tool.py run tokyo-population-by-year --param year=2025
python3 scripts/recipe_tool.py verify result.json
```

Successful JSON results include an integrity receipt that binds the contract version, parameters, request, response hash, extracted-result hash, and provenance.

## Trust boundary

- Recipes use reviewed HTTPS GET requests only.
- Request and redirect hosts must be explicitly allowlisted and resolve to public addresses.
- Responses are bounded to at most 1 MB, with a timeout and one conservative retry.
- Assertions check identifiers and response structure instead of freezing legitimately revisable values.
- Results retain source, license, credit, interpretation, and verification metadata.
- A public endpoint is not automatically unrestricted data. Dataset- and record-level terms still apply.

See the [recipe format](./docs/recipe-format.md), [security policy](./SECURITY.md), and current [verification status](./docs/status.md).

## Validation

```sh
python3 scripts/validate_catalog.py
python3 scripts/evaluate_agent_traces.py --check-set
python3 -m unittest discover -s tests -v
python3 scripts/recipe_tool.py check
npm ci
npm run artifacts:check
npm run typecheck
npm test
```

Pull-request CI performs local contract and unit checks. A separate weekly and manually dispatchable workflow runs the bounded live probes.

`catalog.json` and `recipes/*.json` remain the sources of truth. The deterministic [agent bundle](./generated/catalog.bundle.json) and [DCAT 3 JSON-LD export](./generated/catalog.dcat.jsonld) provide portable, vendor-neutral consumption formats.

## Contributing

Start with a concrete question, not a request to increase the source count.

1. Read [CONTRIBUTING.md](./CONTRIBUTING.md) and the [recipe format](./docs/recipe-format.md).
2. Confirm official documentation, licensing, and attribution requirements.
3. Add one small, read-only recipe for one question.
4. Run local validation and the affected live probe.
5. Record the result, evidence, units, identifiers, and interpretation caveats.

An independent onboarding test is also a valuable first contribution. Follow the [external execution protocol](./docs/external-test-protocol.md) and submit the [external-test form](https://github.com/yhay81/public-data-catalog/issues/new?template=external-test.yml). Agent hosts can use the [nine-scenario evaluation set and scorer](./evals/README.md), which cover all six recipes and false-success cases.

The project's differentiation and evidence gates are documented in [strategy](./docs/strategy.md) and the [roadmap](./docs/roadmap.md). For usage and reporting routes, see [SUPPORT.md](./SUPPORT.md).

## License

The repository's structured metadata, code, and documentation are provided under the MIT License. Data and services referenced by the catalog remain subject to their own official terms.
