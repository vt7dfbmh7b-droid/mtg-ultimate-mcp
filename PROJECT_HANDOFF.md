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
- Active branch validation: **bench01-generic-card-draw-lifegain-taxonomy-repair-validated-replay-pending**

## Audit reuse rule

The comprehensive system audit remains complete and reusable. BENCH-01 is active. Compound parsing/component-preservation repairs are validated. Unseen Batch C exposed two generic neutral-theme registry omissions backed by existing shared role truth. The card-draw/lifegain bridge is now fully validated on source e17b0a1cba659b229fd6f0b6e2df79c5e464a616 (product change 387709983880fa2fd10c7f0aa50cd8b1524852f5, normal CI 34006676470). Freeze that source and replay Witherbloom + Urza together, with Necron as control, before any further intelligence change. Counter dense-countermagic allocation remains watch-only. Stable remains V0.13.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. Standing user authorization permits merge/promotion without another approval once the repository records complete validation, non-redundancy, safety, no relevant unresolved blocker, and promotion-grade benchmark evidence. Until those gates are satisfied, stable/current remains unchanged.

## Latest fully validated executable experimental baseline

`e17b0a1cba659b229fd6f0b6e2df79c5e464a616` on `agent/v15-native-deck-intelligence`.

Fully validated generic neutral-theme taxonomy bridge for shared card-draw and lifegain semantics. Product code change is commit 387709983880fa2fd10c7f0aa50cd8b1524852f5; e17b0a1cba659b229fd6f0b6e2df79c5e464a616 differs only by the persisted BENCH evidence document. Focused regressions cover standalone resolution/matching, unrelated compound decomposition and unchanged fail-closed unknown leftovers. Normal CI run 34006676470 passed project/state/index/recovery checks, build/type-check and the full repository test suite. This is the frozen executable source for the Witherbloom + Urza replay; it is not yet promotion evidence.

## Important pending validation

The last persisted Marvel control is `5829b37b686255ba35d419b37be17095e54fb696` with outcome **expected-ceiling-fail-closed-zero-swap**. At exact source 5829b37..., focused and broad Marvel execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

## Next actions

1. Do not repeat the completed comprehensive system audit; docs/SYSTEM-AUDIT-2026-09-02.md remains the reusable baseline unless a material architecture, runtime-entry-point, stable-boundary or project-state-integrity change occurs.
2. Freeze e17b0a1cba659b229fd6f0b6e2df79c5e464a616 as the latest fully validated executable Commander product source. Its src/** contains generic taxonomy repair 387709983880fa2fd10c7f0aa50cd8b1524852f5; the descendant adds only persisted benchmark evidence.
3. Replay Witherbloom Witchcraft and Urza's Iron Alliance from the same unchanged frozen source. Require card draw and lifegain to resolve through controlled semantics, not raw provider grammar, and keep Necron Dynasties as the supported-vocabulary control.
4. Interpret the replay before another intelligence edit: verify Commander legality/exact 100, budgets/printing truth where applicable, every requested component before/after, target movement versus target achievement, swap quality, strategy preservation and complete-deck coherence.
5. Keep the earlier Counter Blitz dense-countermagic allocation concern as a watch item only unless an unrelated fixture independently reproduces the same spend-swaps/leave-high-priority-target-stationary pattern.
6. If the taxonomy replay is sound, broaden BENCH-01 across control, unrestricted combo, hybrid, combat/commander-damage, spellslinger/equipment, budget and unusual-partner families with product source frozen across each batch before another intelligence edit.
7. PR #29 and stable V0.13 remain unchanged while BENCH-01 is not promotion-grade. Standing authorization permits merge/promotion without another approval only after complete validation and broad benchmark evidence demonstrate the specialist is genuinely ready.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
