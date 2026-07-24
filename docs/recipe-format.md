# Retrieval Recipe Format

A retrieval recipe connects one concrete question to a bounded request, a small response contract, interpretation guidance, and official evidence.

The JSON Schema is [`recipe.schema.json`](../recipe.schema.json). Each recipe is a separate JSON file under [`recipes/`](../recipes/).

## Required sections

| Field | Purpose |
| --- | --- |
| `id` | Stable lowercase recipe identifier; it must match the JSON filename |
| `title`, `question` | Japanese and English human-readable intent |
| `source_id` | Reference to an entry in `catalog.json` |
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
- Arbitrary commands, request bodies, local files, and dynamic URL templates are not supported.

These constraints keep a recipe reviewable. A new capability should be added only when a real, reviewed public-data question cannot be represented safely without it.

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
