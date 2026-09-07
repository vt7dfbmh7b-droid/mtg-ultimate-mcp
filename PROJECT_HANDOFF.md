<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project Handoff

This is the short compatibility handoff. **`project-state.json` is the authoritative current-state source.**

## Resume in under five minutes

1. Read `project-state.json` and `docs/PROJECT-STATE.md`.
2. Read `validation-index.json` and `docs/VALIDATION-STATE.md` to identify current versus stale registered evidence.
3. Inspect live head of `agent/v15-native-deck-intelligence` and PR #29.
4. Read `ULTIMATE_MTG_SPEC.md`, then only the decision/failure/validation docs relevant to the active milestone.
5. Continue from the Next actions below. Do not reconstruct old chats unless state integrity fails.

## Current mode

- Active milestone: **BENCH-01 — Adversarial Commander benchmark suite**
- Intelligence development paused: **no**
- Experimental branch: `agent/v15-native-deck-intelligence`
- Development checkpoint at pause: `2f93c9ec1a171775500e7c7cfd9cb7d0c11bc5ea`
- Active branch validation: **bench01-005717-frozen-replay-manual-review-pending**

## Audit reuse rule

BENCH-01 remains active and the hourly autonomous Workday is enabled. Keep e17b0a1c... as the latest accepted Commander baseline. The newest frozen formally validated five-fixture product candidate is 00571713696977093fee717deecc2b26969e2643; replay metadata confirms src/** equality and successful execution, but no manual whole-deck verdict is currently persisted, so do not change product logic again before reviewing those complete decks. Before any repository write read AGENTS.md and obey its hard workflow authority boundary. Use .automation/bench01-strategy-anchor-replay.request for future frozen replay requests; never edit .github/workflows/** during scheduled/autonomous development. Stable remains V0.13 and PR #29 remains unmerged.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. Standing user authorization permits merge/promotion without another approval once the repository records complete validation, non-redundancy, safety, no relevant unresolved blocker, and promotion-grade benchmark evidence. Until those gates are satisfied, stable/current remains unchanged.

## Latest fully validated executable experimental baseline

`e17b0a1cba659b229fd6f0b6e2df79c5e464a616` on `agent/v15-native-deck-intelligence`.

Latest accepted fully validated Commander product baseline. Later candidates, including formally validated frozen product candidate 00571713696977093fee717deecc2b26969e2643, are not accepted until mandatory manual whole-deck BENCH review is persisted and passes.

## Important pending validation

The last persisted Marvel control is `5829b37b686255ba35d419b37be17095e54fb696` with outcome **expected-ceiling-fail-closed-zero-swap**. At exact source 5829b37..., focused and broad Marvel execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

## Next actions

1. Read AGENTS.md before any scheduled/autonomous repository write and preserve the hard workflow authority boundary; do not touch .github/workflows/** or the workflow-policy epoch.
2. Manually inspect the complete frozen 00571713696977093fee717deecc2b26969e2643 five-fixture replay outputs and persist one explicit whole-deck BENCH verdict covering Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire and Animated Army.
3. If manual review accepts the lineage, record 005717... as the new accepted Commander product checkpoint only with the exact supporting evidence. If it rejects the lineage, isolate the repeated generic cross-fixture weakness before any further product repair.
4. After the current five-fixture lineage is conclusively accepted or rejected, broaden BENCH-01 to fresh combo, hybrid, control, aristocrats, budget and unusual-commander fixtures with strong general-AI comparison rather than continuing to polish the same precons.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
