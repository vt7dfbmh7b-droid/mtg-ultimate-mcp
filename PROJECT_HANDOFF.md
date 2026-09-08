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
- Active branch validation: **bench01-473edf47-aura-repair-green-fresh-fixture-general-ai-next**

## Audit reuse rule

BENCH-01 remains active. Accepted Commander baseline remains e17b0a1cba659b229fd6f0b6e2df79c5e464a616. Product 473edf473a284b9532aa03747abfa41a1081ca2c has green immutable CI and exact-source frozen five-fixture replay; the durable manual verdict ACCEPTS its generic Aura target-shape repair as progression but defers baseline acceptance. The prior Ellivere artifact-only Aura replacement is gone while Hakbal/Bello repairs and Quick Draw/Elven Empire controls remain stable. Do not repeat the Aura regression, repair or five-fixture replay. Next unfinished stage: freeze 473edf47 for genuinely fresh contrasting BENCH-01 evidence, manually review complete decks and compare with a strong general-purpose AI. Only then decide baseline acceptance or whether cross-fixture evidence justifies another generic repair. Stable remains V0.13 and PR #29 unmerged.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. Standing user authorization permits merge/promotion without another approval once the repository records complete validation, non-redundancy, safety, no relevant unresolved blocker, and promotion-grade benchmark evidence. Until those gates are satisfied, stable/current remains unchanged.

## Latest fully validated executable experimental baseline

`e17b0a1cba659b229fd6f0b6e2df79c5e464a616` on `agent/v15-native-deck-intelligence`.

Latest accepted fully validated Commander product baseline. Later candidates 00571713696977093fee717deecc2b26969e2643, 4a7bbf616ac6826ec4ac979894f8752133af3bca, 66836fef0009a6913336efe0ec074aefd277abd5, 569933bf605a841f14dc000d1f04296ad3456df3, dfdb9663bd2394dfa620511d750501880b903770 and c2fa83b7ea4a81e18445aba3a54529cdb31d86cd are formally validated/replayed but manually rejected as replacement baselines.

## Important pending validation

The last persisted Marvel control is `c2fa83b7ea4a81e18445aba3a54529cdb31d86cd` with outcome **execution-success-target-not-achieved**. Latest registered focused and broad Marvel metadata at c2fa83b7 records successful execution/build where reported, but failed control/target-quality gates; no target achievement is claimed. Preserve the earlier exact-source 5829b37 restricted-pool construction-ceiling result as historical evidence. A red historical or constrained target is not automatically a blocker to unrelated BENCH-01 work; investigate only if relevant source, pool, provider truth or policy evidence changes. Do not convert provider uncertainty into absence or an intelligence failure.

## Next actions

1. Read project-state.json and AGENTS.md; inspect all relevant branch writers, including earlier-commit jobs. Do not overlap a running validation, replay, integrity writer or product repair.
2. Resume from the completed 473edf473a284b9532aa03747abfa41a1081ca2c Aura repair, green CI, frozen five-fixture replay and durable manual verdict. Do not repeat the regression, repair, replay or review.
3. Freeze exact product SHA 473edf473a284b9532aa03747abfa41a1081ca2c for a genuinely fresh contrasting BENCH-01 batch outside the Aura/precon-control family. Prefer high-interaction control, aristocrats/graveyard, unrestricted combo or an unusual commander with competing constraints.
4. Inspect every complete deck manually for legality, target achievement, mana, curve, roles, synergy, commander support, replacement quality, resilience and alternative wins. Preserve target movement versus target achievement and restricted-pool ceiling classifications.
5. Compare the specialist output against a strong general-purpose AI answer and record a fixture-level verdict. Do not accept a new baseline solely because the familiar repair controls are green.
6. If fresh evidence is competitive without a repeated new weakness, accept 473edf473a284b9532aa03747abfa41a1081ca2c as the new Commander baseline and continue breadth. If it loses, require contrasting cross-fixture evidence or a clearly centralized defect before another smallest generic repair.
7. Persist meaningful evidence and synchronize project-state, roadmap, handoff and validation surfaces. Keep PR #29 and stable/current V0.13 unmerged/unpromoted until promotion-grade BENCH-01 evidence exists.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
