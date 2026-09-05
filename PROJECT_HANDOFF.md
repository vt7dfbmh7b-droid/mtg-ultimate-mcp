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
- Active branch validation: **bench01-compound-repair-validated-ce4c9eba-cavalry-replay-complete-with-requested-facet-regression-counter-replay-in-progress-no-promotion**

## Audit reuse rule

The comprehensive system audit in docs/SYSTEM-AUDIT-2026-09-02.md is complete and reusable; do not rerun it without a material trigger. BENCH-01 is active. The generic compound-theme parser repair is fully validated at ce4c9eba..., and the product source is frozen for paired repaired replays. Cavalry now refines but regresses explicit Knight and combat facets while improving graveyard/structural quality; Counter repaired replay 33958274005 is still in progress. Do not change Commander-intelligence source until Counter is interpreted. If the same per-component compensation appears across both fixtures, repair it generically and replay both from one exact new source; otherwise gather another contrasting fixture first. Stable remains V0.13 until promotion-grade evidence exists; standing user authorization allows merge/promotion once full validation and evidence gates are satisfied.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. Standing user authorization permits merge/promotion without another approval once the repository records complete validation, non-redundancy, safety, no relevant unresolved blocker, and promotion-grade benchmark evidence. Until those gates are satisfied, stable/current remains unchanged.

## Latest fully validated executable experimental baseline

`ce4c9eba59617be2cf57718408b40252230bccf4` on `agent/v15-native-deck-intelligence`.

Fully validated executable generic compound-theme repair. Run 33958162827 passed focused regressions, full repository tests and build on the clean committed tree before publishing. This is a validated experimental product baseline for BENCH-01 replay, not a stable promotion or proof of benchmark superiority.

## Important pending validation

The last persisted Marvel control is `5829b37b686255ba35d419b37be17095e54fb696` with outcome **expected-ceiling-fail-closed-zero-swap**. At exact source 5829b37..., focused and broad Marvel execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

## Next actions

1. Do not repeat the completed comprehensive system audit; docs/SYSTEM-AUDIT-2026-09-02.md remains the reusable baseline unless a material architecture, runtime-entry-point, stable-boundary or project-state-integrity change occurs.
2. Preserve ce4c9eba59617be2cf57718408b40252230bccf4 as the frozen validated product source for the repaired compound-theme BENCH replay. Subsequent benchmark workflow/evidence commits are harness-only descendants; do not change src/** until the paired replay is interpreted.
3. Preserve the repaired Cavalry Charge result: refinement status refined, 8 swaps, about NZ$32.12 upgrade spend, exact 100/legal, within NZ$35-per-card/NZ$200-total/12-swap limits, Bracket 2→3, MV 3.34→2.97, early 19→26, cheap interaction 3→6, tutors 0→2, recursion +3; however Knight creatures 32→27 and combat references 21→17. Aggregate compound satisfaction is therefore not sufficient evidence of per-component success.
4. Wait for repaired Counter Blitz workflow run 33958274005 to complete and persist evidence. Verify run metadata points to ce4c9eba..., then inspect exact 100/legality/FF-only truth, accepted swaps, bracket, curve, interaction/protection, verified routes and each requested compound facet (+1/+1 counters, proliferate, countermagic, combat).
5. Compare repaired Counter Blitz against the locked 18-swap general-AI baseline. Determine whether any requested facet materially regresses while aggregate compound satisfaction remains green.
6. If Counter independently reproduces per-component compensation/regression, implement one generic compound-component preservation/achievement acceptance gate, validate it fully, freeze the exact new product SHA, and replay Counter Blitz plus Cavalry Charge from that same unchanged source. Do not use deck/card-specific thresholds or fixes.
7. If Counter does not reproduce the facet-regression pattern, run at least one additional contrasting unseen compound fixture before changing product source; Cavalry alone remains a BENCH quality failure but is not enough to justify a broad gate without further evidence.
8. Once the compound quality blocker is resolved, continue several unseen BENCH-01 fixtures across combat, control, typal, aristocrats, unrestricted combo, hybrid and other contrasting families before another intelligence change. Convert only repeated cross-fixture weaknesses into generic repairs.
9. PR #29 and stable V0.13 remain unchanged while BENCH-01 is not promotion-grade. Standing authorization permits merge/promotion without another approval only after complete validation and broad benchmark evidence demonstrate the specialist is genuinely ready.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
