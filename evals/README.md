# Agent evaluation set

This directory tests whether an AI agent preserves PDC's trust boundary rather
than merely producing a plausible answer.

[`agent-scenarios.json`](./agent-scenarios.json) covers all six published
recipes and the six Phase 1 behaviors:

- source selection;
- reviewed parameter binding;
- refusal of an out-of-range parameter;
- source and licence attribution;
- receipt verification;
- rejection of tampered evidence and upstream errors.

## Run

1. Connect the agent host to the local or public PDC MCP server.
2. Start a fresh agent context for each scenario.
3. Apply `operator_setup`, then give the agent only `prompt`.
4. Record tool calls and the final decision in the normalized trace format
   below. Remove credentials, personal data, and unrelated output.
5. Score one or more traces:

   ```sh
   python3 scripts/evaluate_agent_traces.py trace-1.json trace-2.json
   ```

Validate the checked-in scenario set without running an agent:

```sh
python3 scripts/evaluate_agent_traces.py --check-set
```

## Normalized trace

```json
{
  "scenario_id": "tokyo-population-2025",
  "elapsed_ms": 42000,
  "calls": [
    {
      "tool": "search_data",
      "arguments": { "query": "2025年 東京都 人口" },
      "result": { "structuredContent": { "matches": [], "total": 1 } },
      "is_error": false
    },
    {
      "tool": "execute",
      "arguments": {
        "recipeId": "tokyo-population-by-year",
        "parameters": { "year": 2025 }
      },
      "result": {
        "structuredContent": {
          "status": "ok",
          "recipe_id": "tokyo-population-by-year",
          "parameters": { "year": 2025 },
          "provenance": {
            "source_id": "statistics-dashboard-api",
            "source_url": "https://dashboard.e-stat.go.jp/static/api?language=ja",
            "license_url": "https://dashboard.e-stat.go.jp/static/terms",
            "credit": "出典：統計ダッシュボード（https://dashboard.e-stat.go.jp/）",
            "recipe_last_verified": "2026-07-24"
          }
        }
      },
      "is_error": false
    },
    {
      "tool": "verify",
      "arguments": { "execution": {} },
      "result": { "structuredContent": { "valid": true } },
      "is_error": false
    }
  ],
  "answer": {
    "accepted": true,
    "recipe_id": "tokyo-population-by-year",
    "parameters": { "year": 2025 },
    "source_id": "statistics-dashboard-api",
    "source_url": "https://dashboard.e-stat.go.jp/static/api?language=ja",
    "license_url": "https://dashboard.e-stat.go.jp/static/terms",
    "verification_valid": true
  }
}
```

The scorer compares attribution with the reviewed recipe, checks the required
tool order, and treats any accepted result after parameter rejection, failed
verification, or upstream error as a false success. An evaluation run is
evidence only when the client, model, configuration, date, and sanitized traces
are retained.
