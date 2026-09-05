# BENCH-01 — Generic compound-component gate evidence

Status: **cross-fixture generic defect confirmed; product repair authorized by benchmark evidence**

Validated frozen product source under test: `ce4c9eba59617be2cf57718408b40252230bccf4`

## Independent evidence

### Cavalry Charge

The repaired compound request executes instead of failing closed, but the accepted package allows explicitly requested facets to regress while aggregate compound-theme satisfaction remains acceptable:

- Knight creatures: **32 -> 27**
- combat references: **21 -> 17**
- graveyard/recursion and structural metrics improve
- aggregate compound satisfaction remains green

This was initially treated as a candidate quality defect only, pending an unrelated fixture.

### Counter Blitz

Repaired workflow run `33958274005` completed successfully from the same frozen product source and persisted the paired benchmark evidence.

Requested compound intent resolves to controlled counter/proliferate/instant-sorcery facets. The final metrics show:

- aggregate themed cards: **53 -> 55**
- instant/sorcery: **37 -> 40**
- counter-related: **51 -> 53**
- proliferate: **4 -> 2**
- aggregate theme density: **86 -> 88**
- aggregate target: pass
- proliferate target: **fail**

Therefore a second unrelated fixture independently reproduces the same pattern: improvement in other requested components can compensate for material loss in one explicit component while the aggregate compound theme remains green.

## Root cause localization

The defect is generic and centralized:

1. `cardMatchesNeutralThemeV15()` treats a compound theme as a match when a card matches **any** controlled component (`components.some(...)`).
2. `auditNeutralThemeV15()` then reports one aggregate `matchedMainCards` count for that OR-style compound match.
3. `candidateThemeGateV15()` compares only the aggregate before/after audit. It does not inspect each controlled component independently.

That combination explains both Cavalry and Counter without card-name, commander, deck, or benchmark-specific behavior.

## Authorized generic repair

Implement one controlled per-component compound-theme preservation/achievement gate at candidate acceptance.

Required semantics:

- operate only from resolved controlled `components[]` metadata;
- preserve existing single-theme behavior;
- audit every component independently before and after a candidate package;
- when a component is already at/above its controlled target, an accepted package may not push it below that target;
- when a component is below target, an accepted package must not materially regress it while aggregate gains elsewhere compensate;
- prefer measurable advancement toward deficient component targets when swaps are being justified by the compound theme;
- fail closed if exact component audit evidence is unavailable;
- retain legality, budget, printing, strategy-retention, package-acceptance and target-gate guards unchanged;
- do not add deck/card-specific thresholds, names or exceptions.

## Required validation before acceptance

1. Add focused deterministic regressions showing an aggregate compound gain cannot hide a requested-component regression.
2. Preserve existing single-theme regression tests.
3. Run the complete repository test suite.
4. Run build/type checks used by the accepted product validation path.
5. Only after all are green, freeze the exact repaired product SHA.
6. Replay **Counter Blitz and Cavalry Charge from that same unchanged SHA**.
7. Judge each requested facet independently plus whole-deck quality; a green aggregate theme score alone is insufficient.

## Promotion consequence

This is a demonstrated BENCH-01 correctness blocker. V0.15 remains **not promotion-ready** until the generic repair is validated and the paired replays show the component-compensation defect is actually resolved without unacceptable strategy/quality regressions.
