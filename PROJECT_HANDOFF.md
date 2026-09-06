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
- Active branch validation: **bench01-candidate-discovery-ranking-diagnosis-active**

## Audit reuse rule

BENCH-01 remains active on frozen validated product e17b0a1c.... Cross-family breadth sensitivity now reproduces in Explorers of the Deep and Animated Army, while Quick Draw, Virtue and Valor, and Elven Empire remain unchanged controls. This is sufficient evidence of a generic bounded candidate-discovery/ranking defect signal, but not evidence that globally raising candidatePackagesPerRound is the right repair. Diagnose/instrument the shared pre-truncation mechanism first, preserve all downstream correctness gates, and only then consider a generic product repair. Stable remains V0.13 and PR #29 remains unmerged.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. Standing user authorization permits merge/promotion without another approval once the repository records complete validation, non-redundancy, safety, no relevant unresolved blocker, and promotion-grade benchmark evidence. Until those gates are satisfied, stable/current remains unchanged.

## Latest fully validated executable experimental baseline

`e17b0a1cba659b229fd6f0b6e2df79c5e464a616` on `agent/v15-native-deck-intelligence`.

Fully validated generic neutral-theme taxonomy bridge for shared card-draw and lifegain semantics. Product code change is commit 387709983880fa2fd10c7f0aa50cd8b1524852f5; e17b0a1cba659b229fd6f0b6e2df79c5e464a616 differs only by persisted BENCH evidence documentation. Focused regressions cover standalone resolution/matching, unrelated compound decomposition and unchanged fail-closed unknown leftovers. Normal CI run 34006676470 passed project/state/index/recovery checks, build/type-check and the full repository test suite. Subsequent BENCH wrappers/evidence descendants are not newer formally validated product baselines.

## Important pending validation

The last persisted Marvel control is `5829b37b686255ba35d419b37be17095e54fb696` with outcome **expected-ceiling-fail-closed-zero-swap**. At exact source 5829b37..., focused and broad Marvel execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

## Next actions

1. Inspect the shared bounded candidate-discovery/ranking implementation at frozen source e17b0a1c..., specifically the pre-truncation candidate sources, ordering, deduplication, target/component coverage, diversity and top-N selection used by candidatePackagesPerRound.
2. Instrument benchmark-only pre-truncation diagnostics on Explorers of the Deep and Animated Army, with at least one unchanged control, if source inspection alone cannot prove why breadth positions 5-6 expose viable accepted packages.
3. Only after the repeated mechanism is demonstrated, implement the smallest generic discovery/ranking repair; do not simply increase the global breadth cap and do not weaken downstream correctness gates.
4. Validate any exact repair SHA with focused regressions, full repository CI/build/state-integrity checks, then replay the positive fixtures and controls from one unchanged validated source before accepting it.
5. Keep PR #29 unmerged and stable/current V0.13 unchanged until BENCH-01 is promotion-grade.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
