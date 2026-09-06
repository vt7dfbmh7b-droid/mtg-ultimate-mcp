# BENCH-01 Adaptive Diversification — Manual Deck-Quality Review

## Evidence boundary

- Frozen executable product source: `247fb37bc34ad70678ff12ec297a6e9bdc220323`
- Persisted replay evidence: `test-results/bench01-adaptive-diversification-replay/`
- Compact review extraction: `test-results/bench01-adaptive-diversification-replay/review/`
- Fixtures: Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire, Animated Army.
- Repository tests/build/source-freeze guard for the replay were green. This document records the separate Commander-quality acceptance verdict required by BENCH-01.

## Mechanical replay results

| Fixture | Adaptive result | Prior fixed breadth 4 | Prior fixed breadth 6 | Mechanical verdict |
| --- | --- | --- | --- | --- |
| Quick Draw | 8 swaps, Bracket 3 | 8 / B3 | 8 / B3 | unchanged control |
| Virtue and Valor | 4 swaps, Bracket 2 | 4 / B2 | 4 / B2 | unchanged control |
| Explorers of the Deep | 9 swaps, Bracket 3 | 4 / B2 | 9 / B3 | adaptive recovered breadth-6 result |
| Elven Empire | 12 swaps, Bracket 2 | unchanged family control in prior breadth experiment | unchanged family control in prior breadth experiment | more structural movement without target achievement |
| Animated Army | 5 swaps, Bracket 2 | 9 / B2 | 12 / B3 | regression: adaptive did not recover breadth-6 result |

## Manual whole-deck verdict

The adaptive-diversification candidate is **not accepted as a Commander-intelligence improvement** even though its engineering validation and replay harness are green.

### Quick Draw

The output improves machine structural metrics and remains a legal Stella Lee spellslinger deck, but several accepted additions are generic or weakly on-plan relative to the cards removed. Equipment such as Sword of Once and Future / Sword of Wealth and Power appears because generic structural and inferred-strategy scoring can out-rank spellslinger identity. Result: mechanically improved, Commander-quality verdict mixed rather than a clear specialist win.

### Virtue and Valor

The output preserves legality and the enchantment shell but spends upgrade slots on generic structural fillers such as Puresteel Paladin, Negative Zone Portal, Sidequest: Raise a Chocobo // Black Chocobo and Tataru Taru. The result does not convincingly demonstrate better Ellivere enchantment/combat construction. Result: mechanically valid, Commander-quality improvement unproven.

### Explorers of the Deep

Adaptive search successfully recovers the prior breadth-6 9-swap / Bracket-3 state and retains the hard Merfolk + counters + draw + combat theme floor. However, the accepted package still trades high-synergy typal/commander pieces for generic structural cards while remaining above the minimum theme thresholds. The bracket movement therefore overstates whole-deck quality. Result: adaptive-search positive, but requested-identity/replacement-priority quality remains mixed.

### Elven Empire

This is a clear identity-quality warning. A Lathril Elf typal/tokens/combat deck loses multiple Elf/Elf-payoff cards for Gilded Goose, Culling the Weak, Transmutation Font, The Meathook Massacre, Kura, Campsite Cuisine, Gyome, Sidequest: Raise a Chocobo and other generic/aristocrats/food-adjacent cards, while the deck still ends at Bracket 2. The recorded swap reasoning treats incidental `aristocrats` / `food-lifegain` signals as strategy support even though the explicit requested identity is Elves + tokens + combat. Result: Commander-quality regression despite structural movement.

### Animated Army

This is both a mechanical and strategic rejection. The adaptive result stops at only 5 swaps / Bracket 2, versus the prior fixed-breadth-6 result of 12 swaps / Bracket 3. It also drops strategically relevant combo evidence from 1 to 0. The accepted package cuts Etali, Grothama, Kodama of the East Tree, Warstorm Surge and Rampaging Baloths for Mask of Memory, Turn to Dust, Cool but Rude, Diamond Pick-Axe and Veil of Summer. More importantly, strategy evidence labels Bello as `equipment-voltron` even though Bello's rules text explicitly refers to **non-Equipment** artifacts and non-Aura enchantments. Source inspection shows that incidental protection + power/toughness signals, plus an `equipment` role inferred from the negative `non-Equipment` reference, can manufacture a substantive Equipment/Voltron strategy context. Result: clear product-quality failure.

## Repeated generic weakness

The cross-fixture problem is broader than candidate breadth:

1. Generic Bracket structural targets can dominate replacement priority even when the resulting cards are weaker fits for the commander/requested deck identity.
2. Strategy preservation is only as good as the inferred strategy context. When incidental or negatively referenced mechanics become substantive strategies, the preservation layer can confidently preserve the wrong identity.
3. Hard theme/component minimums correctly prevent catastrophic target failure, but they can still allow meaningful erosion of an already-dense requested identity above the minimum floor.
4. Therefore Bracket movement, structural metric movement and green acceptance gates are not sufficient evidence of whole-deck Commander improvement.

## Centralized source diagnosis

`inferNeutralStrategyV15()` currently accumulates independent archetype signals. For `equipment-voltron`, protection and power/toughness text can reach substantive support, while the generic card-role layer can also treat a negative `non-Equipment` reference as Equipment semantics. This is a centralized semantic strategy-inference defect, not a Bello-specific exception.

The first justified repair is generic: require a positive Equipment/equip/attach semantic anchor before incidental protection/combat-scaling signals may create substantive `equipment-voltron` identity, and do not treat explicit negative `non-Equipment` references as positive Equipment anchors.

This does **not** yet solve the broader theme-aware replacement-priority issue demonstrated by Elven Empire and Explorers. That remains a separate BENCH-01 product-quality gate and must not be hidden by a successful strategy-anchor regression.

## Acceptance / next action

- Keep `e17b0a1cba659b229fd6f0b6e2df79c5e464a616` as the latest accepted fully validated Commander product baseline.
- Treat `247fb37bc34ad70678ff12ec297a6e9bdc220323` as an engineering-green adaptive-diversification candidate that **failed manual Commander-quality acceptance**.
- Validate the generic positive-anchor strategy-inference repair with focused + full regressions before any benchmark replay.
- After that exact repair SHA is green, replay at minimum Animated Army plus Elven Empire and Explorers of the Deep, with Quick Draw / Virtue and Valor controls, from one frozen source.
- Require manual whole-deck quality improvement, not merely Bracket or structural-metric movement.
- Continue diagnosing theme-aware replacement priority if Elven/Explorers still trade requested identity for generic structural fillers.
- Do not merge PR #29 or promote V0.15 while this product-quality gate remains open.
