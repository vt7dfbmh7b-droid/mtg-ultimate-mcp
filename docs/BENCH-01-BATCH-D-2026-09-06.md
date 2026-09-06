# BENCH-01 Batch D — unseen guard/ceiling discrimination

Date: 2026-09-06

## Provenance

- Frozen executable Commander product source: `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`
- Harness/workflow source before persistence: `c86bcc6657f6d72f704f08259b8a13da9deed10e`
- Persisted Batch D evidence head: `ffcadb3c6d49e3acecbd2f626e14416bdf4dd7a9`
- Persisted raw result: `test-results/bench01-batch-d/result.json`
- Product source was unchanged within the batch. The persisted evidence commit is not a newer validated Commander product baseline.

## Reconciliation note

The first human-readable Batch D interpretation overstated Quick Draw and Virtue and Valor relative to the persisted JSON. The persisted raw artifact is authoritative. This document now records the exact persisted results:

- Quick Draw: **8 swaps**, Bracket **3 → 3**.
- Virtue and Valor: **4 swaps**, Bracket **2 → 2**.
- Explorers of the Deep: **4 swaps**, Bracket **2 → 2**.

This was interpretation/state drift, not a Commander-runtime or benchmark-execution failure. The frozen-source, repository-test, build and benchmark controls remained green.

## Fixtures

### Quick Draw

- Family: spellslinger / card draw / countermagic.
- Accepted 8 swaps across two rounds.
- Assessed Bracket remained 3 → 3.
- Average nonland mana value improved 3.27 → 2.84.
- Early plays improved by 4, cheap interaction by 3 and tutors by 2.
- The persisted terminal stop reason is `package-does-not-repair-or-advance-failed-bracket-5-target-gate`.
- Quick Draw therefore serves as the control for the Batch D component-veto investigation: it made meaningful structural progress and did **not** terminate on the all-packages compound-component veto.
- This is target movement, not Bracket-4 target achievement.

### Virtue and Valor

- Family: enchantments / combat / card draw.
- Accepted 4 swaps in one round.
- Assessed Bracket remained 2 → 2.
- Average nonland mana value improved 3.31 → 3.10; early plays improved by 4, cheap interaction by 1 and tutors by 1.
- The next round exhausted competing packages on `all-competing-packages-would-regress-a-required-compound-theme-component`.
- Rejected packages showed structural movement but failed the requested-component preservation boundary. That downstream rejection does not prove the guard is over-restrictive.

### Explorers of the Deep

- Family: Merfolk typal / +1/+1 counters / card draw / combat.
- Accepted 4 swaps across two accepted refinement rounds in the persisted refinement record.
- Assessed Bracket remained 2 → 2.
- Average nonland mana value improved 3.13 → 2.92; early plays improved by 2, cheap interaction by 1 and tutors by 1.
- The terminal stop reason is `all-competing-packages-would-regress-a-required-compound-theme-component`.
- Rejected packages again attempted structural gains while threatening requested deck-identity material. This does not by itself justify weakening the downstream guard.

## Cross-fixture interpretation

Batch D does **not** reproduce the earlier Counter Blitz `zeroTargetProgressWhileFailedGatesRemain` allocation pattern. No optimizer-priority repair is justified on that old watch item.

The exact persisted pattern is narrower than the first interpretation stated:

- Quick Draw progresses and terminates for a target-advancement reason rather than the compound-component veto.
- Virtue and Valor and Explorers of the Deep are two unrelated fixtures that terminate because every competing package at the terminal decision would regress a required compound-theme component.

Two explanations remain possible for those two fixtures:

1. **Legitimate construction/identity ceiling:** no candidate in the bounded legal/price/strategy search can repair the remaining structural target while preserving all requested components.
2. **Upstream candidate-generation blind spot:** acceptable on-theme structural alternatives exist, but bounded candidate generation/ranking does not surface them, so the downstream preservation guard correctly rejects the packages it is given.

Source review supports investigating the second explanation without weakening the guard: `refineCommanderDeckIterativelyV12()` sends candidates through `buildSimulationBackedUpgradePlanV07()` and only later audits the built package with `candidateCompoundThemeComponentGateV15()`. The upgrade planner uses bounded role/strategy candidate discovery and pairing; the component gate is a post-build correctness boundary rather than proof that discovery searched sufficiently for component-compatible alternatives.

That architecture is not itself a defect. A product repair is authorized only if diagnostic evidence demonstrates that valid, policy-compliant alternatives exist inside the relevant search universe but are systematically missed or ranked out across multiple unrelated fixtures.

## Exact next evidence gate

1. Keep `e17b0a1c...` frozen as the latest fully validated executable product source.
2. Do **not** relax `candidateCompoundThemeComponentGateV15()`; it is preventing demonstrated identity regressions.
3. Inspect/instrument candidate discovery for the terminal Virtue and Valor and Explorers of the Deep decisions so each structural deficit reports whether component-compatible legal candidates existed before final package ranking/exclusion.
4. Identify which requested component each terminal rejected package would regress and whether an alternative candidate can satisfy the same structural role without regressing that component.
5. Use Quick Draw as the control because the same frozen product source made meaningful progress and stopped for a different reason.
6. Only if valid alternatives are repeatedly present but omitted should one generic theme-aware candidate-discovery/ranking repair be implemented and tested. If no such alternatives exist, record the result as an expected bounded construction ceiling and broaden BENCH-01 without changing product intelligence.

## Promotion impact

BENCH-01 is still not promotion-grade. PR #29 remains unmerged and stable/current remains V0.13. Batch D improves adversarial coverage but does not establish specialist superiority or justify a new Commander product repair.
