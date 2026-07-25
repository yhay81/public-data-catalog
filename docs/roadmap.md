# Roadmap: from verified recipes to public-data trust infrastructure

Status: active

Date: 2026-07-25

Review cadence: monthly, and after every evidence gate

## Ultimate purpose

Make it normal for a public-data claim used by an AI agent or a person to remain
traceable to an official source, reproducible under a versioned contract, and
checkable by an independent implementation.

PDC should reduce the distance between:

> “An official dataset probably exists”

and:

> “This result was retrieved under these bounded conditions, from this source,
> with this meaning and license, and another party can reproduce or invalidate
> it.”

The project is not trying to own the underlying public data. It is building the
open trust layer around selecting, retrieving, interpreting, citing, and
rechecking it.

## Strategic position

The initial wedge is **Japanese official statistics and administrative data for
AI-agent and developer workflows**, with international sources included only
when a Japanese question needs comparison or independent context.

PDC will not compete on:

- number of catalog entries;
- copied data volume;
- number of MCP tools;
- general web search;
- autonomous-agent complexity.

PDC can win on:

1. **A reviewable contract corpus** — a concrete question is bound to a small,
   safe, versioned retrieval.
2. **Evidence-preserving execution** — the result retains parameters,
   provenance, license, interpretation, and a verifiable receipt.
3. **Drift knowledge** — failures, revisions, and upstream changes become
   reusable maintenance evidence.
4. **Cross-runtime conformance** — Python, TypeScript, hosted MCP, and future
   adapters must agree on the same contracts and receipts.
5. **Japanese public-data semantics** — region codes, statistical definitions,
   provisional status, units, attribution, and administrative conventions are
   treated as product behavior rather than documentation footnotes.

The unit stored in the repository remains the **verified retrieval recipe**.
The unit of user value is a **verified answer chain**:

```text
question
  → source selection
  → versioned retrieval contract
  → bounded execution
  → interpreted result + attribution
  → integrity receipt
  → independent reproduction
```

## North-star measure

The north-star measure is:

> **Independently reproduced, attributable retrieval scenarios per month.**

A scenario counts only when:

- the result was obtained outside the maintainer's implementation test that
  created the recipe;
- the result includes its source, license or terms, interpretation, and
  verification date;
- the receipt or equivalent evidence check passes;
- failures and empty results are not misreported as valid answers.

Catalog entries, requests, GitHub stars, and MCP connections are supporting
signals. They do not count as value by themselves.

### Operating scorecard

| Dimension | Measure | Initial target |
| --- | --- | --- |
| Activation | Independent sessions reaching a valid attributed result | at least 4 of 5 |
| Speed | Successful registration-free sessions completed without extra research | within 2 minutes |
| Demand | Testers naming a real workflow | at least 3 of 5 |
| Reuse | Independent workflows executing the same family again within 30 days | at least 3 after Gate 1 |
| Trust | False-success results | zero |
| Compatibility | Supported runners and clients passing the same conformance cases | 100% of the published matrix |
| Freshness | Known breaking drift classified | within 48 hours of detection |
| Community | Non-maintainer reports or merged contributions | at least 2 by day 90 |
| Sustainability | Median maintenance time per active contract | at most 15 minutes per month |

Metrics must not collect prompts, result values, personal data, credentials, or
full upstream responses. Until a privacy-reviewed aggregate measurement design
exists, external test reports are the source of product evidence.

The current measurements and unknowns are maintained in the
[product evidence scorecard](./scorecard.md).

## Product principles

1. **Questions before sources.** Add a contract because a real question needs
   it, not because a catalog category looks empty.
2. **Deterministic trust boundary.** Models may help discover or draft a
   contract, but reviewed execution and verification remain deterministic.
3. **Three stable operations.** Keep `search_data`, `execute`, and `verify` as
   the default MCP surface. Add capability behind those operations rather than
   creating one tool per dataset.
4. **Receipts are evidence, not endorsement.** A receipt proves what PDC
   observed and whether the artifact changed. It does not claim that the
   upstream publisher signed the value or that the value remains current.
5. **Portable core, replaceable adapters.** JSON Schema, contract semantics,
   test vectors, and receipts must not depend on Cloudflare, MCP, or one
   programming language.
6. **Stable standards first.** Track emerging standards, but dual-run or
   isolate experimental integrations until interoperability is demonstrated.
7. **Infrastructure follows measured load.** Add storage, queues, search
   services, and state only when a recorded threshold is crossed.
8. **Public retrieval stays simple.** Do not add accounts or OAuth to
   registration-free public contracts. Authentication belongs to future
   user-bound or mutating capabilities.

## Current baseline

As of 2026-07-25:

- 13 reviewed source profiles;
- 6 executable recipes, including one bounded 2015–2025 contract family;
- dependency-free Python execution;
- shared TypeScript execution and receipt semantics;
- a three-tool stdio and remote MCP server;
- a stateless Cloudflare Worker deployment;
- deterministic agent bundle and DCAT 3 JSON-LD;
- MCP Registry preview publication;
- weekly live probes and local conformance tests;
- a public brand site and connection guide;
- a nine-scenario agent evaluation set covering all six recipes and false-success
  cases;
- a published compatibility matrix with local stdio and cross-runtime evidence;
- zero completed independent execution reports.

The technical spike is complete. Demand and independent usability are not yet
proven. **Gate 1 is now the only critical path.**

## Phase 0 — foundation

Status: complete

- [x] Define source profiles and verified retrieval recipes.
- [x] Publish the first six bounded recipes.
- [x] Implement safe Python and TypeScript execution.
- [x] Add response assertions, integrity receipts, and offline verification.
- [x] Add deterministic artifacts and DCAT 3 export.
- [x] Expose three tools over stdio and stateless Streamable HTTP.
- [x] Deploy the reference server to Cloudflare Workers.
- [x] Publish MCP Registry metadata.
- [x] Add CI, weekly probes, contribution templates, security policy, website,
      and brand system.

## Phase 1 — prove independent value

Window: days 0–30

Entry: current state

Goal: prove that the retrieval unit works without maintainer context and that
the result matters to a real workflow.

### Deliverables

1. Complete five independent sessions through
   [Issue #2](https://github.com/yhay81/public-data-catalog/issues/2) and the
   [external execution protocol](./external-test-protocol.md).
2. Include at least:
   - two human developer or analyst sessions;
   - two AI-agent sessions;
   - two distinct MCP clients or agent hosts;
   - one clean Python runner session;
   - coverage of all six recipes across the five sessions.
3. Record success, elapsed time, extra-help use, failure category, and real
   workflow intent for every session.
4. Add a small checked-in agent evaluation set covering:
   - source selection;
   - parameter binding;
   - refusal of unreviewed parameters;
   - correct attribution;
   - receipt verification;
   - detection of tampered and upstream-error cases.
5. Publish a compatibility matrix for Python, TypeScript, remote MCP, and the
   externally tested clients.
6. Record actual maintainer minutes spent investigating weekly probe results.

### Exit gate

Proceed only when:

- at least 4 of 5 sessions produce a valid attributed result;
- successful sessions finish within two minutes without extra web search;
- no upstream failure is accepted as a valid empty result;
- at least three testers identify a real workflow;
- at least two adjacent questions are requested;
- at least one non-maintainer submits a report or correction.

If activation fails, improve onboarding, contracts, and failure reporting.
If activation passes but demand fails, narrow the audience or question family.
Do not add a database, vector search, A2A, a new runtime, or more source
categories to solve a demand problem.

## Phase 2 — prove repeated usefulness

Window: days 31–90

Entry: Gate 1 passed

Goal: turn one demonstrated question family into a workflow people or agents
reuse.

### Deliverables

1. Select exactly one vertical from observed demand. Likely candidates include
   regional population, labor, economic, or administrative statistics, but
   tester evidence decides.
2. Expand in tranches of no more than three adjacent contracts. Each tranche
   must improve the evaluation set before the next begins.
3. Generalize only reviewed dimensions such as year, region, indicator, or
   classification code. Do not expose arbitrary URLs, SQL, request bodies, or
   model-written execution code.
4. Publish an agent skill with:
   - when PDC should be used;
   - example questions;
   - required citation behavior;
   - receipt verification;
   - refusal and fallback behavior.
5. Test whether MCP resources reduce repeated schema/context transfer. Adopt
   them only if client support is sufficient and evaluation quality or context
   cost materially improves.
6. Design privacy-preserving aggregate usage measurement. Allowed dimensions
   are tool name, contract ID, status class, protocol version, latency bucket,
   and anonymous daily counts. Prompts, parameters, results, IP addresses, and
   credentials are excluded.
7. Recruit a second reviewer for the selected vertical.

### Exit gate

- at least three independent workflows repeat a retrieval within 30 days;
- at least 30 independently successful attributed retrievals are recorded;
- agent evaluations pass at least 90%, with zero false-success cases;
- two non-maintainer contributions or corrections are merged;
- the median active-contract maintenance cost remains at most 15 minutes per
  month.

If reuse does not appear, freeze contract growth and revisit positioning. If
maintenance exceeds value, reduce the supported family instead of automating
everything.

## Phase 3 — make trust operational

Window: months 3–6

Entry: Gate 2 passed

Goal: make freshness, drift, and receipt trust independently observable.

### Deliverables

1. Publish append-only probe summaries and a drift taxonomy without committing
   temporary outages as catalog changes.
2. Add a machine-readable status view separating:
   - upstream outage or rate limit;
   - response-contract break;
   - legitimate data revision;
   - license or usage-condition change;
   - PDC implementation failure.
3. Design receipt version 2 with optional signatures. A signature attests that
   a named PDC implementation observed a response under a specific contract at
   a specific time; it must not imply upstream publisher endorsement.
4. Have a second implementation verify the signed test vectors.
5. Define an availability objective only after real recurring use exists.
   Upstream execution availability and PDC handler availability must be
   reported separately.
6. Complete a focused security review covering SSRF boundaries, redirects,
   content limits, receipt canonicalization, protocol versions, and dependency
   integrity.
7. Evaluate a Hayate adapter only if it attracts Python contributors or removes
   a measured operating constraint. It must pass the same tool, receipt, and
   security conformance suite before receiving traffic.

### Exit gate

- breaking drift is detected within seven days and classified within 48 hours;
- a broken contract is repaired, narrowed, or deprecated within seven days;
- signed receipt vectors verify in two independent implementations;
- the selected vertical has a second active reviewer;
- reliability work does not require storing user prompts or complete response
  bodies.

## Phase 4 — become an interoperable trust layer

Window: months 6–12

Entry: Gate 3 passed

Goal: let other catalogs, agents, and runtimes consume PDC contracts and
evidence without adopting PDC's hosting stack.

### Deliverables

1. Version and publish portable contract packs, receipt vectors, and verifier
   libraries for at least Python and TypeScript.
2. Validate the DCAT 3 export with one real external catalog consumer.
3. Maintain MCP Registry metadata while it is in preview, but do not make the
   registry the only discovery path.
4. Implement MCP Server Cards through a `.well-known` endpoint only after the
   format is stable and at least two clients or registries consume it.
5. Track MCP Tasks, reference-based results, triggers, and Skills over MCP.
   Adopt them only after specification stability and a PDC scenario demonstrates
   a clear lifecycle or context-cost benefit.
6. Add A2A only when two independent orchestrators need to delegate a
   long-running public-data task to PDC. Any A2A adapter must return the same
   contract and receipt evidence as MCP; it must not create a second truth
   model.
7. Establish a documented contributor ladder and a bus factor of at least two
   for release and contract review.

### Exit gate

- at least ten external workflows use PDC in a month;
- at least three integrations are recurring rather than one-off demos;
- one external catalog consumes the DCAT or contract-pack output;
- two independent MCP clients pass the compatibility suite;
- release and recipe review no longer depend on one person.

## Phase 5 — federated public-data verification

Window: months 12–24

Entry: Gate 4 passed

Goal: allow trusted communities to publish compatible recipe packs and evidence
without centralizing all data or review authority in this repository.

Potential outcomes:

- a conformance suite and compatibility badge for contract packs;
- signed recipe-pack releases with reviewer and source-policy metadata;
- federated discovery across Japanese national, local-government, research, and
  selected international publishers;
- reusable drift and interpretation test corpora;
- managed reliability for organizations that need private contracts, audit
  export, or uptime commitments while the core formats, runner, and verifier
  remain open.

This phase is an option, not a commitment. It begins only if multiple
independent publishers want to produce compatible evidence. PDC must not become
a central authority that claims to certify the truth of public data.

## Infrastructure trigger matrix

The default architecture remains Git, generated static artifacts, stateless
Workers, and direct bounded reads.

| Capability | Introduce only when | Do not introduce merely because |
| --- | --- | --- |
| D1 | Static bundle search or append-only probe-history queries no longer meet a measured latency or size target | a database appears more scalable |
| Analytics Engine or equivalent | Gate 1 passes and a privacy-reviewed aggregate measurement design exists | raw traffic counts are available |
| Queues | Probe volume or retry isolation exceeds the simple scheduled job | asynchronous systems are fashionable |
| Workflows | A multi-step operation must resume after delay or failure and its lifecycle is tested | one request is slow |
| Durable Objects / `McpAgent` | A proven feature requires per-session state, elicitation, or durable coordination | MCP can be stateful |
| R2 | Licensed immutable artifacts become too large for GitHub releases and are requested by consumers | PDC references large upstream datasets |
| R2 Data Catalog / R2 SQL | There are licensed analytical snapshots, repeated SQL workloads, and enough volume to justify Iceberg operations | Cloudflare offers a lakehouse |
| Semantic/vector search | A labeled query set shows lexical search failing and semantic search improves success materially without hiding provenance | embeddings are available |
| OAuth / Access | User-bound, private, or mutating tools exist | public read-only recipes need a login |
| Hayate | Cross-runtime demand or maintenance evidence justifies a Python edge adapter and parity tests pass | a new runtime is technically possible |
| A2A | Independent orchestrators need delegated, asynchronous PDC tasks | agent-to-agent interoperability exists |

R2 Data Catalog and R2 SQL are currently beta services. If adopted later, keep
Apache Iceberg and the contract-pack format as the portability boundary.

## Standards watchlist

### Adopt and maintain

- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
  for remote agent connection.
- [MCP Registry remote metadata](https://modelcontextprotocol.io/registry/remote-servers),
  with the understanding that the registry is still in preview.
- [W3C DCAT 3](https://www.w3.org/TR/vocab-dcat-3/) for catalog
  interoperability.
- JSON Schema and deterministic JSON artifacts as the runtime-neutral contract
  boundary.

### Watch, do not lead with

- [MCP Server Cards, Tasks, enterprise audit, triggers, and reference-based
  results](https://modelcontextprotocol.io/development/roadmap).
- Skills over MCP and other MCP extensions until lifecycle and registry support
  stabilize.
- [A2A](https://a2a-protocol.org/latest/) for agent-to-agent delegation; MCP
  remains the correct tool boundary for the current product.
- [Cloudflare R2 Data Catalog](https://developers.cloudflare.com/r2/data-catalog/)
  and R2 SQL for licensed analytical scale, not the current metadata corpus.

Cloudflare's current guidance favors small goal-oriented MCP tool surfaces and
evaluation tests. PDC's three-tool design follows that direction. Cloudflare's
Code Mode is useful for huge APIs, but model-written code must not enter PDC's
reviewed execution boundary.

## Explicit no-build list for the next 90 days

Until Gate 1 passes, do not build:

- a general-purpose public-data agent or chat UI;
- a vector database or semantic search service;
- a bulk mirror, lakehouse, R2 catalog, or R2 SQL layer;
- arbitrary code, SQL, URL, or request execution;
- one MCP tool per dataset;
- OAuth for the public read-only server;
- stateful MCP sessions;
- an A2A agent;
- a production Hayate migration;
- source-count expansion without a tested question.

These are not permanent prohibitions. They prevent unmeasured infrastructure
from displacing the only current critical path: independent use.

## Immediate next actions

1. Recruit and run the five independent sessions in Issue #2.
2. Add the first agent evaluation cases before changing tool descriptions.
3. Publish a client/runtime compatibility matrix.
4. Record weekly probe investigation time.
5. Review the Gate 1 evidence and choose exactly one of:
   - improve activation;
   - narrow the user or question family;
   - expand one proven vertical.

Every new roadmap item must name the user scenario, metric it should move, entry
gate, exit evidence, and removal condition.
