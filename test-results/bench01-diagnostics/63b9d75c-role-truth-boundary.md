# BENCH-01 diagnostic — split role-truth boundary after 63b9d75c replay

## Evidence basis

- Rejected frozen product: `63b9d75cf425727d1aa0be1ed5123bf6c13ea3f9`.
- Persisted replay evidence: `db7f5aeb4b7b5a23d0030e65d96ff6a2ae1c0948`.
- Durable whole-deck verdict: `test-results/bench01-manual-verdicts/63b9d75cf425727d1aa0be1ed5123bf6c13ea3f9.md`.

## Production-path finding

`src/services/deck-builder-v07-core.ts` imports and uses `effectiveCardRolesV15` for structural role contribution/counting. The same file's replacement-preservation helpers, including `summarizedRoles(...)` and `uncompensatedEngineCountV15(...)`, read the serialized `card.roles` array carried by candidate/cut summaries.

`src/services/scryfall.ts` currently defines `summarizeCard(...)` with:

`roles: inferCardRoles(card)`

rather than the newer effective/shared role-truth boundary.

The V0.7 core explicitly overrides roles with `effectiveCardRolesV15(card)` for at least the win-package selection path, demonstrating that the serialized summary role source can differ by path.

## Why this matters to the replay failure

The 63b9 threshold-tutor repair proved that corrected effective role truth can change structural target accounting: Deep Clue Sea no longer uses Archmage Ascension as reliable tutor access. However the full replacement package still cuts identity-bearing engines for generic structural cards, and Revenant Recon is composition-identical to the rejected 34cbc output.

This creates a concrete wiring hypothesis rather than a new semantic patch request:

**candidate/target role truth and replacement-preservation role truth may be observing different semantic role sets.**

If an engine/payoff role exists only in the effective/shared role boundary but the cut summary carries legacy `inferCardRoles`, `uncompensatedEngineCountV15` and related replacement ordering cannot protect it even though target metrics elsewhere use the corrected role truth.

## Required next proof

Do not change production behavior from this inspection alone.

1. Add a production-route regression through `buildSimulationBackedUpgradePlanV07` (or the nearest public planner surface) using anonymous Oracle-shaped cards.
2. Construct a card whose effective/shared operational role differs materially from its legacy summarized-role evidence and demonstrate that a generic structural candidate can incorrectly displace it in the current production path.
3. Include a safer filler cut and a mechanism-preserving incoming control so the regression proves ordering/wiring rather than a blanket no-cut rule.
4. If the regression fails as predicted, make the smallest generic role-boundary/wiring repair so replacement preservation consumes the same authoritative semantic role truth as structural target accounting.
5. Re-run focused/full validation, freeze exact source, and replay the affected decks plus controls before any acceptance claim.

## Non-conclusions

- This diagnostic does not by itself prove every Morska/Mirko failure is caused by the role-summary split.
- It does not authorize protecting all theme cards or all expensive creatures.
- It does not authorize card-name, commander-name or fixture-specific exceptions.
- Endless Punishment remains a separate semantic-taxonomy issue.
