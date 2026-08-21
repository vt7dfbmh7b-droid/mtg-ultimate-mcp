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
- Development checkpoint at pause: `e11826caa0c758c3c637828e71e8782ade8a8532`
- Active branch validation: **incomplete**

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. No merge, stable/current promotion, version bump or release is authorized by this handoff.

## Latest fully validated executable experimental baseline

`63bb7274004060eea507f7991a04b84921d0cd47` on `agent/package-probabilities`.

Latest fully validated executable experimental baseline documented by the prior authoritative handoff. Later V0.15 deck-intelligence work on PR #29 remains experimental until its own controls complete.

## Important pending validation

The last persisted Marvel control is `e11826caa0c758c3c637828e71e8782ade8a8532` with outcome **failure**. Current checked-in-source control: execution succeeded, the hard guard rejected the old Aurelia -> The Masters of Evil cosmetic tutor swap, and target-quality correctly failed because the deck stayed unchanged. Candidate diagnostics show five final one-swap comparisons: one positive-scoring tutor-only package rejected for zero target progress and four no-supported-swap results. The current blocker is target-aware candidate generation/selection, not guard enforcement.

## Next actions

1. Inspect the persisted e11826c candidate comparisons and the V0.7/V0.12 plan provenance to distinguish two observed paths: the surviving tutor-only package ignores already-passing real tutor pressure, while the other candidates produce no supported swaps.
2. Make Bracket-5 candidate generation prioritize currently failed authoritative gates before aspirational role deficits: first average-nonland-mv progress or a verified full-table package, without weakening lower-bracket behavior or the zero-progress rejection.
3. Persist win-package discovery/injection provenance and candidate comparisons across every attempted swap size, not only the final one-swap fallback, so completed absence, provider unavailability and selection failure remain distinguishable.
4. Add deterministic regressions for the diagnosed generation/selection root cause, then rerun project integrity, TypeScript/build, the full regression suite and exact-head CI.
5. Rerun the checked-in-source Marvel Bracket 5 control and require a legal constrained deck that repairs or measurably advances a failed gate; keep INTEL-01/INTEL-02 unvalidated if it again returns honest no-supported-improvement.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
