<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project Handoff

This is the short compatibility handoff. **`project-state.json` is the authoritative current-state source.**

## Resume in under five minutes

1. Read `project-state.json`, `AGENTS.md`, and `docs/PROJECT-STATE.md`.
2. Read `validation-index.json` and `docs/VALIDATION-STATE.md` to identify current versus stale registered evidence.
3. Inspect live head of `agent/v15-native-deck-intelligence`, current Actions runs, and PR #29 before any write.
4. Read only the benchmark/decision/failure evidence relevant to the active BENCH-01 action.
5. Continue from the Next actions below. Do not reconstruct old chats unless repository state integrity fails.

## Current mode

- Active milestone: **BENCH-01 — Adversarial Commander benchmark suite**
- Intelligence development paused: **no**
- Experimental branch: `agent/v15-native-deck-intelligence`
- Product development checkpoint: `dfdb9663bd2394dfa620511d750501880b903770`
- Active branch validation: **bench01-dfdb9663-manual-reject-typed-mechanism-precedence-defect-next**

## Audit reuse rule

BENCH-01 remains active. Keep `e17b0a1cba659b229fd6f0b6e2df79c5e464a616` as the latest accepted Commander baseline. Product SHA `dfdb9663bd2394dfa620511d750501880b903770` is fully validated and its exact frozen-source five-fixture replay is green, but whole-deck review **REJECTS** it as a replacement baseline. Durable verdict: `test-results/bench01-manual-verdicts/dfdb9663bd2394dfa620511d750501880b903770.md`.

The same three signature failures survive across contrasting archetypes: Hakbal still cuts `Reflections of Littjara`, Bello still cuts `Esika's Chariot`, and Ellivere still cuts `Angelic Destiny`. Typed `relation:*` mechanism IDs are present, so the remaining centralized defect is now cut-order precedence rather than missing relationship vocabulary: after the meaningful-strategy-loss comparison, quantitative legacy substantive-strategy-loss is evaluated before requested/replacement identity. Low-legacy-affinity mechanism cards can therefore be selected for cutting before their typed requested identity is consulted.

Next product action: preserve the meaningful-strategy-loss first priority, then compare typed requested/replacement identity before the weaker quantitative substantive-strategy-loss tie-break. Keep all hard legality, structural, target-progress, semantic-safety and package gates unchanged. Do not modify protected workflow surfaces during scheduled/autonomous development.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. PR #29 remains unmerged. Standing user authorization permits merge/promotion without another approval only after complete validation, non-redundancy, safety, no relevant blocker, and promotion-grade benchmark/manual evidence are actually recorded.

## Latest accepted experimental baseline

`e17b0a1cba659b229fd6f0b6e2df79c5e464a616` on `agent/v15-native-deck-intelligence`.

Later validated/replayed candidates, including `66836fef...`, `569933bf...`, and `dfdb9663...`, remain manually rejected as replacement baselines.

## Important pending validation

The last persisted Marvel control remains `5829b37b686255ba35d419b37be17095e54fb696` with outcome **expected-ceiling-fail-closed-zero-swap**. Keep that result classified as an expected restricted-pool construction ceiling, not a passing target and not a BENCH-01 blocker.

## Next actions

1. Read `project-state.json` and `AGENTS.md` first; obey single-flight execution and do not overlap a branch-changing validation, replay, integrity writer or product repair.
2. Implement the smallest generic cut-order precedence repair: keep meaningful-strategy-loss first, then evaluate `upgradeSwapReplacementIdentityPriorityV15` before `upgradeSwapSubstantiveStrategyLossScoreV15`.
3. Keep the change advisory and preserve all hard legality, target, structural-floor, semantic-safety and package-acceptance gates. No fixture/card/commander/benchmark exceptions.
4. Use the focused actual-pairing regression in `src/services/replacement-priority-ordering-v15.test.ts`, including the fallback proof that a typed mechanism remains cuttable when no better hard-valid alternative exists.
5. Run complete immutable validation. Only if green, freeze the exact precedence-repair SHA and replay the affected five controls from unchanged source; manually compare full decks against the `dfdb9663...` rejection signatures.
6. Only if those controls materially improve without regression, spend a fresh contrasting fixture and strong-general-AI comparison before accepting a new Commander baseline.
7. Once this replacement-coherence defect is resolved or bounded, broaden BENCH-01 toward fresh combo, hybrid, control, aristocrats, budget and unusual-commander fixtures.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
