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

- Active milestone: **BENCH-01 — Adversarial Commander benchmark suite**
- Intelligence development paused: **no**
- Experimental branch: `agent/v15-native-deck-intelligence`
- Development checkpoint at pause: `1d6b73aae4edc72d80a2ebc945a160506a13c71e`
- Active branch validation: **bench01-1d6b73-eight-fixture-manual-reject-3bc7e2b-test-only-ci-green**

## Audit reuse rule

BENCH-01 active. Reuse completed 34cbc784, 63b9d75c and 1d6b73a replay/verdict evidence; do not repeat those batches. Latest durable verdict: test-results/bench01-manual-verdicts/1d6b73aae4edc72d80a2ebc945a160506a13c71e.md. Requested-mechanism pairing tests already exist and pass at 3bc7e2b; no new production repair followed 1d6b73a. Next prove the residual mechanism-importance defect through the actual public planner/precon path, including the real serialized OUT/IN evidence. Keep accepted e17b0a1c and stable V0.13 unchanged.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. Standing user authorization permits merge/promotion without another approval once the repository records complete validation, non-redundancy, safety, no relevant unresolved blocker, and promotion-grade benchmark evidence. Until those gates are satisfied, stable/current remains unchanged.

## Latest fully validated executable experimental baseline

`e17b0a1cba659b229fd6f0b6e2df79c5e464a616` on `agent/v15-native-deck-intelligence`.

Latest accepted Commander product baseline. Later formally validated 1d6b73a completed eight-fixture execution and has a persisted manual baseline rejection.

## Important pending validation

The last persisted Marvel control is `1d6b73aae4edc72d80a2ebc945a160506a13c71e` with outcome **execution-success-target-not-achieved**. Focused and broad source-1d6b73a controls execute successfully but fail target-quality gates. Retain this unresolved result; other scenario passes do not establish promotion readiness.

## Next actions

1. Read project-state.json and AGENTS.md; inspect all current/recent branch writers, including earlier-commit jobs, then refresh head before writes. The enabled hourly Chat Fast Path already requires reconciliation; preserve its full prompt and schedule.
2. Reuse completed frozen eight-fixture replay 34370124608 of product 1d6b73aae4edc72d80a2ebc945a160506a13c71e, evidence ce854778d280eed76ea290767361cdd7af038130 and its durable manual rejection. Earlier 34cbc784 and 63b9d75c verdicts remain historical comparisons, not unfinished replay requests.
3. Do not recreate the requested-mechanism tests: src/services/upgrade-requested-mechanism-importance-v15.test.ts was added at 1e06aaf and its fallback control corrected at 3bc7e2b. CI 34377710210 passes; these are test-only changes, not a new product repair or proof of a remaining failing production case.
4. Reproduce the residual OUT-card mechanism loss through buildSimulationBackedUpgradePlanV07/the actual precon production route using anonymous Oracle-shaped cards and realistic generated summaries. Trace role serialization, requested relationships and commander/request mechanism importance; include a safer filler cut and a compatible same-mechanism positive control. A passing hand-authored pairing witness is insufficient to justify another patch.
5. Only after a genuine failing production regression, implement the smallest generic repair. Keep existing legality, exact-printing/budget, role truth, strategy and package gates; no card, commander or fixture exceptions.
6. Require focused and full exact-commit validation, then request a new frozen affected/control replay through .automation/bench01-strategy-anchor-replay.request. Preserve the protected workflows, workflow-immutability test and policy epoch; do not replay unchanged 1d6b73a.
7. Review complete new decks against retained 473edf47/34cbc784/63b9d75c/1d6b73a evidence. Existing general-AI verdicts are analytical assessments, not independently executed alternative-build or matchup evidence. Keep Endless Punishment's unsupported group-slug/punisher taxonomy defect separate.
8. Keep accepted baseline e17b0a1cba659b229fd6f0b6e2df79c5e464a616, PR #29 unmerged and stable/current V0.13 unpromoted. Marvel focused/broad still execute without a supported improvement and fail quality gates; do not convert execution success into target achievement. Reconcile synchronized state after material progress.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
