<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project Handoff

This is the short compatibility handoff. **`project-state.json` is the authoritative current-state source.**

## Resume in under five minutes

1. Read `project-state.json` and `docs/PROJECT-STATE.md`.
2. Inspect live head of `agent/v15-native-deck-intelligence` and PR #29.
3. Read `ULTIMATE_MTG_SPEC.md`, then only the decision/failure/validation docs relevant to the active milestone.
4. Continue from the Next actions below. Do not reconstruct old chats unless state integrity fails.

## Current mode

- Active milestone: **PM-01 — Persistent Project State & Handoff Automation**
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

1. Complete PM-01 authoritative project-state files and generated handoff tooling.
2. Add project-state validation to CI so stale handoffs fail fast.
3. Record permanent architecture decisions and known failure regressions.
4. Build a validation matrix mapping every control to the claim it proves.
5. After PM-01 is validated, resume INTEL-01/INTEL-02 from the pause checkpoint and run the fresh Marvel control before further feature work.

## Permanent recovery references

- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
