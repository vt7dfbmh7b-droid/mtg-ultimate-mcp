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
- Active branch validation: **bench01-strategy-anchor-fixed-adaptive-lineage-manual-rejected-identity-replacement-priority-next**

## Audit reuse rule

BENCH-01 remains active. The adaptive-diversification candidate 247fb37... was engineering-green but manually rejected. Generic strategy-anchor repair descendant 2e34ebff... passed focused/full/build validation and closed the false Equipment/Voltron inference defect, but its five-fixture replay still fails whole-deck Commander-quality acceptance: Animated Army remains a structural-but-strategic regression and Elven Empire / Explorers still expose identity erosion above hard theme floors. Keep e17b0a1c... as the latest accepted product baseline. Next: diagnose and generically repair identity-aware replacement priority, then fully validate and replay positives + controls from one frozen SHA. Stable remains V0.13 and PR #29 remains unmerged.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. Standing user authorization permits merge/promotion without another approval once the repository records complete validation, non-redundancy, safety, no relevant unresolved blocker, and promotion-grade benchmark evidence. Until those gates are satisfied, stable/current remains unchanged.

## Latest fully validated executable experimental baseline

`e17b0a1cba659b229fd6f0b6e2df79c5e464a616` on `agent/v15-native-deck-intelligence`.

Latest accepted fully validated Commander product baseline. Generic neutral-theme taxonomy bridge for shared card-draw and lifegain semantics. Later adaptive-diversification and strategy-anchor descendants contain useful engineering fixes/evidence but have not passed required manual whole-deck Commander-quality acceptance as a product lineage.

## Important pending validation

The last persisted Marvel control is `5829b37b686255ba35d419b37be17095e54fb696` with outcome **expected-ceiling-fail-closed-zero-swap**. At exact source 5829b37..., focused and broad Marvel execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

## Next actions

1. Inspect optimizer-v12 / deck-builder-v07 / strategy-affinity and theme-scoring paths to locate where structural target pressure can select an IN card that is materially weaker than the OUT card for explicit commander/requested identity while aggregate strategy/theme floors still pass.
2. Define generic identity-aware replacement-priority regressions across at least typal (Elven Empire), artifact/enchantment (Animated Army), and spellslinger/enchantment controls; require relative IN-versus-OUT identity/strategy preservation without forbidding necessary structural cuts.
3. Implement the smallest generic replacement-priority repair only if source diagnosis supports a centralized mechanism; keep all downstream truth/preservation/simulation gates unchanged.
4. Run focused regressions, then full repository tests/type-check/build/project-state integrity; freeze the exact green repair SHA.
5. Replay Animated Army, Elven Empire and Explorers of the Deep plus Quick Draw and Virtue and Valor controls from that unchanged SHA; manually inspect complete decks and compare against the rejected 247fb37/2e34 lineage before acceptance.
6. Only after manual whole-deck quality improves across the repeated failure pattern should BENCH-01 broaden or PR #29 / V0.15 promotion readiness be reconsidered.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
