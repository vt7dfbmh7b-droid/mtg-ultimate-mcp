# BENCH-01 Batch D — unseen guard/ceiling discrimination

Date: 2026-09-06

## Provenance

- Frozen executable Commander product source: `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`
- Harness/workflow source before persistence: `c86bcc6657f6d72f704f08259b8a13da9deed10e`
- Persisted Batch D evidence head: `ffcadb3c6d49e3acecbd2f626e14416bdf4dd7a9`
- Product source was unchanged within the batch. The persisted evidence commit is not a newer validated Commander product baseline.

## Fixtures

### Quick Draw

- Family: spellslinger / card draw / countermagic.
- Accepted 12 swaps across four rounds.
- Assessed Bracket 2 → 3.
- Card draw 8 → 12.
- Countermagic 6 → 10.
- Board wipes 0 → 3.
- Cheap interaction 9 → 13.
- Average nonland mana value improved from about 2.60 → 2.43.
- The next round exhausted candidates on `package-would-regress-required-compound-theme-component-density`.
- This is meaningful target movement, not Bracket-4 target achievement.

### Virtue and Valor

- Family: enchantments / combat / card draw.
- Accepted 8 swaps across three rounds.
- Assessed Bracket remained 2 → 2.
- Cheap interaction 6 → 7 and total interaction 14 → 15, while ramp 9 → 8 and bonus-resource count 2 → 1.
- The next round exhausted all package sizes on `package-would-regress-required-compound-theme-component-density`.
- Rejected packages still showed structural movement, including candidates that would add tutor or cheap-interaction coverage, but their swaps cut multiple obvious on-theme cards for largely off-theme structural cards. The preservation veto is therefore not shown to be wrong by this fixture alone.

### Explorers of the Deep

- Family: Merfolk typal / +1/+1 counters / card draw / combat.
- Accepted 4 swaps in one round.
- Assessed Bracket remained 2 → 2.
- Total interaction 10 → 12, ramp 12 → 13 and cheap interaction 7 → 8.
- The next round exhausted all package sizes on `package-would-regress-required-compound-theme-component-density`.
- Rejected packages again showed structural movement, including tutor/interaction gains, while proposing cuts from requested deck-identity material. This does not yet prove the downstream guard is too strict.

## Cross-fixture interpretation

Batch D does **not** reproduce the earlier Counter Blitz `zeroTargetProgressWhileFailedGatesRemain` allocation pattern. No optimizer-priority repair is justified on that old watch item.

All three unseen fixtures eventually encounter compound-component preservation vetoes, and Virtue and Valor plus Explorers of the Deep terminate because those vetoes exhaust every attempted package size. This is a repeated cross-fixture pattern, but the current evidence does not distinguish two very different explanations:

1. **Legitimate construction/identity ceiling:** no candidate in the bounded legal/price/strategy search can repair the remaining structural target while preserving all requested components.
2. **Upstream candidate-generation blind spot:** acceptable on-theme structural alternatives exist, but bounded candidate generation/ranking does not surface them, so the downstream preservation guard correctly rejects the packages it is given.

Source review supports investigating the second explanation without weakening the guard: `refineCommanderDeckIterativelyV12()` sends candidates through `buildSimulationBackedUpgradePlanV07()` and only later audits the built package with `candidateCompoundThemeComponentGateV15()`. The plan provenance describes discovery as `bounded-role-plus-strategy-search`; the component gate is therefore a post-build correctness boundary rather than proof that discovery searched sufficiently for component-compatible alternatives.

That architecture is not itself a defect. A product repair is authorized only if diagnostic evidence demonstrates that valid, policy-compliant alternatives exist inside the relevant search universe but are systematically missed or ranked out across unrelated fixtures.

## Exact next evidence gate

1. Keep `e17b0a1c...` frozen as the latest fully validated executable product source.
2. Do **not** relax `candidateCompoundThemeComponentGateV15()`; it is preventing demonstrated identity regressions.
3. Instrument/inspect candidate discovery for the failed Batch D rounds so each structural deficit reports whether component-compatible legal candidates existed before final package ranking/exclusion.
4. For Virtue and Valor and Explorers of the Deep, identify the component threatened by each terminal rejection and whether an alternative candidate could satisfy the same structural role without regressing that component.
5. Use Quick Draw as a control because the same source achieved substantial progress before hitting the guard.
6. Only if valid alternatives are repeatedly present but omitted should one generic theme-aware candidate-discovery/ranking repair be implemented and tested. If no such alternatives exist, record the result as an expected bounded construction ceiling and broaden BENCH-01 without changing product intelligence.

## Promotion impact

BENCH-01 is still not promotion-grade. PR #29 remains unmerged and stable/current remains V0.13. Batch D improves adversarial coverage but does not yet establish specialist superiority or justify a new Commander product repair.
