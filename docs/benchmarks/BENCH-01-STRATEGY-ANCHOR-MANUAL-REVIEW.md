# BENCH-01 Strategy-Anchor Replay — Manual Deck-Quality Review

## Evidence boundary

- Frozen executable product source: `2e34ebff20d0a66b7c4649feb1e9984c156e43ca`.
- Replay evidence: `test-results/bench01-strategy-anchor-replay/`.
- Fixtures: Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire, Animated Army.
- The replay metadata records focused strategy regression + full repository suite + build green before the frozen-source five-fixture replay.
- This review is the Commander-quality acceptance layer required by BENCH-01; green engineering validation alone is not treated as product-quality acceptance.

## What the repair fixed

The generic positive-anchor strategy-inference repair did fix the specific centralized semantic defect discovered in the prior adaptive replay: Bello no longer receives an `equipment-voltron` strategy merely because his Oracle text contains a negative `non-Equipment` reference plus incidental protection/combat-scaling text. In the new Animated Army replay, accepted-swap strategy evidence is driven by `value-engine`, not fabricated Equipment/Voltron identity.

That is a real generic semantic correction and should remain covered by regression tests.

## Whole-deck replay result

The repair does **not** make the adaptive-diversification lineage acceptable as a Commander-intelligence improvement.

### Animated Army

Animated Army still ends at only **3 swaps / Bracket 2**. The pre-repair adaptive candidate was already rejected at 5 swaps / Bracket 2, while the earlier fixed-breadth-6 diagnostic had reached 12 swaps / Bracket 3.

The new accepted package is mechanically legal and improves some structural counters, but it still cuts strategically valuable Bello cards for generic structural replacements:

- `Etali, Primal Storm` -> `Idol of Oblivion`
- `Kodama of the East Tree` -> `Negative Zone Portal`
- `Sunbird's Invocation` -> `Cool but Rude`

The final post-build evidence also drops strategically relevant combo evidence from **1 to 0**. This remains a Commander-quality regression despite the corrected strategy label.

Verdict: **semantic anchor fixed; whole-deck product candidate still rejected**.

### Elven Empire

The strategy-anchor repair does not address the broader Elven identity problem found in the prior manual review. The replay still allows structural-Bracket pressure and incidental strategy signals to justify replacing Elf/Elf-payoff cards with generic aristocrats, food/lifegain, tutor, fast-mana, and structural filler cards while the deck remains below the requested higher target.

Examples in the replay continue to include `Culling the Weak`, `Transmutation Font`, `The Meathook Massacre`, `Savor`, `Kura, the Boundless Sky`, `Campsite Cuisine`, and other cards whose structural utility can out-rank the explicit Elves + tokens + combat identity.

Verdict: **requested-identity / replacement-priority weakness remains open**.

### Explorers of the Deep

The replay continues to demonstrate the earlier pattern: adaptive search can find more structural movement, but minimum compound-theme preservation does not prove that high-value Merfolk/counter/commander-synergy pieces are being replaced by equally appropriate cards. The product can remain above hard theme floors while still eroding the quality of a dense requested identity.

Verdict: **search breadth is not the remaining primary blocker; replacement quality is**.

### Quick Draw and Virtue and Valor

These remain useful controls. The anchor repair does not create a broad new Commander-quality gain in these families, and their prior manual concerns about generic structural additions versus commander-specific identity are not resolved by the Equipment semantic fix.

## Cross-fixture diagnosis

The remaining repeated weakness is now clearer:

1. Hard legality/budget/printing/component gates are doing their job and should remain unchanged.
2. Strategy preservation can only reject losses that the inferred strategy model recognizes as meaningful.
3. Even with corrected strategy labels, the optimizer can prefer a structurally useful candidate whose commander/requested-theme affinity is materially weaker than the card being cut.
4. Current minimum theme/component floors prevent catastrophic identity collapse, but they do not protect **identity quality above the minimum floor**.
5. Therefore the next repair should target generic replacement priority / identity-relative scoring, not candidate breadth and not weaker preservation gates.

## Repair threshold / next action

The repeated pattern across Animated Army, Elven Empire, Explorers of the Deep, and the earlier Quick Draw / Virtue manual observations is sufficient to justify source diagnosis of a generic **theme-aware, commander-aware replacement-priority capability**.

Before implementation, establish a generic contract such as:

- when a cut has strong requested-theme/commander-strategy affinity, an incoming card must not win solely on Bracket structural movement if it materially lowers that identity contribution without compensating strategic value;
- compare relative identity/strategy value of the IN and OUT card, rather than relying only on aggregate minimum floors;
- do not freeze every typal/theme card: allow cuts when the replacement has equal or stronger requested-role/strategy value or when the structural gain is necessary and the deck retains sufficient quality redundancy;
- preserve current legality, budget, printing, component, package-acceptance, target-progress, simulation, and strategy-loss truth gates;
- add generic regressions across at least typal, artifact/enchantment, and spellslinger/enchantment controls before accepting a repair.

## Acceptance boundary

- Keep `e17b0a1cba659b229fd6f0b6e2df79c5e464a616` as the latest accepted fully validated Commander product baseline.
- Record `247fb37bc34ad70678ff12ec297a6e9bdc220323` as engineering-green adaptive diversification that failed manual whole-deck acceptance.
- Record `2e34ebff20d0a66b7c4649feb1e9984c156e43ca` as a fully tested strategy-anchor descendant whose localized semantic correction is valid, but whose overall adaptive product lineage still fails manual Commander-quality acceptance.
- Do not merge PR #29 or promote V0.15.
- Next product work: diagnose and implement only a generic identity-aware replacement-priority repair if source inspection supports the contract above, then run focused/full validation and a frozen-source multi-fixture replay with manual whole-deck review.
