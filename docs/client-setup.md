# MCP client setup

Use this guide to connect an AI client to the public PDC reference server. The
commands below describe supported setup paths in the clients' current official
documentation. They are not compatibility claims: a client is marked
`passing` only after the checks in the
[compatibility matrix](./compatibility.md) have independent evidence.

## Public endpoint

```text
https://public-data-catalog-mcp.yusuke8h.workers.dev/mcp
```

- Transport: MCP Streamable HTTP
- Authentication: none
- Expected tools: exactly `search_data`, `execute`, and `verify`
- Service level: public reference deployment; no availability guarantee

Use the `/mcp` endpoint, not the website root. No token, API key, or other
secret is required.

## Codex

The fastest CLI setup is:

```sh
codex mcp add public-data-catalog \
  --url https://public-data-catalog-mcp.yusuke8h.workers.dev/mcp
codex mcp list
```

Then start a new Codex task. In the terminal UI, `/mcp` shows the active
servers.

In the ChatGPT desktop app or Codex IDE extension:

1. Open **Settings** (or the gear menu) and **MCP servers**.
2. Select **Add server**.
3. Name it `public-data-catalog`, choose **Streamable HTTP**, and paste the
   public endpoint.
4. Save and restart the app or extension.

The desktop app, CLI, and IDE extension share MCP configuration for the same
Codex host. See the official
[Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp).

To remove the CLI configuration:

```sh
codex mcp remove public-data-catalog
```

## Claude Code

Run this from the project context where the server should be available:

```sh
claude mcp add --transport http public-data-catalog \
  https://public-data-catalog-mcp.yusuke8h.workers.dev/mcp
claude mcp list
```

Start a new Claude Code session and use `/mcp` to inspect the connection. The
default `local` scope belongs to the current project. Use a different scope
only when you intentionally want to share the configuration more broadly.

See the official
[Claude Code MCP documentation](https://code.claude.com/docs/en/mcp).

To remove the configuration, run this from the same project context:

```sh
claude mcp remove public-data-catalog
```

## One-minute connection check

This check confirms the tool workflow without treating the client as
independently compatible.

1. Confirm that the client shows three PDC tools.
2. Send this prompt:

   > 2025年の東京都の人口を公式データから調べてください。値だけでなく、出典、利用条件のURL、注意点を示し、取得結果を検証してください。

3. Confirm that the agent uses `search_data`, `execute`, and `verify`.
4. Confirm that the final answer keeps the source and licence URL, and that
   verification reports `valid: true`.

The value can change when the official source revises it. The source,
licence, interpretation notes, and successful receipt verification are the
acceptance criteria.

For a report that counts toward the project's onboarding gate, use a fresh
session and follow the
[external execution test protocol](./external-test-protocol.md) instead of
reusing this smoke check.

## Troubleshooting

- **No tools appear:** confirm the endpoint ends in `/mcp`, then restart or
  reconnect the client.
- **The client asks for credentials:** PDC requires none. Do not enter a
  secret; recheck the URL and server selection.
- **The client does not support remote Streamable HTTP:** use the local stdio
  server from a repository checkout with Node.js 24 or newer:
  `npm ci && npm run mcp`.
- **A tool returns an upstream error:** do not convert it into an empty or
  guessed result. Record the error category in an external test report.
- **The client format differs:** use its native Streamable HTTP setup and the
  endpoint above. MCP client configuration files are not universal.
