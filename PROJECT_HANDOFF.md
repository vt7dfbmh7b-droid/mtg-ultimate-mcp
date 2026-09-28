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
- Intelligence development paused: **yes**
- Experimental branch: `agent/counter-blitz-generic-mechanism-floor-20260911`
- Development checkpoint at pause: `43e9c1c80dadfea4d53ed1a2affebd90131e362f`
- Active branch validation: **stage-2-safeguards-verification-pending-targets-unmet**

## Audit reuse rule

Bounded Stage 2 safeguards and necessary tests/existing CI are authorized by Justin. Complete and review Stage 2, then STOP before recognition repair. Read docs/STAGE-2-SAFEGUARDS.md. Main/stable, PR #29, workflows/guard/policy epoch and paused schedules remain unchanged. Server-side trusted policy ownership remains separate maintenance, not granted here.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. No merge, stable/current promotion, version bump or release is authorized by this handoff.

## Latest fully validated executable experimental baseline

`1ef10cec8c50d3d576cb1c3ae3c2566a4f632aa7` on `agent/v15-native-deck-intelligence`.

Latest accepted Commander product baseline. Exact CI green, frozen affected/control replay successful with src/** equality proven, and durable manual whole-deck verdict accepted the repaired Aura-recursion role inference after Revenant Recon retained Animate Dead without a material control regression.

## Important pending validation

The last persisted Marvel control is `1d6b73aae4edc72d80a2ebc945a160506a13c71e` with outcome **execution-success-target-not-achieved**. Focused and broad source-1d6b73a controls execute successfully but fail target-quality gates. Retain this unresolved result; other scenario passes do not establish promotion readiness.

## Next actions

1. Finish Stage 2 safeguards and exact-commit verification under the approved scope; stop at Stage 2 review before recognition repair. No repeated approval is needed for routine actions within this stage.
2. Stage 1 publication: e91b8877aa4823bab03e8b5c616e535307824314; integrity writer a38bb72f6abf9e3336d2cc16ec39bf88a0e73d84. Recheck live head and active writers before each branch-changing operation.
3. Historical B4/B5 manual summaries remain under test-results/bench01-stage1-records/ and are not automated validation controls. Their original evidence is preserved; both target-quality verdicts remain failed.
4. Require hash-bound approved claim contracts, provenance, required observations and complete-deck review before accepted-state changes. Unknown or failed evidence blocks advancement. Existing CI is not deck-quality acceptance.
5. Do not claim unattended tamper-proof enforcement: trusted server-side acceptance-policy ownership and shared run ownership require separate authorized maintenance before Stage 4.
6. Preserve accepted baseline 1ef10cec8c50d3d576cb1c3ae3c2566a4f632aa7, narrow checkpoint 43e9c1c80dadfea4d53ed1a2affebd90131e362f, main/stable V0.13, PR #29, workflows, workflow guard, policy epoch and held-out comparison isolation.
7. Recognition repair is the next product task only after a new stage-specific approval. Do not run fresh benchmarks or change Commander ranking during Stage 2. Keep other open Commander failures separately recorded.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
