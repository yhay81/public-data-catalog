# Purpose and Scope

This repository reduces the uncertainty between a data question and the first trustworthy, reproducible result from public data.

The activity is not successful merely because the catalog contains many sources. It creates value when an AI or a person can use the maintained information to:

- decide whether a source is appropriate for a concrete question;
- run a small, valid first request without repeating basic documentation research;
- interpret the result with its provenance, license, limitations, and verification date intact.

The primary audience is people and AI agents building research, analysis, and data workflows. The catalog should help them move from an unfamiliar question to an attributable first result in a short, measurable time.

## Unit of value

A source profile is necessary, but it is not the final unit of value. The intended unit is a **verified retrieval recipe**: a source profile connected to at least one concrete question, a bounded retrieval method, the expected response shape, interpretation notes, and official evidence.

The existing `catalog.json` is the source-profile layer. Files under `recipes/` add executable recipes and lightweight response checks without turning this repository into a mirror of the underlying data.

The activity therefore optimizes for:

1. **Selection** — choosing a source that can actually answer the question.
2. **Execution** — reaching a valid first response with a reproducible request.
3. **Trust** — retaining provenance, licensing, attribution, and quality caveats.
4. **Freshness** — detecting when an endpoint, contract, or usage condition has changed.

The catalog is an inventory of data access points, not a mirror of the underlying data. Each entry should make the following questions answerable:

- What kind of data is available, from whom, where, and for what period?
- Can it be reached through an API, download, or portal, and what authentication or usage limits apply?
- What formats and query vocabulary should a user start with?
- Which license, attribution, privacy, provenance, and quality conditions affect reuse?
- When was the official information last checked?

## Source of truth

- `catalog.json` is the machine-readable catalog.
- `catalog.schema.json` defines the entry shape.
- `recipes/*.json` are the verified retrieval recipes.
- `recipe.schema.json` defines the recipe shape.
- `README.md` explains how to read and contribute to the catalog.
- `docs/status.md` records the last reviewed complete probe.
- `docs/investigation-log.md` records investigation decisions and coverage gaps.

## Investigation loop

1. Start with a concrete data question or repeated retrieval problem.
2. Discover candidate sources from an official portal or official documentation.
3. Verify access, formats, authentication, usage limits, license, and important caveats from the official source.
4. Run a bounded first retrieval and record enough detail to reproduce and interpret it.
5. Normalize the source profile and retrieval recipe without copying bulk data or secrets.
6. Record the verification date and official source URLs.
7. Run the validator, unit tests, and the specific live recipe probe, then review the diff for misleading claims.

“Publicly accessible” does not mean “unconditionally reusable.” Dataset-level, record-level, contributor, jurisdictional, privacy, and commercial-use conditions must remain visible in the entry.

## Non-goals

- Maximizing the number of entries or attempting to become a comprehensive global directory.
- Mirroring or redistributing large amounts of source data.
- Treating a catalog entry as an endorsement, quality guarantee, or legal opinion.
- Registering private, credential-gated, or scraping-only sources as public data.
- Hiding uncertainty behind broad claims such as “free,” “complete,” or “commercially usable.”
- Maintaining source profiles that are not connected to a plausible user question or decision.

The catalog should grow when a verified recipe makes a meaningful question easier to answer, not simply when another link can be added.

## Current proof set

The first proof set contains five bounded, registration-free recipes:

- two Japanese official-statistics questions through Statistics Dashboard;
- one Japanese government data-catalog discovery question;
- one international comparison through the World Bank;
- one Japan-related earthquake record through the USGS catalog.

This set is an implementation milestone, not proof of demand. The next gate is independent execution by at least five people or AI-agent sessions.
