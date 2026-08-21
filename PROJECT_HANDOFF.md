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

- Active milestone: **INTEL-02 — Actual autonomous deck improvement**
- Intelligence development paused: **no**
- Experimental branch: `agent/v15-native-deck-intelligence`
- Development checkpoint at pause: `758c5658e1f10a961c15a330ee9b5832ea7005b3`
- Active branch validation: **scenario-pass-broader-validation-pending**

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. No merge, stable/current promotion, version bump or release is authorized by this handoff.

## Latest fully validated executable experimental baseline

`63bb7274004060eea507f7991a04b84921d0cd47` on `agent/package-probabilities`.

Latest fully validated executable experimental baseline documented by the prior authoritative handoff. Later V0.15 deck-intelligence work on PR #29 remains experimental until its own controls complete.

## Important pending validation

The last persisted Marvel control is `758c5658e1f10a961c15a330ee9b5832ea7005b3` with outcome **success**. Current checked-in-source scenario control: execution and target quality passed. Vanquish the Horde -> Skullclamp and Aurelia, the Warleader -> Reanimate moved average nonland mana value 2.71 -> 2.54, removed that failed construction gate, added no failed gate, preserved legal exact-100 Marvel printings, and retained per-attempt provenance distinguishing completed no-verified-package discovery. The workflow artifact was recovered after KF-013 rejected only the concurrent result push. The final deck remains Bracket 4 with zero verified winning combos, and strategy preservation is not yet independently audited, so this is not broad milestone validation.

## Next actions

1. Add explicit strategy-preservation and cut-impact evidence to candidate comparison, beginning with the accepted Marvel cuts against Najeela's primary combat and secondary extra-combat plans; do not treat curve repair alone as proof of whole-deck improvement.
2. Add deterministic regressions that reject a target-gate repair when its structural-card or route damage outweighs the gain, while retaining the current legal average-mana-value repair and lower-bracket behavior.
3. Run fresh constrained and unrestricted INTEL-02 controls on materially different archetypes and persist exact source, before/after gates, strategy evidence and per-attempt candidate provenance.
4. Run an eligible verified full-table package scenario to validate INTEL-01 discovery, feasibility, atomic injection, protection and independent final recognition end to end; Marvel's completed no-package result cannot prove injection.
5. Before relying on concurrent live controls again, harden KF-013 result persistence with isolated evidence paths plus fetch/reconcile/retry or a single consolidated writer.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
