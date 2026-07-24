# Retrieval Recipe Format

A retrieval recipe connects one concrete question to a bounded request, a small response contract, interpretation guidance, and official evidence.

The JSON Schema is [`recipe.schema.json`](../recipe.schema.json). Each recipe is a separate JSON file under [`recipes/`](../recipes/).

## Required sections

| Field | Purpose |
| --- | --- |
| `id` | Stable lowercase recipe identifier; it must match the JSON filename |
| `contract_version` | Semantic version for the executable contract |
| `title`, `question` | Japanese and English human-readable intent |
| `source_id` | Reference to an entry in `catalog.json` |
| `parameters` | Optional, typed values with defaults and reviewed bounds |
| `request` | Reviewed HTTPS GET request and exact host allowlist |
| `expect` | HTTP, content-type, size, and JSON response assertions |
| `result.fields` | Values to extract with RFC 6901 JSON Pointers |
| `interpretation` | Units, definitions, revisions, and comparison caveats |
| `attribution` | Official evidence, license, and copyable credit |
| `last_verified` | Date the complete recipe was actually run |

## Safety constraints

The initial format is deliberately narrow.

- Only HTTPS GET requests are accepted.
- Request hosts and redirect hosts must be explicitly allowlisted.
- Direct private, loopback, link-local, and other non-public addresses are rejected.
- Query fields that look like secrets are rejected.
- Attribution and license references must also use credential-free HTTPS URLs.
- Only the `Accept` request header can be customized.
- Each recipe limits the maximum response size to at most 1 MB.
- Requests have a timeout and only one conservative retry.
- Parameters can bind only to an existing query field. The host and path are immutable.
- The initial parameter type is a bounded integer, and a safe format may wrap only `{value}`.
- Arbitrary commands, request bodies, local files, and free-form URL templates are not supported.

These constraints keep a recipe reviewable. A new capability should be added only when a real, reviewed public-data question cannot be represented safely without it.

## Parameters

A parameterized recipe retains a canonical URL rendered from the defaults:

```json
{
  "parameters": {
    "year": {
      "type": "integer",
      "description": {
        "ja": "取得する暦年",
        "en": "Calendar year to retrieve"
      },
      "default": 2023,
      "minimum": 2015,
      "maximum": 2025
    }
  },
  "request": {
    "bindings": [
      {
        "parameter": "year",
        "location": "query",
        "name": "Time",
        "format": "{value}CY00"
      }
    ]
  }
}
```

Each parameter must have exactly one binding, each binding must name a query field already present in the canonical URL, and formatting may contain exactly one `{value}` placeholder. Changing a parameter range or meaning requires review and an appropriate `contract_version` change.

## Execution receipts

Successful executions include a receipt conforming to [`receipt.schema.json`](../receipt.schema.json). Its hashes bind the contract, resolved parameters, request, response body, extracted results, and provenance. `verify` detects a result change while the receipt itself remains trusted. The receipt is not a publisher signature, cannot prove authenticity on its own, and does not replace freshness probes.

The response hash covers the exact received bytes. Result and receipt IDs hash compact UTF-8 JSON with object keys sorted recursively; `receipt_id` itself is excluded when calculating the receipt ID.

## Assertions

Assertions use RFC 6901 JSON Pointers and exactly one check:

```json
{
  "pointer": "/GET_STATS/RESULT/status",
  "equals": "0"
}
```

Supported checks are:

- `equals`
- `minimum`
- `min_length`

Assertions should test the upstream contract, identifiers, and expected result cardinality. Avoid asserting a published numeric value when the source can legitimately revise it.

## Result extraction

Each result field has a stable name, bilingual label, JSON Pointer, and optional unit, description, or transformation.

```json
{
  "name": "population",
  "label": {
    "ja": "総人口",
    "en": "Total population"
  },
  "pointer": "/GET_STATS/STATISTICAL_DATA/DATA_INF/DATA_OBJ/0/VALUE/$",
  "unit": "人",
  "transform": "integer"
}
```

Supported transformations are `string`, `integer`, `number`, and `unix_milliseconds_to_iso8601`.

## Review checklist

Before changing `last_verified`, run the exact recipe and confirm:

1. The request is the smallest practical request for the question.
2. The response assertions distinguish a valid result from a friendly error payload.
3. Units, time, geography, identifiers, provisional status, and annotations remain interpretable.
4. Attribution and license URLs match the linked catalog source.
5. The output contains no credential, personal data, or unbounded source data.
