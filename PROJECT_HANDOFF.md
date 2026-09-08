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
- Development checkpoint at pause: `473edf473a284b9532aa03747abfa41a1081ca2c`
- Active branch validation: **bench01-473edf47-fresh-batch-general-ai-loss-contextual-replacement-repair-next**

## Audit reuse rule

BENCH-01 remains active. Accepted Commander baseline remains e17b0a1cba659b229fd6f0b6e2df79c5e464a616. Product 473edf473a284b9532aa03747abfa41a1081ca2c remains fully validated for the Aura target-shape repair, but fresh contrasting evidence at test-results/bench01-fresh-contrasting-473edf47/manual-verdict.md rejects baseline acceptance: Endless Punishment is an unsupported-theme failure; Revenant Recon and Deep Clue Sea expose repeated contextual replacement-priority/role-effectiveness weaknesses and are general-AI clear wins. Do not repeat the Aura replay or this fresh batch. Next unfinished stage: add generic production-path regressions for context-sensitive protection effectiveness, engine/payoff replacement compensation, per-component before/after theme movement and target-pressure priority; then implement the smallest justified generic repair, fully validate it, freeze it and replay affected fixtures plus a control. Stable remains V0.13 and PR #29 unmerged.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. Standing user authorization permits merge/promotion without another approval once the repository records complete validation, non-redundancy, safety, no relevant unresolved blocker, and promotion-grade benchmark evidence. Until those gates are satisfied, stable/current remains unchanged.

## Latest fully validated executable experimental baseline

`e17b0a1cba659b229fd6f0b6e2df79c5e464a616` on `agent/v15-native-deck-intelligence`.

Latest accepted fully validated Commander product baseline. Later candidates 00571713696977093fee717deecc2b26969e2643, 4a7bbf616ac6826ec4ac979894f8752133af3bca, 66836fef0009a6913336efe0ec074aefd277abd5, 569933bf605a841f14dc000d1f04296ad3456df3, dfdb9663bd2394dfa620511d750501880b903770 and c2fa83b7ea4a81e18445aba3a54529cdb31d86cd are formally validated/replayed but manually rejected as replacement baselines.

## Important pending validation

The last persisted Marvel control is `c2fa83b7ea4a81e18445aba3a54529cdb31d86cd` with outcome **execution-success-target-not-achieved**. Latest registered focused and broad Marvel metadata at c2fa83b7 records successful execution/build where reported, but failed control/target-quality gates; no target achievement is claimed. Preserve the earlier exact-source 5829b37 restricted-pool construction-ceiling result as historical evidence. A red historical or constrained target is not automatically a blocker to unrelated BENCH-01 work; investigate only if relevant source, pool, provider truth or policy evidence changes. Do not convert provider uncertainty into absence or an intelligence failure.

## Next actions

1. Read project-state.json and AGENTS.md; inspect all relevant branch writers, including earlier-commit jobs. Do not overlap a running validation, replay, integrity writer or product repair.
2. Resume from fresh batch evidence commit 23da6102842bf1aeb8db91f4a3e3a068d2df05b1 and test-results/bench01-fresh-contrasting-473edf47/manual-verdict.md. Do not repeat the completed Aura replay or the three fresh fixtures on unchanged source.
3. State the generic deficient capability precisely: replacement priority and role inference reward abstract protection/tutor/theme counts without enough deck-context effectiveness, commander-specific engine compensation or per-component before/after movement.
4. Add production-path regressions showing that protection requires usable connectivity/setup, commander-specific engine/payoff cuts require same-role or same-component compensation, aggregate compound-theme OR coverage cannot hide a degraded component, and failed cheap-interaction target pressure cannot be bypassed by unrelated metric gains.
5. Implement the smallest generic repair with no card-name, commander, fixture or benchmark-label exceptions. Preserve downstream legality, printing, budget, strategy and route-protection gates.
6. Run focused regression tests and the full required validation suite. Require corrected validation green before freezing the exact repair SHA.
7. Replay Endless Punishment, Revenant Recon and Deep Clue Sea plus at least one unchanged control from that exact validated repair SHA; manually inspect complete decks and compare with pre-repair and strong general AI.
8. Persist meaningful evidence and synchronize project-state, roadmap, handoff and validation surfaces. Keep PR #29 and stable/current V0.13 unmerged/unpromoted until promotion-grade BENCH-01 evidence exists.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
