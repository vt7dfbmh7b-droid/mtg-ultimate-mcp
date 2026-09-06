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
- Development checkpoint at pause: `90eae44f0fca63f51d82f2e05c1e656492a9b768`
- Active branch validation: **bench01-component-aware-theme-affinity-repair-needed**

## Audit reuse rule

BENCH-01 remains active. Keep e17b0a1c... as the latest accepted Commander baseline. The advisory any-theme-component repair at frozen 2c5bbceb... passed immutable full validation but failed mandatory five-precon manual whole-deck review; evidence is persisted at 36f6734e... with manual verdict manual-verdict-2c5bbceb.md. The remaining centralized defect is compound-theme component priority: broad support components can outrank defining typal/enchantment/spellslinger identity. Next: implement only a generic component-aware advisory candidate affinity, validate fully, freeze the exact green SHA, replay the same comparison fixtures, then broaden BENCH-01 only after this pattern is resolved. Stable remains V0.13 and PR #29 remains unmerged.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. Standing user authorization permits merge/promotion without another approval once the repository records complete validation, non-redundancy, safety, no relevant unresolved blocker, and promotion-grade benchmark evidence. Until those gates are satisfied, stable/current remains unchanged.

## Latest fully validated executable experimental baseline

`e17b0a1cba659b229fd6f0b6e2df79c5e464a616` on `agent/v15-native-deck-intelligence`.

Latest accepted fully validated Commander product baseline. Generic neutral-theme taxonomy bridge for shared card-draw and lifegain semantics. Later adaptive-diversification and strategy-anchor descendants contain useful engineering fixes/evidence but have not passed required manual whole-deck Commander-quality acceptance as a product lineage.

## Important pending validation

The last persisted Marvel control is `5829b37b686255ba35d419b37be17095e54fb696` with outcome **expected-ceiling-fail-closed-zero-swap**. At exact source 5829b37..., focused and broad Marvel execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

## Next actions

1. Design the smallest generic component-aware advisory theme-affinity signal so role-compatible incoming candidates are ranked by support for defining and/or currently underrepresented requested compound-theme components instead of binary any-component membership.
2. Add focused generic regressions spanning spellslinger, enchantment-combat, Merfolk typal, Elf typal and artifact/enchantment compound requests; do not encode fixture names or card-specific exceptions.
3. Run the complete immutable repository validation. Only if green, freeze the exact repair SHA and replay Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire and Animated Army from unchanged source, then manually compare complete decks against f65f4b7... and 2c5bbceb....
4. Accept the lineage only if replacement identity materially improves across the repeated problem fixtures without Animated Army regression; otherwise persist the new generic failure pattern. After resolution, broaden BENCH-01 to fresh combo, hybrid, control, aristocrats, budget and unusual-commander fixtures with strong general-AI comparison.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
