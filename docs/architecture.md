# Architecture: a trusted public-data execution layer

Date: 2026-07-24

## Product boundary

The project is a portable trust layer between broad public-data discovery and an agent's final answer. It does not compete with national portals on record count and does not mirror every source. Its defensible unit is a versioned retrieval contract that can still be executed, interpreted, attributed, and checked.

```text
official catalogs and APIs
          │
          ▼
catalog.json + recipes/*.json  ← source of truth and review boundary
          │
          ├── generated/catalog.bundle.json  ← small runtime/search index
          ├── generated/catalog.dcat.jsonld  ← catalog interoperability
          ├── Python reference runner        ← dependency-free execution
          ├── browser research service       ← human-facing questions and answers
          │         └── /api/research
          └── MCP server                     ← optional agent automation
                    ├── search_data
                    ├── execute
                    └── verify
```

## Human-facing research service

The public website is the primary product surface. A visitor chooses one of the
reviewed questions and, where supported, a bounded parameter such as year. The
same execution and verification core then retrieves the official source and
returns a plain-language research memo containing the value, source, usage
terms, interpretation notes, request URL, and verification summary.

`/api/research` deliberately maps a small set of understandable topics to
reviewed recipe IDs. It is not an arbitrary query, URL-fetch, or proxy endpoint.
This keeps the browser experience simple without weakening the contract
boundary used by the MCP and local runners.

## Three planes

### Discovery plane

`search_data` searches committed metadata and contract descriptions without calling an upstream API. The current corpus is small enough to ship as one static bundle. This keeps latency and operating cost low and makes local and hosted results identical.

When the corpus no longer fits comfortably in a Worker bundle, the next step is a generated search index, not a change to the source format. D1 or another portable SQL store may serve metadata search. Source JSON remains authoritative.

### Execution plane

`execute` accepts only a recipe ID and parameters declared by that recipe. A parameter may replace only its reviewed query-field binding, within a fixed type and range. The host, path, HTTP method, headers, response size, assertions, extraction pointers, and attribution remain committed code and data.

The first parameterized family is deliberately narrow: Tokyo's annual population for 2015–2025. It proves that a fixed recipe can become useful to agents without opening an arbitrary HTTP proxy, SQL endpoint, or code executor.

### Evidence plane

Every successful execution returns the extracted result and a receipt containing:

- contract ID, version, and verification date;
- resolved parameters, exact reviewed request URL, and final allowlisted request URL;
- retrieval time, elapsed time, and raw-response SHA-256;
- passed assertion count and runner version;
- source, license, and required credit;
- extracted-result SHA-256 and a receipt SHA-256.

`verify` recomputes the receipt and result hashes without network access, checks
that the displayed contract, parameters, request metadata, and provenance match
the receipt, and checks the question and interpretation against the reviewed
recipe version in the bundled catalog. It detects later modification across the
full evidence envelope. It does not prove that an official publisher signed the
source data or that a value remains current.

## Optional agent connection

MCP is a secondary automation path for repeated research. The same server
factory is used by:

- local stdio transport for desktop agents and development;
- stateless MCP Streamable HTTP on Cloudflare Workers;
- in-memory transport in integration tests.

The tool surface stays at three tools even as recipe count grows. This keeps agent context cost stable and preserves a clear policy boundary. The hosted Worker creates a fresh MCP server for every request, following the security requirement introduced in MCP TypeScript SDK 1.26.

## Runtime strategy

The production remote server currently uses the MCP TypeScript SDK, Zod input
schemas, Cloudflare Agents' stateless handler, and Cloudflare Workers. The
dependency-free Python runner remains the portable execution reference.

Hayate 0.10 can also run directly on Cloudflare Python Workers. A Hayate adapter
can expose the same three-tool stateless Streamable HTTP endpoint without
changing the catalog, retrieval-contract, or receipt formats. It is a viable
Python-edge path, not a required client dependency.

Migration is evidence-gated: keep the production TypeScript endpoint in place,
implement the Hayate adapter beside it, and run the same tool-list,
execute/verify, receipt-vector, and remote smoke tests against both. Switch the
public route only after those outputs and security boundaries agree.

## Interoperability

- JSON Schema defines source profiles, executable contracts, and receipts.
- DCAT 3 JSON-LD exposes source profiles to standards-based catalog consumers.
- `server.json` describes the remote Streamable HTTP endpoint for the MCP Registry.
- The Python and TypeScript implementations share the same generated bundle and receipt vocabulary.
- Cloudflare is a deployment adapter, not a data-model dependency. Local stdio remains fully functional.

## Data-volume path

Scale storage only after measured use requires it:

1. **Current:** committed JSON, a generated 69 KB interoperability set, and direct bounded reads from official APIs.
2. **More metadata:** generate a compact searchable index and serve it from D1 or an equivalent store.
3. **Probe history:** store append-only health summaries in D1; do not store arbitrary user queries or full source responses by default.
4. **Large public snapshots:** place immutable objects in R2 or compatible object storage, with checksums and source terms.
5. **Analytical scale:** expose Parquet/Iceberg through an interoperable catalog only for sources whose licenses and demand justify mirroring. Cloudflare R2 Data Catalog and R2 SQL are candidates, not core requirements.

This sequence avoids paying the complexity cost of a data lake before the project has a data-lake workload.

## Deliberate non-goals

- arbitrary URL fetching, SQL, browser automation, or model-written code;
- one MCP tool per dataset or recipe;
- silently merging sources with incompatible definitions;
- storing user prompts, personal data, or complete upstream responses;
- making Cloudflare, MCP, or an experimental agent protocol the source of truth;
- A2A coordination before a real multi-agent delegation use case appears.

## Operational checks

Pull-request CI validates schemas, deterministic artifacts, both runners, and MCP behavior without calling external data providers. Weekly probes run the bounded contracts against their official sources. The public Worker exposes `/health`, `/api/research`, and `/mcp`; deployment smoke tests must complete one public research request, list the three MCP tools, and complete one live execute/verify round trip.

Relevant current specifications and platform documentation:

- [Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25)
- [MCP Registry remote servers](https://modelcontextprotocol.io/registry/remote-servers)
- [Cloudflare stateless MCP handler](https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/)
- [W3C DCAT 3](https://www.w3.org/TR/vocab-dcat-3/)
- [Apache Iceberg REST Catalog](https://iceberg.apache.org/rest-catalog-spec/)
