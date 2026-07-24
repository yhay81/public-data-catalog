# OSS Adoption Strategy

Date: 2026-07-24

## Position

Public Data Catalog should become the **Japanese-first collection of tested, source-specific retrieval contracts for official data**.

Its job is not to maximize the number of discoverable datasets. It should make a smaller number of important questions reproducible while preserving the request, response contract, units, identifiers, interpretation, provenance, attribution, license, and freshness evidence.

## Where it fits

| Existing approach | What it does well | Boundary for this project |
| --- | --- | --- |
| [Awesome Public Datasets](https://github.com/awesomedata/awesome-public-datasets) | Broad, community-curated dataset discovery | Do not compete on link count |
| [CKAN](https://docs.ckan.org/en/latest/api/) and government portals | Publishing and searching catalog metadata | Consume official catalog evidence; do not become another portal |
| [W3C DCAT 3](https://www.w3.org/TR/vocab-dcat-3/) | Interoperable catalog vocabulary | Export only when a real consumer needs it |
| [Frictionless Data Package](https://specs.frictionlessdata.io/guides/data-package/) | Portable dataset and table packaging | Do not duplicate dataset packaging |
| [Data Commons MCP](https://docs.datacommons.org/mcp/) | Normalized cross-source graph queries through AI agents | Preserve source-specific semantics and official evidence instead of normalizing everything |

The defensible gap is the last mile between “an API or dataset exists” and “this exact result can still be retrieved, interpreted, attributed, and reused responsibly.”

## Product loop

1. A person or agent submits a concrete question.
2. A contributor selects the smallest appropriate official source and request.
3. Review records response assertions, extraction, interpretation, attribution, license, and verification date.
4. CI checks the local contract; bounded probes detect upstream drift.
5. An independent session attempts the recipe without extra research.
6. Failures improve the recipe or narrow the supported scope.
7. Only repeated adjacent demand justifies parameters, packaging, or agent adapters.

The north-star measure is **independently reproduced, attributable retrieval scenarios**, not catalog entries, tools, stars, or API calls alone.

## Evidence gates

### Gate A — activation

Run at least five independent sessions covering all initial recipes.

- At least 80% reach a valid attributed result.
- Successful sessions finish within two minutes.
- No unpublished instruction or extra web search is required.
- Failure causes are distinguishable.

If this fails, improve onboarding and recipe clarity before expanding.

### Gate B — demand

Among successful testers:

- at least three can name a real workflow where the result is useful;
- at least two request an adjacent question or controlled parameter;
- at least one non-maintainer submits a report, correction, or recipe contribution.

If activation passes but demand does not, narrow the user or question family.

### Gate C — distribution

Only after repeated use:

- parameterize one proven recipe family with strict allowlists;
- test one distribution adapter, such as an installable CLI or a small read-only MCP surface;
- keep the dependency-free repository runner as the reference implementation.

Do not build a hosted general-purpose data agent before these gates.

## 30 / 60 / 90-day plan

### First 30 days

- Complete the five independent execution reports.
- Measure success rate, median time, slowest successful time, and extra-help rate.
- Ask every tester whether the result supports a real workflow.
- Fix the first repeated onboarding problem.
- Recruit one non-maintainer documentation or recipe contribution.

### Days 31–60, only if Gate A passes

- Select the question family with the strongest stated demand.
- Add no more than three adjacent recipes.
- Decide between one strictly bounded parameterization experiment and one local agent-adapter experiment.
- Measure weekly probe failures and maintainer minutes per recipe.

### Days 61–90, only if Gates A and B pass

- Package the proven interface for its actual users.
- Publish a stable machine-readable bundle or registry entry only when a consumer exists.
- Establish a second maintainer or reviewer for the proven question family.
- Remove unused or high-maintenance recipes rather than accumulating them.

## Measures

| Measure | Why it matters |
| --- | --- |
| Independent execution success rate | Whether the artifact works outside the maintainer's context |
| Time to attributed result | Whether onboarding is genuinely short |
| Extra-help rate | Whether documentation is self-sufficient |
| Real-workflow intent | Whether the result matters beyond a demo |
| Adjacent-question requests | Whether controlled generalization is justified |
| Non-maintainer contributions | Whether the project can become a community |
| Probe failures and maintenance minutes | Whether trust remains affordable |

GitHub stars, forks, views, and clones are useful distribution signals, but they are secondary and must not substitute for successful retrievals.

## Stop conditions

Pause expansion when:

- fewer than four of five independent sessions succeed;
- no tester identifies a real workflow;
- upstream terms cannot be recorded clearly;
- a recipe requires secrets or broad retrieval without a safe design;
- maintenance effort grows faster than independently reproduced scenarios.

Success means a small trusted corpus used repeatedly, not a large unattended catalog.
