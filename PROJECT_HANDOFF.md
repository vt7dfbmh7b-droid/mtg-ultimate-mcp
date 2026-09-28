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
- Active branch validation: **stage-1-handoff-proposal-execution-paused-targets-unmet**

## Audit reuse rule

STOP at the Stage 1 review boundary. Read START-HERE.md, docs/STAGED-RECOVERY-CONTRACT.md and docs/STAGE-1-EVIDENCE.md. The next approval concerns publication and bounded Stage 2 acceptance safeguards plus their tests. No execution, push or schedule change is currently authorized. After safeguards, the first product repair is shared restricted-counterspell and land-type-search recognition; do not repeat completed candidate diagnostics or benchmark setup.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. No merge, stable/current promotion, version bump or release is authorized by this handoff.

## Latest fully validated executable experimental baseline

`1ef10cec8c50d3d576cb1c3ae3c2566a4f632aa7` on `agent/v15-native-deck-intelligence`.

Latest accepted Commander product baseline. Exact CI green, frozen affected/control replay successful with src/** equality proven, and durable manual whole-deck verdict accepted the repaired Aura-recursion role inference after Revenant Recon retained Animate Dead without a material control regression.

## Important pending validation

The last persisted Marvel control is `1d6b73aae4edc72d80a2ebc945a160506a13c71e` with outcome **execution-success-target-not-achieved**. Focused and broad source-1d6b73a controls execute successfully but fail target-quality gates. Retain this unresolved result; other scenario passes do not establish promotion readiness.

## Next actions

1. Stage 1 is preparation only. Read START-HERE.md and the staged recovery contract. Keep tests, builds, benchmarks, product changes, pushes, CI/replay requests and schedules paused until specifically authorized.
2. Review the coordinated proposed handoff and evidence package against remote base 34109290ba41693d9184ec21768fa65079302409. Recheck current head and active writers before any later publication; a push may trigger existing CI.
3. Preserve existing source-8606761c B4/B5 evidence and anonymous role reproductions. B4 compressed evidence and manifests are under test-results/bench01-bracket4-comparison/8606761c4d2e29cebb980bb06520b6aced459a1b/. Do not run the archived reproducer.
4. Use only the recovered retained snapshot whose compressed SHA-256 is d64aabfa50914fa4571479db29ea262af84b9a80eb0e34a251b168908556b7a4. Two older local cache copies were found incomplete; see docs/STAGE-1-EVIDENCE.md. Do not reacquire a new snapshot or rerun a benchmark during this pause.
5. Next proposed implementation stage: a bounded structured acceptance evaluator and baseline-transition checks, with specifically authorized verification. Distinguish narrow-repair acceptance from unmet B4/B5 targets. Protected maintenance and schedule resumption need separate authority.
6. The next product failure is already reproduced: restricted counterspells and land-type ramp are missed. Repair shared discovery/planner/evaluator semantics only after execution approval and the safeguards checkpoint. Conditional setup, tutor relevance and package selection remain later evidence-led work.
7. Keep accepted baseline 1ef10cec8c50d3d576cb1c3ae3c2566a4f632aa7, narrow checkpoint 43e9c1c80dadfea4d53ed1a2affebd90131e362f, main/stable V0.13, PR #29, workflows, workflow guard, policy epoch and held-out comparison isolation unchanged.
8. Keep Deep Clue Sea engine quality, Endless Punishment taxonomy and Marvel target limitations separately open. Resume broader BENCH-01 only after the current bounded recovery work is accepted or explicitly reprioritized.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
