# BENCH-01 manual whole-deck verdict — strategy-compatible candidate lane

## Frozen source

- Product source SHA: `d7b203ce14161875720c72290a7adbcc12129cde`
- Batch: `BENCH-01-STRATEGY-ANCHOR-REPLAY`
- Source frozen within batch: yes
- Fixtures: Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire, Animated Army
- Formal validation before replay: green

## Overall verdict

**REJECT as an accepted Commander-product lineage.**

The candidate-lane repair is a real engineering improvement: it can prefer cards that the current strategy-affinity machinery labels as aligned, and it preserves generic structural fallback when no aligned printing exists. Mandatory whole-deck review shows that the underlying affinity signal is still too shallow to establish genuine commander/requested-strategy compatibility. Generic structural cards can receive high strategy-affinity scores from broad role overlap and then enter the primary lane even when their card type/mechanism is poorly matched to the deck's actual plan.

The accepted Commander baseline therefore remains `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`.

## Fixture review

### Quick Draw — Stella Lee, Wild Card — spellslinger/control

- Legal/exact-size output: yes; replay evidence reports 100 cards, Commander legality, no unresolved cards.
- Structural movement: substantial improvement in curve, cheap interaction, draw and protection metrics.
- Whole-deck quality: **fail**.
- The final deck adds `Sword of Once and Future`, `Sword of Wealth and Power`, and `Sword of Forge and Frontier`. These are individually useful cards and can satisfy protection/value labels, but three Equipment additions are a poor primary-lane answer for a Stella Lee deck whose defining incentives are casting multiple instants/sorceries, cheap interaction, spell velocity and spell-based protection. The system is mistaking broad role overlap for true spellslinger affinity.
- Other additions such as `Three Steps Ahead`, `Wash Away`, `Remand`, and `Coruscation Mage` are directionally coherent, proving that the issue is ranking/affinity discrimination rather than an inability to find aligned cards.
- Verdict: **deck-quality / strategy-affinity weakness; reject**.

### Virtue and Valor — Ellivere of the Wild Court — enchantment combat

- Legal/exact-size output: yes.
- Whole-deck quality: **fail**.
- `Sram, Senior Edificer` is coherent, but the package also includes generic or weakly related structural/value cards such as `Mind Stone`, `Skullclamp`, `Prosperous Innkeeper`, `Ephemerate`, `Sword of Fire and Ice`, `Hour of Promise`, `Mangara's Tome`, and `Insidious Fungus`.
- Several of these can technically contribute draw, ramp, protection or interaction, yet they dilute an enchantment/Aura combat shell where enchantment density, modified-creature support and enchantress-style engines should normally win tie-breaks among role-compatible candidates.
- Verdict: **deck-quality / strategy-affinity weakness; reject**.

### Explorers of the Deep — Hakbal of the Surging Soul — Merfolk/counters

- Legal/exact-size output: yes.
- Whole-deck quality: **fail**.
- `Worldly Tutor` can be justified as a generic tutor, but `Mind Stone`, `Archmage Ascension`, `Sword of Fire and Ice`, `Origin of Metalbending`, `Padeem, Consul of Innovation`, and other off-plan additions do not adequately support Hakbal's Merfolk/explore/+1/+1-counter incentives.
- The deck already contains a dense typal core; role-compatible replacements should therefore strongly prefer Merfolk, explore/counter engines, or cards that directly multiply Hakbal's combat/value loop before generic artifact/value pieces.
- Verdict: **typal/commander-affinity weakness; reject**.

### Elven Empire — Lathril, Blade of the Elves — Elf typal/token combat

- Legal/exact-size output: yes.
- Whole-deck quality: **fail**.
- `Valley Rotcaller` is on-plan, but the final additions also include `Haywire Mite`, `Transmutation Font`, `Campsite Cuisine`, `Kura, the Boundless Sky`, `Gyome, Master Chef`, `Dina, Soul Steeper`, and other non-Elf utility/value pieces.
- Some are playable Commander cards and some cover structural roles, but the replacement package does not respect the unusually high value of Elf body count and Elf-synergy density for Lathril. Generic role satisfaction is still outranking the defining typal mechanism too often.
- Verdict: **typal density / commander-affinity weakness; reject**.

### Animated Army — Bello, Bard of the Brambles — high-MV artifact/enchantment combat

- Legal/exact-size output: yes.
- Whole-deck quality: **fail / insufficient improvement**.
- The final additions are `Mask of Memory`, `You Find Some Prisoners`, and `Cool but Rude`. They provide useful generic card advantage/value, but none materially deepens Bello's defining incentive to play mana-value-4+ noncreature artifacts/enchantments that become hasty indestructible 4/4 creatures on the user's turn.
- The repair therefore moves the deck structurally but still does not consistently discover or prioritize commander-specific role-compatible upgrades.
- Verdict: **commander-specific incentive weakness; reject**.

## Cross-fixture diagnosis

The repeated generic defect is now narrower than candidate-lane availability:

> **Strategy-affinity scoring is over-permissive because broad structural-role/value overlap can masquerade as commander/requested-strategy compatibility.**

The system needs to distinguish **direct strategic mechanism affinity** from **generic role utility**. A card should not enter the strategy-compatible primary lane merely because it draws cards, protects something, ramps, tutors, or interacts if those functions are not expressed through a mechanism that materially advances the requested deck identity.

Examples of direct mechanism evidence include, generically:

- spellslinger: instant/sorcery casting, copying, magecraft/prowess-like cast triggers, spell-cost/velocity mechanics, spell recursion, interaction/protection delivered as spells;
- enchantment/Aura combat: enchantments/Auras, enchantment-cast triggers, modified/enchanted-creature payoffs, enchantress engines;
- typal: relevant creature type, type-specific token production, type-count/type-cast payoffs, type-specific lords/tutors/recursion;
- commander permanent-class incentives: the exact card type/mana-value/permanent property the commander turns into an engine or win condition.

Generic role utility remains valuable and must remain available as fallback. It should not be treated as proof of strategic affinity.

## Repair threshold

A new generic repair **is justified** because the same false-positive affinity pattern appears across five contrasting archetypes after the candidate-lane repair passed formal validation.

The deficient generic capability is: **mechanism-aware commander/requested-strategy affinity discrimination**.

The smallest next repair should tighten the primary-lane affinity predicate/scoring so that direct mechanism evidence outranks broad role-only overlap, while retaining generic structural fallback when no genuinely aligned candidate is eligible. Do not add fixture, commander, or card-name exceptions.

## General-AI comparison

No fresh, independently persisted strong-general-AI builds were produced for this exact five-fixture replay. Therefore the specialist-vs-general-AI verdict for this batch remains **inconclusive for formal comparison**, rather than inferring a win/loss from earlier runs. The manual Commander-quality rejection is independent of that comparison.

## What remains unproven / next action

1. Locate the centralized strategy-affinity matcher/scorer used by candidate-lane selection and identify which generic role/value signals are creating these false positives.
2. Implement the smallest mechanism-aware generic distinction between direct strategic affinity and generic structural utility.
3. Add focused cross-archetype regressions that use synthetic/generic card semantics rather than fixture/card-name exceptions.
4. Run focused tests and the complete immutable validation suite.
5. Only if fully green, freeze the exact product SHA and replay contrasting fixtures from unchanged source.
6. Manually inspect complete decks before accepting the lineage.
