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
- Active branch validation: **bench01-adaptive-diversification-repair-authorized-validation-pending**

## Audit reuse rule

BENCH-01 remains active on frozen validated product e17b0a1c.... Explorers and Animated Army reproduce breadth sensitivity; Quick Draw, Virtue and Valor, and Elven Empire are controls. Frozen-source inspection establishes that candidatePackagesPerRound bounds serial diversification attempts: each planner call accumulates blocked prior additions, so later candidate numbers are genuinely new search states. A generic adaptive bounded-diversification repair is now justified, but no fixed breadth increase or downstream guard weakening is authorized. Add generic control-flow regressions, implement the smallest adaptive bounded repair, fully validate the exact SHA, then replay positives and controls before acceptance. Stable remains V0.13 and PR #29 remains unmerged.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. Standing user authorization permits merge/promotion without another approval once the repository records complete validation, non-redundancy, safety, no relevant unresolved blocker, and promotion-grade benchmark evidence. Until those gates are satisfied, stable/current remains unchanged.

## Latest fully validated executable experimental baseline

`e17b0a1cba659b229fd6f0b6e2df79c5e464a616` on `agent/v15-native-deck-intelligence`.

Fully validated generic neutral-theme taxonomy bridge for shared card-draw and lifegain semantics. Product code change is commit 387709983880fa2fd10c7f0aa50cd8b1524852f5; e17b0a1cba659b229fd6f0b6e2df79c5e464a616 differs only by persisted BENCH evidence documentation. Focused regressions cover standalone resolution/matching, unrelated compound decomposition and unchanged fail-closed unknown leftovers. Normal CI run 34006676470 passed project/state/index/recovery checks, build/type-check and the full repository test suite. Subsequent BENCH wrappers/evidence/state descendants are not newer formally validated product baselines.

## Important pending validation

The last persisted Marvel control is `5829b37b686255ba35d419b37be17095e54fb696` with outcome **expected-ceiling-fail-closed-zero-swap**. At exact source 5829b37..., focused and broad Marvel execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

## Next actions

1. Add generic control-flow regression coverage for adaptive bounded diversification: continue beyond an initial soft breadth only while materially novel packages/search states are produced; stop on duplicate/no-new states; enforce a strict hard work ceiling; preserve current winner selection and candidate-attempt provenance.
2. Implement the smallest generic adaptive bounded-diversification repair in optimizer-v12 without changing downstream legality, budget, printing, strategy, package-acceptance, target-progress, simulation, theme or component gates.
3. Run focused optimizer regressions first, then full repository tests/type-check/build/project-state integrity; never mark the repair validated before all required evidence is green.
4. Freeze the exact validated repair SHA and replay Explorers of the Deep and Animated Army plus Quick Draw, Virtue and Valor, and Elven Empire controls; compare quality movement and runtime/work cost against e17b0a1c....
5. Accept or reject the repair from cross-fixture replay; only then broaden BENCH-01 or consider PR #29 / V0.15 promotion readiness.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
