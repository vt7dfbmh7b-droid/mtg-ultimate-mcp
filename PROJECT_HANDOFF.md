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
- Development checkpoint at pause: `3cfca39c194df72727bcd1fae19e81080e543e41`
- Active branch validation: **restricted-scenario-pass-broader-validation-pending**

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. No merge, stable/current promotion, version bump or release is authorized by this handoff.

## Latest fully validated executable experimental baseline

`63bb7274004060eea507f7991a04b84921d0cd47` on `agent/package-probabilities`.

Latest fully validated executable experimental baseline documented by the prior authoritative handoff. Later V0.15 deck-intelligence work on PR #29 remains experimental until its own controls complete.

## Important pending validation

The last persisted Marvel control is `3cfca39c194df72727bcd1fae19e81080e543e41` with outcome **success**. Current exact-source focused and broad controls both passed. Two swaps—Vanquish the Horde -> Vandalblast and Arcane Signet -> Ponder—moved average nonland mana value 2.71 -> 2.59, repaired that failed construction gate, added no failed construction gate, preserved exact 100 Marvel-family printings, retained Lightning Greaves and all eight tutors, and carried complete passing strategy/cut evidence. The final deck remains Bracket 4 with zero verified winning combos, so this is one restricted scenario pass rather than broad INTEL-01/INTEL-02 validation.

## Next actions

1. Keep the current Marvel and Middle-earth restrictions active and create an addressable Middle-earth/precon-style INTEL-02 scenario whose starting list has a safely repairable weakness; persist exact source, before/after gates, strategy evidence, cut importance and per-attempt candidate provenance.
2. Require the restricted Middle-earth/precon control to improve the whole deck without weakening its commander plan, legal exact-100 list, printing policy or already-passing gates; a truthful no-supported-improvement remains engineering/constraint evidence, not an intelligence pass.
3. Only after the restricted-theme scenarios meet the same high standard, vary budget, card-pool and unrestricted conditions across materially different archetypes.
4. Run an eligible verified full-table package scenario to validate INTEL-01 discovery, feasibility, atomic injection, protection and independent final recognition end to end; Marvel and Middle-earth both currently end with zero verified winning combos.
5. Migrate legacy KF-013 evidence writers to isolated paths plus bounded latest-head reconciliation before treating concurrent persistence as globally closed.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
