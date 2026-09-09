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
- Active branch validation: **bench01-34cbc-validated-control-safe-affected-fixture-replay-interface-blocked**

## Audit reuse rule

BENCH-01 remains active. Accepted Commander baseline remains e17b0a1cba659b229fd6f0b6e2df79c5e464a616. Candidate 34cbc7843fcc936bd153a6516e1762ad2b5091e5 is formally validated and five-control-replay safe, with durable verdict at test-results/bench01-manual-verdicts/34cbc7843fcc936bd153a6516e1762ad2b5091e5.md. Do not repeat that control replay. The unfinished acceptance gate is exact-source replay of Endless Punishment, Revenant Recon and Deep Clue Sea plus a control, followed by complete-deck manual comparison against 473edf47 and strong general AI. The current authorized replay request only runs the five strategy-anchor controls and autonomous work may not modify .github/workflows/**. Treat this as an execution-interface blocker rather than a product failure. Stable remains V0.13 and PR #29 unmerged.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. Standing user authorization permits merge/promotion without another approval once the repository records complete validation, non-redundancy, safety, no relevant unresolved blocker, and promotion-grade benchmark evidence. Until those gates are satisfied, stable/current remains unchanged.

## Latest fully validated executable experimental baseline

`e17b0a1cba659b229fd6f0b6e2df79c5e464a616` on `agent/v15-native-deck-intelligence`.

Latest accepted fully validated Commander product baseline. 34cbc7843fcc936bd153a6516e1762ad2b5091e5 is a later formally validated candidate with green five-control replay, but remains provisional until affected-fixture replay and manual comparison are completed.

## Important pending validation

The last persisted Marvel control is `c2fa83b7ea4a81e18445aba3a54529cdb31d86cd` with outcome **execution-success-target-not-achieved**. Historical constrained control; do not convert provider uncertainty or construction ceiling into unrelated BENCH failure.

## Next actions

1. Read project-state.json and AGENTS.md; inspect all relevant branch writers, including earlier-commit jobs. Do not overlap a running validation, replay, integrity writer or product repair.
2. Keep 34cbc7843fcc936bd153a6516e1762ad2b5091e5 frozen as the validated contextual-effectiveness candidate and do not repeat its completed five-fixture strategy-anchor control replay.
3. Complete the unfinished affected-fixture gate: run Endless Punishment, Revenant Recon and Deep Clue Sea plus at least one control from exact source 34cbc7843fcc936bd153a6516e1762ad2b5091e5, then manually inspect complete decks and compare against 473edf47 and the existing strong-general-AI verdicts.
4. Current blocker: no checked-in autonomous replay interface is available for that affected-fixture set; the authorized .automation/bench01-strategy-anchor-replay.request interface is fixed to Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire and Animated Army. Do not edit .github/workflows/**, src/workflow-immutability.test.ts or workflowPolicyEpochSha to work around this.
5. If an already-authorized non-workflow execution path for the affected fixtures is found, use it without changing Commander source. Otherwise defer only the blocked replay and continue safe read-only/manual analysis; do not infer acceptance from the five-control replay.
6. After affected-fixture evidence exists, accept or reject 34cbc784 based on actual whole-deck improvement. If the same contextual failures remain, reproduce them through the production path before another generic repair.
7. Endless Punishment's group-slug/punisher vocabulary failure remains a separate semantic-taxonomy issue unless affected replay evidence shows it has independently changed; do not conflate it with the contextual-effectiveness repair.
8. Keep PR #29 and stable/current V0.13 unmerged/unpromoted until promotion-grade BENCH-01 evidence exists.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
