# Roadmap

The project grows by validated questions, not source count.

## Now: prove the retrieval unit

- [x] Define the verified retrieval recipe format.
- [x] Publish six bounded, source-attributed recipes.
- [x] Add a dependency-free safe runner.
- [x] Add local validation, unit tests, pull-request CI, and weekly probes.
- [x] Add a complete clone-to-result quick start, concise human output, and an English guide.
- [x] Add one bounded parameter contract, integrity receipts, and shared Python/TypeScript execution semantics.
- [x] Publish a three-tool MCP reference service on Cloudflare Workers.
- [x] Generate a portable agent bundle and DCAT 3 JSON-LD export.
- [ ] Test all six recipes with at least five people or independent AI-agent sessions using the [external execution protocol](./external-test-protocol.md).
- [ ] Measure time to first valid result without additional web search.
- [ ] Record confusing steps and revise the recipe format once.

## Next: validate demand

Proceed only after the first external tests.

- Add recipes adjacent to questions that testers actually tried to answer.
- Measure whether the parameterized contract and MCP adapter are reused outside the maintainer's tests.
- Publish probe history without turning temporary upstream failures into noisy commits.
- Seek a second contribution from at least one non-maintainer.
- Validate the DCAT 3 export with one external catalog consumer before expanding its mapping.

## Later: distribution adapters

Build these only after the activation and demand gates in [strategy](./strategy.md).

- A small installable CLI.
- An AI-agent skill that searches and runs reviewed recipes.
- MCP Registry discovery and independent client compatibility reports.
- Optional integrations with Japanese open-data directories and query platforms.

## Decision gates

After the first five external tests:

1. Low execution success: improve the recipes and runner.
2. High execution success but low demand: narrow the audience or question family.
3. High demand but high maintenance: reduce supported sources and automate probes.
4. High execution success and repeat use: add only adjacent recipes and distribution adapters.
