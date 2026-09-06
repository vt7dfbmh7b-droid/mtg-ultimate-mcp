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
- Development checkpoint at pause: `37ae1efef351f6b502aa0156b9cdd704c294406c`
- Active branch validation: **bench01-role-compatible-strategic-affinity-repair-needed**

## Audit reuse rule

BENCH-01 remains active. Keep `e17b0a1c...` as the latest accepted Commander baseline. Component-aware affinity source `27a2fab...` passed focused/full formal validation and an unchanged five-precon replay, but mandatory whole-deck review rejected the lineage; verdict is `test-results/bench01-strategy-anchor-replay/manual-verdict-27a2fab.md`. The remaining centralized defect is role-only structural drift: cards can satisfy draw/protection/tutor/interaction labels while weakly serving the requested commander strategy. Next: implement only a generic role-compatible strategic/requested-identity preference with structural fallback, validate fully, freeze the exact green SHA, replay contrasting fixtures, then broaden BENCH-01. Stable remains V0.13 and PR #29 remains unmerged.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. Standing user authorization permits merge/promotion without another approval once the repository records complete validation, non-redundancy, safety, no relevant unresolved blocker, and promotion-grade benchmark evidence. Until those gates are satisfied, stable/current remains unchanged.

## Latest fully validated executable experimental baseline

`e17b0a1cba659b229fd6f0b6e2df79c5e464a616` on `agent/v15-native-deck-intelligence`.

Latest accepted fully validated Commander product baseline. Generic neutral-theme taxonomy bridge for shared card-draw and lifegain semantics. Later adaptive-diversification, strategy-anchor and component-affinity descendants contain useful engineering fixes/evidence but have not passed required manual whole-deck Commander-quality acceptance as a product lineage.

## Important pending validation

The last persisted Marvel control is `5829b37b686255ba35d419b37be17095e54fb696` with outcome **expected-ceiling-fail-closed-zero-swap**. At exact source 5829b37..., focused and broad Marvel execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

## Next actions

1. Implement the smallest generic role-compatible strategic/requested-identity preference so candidates satisfying the same structural deficit are ordered by commander/request affinity before identity-poor generic role cards, while preserving structural fallback when no compatible candidate exists.
2. Add focused generic regressions spanning spellslinger, enchantment-combat, Merfolk typal, Elf typal and high-MV artifact/enchantment commander incentives; do not encode fixture names, commander names or card-specific exceptions.
3. Run the complete immutable repository validation. Only if green, freeze the exact repair SHA and replay several contrasting fixtures from unchanged source, including representative prior failures for pre/post comparison.
4. Accept the lineage only if whole-deck replacement coherence materially improves without structural target regressions. After resolving this repeated defect, broaden BENCH-01 to fresh combo, hybrid, control, aristocrats, budget and unusual-commander fixtures with strong general-AI comparison rather than repeatedly polishing the same five precons.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
