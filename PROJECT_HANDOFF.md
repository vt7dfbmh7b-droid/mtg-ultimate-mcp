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
- Development checkpoint at pause: `77a5383fa7490aa91360b8186a4bda890f632157`
- Active branch validation: **bench01-replacement-identity-priority-staged-unwired-unvalidated**

## Audit reuse rule

BENCH-01 remains active. Keep `e17b0a1c...` as the latest accepted product baseline. Source diagnosis for the repeated identity erosion is complete: `deck-builder-v07` applies hard semantic/structural/authoritative/package/curve gates first, then chooses among surviving cuts without a relative requested-theme IN-vs-OUT identity comparison. Commits `db471dc7...` / `9e809785...` stage a generic advisory replacement-identity comparator and contrasting typal, artifact/enchantment, and spellslinger regressions. The primitive is **not runtime-wired, validated, or accepted**. Next: wire it into legal cut ordering, add integration coverage, fully validate, freeze the green SHA, then replay failures + controls. Stable remains V0.13 and PR #29 remains unmerged.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. Standing user authorization permits merge/promotion without another approval once the repository records complete validation, non-redundancy, safety, no relevant unresolved blocker, and promotion-grade benchmark evidence. Until those gates are satisfied, stable/current remains unchanged.

## Latest fully validated executable experimental baseline

`e17b0a1cba659b229fd6f0b6e2df79c5e464a616` on `agent/v15-native-deck-intelligence`.

Latest accepted fully validated Commander product baseline. Generic neutral-theme taxonomy bridge for shared card-draw and lifegain semantics. Later adaptive-diversification and strategy-anchor descendants contain useful engineering fixes/evidence but have not passed required manual whole-deck Commander-quality acceptance as a product lineage.

## Important pending validation

The last persisted Marvel control is `5829b37b686255ba35d419b37be17095e54fb696` with outcome **expected-ceiling-fail-closed-zero-swap**. At exact source 5829b37..., focused and broad Marvel execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

## Next actions

1. Wire `replacement-identity-priority-v15` into `deck-builder-v07` candidate-cut ordering only after all existing hard semantic/structural/authoritative/package/curve gates; derive controlled-theme membership from existing `explicitTheme` metadata and substantive strategy affinity from existing V0.15 `strategyAffinity` matches.
2. Add an integration regression proving an on-identity legal cut outranks an identity-eroding legal cut while a structurally necessary identity cut remains possible when no equal legal alternative exists.
3. Run focused replacement-priority regressions, then full repository tests/type-check/build/project-state integrity; freeze the exact green repair SHA.
4. Replay Animated Army, Elven Empire and Explorers of the Deep plus Quick Draw and Virtue and Valor controls from that unchanged SHA; manually inspect complete decks and compare against the rejected 247fb37/2e34 lineage before acceptance.
5. Only after manual whole-deck quality improves across the repeated failure pattern should BENCH-01 broaden or PR #29 / V0.15 promotion readiness be reconsidered.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
