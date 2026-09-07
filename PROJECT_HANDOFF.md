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
- Development checkpoint at pause: `ff34b8d85412f56ac48144de9beec6c7503c3eb5`
- Active branch validation: **bench01-005717-manual-reject-mechanism-aware-relative-replacement-repair-justified**

## Audit reuse rule

BENCH-01 remains active and the hourly autonomous Workday is enabled. Keep e17b0a1c... as the latest accepted Commander baseline. Frozen candidate 00571713696977093fee717deecc2b26969e2643 is formally validated/replayed but manually REJECTED; durable verdict is test-results/bench01-manual-verdicts/00571713696977093fee717deecc2b26969e2643.md. The repeated generic weakness is mechanism-aware relative replacement value, especially outgoing-card requested-component/commander-mechanism importance across Ellivere, Hakbal, Lathril and Bello. Next: implement only the smallest generic advisory IN-vs-OUT mechanism-value repair, validate fully, freeze the exact green SHA, replay representative failures plus controls, and manually review complete decks. Before any write read AGENTS.md, obey single-flight execution, and never alter .github/workflows/** during scheduled/autonomous development. Stable remains V0.13 and PR #29 remains unmerged.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. Standing user authorization permits merge/promotion without another approval once the repository records complete validation, non-redundancy, safety, no relevant unresolved blocker, and promotion-grade benchmark evidence. Until those gates are satisfied, stable/current remains unchanged.

## Latest fully validated executable experimental baseline

`e17b0a1cba659b229fd6f0b6e2df79c5e464a616` on `agent/v15-native-deck-intelligence`.

Latest accepted fully validated Commander product baseline. Frozen candidate 00571713696977093fee717deecc2b26969e2643 is formally validated and replayed but manually rejected; it must not replace this baseline.

## Important pending validation

The last persisted Marvel control is `5829b37b686255ba35d419b37be17095e54fb696` with outcome **expected-ceiling-fail-closed-zero-swap**. At exact source 5829b37..., focused and broad Marvel execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

## Next actions

1. Read project-state.json and AGENTS.md first; obey single-flight execution and do not overlap a still-running branch-changing validation, replay, integrity writer or product repair.
2. Implement the smallest generic mechanism-aware relative replacement repair: score direct requested-component/commander-mechanism importance for OUT as well as IN, compare them within structurally valid replacements, and apply only an advisory identity-preservation preference with structural fallback.
3. Add focused generic regressions spanning Aura/enchantment, typal, counters/explore-style, token/combat and high-MV artifact/enchantment mechanism cases; do not encode fixture names, commander names or card-specific exceptions.
4. Run the complete immutable repository validation. Only if green, freeze the exact repair SHA and replay representative 005717 failures plus contrasting controls from that unchanged source, then persist a new durable manual whole-deck verdict.
5. Once the repeated replacement-value defect is conclusively resolved or bounded, broaden BENCH-01 to fresh combo, hybrid, control, aristocrats, budget and unusual-commander fixtures with strong general-AI comparison rather than continuing to polish the same five precons.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
