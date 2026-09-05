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
- Active branch validation: **bench01-compound-component-gate-validated-dd085caf-paired-replay-required-no-promotion**

## Audit reuse rule

The comprehensive system audit in docs/SYSTEM-AUDIT-2026-09-02.md is complete and reusable; do not rerun it without a material trigger. BENCH-01 is active. Repaired Cavalry Charge and Counter Blitz independently proved a generic compound-component compensation defect on frozen source ce4c9eba.... The one authorized generic component-preservation repair is now fully validated at dd085caf4e47f6f5e1976667dc90de2db46c00a1 by normal CI run 33972639473. Freeze that exact source and replay Counter Blitz plus Cavalry Charge without src changes between them, judging every requested component independently as well as whole-deck quality. Stable remains V0.13 until broad promotion-grade evidence exists; standing user authorization allows merge/promotion once full validation and evidence gates are satisfied.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. Standing user authorization permits merge/promotion without another approval once the repository records complete validation, non-redundancy, safety, no relevant unresolved blocker, and promotion-grade benchmark evidence. Until those gates are satisfied, stable/current remains unchanged.

## Latest fully validated executable experimental baseline

`dd085caf4e47f6f5e1976667dc90de2db46c00a1` on `agent/v15-native-deck-intelligence`.

Fully validated generic compound-component preservation repair. It independently audits every controlled compound component before the existing aggregate theme gate, preserves satisfied components, prevents below-target components from moving backward, fails closed on missing/inconsistent component evidence, leaves single-theme behavior unchanged, and passed normal CI run 33972639473 including full tests and build. This is a validated experimental BENCH-01 replay baseline, not stable promotion or proof of benchmark superiority.

## Important pending validation

The last persisted Marvel control is `5829b37b686255ba35d419b37be17095e54fb696` with outcome **expected-ceiling-fail-closed-zero-swap**. At exact source 5829b37..., focused and broad Marvel execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

## Next actions

1. Do not repeat the completed comprehensive system audit; docs/SYSTEM-AUDIT-2026-09-02.md remains the reusable baseline unless a material architecture, runtime-entry-point, stable-boundary or project-state-integrity change occurs.
2. Freeze dd085caf4e47f6f5e1976667dc90de2db46c00a1 as the exact validated product source for the next paired BENCH replay. Normal CI run 33972639473 is the acceptance evidence for this repair; do not alter src/** between Counter Blitz and Cavalry Charge.
3. Replay Counter Blitz from dd085caf... under the same FF-only Bant +1/+1 counters/proliferate/countermagic/combat constraints and compare the complete final deck to the locked 18-swap general-AI baseline. Verify proliferate no longer regresses while legality, FF printing truth, counters, countermagic, combat identity, protection/access, routes, curve and bracket truth remain acceptable.
4. Replay Cavalry Charge from the same unchanged dd085caf... source under Knights typal + combat + graveyard recursion/reanimation, NZ$35 per added card, NZ$200 total and maximum 12 swaps. Verify Knight and combat components are preserved while legality, budget, recursion/structural improvements and whole-deck quality remain acceptable.
5. Interpret the two replays together. A green aggregate compound score is insufficient: record every controlled component before/after and distinguish target movement from target achievement. If both fixtures show the compensation defect closed without unacceptable quality regression, close this BENCH correctness blocker.
6. If the paired replay exposes another repeated generic defect, localize and justify one generic repair from cross-fixture evidence before changing product source. Do not add deck/card-specific thresholds or exceptions.
7. Once this blocker is closed, continue several unseen BENCH-01 fixtures across combat, control, typal, aristocrats, unrestricted combo, hybrid and other contrasting families before another intelligence change. Convert only repeated cross-fixture weaknesses into generic repairs.
8. PR #29 and stable V0.13 remain unchanged while BENCH-01 is not promotion-grade. Standing authorization permits merge/promotion without another approval only after complete validation and broad benchmark evidence demonstrate the specialist is genuinely ready.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
