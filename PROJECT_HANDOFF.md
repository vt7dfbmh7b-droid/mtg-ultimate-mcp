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
- Development checkpoint at pause: `34cbc7843fcc936bd153a6516e1762ad2b5091e5`
- Active branch validation: **bench01-34cbc-eight-fixture-replay-complete-manual-reject-contextual-quality**

## Audit reuse rule

BENCH-01 active. Eight-fixture replay of 34cbc784 is complete and manually rejected; see test-results/bench01-manual-verdicts/34cbc7843fcc936bd153a6516e1762ad2b5091e5.md and immutable evidence 069b700adf9329004791d52e3961aedd60d318b5. Do not repeat it or report an execution-interface blocker. Reproduce residual outgoing-engine/incoming-role-effectiveness failures through the public production planner before a generic repair. Validate, freeze and replay a new repair through the existing request interface. Accepted baseline stays e17b0a1c; stable V0.13 and PR #29 remain unpromoted/unmerged.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. Standing user authorization permits merge/promotion without another approval once the repository records complete validation, non-redundancy, safety, no relevant unresolved blocker, and promotion-grade benchmark evidence. Until those gates are satisfied, stable/current remains unchanged.

## Latest fully validated executable experimental baseline

`e17b0a1cba659b229fd6f0b6e2df79c5e464a616` on `agent/v15-native-deck-intelligence`.

Latest accepted Commander product baseline. Later formally validated 34cbc784 has completed eight-fixture execution and is manually rejected for residual whole-deck quality failures.

## Important pending validation

The last persisted Marvel control is `c2fa83b7ea4a81e18445aba3a54529cdb31d86cd` with outcome **execution-success-target-not-achieved**. Historical constrained control; do not convert provider uncertainty or construction ceiling into unrelated BENCH failure.

## Next actions

1. Read project-state.json and AGENTS.md; inspect all branch writers, including earlier-commit validation/replay/integrity jobs, and refresh head before writes. Preserve single-flight execution.
2. Reuse the completed eight-fixture 34cbc784 replay and durable manual rejection at test-results/bench01-manual-verdicts/34cbc7843fcc936bd153a6516e1762ad2b5091e5.md. Exact evidence commit 069b700adf9329004791d52e3961aedd60d318b5. The interface blocker is resolved; actual result.json has eight fixtures although legacy workflow metadata lists five.
3. Reproduce residual replacement-quality failures through buildSimulationBackedUpgradePlanV07/the actual production route using anonymous Oracle-shaped evidence. Trace contextual helper versus core planner wiring, outgoing engine recognition and incoming practical protection/tutor/interaction contribution.
4. Implement only the smallest generic change supported by production-path failing regressions across contrasting cases; keep positive compatible-replacement controls and all existing truth/strategy/package gates.
5. Run focused plus full required validation on the exact committed repair, then request frozen eight-fixture replay through .automation/bench01-strategy-anchor-replay.request. Do not modify protected workflows, workflow-immutability.test.ts or policy epoch.
6. Manually review complete new affected decks and controls against 473edf47 and 34cbc784 evidence. Preserve qualitative comparison limits; promotion still requires real strong-general-AI comparison evidence and all validation gates.
7. Keep Endless Punishment unsupported group-slug/punisher vocabulary as a separate open semantic-taxonomy failure. Do not count a contextual repair as fixing it without evidence.
8. Keep accepted baseline e17b0a1cba659b229fd6f0b6e2df79c5e464a616, PR #29 unmerged and stable/current V0.13 unpromoted while product-quality gates remain open. Keep the hourly schedule unchanged.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
