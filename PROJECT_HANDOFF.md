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
- Active branch validation: **bench01-candidate-breadth-generalization-active**

## Audit reuse rule

BENCH-01 remains active on frozen validated product e17b0a1c.... Batch D candidate-breadth diagnostics changed only package breadth 4→6: Quick Draw was unchanged at 8 swaps/Bracket 3, Virtue unchanged at 4 swaps/Bracket 2, Explorers improved to 9 swaps/Bracket 3 from 4/Bracket 2. This proves one-fixture bounded-search sensitivity but not the repeated unrelated pattern required for a product repair. Keep the component-preservation guard. First verify corrected non-empty evidence persistence, then broaden frozen-source breadth diagnostics across another component-rich fixture and an unrelated non-typal compound fixture. No product repair, PR merge or stable promotion is authorized yet. Stable remains V0.13.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. Standing user authorization permits merge/promotion without another approval once the repository records complete validation, non-redundancy, safety, no relevant unresolved blocker, and promotion-grade benchmark evidence. Until those gates are satisfied, stable/current remains unchanged.

## Latest fully validated executable experimental baseline

`e17b0a1cba659b229fd6f0b6e2df79c5e464a616` on `agent/v15-native-deck-intelligence`.

Fully validated generic neutral-theme taxonomy bridge for shared card-draw and lifegain semantics. Product code change is commit 387709983880fa2fd10c7f0aa50cd8b1524852f5; e17b0a1cba659b229fd6f0b6e2df79c5e464a616 differs only by persisted BENCH evidence documentation. Focused regressions cover standalone resolution/matching, unrelated compound decomposition and unchanged fail-closed unknown leftovers. Normal CI run 34006676470 passed project/state/index/recovery checks, build/type-check and the full repository test suite. Corrected Batch C replay run 34009618840, unseen Batch D, and the Batch D candidate-breadth diagnostic later used this exact frozen executable source; their wrapper/evidence descendants are not newer formally validated product baselines.

## Important pending validation

The last persisted Marvel control is `5829b37b686255ba35d419b37be17095e54fb696` with outcome **expected-ceiling-fail-closed-zero-swap**. At exact source 5829b37..., focused and broad Marvel execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

## Next actions

1. Complete the frozen-source breadth-4 versus breadth-6 generalization diagnostic on at least one unseen component-rich typal family and one unrelated non-typal compound-theme family.
2. If broader breadth repeatedly improves outcomes across unrelated families, inspect the shared bounded candidate-discovery/ranking architecture and justify only a generic repair with focused regressions before changing product intelligence.
3. If the Explorers breadth effect does not reproduce, classify it as isolated bounded-search sensitivity, keep the current product source unchanged, and broaden BENCH-01 to another contrasting unseen batch.
4. After the generalization verdict, reconcile project-state, roadmap, handoff, validation records and PR #29 in the same run before any merge or promotion decision.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
