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
- Active branch validation: **stage-3-second-recognition-candidate-not-accepted**

## Audit reuse rule

Justin authorized bounded Stage 3 on 29 September 2026. Read docs/STAGE-3-RECOGNITION-CRITERIA.md. Complete only shared restricted-counterspell and land-type-search recognition, necessary tests, existing CI and frozen affected/control review. Stop after Stage 3 review. Stage 1/2 are complete; do not repeat them. Server-side trusted policy ownership and shared run ownership remain separate maintenance before unattended operation.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. No merge, stable/current promotion, version bump or release is authorized by this handoff.

## Latest fully validated executable experimental baseline

`1ef10cec8c50d3d576cb1c3ae3c2566a4f632aa7` on `agent/v15-native-deck-intelligence`.

Latest accepted Commander product baseline. Exact CI green, frozen affected/control replay successful with src/** equality proven, and durable manual whole-deck verdict accepted the repaired Aura-recursion role inference after Revenant Recon retained Animate Dead without a material control regression.

## Important pending validation

The last persisted Marvel control is `1d6b73aae4edc72d80a2ebc945a160506a13c71e` with outcome **execution-success-target-not-achieved**. Focused and broad source-1d6b73a controls execute successfully but fail target-quality gates. Retain this unresolved result; other scenario passes do not establish promotion readiness.

## Next actions

1. Stage 3 candidate 1 (5e1163d8) is rejected for multi-sentence land-search false negatives despite green CI 36534622262 and Batch A 36534622136. Evidence is preserved at e3265b1a and in its durable manual verdict. Complete only the second bounded recognition attempt, exact-source CI and affected/control review against docs/STAGE-3-RECOGNITION-CRITERIA.md. After two unsuccessful substantive attempts stop for design review; do not repeat Stage 1/2 or matching completed runs.
2. Verified safeguard source 146eb40040b846beb43274993d1dfdbb73fe55d9: CI 36458755433 passed (1156/0/1); integrity 36458755375 passed; writer 464acaa16c5ee9c104cb1840706af8f53391e635 changed evidence metadata only. Check live head and active writers before any later authorized operation.
3. Historical B4/B5 manual summaries remain under test-results/bench01-stage1-records/ and are not automated validation controls. Their original evidence is preserved; both target-quality verdicts remain failed.
4. Require hash-bound approved claim contracts, provenance, required observations and complete-deck review before accepted-state changes. Unknown or failed evidence blocks advancement. Existing CI is not deck-quality acceptance.
5. Do not claim unattended tamper-proof enforcement: trusted server-side acceptance-policy ownership and shared run ownership require separate authorized maintenance before Stage 4.
6. Preserve accepted baseline 1ef10cec8c50d3d576cb1c3ae3c2566a4f632aa7, narrow checkpoint 43e9c1c80dadfea4d53ed1a2affebd90131e362f, main/stable V0.13, PR #29, workflows, workflow guard, policy epoch and held-out comparison isolation.
7. Do not expand Stage 3 into conditional-ability, contextual-tutor, ranking/package, bracket-calibration or unattended-operation work. Keep other open Commander failures separately recorded.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
