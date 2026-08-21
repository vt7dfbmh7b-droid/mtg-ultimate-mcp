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
- Development checkpoint at pause: `303a474e4a1ec8cb80c9dc5babaafe42c1828472`
- Active branch validation: **incomplete**

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. No merge, stable/current promotion, version bump or release is authorized by this handoff.

## Latest fully validated executable experimental baseline

`63bb7274004060eea507f7991a04b84921d0cd47` on `agent/package-probabilities`.

Latest fully validated executable experimental baseline documented by the prior authoritative handoff. Later V0.15 deck-intelligence work on PR #29 remains experimental until its own controls complete.

## Important pending validation

The last persisted Marvel control is `a4a1450d34c337c97b76fbbec688dbcf0ac7388e` with outcome **skipped**. This is stale pre-hardening metadata and must not be used as proof of the current branch. The validation index independently marks it as failing and not matching the development checkpoint.

## Next actions

1. Inspect the current checked-in INTEL-02 scorer/builder against the deck-intelligence pause checkpoint and confirm the hard zero-target-progress guard is still the next unresolved source change.
2. Implement the hard Bracket-5 zero-target-progress rejection with direct shared-scorer and iterative-refinement regressions, without weakening lower-bracket behavior.
3. Run project-management integrity, TypeScript/build, autonomous-refinement regressions and win-package regressions on checked-in source.
4. Run the fresh checked-in-source Marvel Bracket 5 refinement control and persist its exact tested source SHA plus before/after target-gate and verified full-table route evidence.
5. Use validation-index.json to decide whether INTEL-01/INTEL-02 can move to validated or whether the next blocker is discovery, injection, recognition or candidate selection; do not add unrelated features first.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
