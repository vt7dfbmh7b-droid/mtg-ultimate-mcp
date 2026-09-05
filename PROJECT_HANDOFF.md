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
- Active branch validation: **bench01-compound-theme-repair-validation-blocked-focused-regressions-green-full-validation-failed-no-repaired-sha-accepted-no-promotion**

## Audit reuse rule

The comprehensive system audit in docs/SYSTEM-AUDIT-2026-09-02.md is complete and reusable; do not rerun it without a material trigger. BENCH-01 is active. Batch A is complete at 1-1, Cavalry independently reproduced the Counter compound-theme defect, and the generic compound-theme repair is the immediate validation gate. Do not replay repaired benchmarks until a fully green repaired source is accepted and frozen. Then replay Counter Blitz and Cavalry Charge from the same unchanged repair SHA, inspect complete-deck quality, continue unseen contrasting fixtures, and only make further generic intelligence changes from repeated evidence. Stable remains V0.13 until promotion-grade evidence exists; standing user authorization allows merge/promotion once the full validation and evidence gates are satisfied.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. No merge, stable/current promotion, version bump or release is authorized by this handoff.

## Latest fully validated executable experimental baseline

`63bb7274004060eea507f7991a04b84921d0cd47` on `agent/package-probabilities`.

Latest fully validated executable experimental baseline recorded by project state. Later V0.15 deck-intelligence, BENCH-01 evidence and the in-progress compound-theme repair remain experimental until benchmark and validation evidence justify a new accepted checkpoint.

## Important pending validation

The last persisted Marvel control is `5829b37b686255ba35d419b37be17095e54fb696` with outcome **expected-ceiling-fail-closed-zero-swap**. At exact source 5829b37..., focused and broad Marvel execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

## Next actions

1. Do not repeat the completed comprehensive system audit; docs/SYSTEM-AUDIT-2026-09-02.md remains the reusable baseline unless a material architecture, runtime-entry-point, stable-boundary or project-state-integrity change occurs.
2. Preserve BENCH-01 Batch A as completed evidence from product baseline 5829b37...: Liliana NZ$500 is the specialist win; Counter Blitz is the general-AI win; aggregate verdict is split-not-promotion-grade. Preserve the locked general-AI baselines rather than regenerating them after seeing specialist results.
3. Preserve Cavalry Charge as the second unrelated reproduction of the compound-theme rejection. Together with Counter Blitz, this is sufficient generic evidence for the centralized controlled compound-theme repair; do not seek a card/deck-specific workaround.
4. At the current active branch head, isolate the exact failure in corrected validation run 33949687254 / job 101261983495. Focused neutral-theme regressions already passed; fix only the demonstrated remaining full-suite/build/compatibility problem and preserve the bounded combat discovery contract.
5. Require the repaired source to pass focused neutral-theme regressions, the full repository test suite and build. Remove temporary one-shot repair workflows/scripts from the accepted product commit. Do not mark the repair accepted or freeze a repaired SHA before all of those conditions are true.
6. Once green, freeze the exact repaired product SHA and replay Counter Blitz FF-only plus Cavalry Charge compound from that same unchanged source. Verify legality, exact restrictions, budgets/swap limits, actual accepted swaps, requested strategy axes, whole-deck cohesion and benchmark target movement rather than relying on status alone.
7. Compare the repaired Counter result against the locked 18-swap general-AI baseline and inspect Cavalry against its NZ$35-per-card, NZ$200-total and 12-swap limits. Record whether the repair merely parses the request or actually produces stronger complete decks.
8. If the repaired replay is sound, continue several unseen fixtures across combat, control, typal, aristocrats, unrestricted combo, hybrid and other contrasting families before making another intelligence change. Convert only repeated cross-fixture weaknesses into generic repairs.
9. PR #29 and stable V0.13 remain unchanged while BENCH-01 is not promotion-grade. Once all relevant validation is green and broad benchmark evidence shows the specialist consistently deserves promotion, the standing user authorization permits merging/promotion without another approval; document the evidence and resulting state in the same run.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
