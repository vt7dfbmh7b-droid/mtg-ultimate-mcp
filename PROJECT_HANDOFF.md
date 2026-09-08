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
- Development checkpoint at pause: `66836fef0009a6913336efe0ec074aefd277abd5`
- Active branch validation: **bench01-66836fef-manual-reject-partial-component-repair-relationship-affinity-next**

## Audit reuse rule

BENCH-01 remains active. Keep e17b0a1c... as the latest accepted Commander baseline. Product SHA 66836fef... is fully validated, source-frozen replay green and manually REJECTED as a replacement baseline, but its semantic requested-component repair is retained as a meaningful partial generic improvement; newest durable verdict is test-results/bench01-manual-verdicts/66836fef0009a6913336efe0ec074aefd277abd5.md. Lathril materially improves, but Hakbal and Bello remain clear failures and Ellivere remains mixed. The repeated weakness is now beyond broad component membership: Commander relationship/card-shape affinity and payoff importance are too shallow. Next: implement the smallest generic advisory relational layer, add cross-archetype regressions including structural-fallback controls, validate fully, freeze the exact green SHA, and use a new representative replay with at least one fresh contrasting fixture before manual acceptance. Before any write read AGENTS.md, obey single-flight execution, and never alter .github/workflows/** during scheduled/autonomous development. Stable remains V0.13 and PR #29 remains unmerged.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. Standing user authorization permits merge/promotion without another approval once the repository records complete validation, non-redundancy, safety, no relevant unresolved blocker, and promotion-grade benchmark evidence. Until those gates are satisfied, stable/current remains unchanged.

## Latest fully validated executable experimental baseline

`e17b0a1cba659b229fd6f0b6e2df79c5e464a616` on `agent/v15-native-deck-intelligence`.

Latest accepted fully validated Commander product baseline. Frozen candidates 00571713696977093fee717deecc2b26969e2643, 4a7bbf616ac6826ec4ac979894f8752133af3bca and 66836fef0009a6913336efe0ec074aefd277abd5 are formally validated/replayed but manually rejected as replacement baselines; 66836fef is retained as useful partial generic repair evidence.

## Important pending validation

The last persisted Marvel control is `5829b37b686255ba35d419b37be17095e54fb696` with outcome **expected-ceiling-fail-closed-zero-swap**. At exact source 5829b37..., focused and broad Marvel execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

## Next actions

1. Read project-state.json and AGENTS.md first; obey single-flight execution and do not overlap a still-running branch-changing validation, replay, integrity writer or product repair.
2. Implement the smallest generic Commander relationship/mechanism-affinity repair feeding existing advisory replacement identity: distinguish broad requested-component membership from typal payoff/engine relevance, Aura specialization and commander-referenced permanent/card-shape conditions such as type, noncreature status, mana-value thresholds or combat/modified conditions.
3. Prefer rules-text/structured-role evidence and reusable relationships. Do not encode fixture names, commander names, card names or benchmark labels, and do not make all relational matches uncuttable.
4. Add focused generic regressions for typal payoff importance, Aura specialization, artifact/enchantment plus mana-value/noncreature shape, cross-component bridge relevance and a control where a weak theme card still loses to necessary structural repair.
5. Run the complete immutable repository validation. Only if green, freeze the exact relational repair SHA and run a new representative replay that includes at least one fresh contrasting fixture plus enough prior controls to prove no regression, then persist a new durable manual whole-deck verdict.
6. Once the repeated replacement-coherence defect is conclusively resolved or bounded, broaden BENCH-01 to fresh combo, hybrid, control, aristocrats, budget and unusual-commander fixtures with strong general-AI comparison.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
