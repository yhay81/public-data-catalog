# External Execution Test Protocol

This protocol tests whether an unfamiliar person or AI agent can reach a trustworthy first result from the repository alone. It evaluates onboarding and recipe clarity, not the tester's public-data expertise.

## Target

Run at least five independent sessions and cover every published recipe at least once. A session is independent when it starts without unpublished instructions or knowledge carried over from an earlier attempt.

The initial gate passes when:

- at least 80% of sessions produce a valid attributed result;
- successful registration-free sessions reach the result within two minutes;
- the tester does not need an additional web search to understand how to run the recipe;
- no tester mistakes an upstream outage for a valid empty result.

Passing this gate is evidence that the retrieval unit is usable. It is not evidence of demand; record whether the tester would use the result in a real workflow separately.

## Session procedure

Choose one path:

- **Clean Python:** use a clean checkout and Python 3.11 or newer.
- **MCP person or agent:** use a fresh client profile or agent context and add
  only the public MCP URL from `README.md`. Record the client or host and its
  version. For an AI agent, also record the model name when it is safe to share.

Then:

1. Start the timer before opening `README.md`.
2. For Python, do not provide verbal instructions beyond: “Use this repository
   to run the assigned recipe and obtain its result with provenance.” For MCP,
   provide only the corresponding natural-language prompt from
   [`evals/agent-scenarios.json`](../evals/agent-scenarios.json).
3. The tester may read any file in the repository and use normal local tools.
   The agent may use only the three PDC tools for public-data retrieval during
   the timed attempt.
4. Do not use web search or provider documentation. If external research becomes necessary, record it as a failed no-search attempt and let the tester continue.
5. Stop the timer when the tester can identify the requested value or record
   together with its source and license URL and can show a successful
   `verify` result. If the path is clean Python, use
   `python3 scripts/recipe_tool.py verify` on the saved JSON result.
6. Sanitize all captured output. Never collect environment variables, credentials, personal data, or unrelated shell history.

An upstream request can fail temporarily. Record the exact failure category rather than coaching the tester around it:

- onboarding or command confusion;
- local environment problem;
- endpoint or rate-limit failure;
- response contract change;
- misleading interpretation or attribution;
- unknown.

## Report

Submit the `External execution test` issue form once per session. Record:

- recipe ID and session type;
- execution path, client or host version, and operating system;
- start-to-result time;
- whether the first attempt succeeded;
- whether additional web search or unpublished help was needed;
- the first confusing step;
- whether source, licence, and receipt verification remained attached;
- the real workflow where the result would be useful, or `none`;
- one adjacent question the tester wanted next, or `none`;
- a small, sanitized result or error.

Do not average away failures. Keep each session as a separate observation, then summarize the gate after five sessions.

## Gate review

After five sessions:

1. Count valid attributed results and calculate the success rate.
2. Report median and slowest successful time.
3. Group failures by the categories above.
4. Fix repeated onboarding or recipe problems before adding more sources.
5. Record the decision in `docs/investigation-log.md`.

Use the decision rules in `docs/roadmap.md` to choose whether to revise the format, narrow the audience, reduce maintenance scope, or add only adjacent recipes.
