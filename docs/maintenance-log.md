# Contract maintenance log

This log records maintainer attention spent classifying and resolving live
recipe-probe results. It measures human maintenance cost, not CI runtime.

Use one row per reviewed probe run. Record `0` only when a maintainer reviewed a
passing run and no investigation was needed. Do not estimate time
retrospectively.

| Date | Probe run | Result | Investigation minutes | Contracts affected | Decision or follow-up |
| --- | --- | --- | ---: | ---: | --- |
| 2026-07-25 | Baseline created | Historical runs not timed | unknown | 6 | Start timing at the next reviewed scheduled or manual probe |

For a failure, classify the cause as one of:

- upstream outage or rate limit;
- response-contract break;
- legitimate data revision;
- licence or usage-condition change;
- PDC implementation failure;
- unknown.

The monthly median per active contract is reported in
[`scorecard.md`](./scorecard.md). CI duration, unattended retries, and unrelated
feature work are excluded.
