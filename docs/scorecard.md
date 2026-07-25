# Product evidence scorecard

Date: 2026-07-25

Current phase: **Phase 1 — prove independent value**

Next review: after five independent sessions, or 2026-08-25, whichever comes
first.

The roadmap's north-star measure is independently reproduced, attributable
retrieval scenarios per month. This scorecard records evidence, including
unknowns and failures, without treating repository activity as user value.

## Gate 1

| Evidence | Current | Exit requirement | Status |
| --- | ---: | ---: | --- |
| Independent sessions completed | 0 | 5 | pending |
| Sessions with a valid attributed result | 0 | at least 4 | pending |
| Published recipes covered | 0 of 6 | 6 of 6 | pending |
| Human developer or analyst sessions | 0 | at least 2 | pending |
| AI-agent sessions | 0 | at least 2 | pending |
| Distinct MCP clients or agent hosts | 0 | at least 2 | pending |
| Clean Python runner sessions | 0 | at least 1 | pending |
| Testers naming a real workflow | 0 | at least 3 | pending |
| Adjacent questions requested | 0 | at least 2 | pending |
| Non-maintainer reports or corrections | 0 | at least 1 | pending |
| False-success results | 0 observed | 0 | not yet independently tested |

Session reports belong in
[Issue #2](https://github.com/yhay81/public-data-catalog/issues/2) using the
[external execution protocol](./external-test-protocol.md).

## Technical readiness

| Surface | Current evidence | Status |
| --- | --- | --- |
| Python reference runner | 33 unit tests passing on 2026-07-25 | passing |
| TypeScript MCP core | 5 integration tests passing on 2026-07-25 | passing |
| Full evidence-envelope verification | 8 checks in Python and TypeScript; provenance-only tamper rejected cross-runtime | passing |
| Generated artifacts | deterministic bundle and DCAT check passing | passing |
| Remote MCP | MCP Inspector `tools/list`, live parameterized `execute`, 8-check cross-runtime `verify`, and provenance-tamper rejection on 2026-07-25 | passing |
| MCP Registry | remote metadata published; registry remains in preview | published |
| Weekly recipe probes | all six recipes manually verified on 2026-07-24 | passing at last review |
| Client compatibility matrix | [published](./compatibility.md); local stdio and public HTTP Inspector rows passing; 2 external hosts pending | partial |
| Agent evaluation set | 9 checked-in scenarios cover all 6 recipes and required failure behaviors; independent runs pending | published |
| Probe investigation time | [log created](./maintenance-log.md); historical time was not measured | unknown |

Technical readiness is not a substitute for independent activation or demand.

## Current decision

- Freeze source-count expansion.
- Do not add D1, R2, vector search, stateful MCP, OAuth, A2A, or a production
  Hayate migration.
- Spend the next product effort on external sessions, agent evaluations, and a
  compatibility matrix.
- Revisit the roadmap only with recorded Gate 1 evidence.

## Monthly review template

At every review:

1. Update every row above; use `unknown` instead of estimates.
2. Link the underlying issue, test run, or probe evidence.
3. Record the median and slowest successful time.
4. Group every failure by onboarding, environment, upstream, contract,
   interpretation, or unknown.
5. Record maintainer time per active contract.
6. Choose one decision: improve activation, narrow scope, reduce maintenance,
   or expand one proven vertical.
7. Add the decision and rationale to
   [the investigation log](./investigation-log.md).
