# Recipe Status

Last complete manual verification: **2026-07-24**

| Recipe | Result |
| --- | --- |
| `egov-population-dataset-search` | Passing |
| `japan-unemployment-rate-2023` | Passing |
| `tokyo-population-2023` | Passing |
| `usgs-noto-earthquake-2024` | Passing |
| `world-bank-japan-population-2023` | Passing |

Run the same probes locally:

```sh
python3 scripts/recipe_tool.py check
```

The scheduled `Recipe probes` GitHub Actions workflow repeats the checks weekly from the default branch and can also be started manually. GitHub may delay scheduled runs during high load and disables schedules in a public repository after 60 days without repository activity. A failed or missing probe therefore requires investigation; it does not by itself prove that the upstream source is down. Distinguish:

- upstream availability or rate-limit failure;
- a changed response contract;
- a stale or incorrect recipe;
- a legitimate data revision;
- changed license or usage conditions.

This file records reviewed verification, not a real-time uptime guarantee.

Independent onboarding validation is still pending. Run it with the [external execution test protocol](./external-test-protocol.md) and submit one report per session.
