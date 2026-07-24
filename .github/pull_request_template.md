## Question or problem

<!-- What concrete public-data question or maintenance problem does this change address? -->

## Official evidence

<!-- Link to the official API documentation, data portal, license, and relevant notices. -->

## Verification

- [ ] `python3 scripts/validate_catalog.py`
- [ ] `python3 -m unittest discover -s tests -v`
- [ ] `npm ci && npm run artifacts:check && npm run typecheck && npm test`
- [ ] `python3 scripts/recipe_tool.py check <recipe-id>` for each affected recipe
- [ ] The request is bounded, read-only, HTTPS, and contains no credentials
- [ ] Units, codes, revisions, attribution, license, and caveats are retained
- [ ] No large source data files or derived bulk datasets are committed

## Result

<!-- Paste a small sanitized result or explain why a live probe is intentionally unavailable. -->
