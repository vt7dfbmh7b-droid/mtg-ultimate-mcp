# BENCH-01 Manual Whole-Deck Verdicts

This directory is the durable home for human/manual Commander-quality acceptance evidence.

Generated replay output under `test-results/bench01-strategy-anchor-replay/` may be replaced by later runs, so manual verdicts must not live only inside that generated directory.

For each reviewed product lineage, create one file named `<40-character-product-sha>.md` containing:

- exact frozen product SHA
- exact replay/evidence reference
- fixtures reviewed
- complete-deck quality findings per fixture
- constraint/legality observations where relevant
- strategy-preservation and replacement-quality conclusions
- target movement versus target achievement
- specialist-versus-general-AI verdict where available
- repeated cross-fixture weakness, if any
- explicit ACCEPT or REJECT decision
- whether the accepted Commander baseline changes
- exact next justified action

A green CI run or successful replay does not substitute for this verdict.
