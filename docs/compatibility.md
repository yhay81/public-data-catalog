# Compatibility matrix

Date: 2026-07-25

This matrix separates implementation conformance from independent client
onboarding. A row is `passing` only for the checks listed in that row; it does
not imply that every agent host has been tested.

## Conformance surfaces

| Surface | Version / transport | Evidence | Status |
| --- | --- | --- | --- |
| Python reference runner | Python 3.11+, CLI | 33 unit tests; live 2025 retrieval; valid receipt verification; result and evidence-envelope tamper rejection | passing |
| TypeScript core | Node.js 24, TypeScript 7.0.2, MCP SDK 1.29.0 | 5 in-memory MCP integration tests; all 3 tools; bounded parameter refusal; 8 verification checks | passing |
| Cross-runtime receipt | Python execution → TypeScript verifier | A live Python 2025 receipt passed all 8 checks through MCP Inspector; provenance-only tampering was rejected | passing |
| Generated contract pack | JSON Schema + deterministic bundle | catalog, recipe, receipt schemas and both generated artifacts checked in CI | passing |

## MCP clients and transports

| Client | Server surface | Discovery | Tool call | Evidence verification | Status |
| --- | --- | --- | --- | --- | --- |
| MCP Inspector 0.21.2 | local stdio | 3 tools listed | live `execute` returned the reviewed 2025 result | valid Python receipt accepted; provenance-only tamper rejected | passing |
| MCP Inspector 0.21.2 | public Streamable HTTP | 3 tools listed | `search_data` and live parameterized `execute` passed | all 8 checks accepted a valid Python receipt; provenance-only tamper rejected | passing |
| External agent host A | public Streamable HTTP | not run | not run | not run | pending |
| External agent host B | public Streamable HTTP | not run | not run | not run | pending |

The Inspector checks use the official
[`@modelcontextprotocol/inspector`](https://github.com/modelcontextprotocol/inspector#cli-mode)
CLI. Reproduce the local discovery check with:

```sh
npx -y @modelcontextprotocol/inspector@0.21.2 \
  --cli ./node_modules/.bin/tsx src/stdio.ts \
  --method tools/list
```

Reproduce public discovery with:

```sh
npx -y @modelcontextprotocol/inspector@0.21.2 \
  --cli https://pdc.yhay81.com/mcp \
  --transport http \
  --method tools/list
```

## Support rule

A client or runtime becomes supported only after it can:

1. list exactly `search_data`, `execute`, and `verify`;
2. execute a reviewed parameterized contract;
3. retain source, licence, interpretation, and receipt fields;
4. accept an untampered cross-runtime receipt;
5. reject result or provenance tampering;
6. preserve an execute error as an error rather than a valid empty result.

External agent-host rows remain pending until sanitized reports are submitted
through the [external execution protocol](./external-test-protocol.md). Pending
rows are roadmap targets, not compatibility claims.
