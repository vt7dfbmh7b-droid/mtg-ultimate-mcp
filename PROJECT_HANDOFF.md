<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project Handoff

This is the short compatibility handoff. **`project-state.json` is the authoritative current-state source.**

## Resume in under five minutes

1. Read `project-state.json` and `docs/PROJECT-STATE.md`.
2. Read `validation-index.json` and `docs/VALIDATION-STATE.md` to identify current versus stale registered evidence.
3. Inspect live head of `agent/counter-blitz-generic-mechanism-floor-20260911` and PR (none).
4. Read `ULTIMATE_MTG_SPEC.md`, then only the decision/failure/validation docs relevant to the active milestone.
5. Continue from the Next actions below. Do not reconstruct old chats unless state integrity fails.

## Current mode

- Active milestone: **BENCH-01 — Adversarial Commander benchmark suite**
- Intelligence development paused: **no**
- Experimental branch: `agent/counter-blitz-generic-mechanism-floor-20260911`
- Development checkpoint at pause: `43e9c1c80dadfea4d53ed1a2affebd90131e362f`
- Active branch validation: **counter-blitz-compound-progress-repair-validated-full-targets-unmet**

## Audit reuse rule

Resume Counter Blitz from source 43e9c1c80dadfea4d53ed1a2affebd90131e362f and persisted Batch A evidence under test-results/bench01-batch-a/ (writer commit 56ef00294482ca63c37ebe25660721efa5b97b2f). Read the exact-source manual verdict. Compound-component progress is fixed. Remaining gaps are protection 7/8 and assessed bracket 3/5, including fast mana 1/3 and tutors 1/4. Audit candidate identities and final pairing rejections before deciding whether another generic repair is justified; do not claim pool exhaustion from counts alone.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. No merge, stable/current promotion, version bump or release is authorized by this handoff.

## Latest fully validated executable experimental baseline

`1ef10cec8c50d3d576cb1c3ae3c2566a4f632aa7` on `agent/v15-native-deck-intelligence`.

Latest accepted Commander product baseline. Exact CI green, frozen affected/control replay successful with src/** equality proven, and durable manual whole-deck verdict accepted the repaired Aura-recursion role inference after Revenant Recon retained Animate Dead without a material control regression.

## Important pending validation

The last persisted Marvel control is `1d6b73aae4edc72d80a2ebc945a160506a13c71e` with outcome **execution-success-target-not-achieved**. Focused and broad source-1d6b73a controls execute successfully but fail target-quality gates. Retain this unresolved result; other scenario passes do not establish promotion readiness.

## Next actions

1. Read state, AGENTS.md and recovery status; check current/recent writers and refresh candidate head before any write. Development schedules were observed paused on 2026-09-22; do not resume them without user direction.
2. Reuse exact source 43e9c1c80dadfea4d53ed1a2affebd90131e362f, CI 35959975121, Batch A 35959975135 and evidence/state writer commit 56ef00294482ca63c37ebe25660721efa5b97b2f. Do not reacquire snapshots or repeat the fixed Oracle self-reference or compound-component progress families without regression.
3. Trace names and rejection reasons for eligible fast-mana, tutor and protection candidates through the public planner. Separate role-classification misses from unsupported candidate/cut pairings and genuine policy-pool exhaustion.
4. Keep Bracket-5, protection, strategy, legality and FF-printing requirements intact. Do not claim FF pool exhaustion unless the candidate alternatives and reasons are audited.
5. For any justified generic repair, require anonymous public-path regressions, exact-source CI, frozen affected/contrasting controls and a complete-deck review. No independently executed general-AI comparator exists for this repair; broad superiority is unproven.
6. Keep accepted Commander baseline 1ef10cec8c50d3d576cb1c3ae3c2566a4f632aa7. Do not change main/stable V0.13, merge PR #29, modify workflows/guard/policy epoch or resume paused schedules.
7. Return to Deep Clue Sea and wider BENCH-01 breadth after the current recovery objective; keep Endless Punishment taxonomy and Marvel target failures separately open.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
