<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project State

Generated from `project-state.json`. Last state update: **2026-09-06T11:08:00.000Z**.

## Current mode

- Repository: `vt7dfbmh7b-droid/mtg-ultimate-mcp`
- Active experimental branch: `agent/v15-native-deck-intelligence`
- Active PR: #29
- Active milestone: **BENCH-01**
- Intelligence development paused: **no**
- Stable/current: **V0.13 / 0.13.0** on `main`
- Latest accepted fully validated Commander product: `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`

## Current BENCH-01 truth

Adaptive diversification candidate `247fb37bc34ad70678ff12ec297a6e9bdc220323` was engineering-green but failed mandatory manual whole-deck Commander-quality acceptance.

Strategy-anchor descendant `2e34ebff20d0a66b7c4649feb1e9984c156e43ca` passed focused strategy regression, full repository tests and build. Its frozen-source five-fixture replay confirms the centralized false Equipment/Voltron inference defect is fixed: Bello no longer acquires Equipment/Voltron identity from a negative `non-Equipment` reference plus incidental combat/protection text.

However, the product lineage is still **not accepted**. Animated Army ends at 3 swaps / Bracket 2, still loses strategically relevant combo evidence 1→0, and still replaces high-value Bello cards with generic structural cards. Elven Empire and Explorers continue to show requested-identity erosion above hard theme/component minimum floors. The remaining repeated generic weakness is therefore **identity-aware replacement priority**, not candidate breadth and not the downstream preservation gates.

Manual review evidence: `docs/benchmarks/BENCH-01-STRATEGY-ANCHOR-MANUAL-REVIEW.md`.

## Validation status

Active branch status: **bench01-strategy-anchor-fixed-adaptive-lineage-manual-rejected-identity-replacement-priority-next**.

Do not treat later BENCH evidence/state commits as newer accepted product baselines. Keep `e17b0a1c...` as the accepted Commander product boundary until a later lineage passes both formal validation and manual whole-deck BENCH acceptance.

The restricted Marvel Bracket-5 control remains an expected construction-ceiling failure, not target achievement and not a BENCH blocker elsewhere.

## Milestones

| ID | Milestone | Status |
|---|---|---|
| PM-01 | Persistent Project State & Handoff Automation | validated |
| PM-02 | Validation State Indexing | validated |
| INTEL-01 | Win-package intelligence | validated |
| INTEL-02 | Actual autonomous deck improvement | implemented-validation-pending |
| BENCH-01 | Adversarial Commander benchmark suite | active |
| INTEL-03 | Human-level strategic reasoning layer | planned |
| INTEL-04 | Counterfactual deck comparison & expert explanation | planned |

## Exact next actions

1. Inspect optimizer-v12 / deck-builder-v07 / strategy-affinity and theme-scoring paths to locate where structural target pressure can select an incoming card that is materially weaker than the outgoing card for explicit commander/requested identity while aggregate floors still pass.
2. Define generic identity-aware replacement-priority regressions across at least typal (Elven Empire), artifact/enchantment (Animated Army), and spellslinger/enchantment controls.
3. Implement the smallest generic repair only if source diagnosis supports one centralized mechanism. Do not freeze all theme cards, add card/deck exceptions, weaken target gates, or simply raise minimum theme floors.
4. Run focused regressions, then the full required repository validation, type-check/build and project-state integrity; freeze the exact green SHA.
5. Replay Animated Army, Elven Empire and Explorers plus Quick Draw and Virtue and Valor controls from that exact source, then manually inspect complete decks.
6. Accept only if actual Commander whole-deck quality improves across the repeated pattern. Do not merge PR #29 or promote V0.15 before BENCH-01 becomes promotion-grade.

## Permanent truth boundary

- Legality, exact card count, singleton/color identity, physical-printing truth and hard budgets outrank optimization scores.
- Provider unavailable is not evidence of absence.
- Expected restricted-pool ceiling is not target achievement.
- Green harness/tests are not proof of whole-deck Commander improvement.
- Compound component preservation must remain fail-closed.
- Correct strategy labels do not prove replacement quality; relative commander/requested-identity value of IN versus OUT must be considered above hard minimum floors.
- No fixture/card/commander-specific hacks.
- Never treat an unvalidated or manually rejected head as an accepted checkpoint.
- PR merge/stable promotion requires complete validation and promotion-grade benchmark evidence.
