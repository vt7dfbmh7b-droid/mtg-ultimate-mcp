<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project Handoff

This is the short compatibility handoff. **`project-state.json` is the authoritative current-state source.**

## Resume in under five minutes

1. Read `project-state.json` and `docs/PROJECT-STATE.md`.
2. Inspect live head of `agent/v15-native-deck-intelligence` and PR #29.
3. Read `ULTIMATE_MTG_SPEC.md`, then only the decision/failure/validation docs relevant to the active milestone.
4. Continue from the Next actions below. Do not reconstruct old chats unless state integrity fails.

## Current mode

- Active milestone: **PM-02 — Validation State Indexing**
- Intelligence development paused: **yes**
- Experimental branch: `agent/v15-native-deck-intelligence`
- Development checkpoint at pause: `303a474e4a1ec8cb80c9dc5babaafe42c1828472`
- Active branch validation: **incomplete**

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. No merge, stable/current promotion, version bump or release is authorized by this handoff.

## Latest fully validated executable experimental baseline

`63bb7274004060eea507f7991a04b84921d0cd47` on `agent/package-probabilities`.

Latest fully validated executable experimental baseline documented by the prior authoritative handoff. Later V0.15 deck-intelligence work on PR #29 remains experimental until its own controls complete.

## Important pending validation

The last persisted Marvel control is `a4a1450d34c337c97b76fbbec688dbcf0ac7388e` with outcome **skipped**. This is stale pre-hardening metadata and must not be used as proof of the current branch.

## Next actions

1. Finish PM-02 validation-registry/index tooling and strict integrity checks.
2. Validate PM-02 on checked-in source and persist the exact tested SHA/outcomes.
3. Expand the validation registry only with high-value controls needed for current milestone recovery; do not turn it into noisy workflow inventory.
4. Run a fresh-chat recovery smoke using only project state, validation index, live branch/PR state and referenced decision/failure docs.
5. After PM-02 is validated, resume INTEL-01/INTEL-02 from the deck-intelligence pause checkpoint and run the fresh Marvel control before further feature work.

## Permanent recovery references

- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
