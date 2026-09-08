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
- Development checkpoint at pause: `c2fa83b7ea4a81e18445aba3a54529cdb31d86cd`
- Active branch validation: **bench01-c2fa83b7-manual-reject-aura-target-shape-regression-next**

## Audit reuse rule

BENCH-01 remains active. Accepted Commander baseline: e17b0a1cba659b229fd6f0b6e2df79c5e464a616. Latest tested product: c2fa83b7ea4a81e18445aba3a54529cdb31d86cd; immutable CI and frozen five-fixture replay are green, but test-results/bench01-manual-verdicts/c2fa83b7ea4a81e18445aba3a54529cdb31d86cd.md manually REJECTS baseline acceptance. Hakbal and Bello failure signatures are repaired; Ellivere still confuses creature-enchanting support with an artifact-only Aura. Precedence repair/replay/review are complete. Next unfinished stage: a generic failing production-path Aura target-shape regression, then the smallest justified repair, full validation and unchanged replay. Start at src/services/requested-component-relationship-v15.ts; broad Aura specialization currently omits candidate Enchant-target inspection. Require fresh contrasting and general-AI evidence only after affected controls improve. Obey AGENTS.md single-flight and protected-workflow boundaries. Stable remains V0.13 and PR #29 unmerged.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. Standing user authorization permits merge/promotion without another approval once the repository records complete validation, non-redundancy, safety, no relevant unresolved blocker, and promotion-grade benchmark evidence. Until those gates are satisfied, stable/current remains unchanged.

## Latest fully validated executable experimental baseline

`e17b0a1cba659b229fd6f0b6e2df79c5e464a616` on `agent/v15-native-deck-intelligence`.

Latest accepted fully validated Commander product baseline. Later candidates 00571713696977093fee717deecc2b26969e2643, 4a7bbf616ac6826ec4ac979894f8752133af3bca, 66836fef0009a6913336efe0ec074aefd277abd5, 569933bf605a841f14dc000d1f04296ad3456df3, dfdb9663bd2394dfa620511d750501880b903770 and c2fa83b7ea4a81e18445aba3a54529cdb31d86cd are formally validated/replayed but manually rejected as replacement baselines.

## Important pending validation

The last persisted Marvel control is `c2fa83b7ea4a81e18445aba3a54529cdb31d86cd` with outcome **execution-success-target-not-achieved**. Latest registered focused and broad Marvel metadata at c2fa83b7 records successful execution/build where reported, but failed control/target-quality gates; no target achievement is claimed. Preserve the earlier exact-source 5829b37 restricted-pool construction-ceiling result as historical evidence. A red historical or constrained target is not automatically a blocker to unrelated BENCH-01 work; investigate only if relevant source, pool, provider truth or policy evidence changes. Do not convert provider uncertainty into absence or an intelligence failure.

## Next actions

1. Read project-state.json and AGENTS.md; inspect all relevant branch writers, including earlier-commit jobs. Do not overlap a running validation, replay, integrity writer or product repair.
2. Resume from the completed c2fa83b7ea4a81e18445aba3a54529cdb31d86cd replay/manual rejection in test-results/bench01-manual-verdicts/c2fa83b7ea4a81e18445aba3a54529cdb31d86cd.md. Do not redo the completed precedence repair, five-fixture replay or manual review merely because a scheduled invocation ended.
3. Add a focused generic production-path regression for commander-compatible Aura target shape, starting with auraSpecializationV15 in src/services/requested-component-relationship-v15.ts and its actual requested-component/replacement-priority callers. Distinguish creature-enchanting support from artifact-only or other incompatible targets; include a valid compatible replacement and a structural fallback control.
4. Only after the regression/trace proves the centralized defect, implement the smallest generic relationship-shape inference or propagation correction. Preserve all existing hard and advisory safety boundaries; no fixture, card or commander exceptions.
5. Run focused tests plus the complete immutable repository validation. If green, freeze that exact repair SHA through the existing replay request interface; run the affected five fixtures unchanged and manually compare full decks with the c2fa83b7 verdict.
6. Once those controls materially improve without regression, run at least one fresh contrasting fixture from the same frozen source and resume strong general-AI comparison before accepting a new Commander baseline.
7. Persist meaningful results and update project-state plus its generated handoff/validation surfaces as one coordinated checkpoint. Then broaden BENCH-01 rather than restarting completed audits or familiar replay cycles.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
