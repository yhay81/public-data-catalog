# Investigation Log

This log keeps the research direction visible and records why entries were added or deferred. The structured details remain in `catalog.json`.

## First recipe proof set: 2026-07-24

Five bounded, registration-free retrieval recipes were implemented and successfully executed:

- Tokyo total population in 2023 and Japan's 2023 unemployment rate through the official Statistics Dashboard Web API;
- population-dataset discovery through the e-Gov Data Portal metadata API;
- Japan's 2023 population through the World Bank Indicators API for a cross-source comparison case;
- the 2024 Noto Peninsula earthquake record through the USGS Earthquake Catalog API.

`statistics-dashboard-api` was added because it provides a registration-free Japanese official-statistics path while retaining indicator, region, time, unit, survey, annotation, and provisional-status metadata. Its official API guide states that registration is not required, and its copyright policy applies PDL1.0 with specific attribution and API-service credit guidance.

The five recipes passed their response assertions on 2026-07-24. This verifies the implementation and upstream contracts at that time. It does not yet verify that an unfamiliar user can complete the workflow without additional research. External execution testing is the next gate.

The runner is intentionally limited to reviewed HTTPS GET requests, explicit hosts, public network addresses, bounded JSON responses, and a small assertion/extraction language. Parameterized URLs, arbitrary commands, request bodies, and credential injection were deferred because none of the first five proof questions required them.

## Direction change: 2026-07-13

The activity is being reframed from catalog growth to verified retrieval readiness. Until the first five retrieval recipes have been tested, adding sources only to broaden domain coverage is paused. See `docs/value-redefinition.md` for the working decision, success criteria, and next gate.

## 2026-07-13

### Starting coverage

The initial catalog covered Japanese official statistics, weather and climate, global development indicators, biodiversity occurrences, U.S. demographic statistics, and scholarly metadata. It was strong on API examples but did not yet show a government-wide catalog, geospatial feature queries, hazard observations, reanalysis data, biomedical literature, or community-maintained product data.

### Added to the catalog

- `egov-data-portal`: a Japanese central-government portal and metadata API for finding datasets across ministries.
- `usgs-earthquake-api`: event-level earthquake and hazard observations with GeoJSON, CSV, XML, KML, and QuakeML access.
- `overpass-api`: read-only, queryable OpenStreetMap map features for geospatial discovery.
- `copernicus-climate-data-store`: global climate reanalysis and related products, including ERA5, with API and download access.
- `europe-pmc-api`: biomedical publications, open-access full text links, citations, and text-mining annotations.
- `open-food-facts-api`: community-contributed product, ingredient, nutrition, allergen, and label data.

Each addition was checked against official documentation and an official license or terms page. The entries intentionally retain caveats where licensing, provenance, completeness, or access conditions vary by dataset or record.

### Historical coverage gaps

These gaps were identified before the direction change above. They are parked rather than treated as an automatic addition backlog; work should resume only when a concrete retrieval scenario requires one of them.

- Japanese local-government and geospatial open-data portals.
- Satellite and earth-observation archives beyond climate reanalysis.
- Transport, energy, finance, public-health surveillance, and cultural-heritage data.
- A consistent way to record update frequency, download size, pagination, and schema/version drift.
- Automated URL reachability checks that do not turn routine provider outages into catalog noise.
