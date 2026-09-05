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
- Active branch validation: **bench01-batch-c-vocabulary-boundary-investigation-dd085caf-product-frozen-no-promotion**

## Audit reuse rule

The comprehensive system audit remains complete and reusable. BENCH-01 is active. The compound parser and component-preservation repairs are validated, and the paired replay closed the component-compensation blocker. Unseen Batch C ran from product source verified equal to dd085caf... and exposed a new pre-optimization vocabulary boundary: lifegain and card draw are rejected while supported terms continue through. Card draw already exists as a shared inferred role, proving at least part of the issue is a generic neutral-theme registry gap. Investigate shared measurable semantics, authorize only a generic vocabulary repair, validate it fully, then replay Witherbloom and Urza from one frozen source. Stable remains V0.13 until broad promotion-grade evidence exists.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. Standing user authorization permits merge/promotion without another approval once the repository records complete validation, non-redundancy, safety, no relevant unresolved blocker, and promotion-grade benchmark evidence. Until those gates are satisfied, stable/current remains unchanged.

## Latest fully validated executable experimental baseline

`dd085caf4e47f6f5e1976667dc90de2db46c00a1` on `agent/v15-native-deck-intelligence`.

Fully validated generic compound-component preservation repair. It independently audits every controlled compound component before the existing aggregate theme gate, preserves satisfied components, prevents below-target components from moving backward, fails closed on missing/inconsistent component evidence, leaves single-theme behavior unchanged, and passed normal CI run 33972639473 including full tests and build. This remains the validated executable product baseline while BENCH-01 investigates broader vocabulary coverage.

## Important pending validation

The last persisted Marvel control is `5829b37b686255ba35d419b37be17095e54fb696` with outcome **expected-ceiling-fail-closed-zero-swap**. At exact source 5829b37..., focused and broad Marvel execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

## Next actions

1. Do not repeat the completed comprehensive system audit; docs/SYSTEM-AUDIT-2026-09-02.md remains the reusable baseline unless a material architecture, runtime-entry-point, stable-boundary or project-state-integrity change occurs.
2. Keep dd085caf4e47f6f5e1976667dc90de2db46c00a1 frozen as the latest fully validated executable Commander product baseline while investigating Batch C. Wrapper/evidence commits are not new product-validation milestones unless src/** changes and validates.
3. Inspect the shared intent taxonomy against existing measurable card semantics. Card draw is already emitted by inferCardRoles() and therefore is a generic neutral-theme registry candidate rather than benchmark wording. Establish whether lifegain has equivalent shared semantic truth before authorizing it; do not add a one-off literal merely to make Witherbloom run.
4. If the taxonomy inspection confirms at least two generic omitted concepts or a common registry-coverage mechanism, implement the smallest shared vocabulary/normalization repair with no deck/card-specific conditions and with fail-closed unknown-token behavior preserved.
5. Validate any vocabulary repair with focused neutral-theme decomposition/audit regressions, full repository tests, build/type-check, project-state/index/recovery checks, then freeze the exact successful product SHA. Never treat a partial or wrapper-only green as product validation.
6. Replay Witherbloom Witchcraft and Urza's Iron Alliance from the same unchanged validated repair SHA. Require the natural-language requests to resolve through controlled semantics and then manually inspect legality, budgets, target movement/achievement, component preservation and whole-deck quality. Keep Necron as the supported-vocabulary control.
7. If those replays are sound, broaden BENCH-01 across control, unrestricted combo, hybrid, combat/commander-damage, spellslinger/equipment and unusual-partner families before another intelligence edit. Convert only repeated cross-fixture weaknesses into generic repairs.
8. PR #29 and stable V0.13 remain unchanged while BENCH-01 is not promotion-grade. Standing authorization permits merge/promotion without another approval only after complete validation and broad benchmark evidence demonstrate the specialist is genuinely ready.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
