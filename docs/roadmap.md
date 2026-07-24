# Roadmap

The project grows by validated questions, not source count.

## Now: prove the retrieval unit

- [x] Define the verified retrieval recipe format.
- [x] Publish five bounded, source-attributed recipes.
- [x] Add a dependency-free safe runner.
- [x] Add local validation, unit tests, pull-request CI, and weekly probes.
- [ ] Test all five recipes with at least five people or independent AI-agent sessions using the [external execution protocol](./external-test-protocol.md).
- [ ] Measure time to first valid result without additional web search.
- [ ] Record confusing steps and revise the recipe format once.

## Next: validate demand

Proceed only after the first external tests.

- Add recipes adjacent to questions that testers actually tried to answer.
- Provide parameterized inputs only where fixed recipes have demonstrated the need.
- Publish probe history without turning temporary upstream failures into noisy commits.
- Seek a second contribution from at least one non-maintainer.
- Add a DCAT 3 export for source profiles if an external consumer needs it.

## Later: distribution adapters

Build these only if the recipe layer is used repeatedly.

- A small installable CLI.
- An AI-agent skill that searches and runs reviewed recipes.
- A read-only MCP adapter exposing a small recipe-oriented tool surface.
- Optional integrations with Japanese open-data directories and query platforms.

## Decision gates

After the first five external tests:

1. Low execution success: improve the recipes and runner.
2. High execution success but low demand: narrow the audience or question family.
3. High demand but high maintenance: reduce supported sources and automate probes.
4. High execution success and repeat use: add only adjacent recipes and distribution adapters.
