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
- Active branch validation: **bench01-theme-candidate-priority-repair-validation-pending**

## Audit reuse rule

BENCH-01 remains active. Keep e17b0a1c... as the latest accepted Commander baseline. Frozen runtime f65f4b7... and replay evidence 0322790... are formally green but manually rejected: repeated off-plan incoming additions remain across Quick Draw, Virtue and Valor, Explorers and Elven Empire. The centralized defect is incoming requested-theme candidate ordering after the aggregate floor. Next: fully validate the smallest advisory candidate priority repair, freeze the exact green SHA, replay the same five fixtures unchanged, and accept only if complete manual deck quality materially improves. Stable remains V0.13 and PR #29 remains unmerged.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. Standing user authorization permits merge/promotion without another approval once the repository records complete validation, non-redundancy, safety, no relevant unresolved blocker, and promotion-grade benchmark evidence. Until those gates are satisfied, stable/current remains unchanged.

## Latest fully validated executable experimental baseline

`e17b0a1cba659b229fd6f0b6e2df79c5e464a616` on `agent/v15-native-deck-intelligence`.

Latest accepted fully validated Commander product baseline. Generic neutral-theme taxonomy bridge for shared card-draw and lifegain semantics. Later adaptive-diversification and strategy-anchor descendants contain useful engineering fixes/evidence but have not passed required manual whole-deck Commander-quality acceptance as a product lineage.

## Important pending validation

The last persisted Marvel control is `5829b37b686255ba35d419b37be17095e54fb696` with outcome **expected-ceiling-fail-closed-zero-swap**. At exact source 5829b37..., focused and broad Marvel execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

## Next actions

1. Validate the generic advisory incoming-candidate requested-theme priority after the aggregate floor using focused replacement/strategy regressions and the complete repository check; do not accept or commit product source unless all required gates are green.
2. If validation is green, freeze the exact product SHA and replay Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire and Animated Army from that unchanged source.
3. Manually inspect all five complete decks against rejected frozen source f65f4b7b77ee832e2ac66b2a7403f9dda603b84c, requiring materially better replacement identity without Animated Army regression before accepting the lineage.
4. After acceptance or rejection, persist the batch verdict and broaden BENCH-01 only when the repeated replacement-quality pattern is resolved; keep PR #29 and stable/current V0.13 unchanged until promotion-grade evidence exists.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
