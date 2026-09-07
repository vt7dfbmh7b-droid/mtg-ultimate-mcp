# BENCH-01 manual whole-deck verdict — mechanism-aware strategy affinity

## Frozen source

- Product source SHA: `e6850c8ffab7c52cf0f6e1d7bf0c323e14d76ad7`
- Persisted replay checkpoint: `f5c1bd7b63df3504f75944b7d640684dc3065b4d`
- Batch: `BENCH-01-STRATEGY-ANCHOR-REPLAY`
- Source frozen within batch: yes (`src/**` verified equal to frozen product SHA before replay)
- Fixtures: Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire, Animated Army
- Formal validation before replay: focused regressions + full repository suite + build green
- Harness outcome: success

## Overall verdict

**REJECT as an accepted Commander-product lineage, while retaining the repair as a measurable partial improvement.**

The mechanism-aware affinity repair improves the previous `d7b203ce...` lineage: several glaring generic-role false positives disappear, especially in Hakbal and Lathril. Mandatory whole-deck review still finds the same higher-level failure in enough contrasting archetypes to block product acceptance: direct commander/request strategy mechanisms are not yet weighted strongly enough when choosing among legal role-compatible replacements.

The accepted Commander baseline therefore remains `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`.

## Fixture review

### Quick Draw — Stella Lee, Wild Card — spellslinger/control

- Legal/exact-size output: yes; 100-card Commander output persisted.
- Improvement versus rejected `d7b203ce...`: the previous package contained three off-plan Swords; `Sword of Forge and Frontier` is gone and the list includes coherent spell-based upgrades such as `Pact of Negation`, `Three Steps Ahead`, `Daze`, `Mystical Tutor`, and `Coruscation Mage`.
- Remaining defect: `Sword of Once and Future` and `Sword of Wealth and Power` are still admitted into the final package. They can provide protection/value, but Equipment remains a poor primary answer for Stella Lee compared with cheap instants/sorceries, cast-trigger engines, spell recursion, velocity, and spell-based protection.
- Verdict: **partial improvement; deck-quality / commander-mechanism prioritization still below acceptance**.

### Virtue and Valor — Ellivere of the Wild Court — enchantment/Aura combat

- Legal/exact-size output: yes.
- The stock enchantment core remains intact, but the new tail still includes generic or weakly related cards such as `Hangarback Walker`, `Bloodforged Battle-Axe`, `Warping Wail`, `Hour of Promise`, `Idol of Oblivion`, `Pawpatch Formation`, and `Sword of Wealth and Power`.
- Those cards can satisfy ramp/draw/protection/interaction/token labels, but they should normally lose role-compatible tie-breaks to enchantments/Auras, enchantress engines, modified-creature support, or cards that directly multiply Ellivere's Virtuous Role/combat plan.
- Verdict: **fail; strategy-preservation/replacement-priority weakness remains**.

### Explorers of the Deep — Hakbal of the Surging Soul — Merfolk/counters

- Legal/exact-size output: yes.
- Meaningful improvement versus rejected `d7b203ce...`: `Mind Stone`, `Sword of Fire and Ice`, `Padeem, Consul of Innovation`, and several other generic artifact/value additions are gone. The resulting deck preserves a much denser Merfolk/explore/counter core and adds `Merfolk Cave-Diver`.
- Remaining off-plan tail includes `Wizard Class`, `Origin of Metalbending`, `District Mascot`, `Silkguard`, and `Planar Incision`; `Worldly Tutor` and `Delay` are defensible generic structural cards.
- Verdict: **clear directional improvement, but not independently strong enough to accept the lineage while other fixtures still fail the same capability**.

### Elven Empire — Lathril, Blade of the Elves — Elf typal/token combat

- Legal/exact-size output: yes.
- Meaningful improvement versus rejected `d7b203ce...`: the prior non-Elf drift (`Haywire Mite`, `Transmutation Font`, `Campsite Cuisine`, `Kura`, `Gyome`, `Dina`, etc.) is gone. The final list restores/retains a very high Elf body count and coherent Elf payoffs.
- The remaining generic tail (`Not Dead After All`, `Giant Mana Cake`, `The Meathook Massacre`, `Deadly Dispute`) is small enough to be plausibly justified as structural support rather than identity dilution.
- Verdict: **pass for replacement coherence in this replay; strong evidence the mechanism repair helps typal decks**.

### Animated Army — Bello, Bard of the Brambles — MV4+ artifact/enchantment combat

- Legal/exact-size output: yes.
- Improvement versus rejected `d7b203ce...`: the prior generic additions `Mask of Memory`, `You Find Some Prisoners`, and `Cool but Rude` are gone.
- Remaining problem: the only new tail card is `Sword of the Animist`, which is useful ramp but does not materially advance Bello's defining MV4+ noncreature artifact/enchantment animation incentive. The system therefore avoids some false positives but still fails to discover/prioritize a commander-specific upgrade package.
- Verdict: **fail / insufficient target achievement; commander-specific mechanism recognition/prioritization remains weak**.

## Cross-fixture diagnosis

The repair successfully reduces **false positive strategy affinity**, but the remaining repeated defect is now:

> **Direct commander/request mechanism affinity is still too weak as a positive prioritization signal among structurally eligible candidates.**

This is distinct from the previous problem. Generic cards are less likely to be mislabeled as strategically aligned, but the system still does not consistently elevate the strongest mechanism-bearing alternatives above acceptable generic structural cards.

Repeated evidence:

- spellslinger: spell-based protection/interaction/velocity should beat Equipment utility for Stella Lee;
- enchantment combat: enchantments/Auras/enchantress/modification support should beat generic token, artifact, ramp, or Equipment value for Ellivere;
- typal: the repair now succeeds much better for Lathril and materially improves Hakbal, showing the mechanism filter is useful;
- commander permanent-class incentives: Bello still lacks sufficient positive preference for the exact MV4+ artifact/enchantment property his commander converts into threats.

## Repair threshold

A further generic repair is justified because the same positive-prioritization deficiency persists in at least three contrasting archetypes after a formally green frozen replay, while two typal fixtures demonstrate the current repair is directionally correct.

The deficient capability is **positive commander/request mechanism weighting and candidate discovery/ranking**, not merely rejection of false positives.

Do not revert the mechanism-aware filter, add fixture/card exceptions, or hard-freeze typal/theme cards. The smallest next experiment should strengthen generic positive evidence for direct mechanisms when comparing candidates satisfying the same structural role, while keeping generic structural fallback available.

Before changing product behavior, inspect whether the desired aligned alternatives are present in the candidate pool. If they are absent, classify/fix candidate discovery rather than ranking. If present but losing, adjust only the centralized mechanism-aware ordering signal.

## General-AI comparison

No fresh independently persisted strong-general-AI builds were generated for this exact replay, so the formal specialist-vs-general-AI verdict remains **inconclusive** for this batch. The manual product rejection does not depend on claiming a general-AI win.

## Exact next action

1. Inspect candidate-pool evidence for Quick Draw, Virtue and Valor, and Animated Army to distinguish **aligned-candidate discovery failure** from **aligned-candidate ranking failure**.
2. Do not patch until that distinction is proven across the contrasting failures.
3. If aligned candidates exist but lose, strengthen the centralized positive direct-mechanism preference among same-role candidates; if absent, repair generic candidate discovery instead.
4. Add focused cross-archetype regressions, run the complete immutable validation suite, freeze the exact green SHA, and replay contrasting fixtures unchanged.
5. After this repeated family is resolved, broaden BENCH-01 to fresh combo, hybrid, control, aristocrats, budget, and unusual-commander fixtures with strong general-AI comparison rather than continuing to polish only these five precons.
