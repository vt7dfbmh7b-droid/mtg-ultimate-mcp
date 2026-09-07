# BENCH-01 manual whole-deck verdict — 6686f289

Frozen product source: `6686f2892e93cc571ee9e4f7717bb5f0156bd301`

Batch: Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire, Animated Army.

## Verdict

**REJECTED as the next accepted Commander product baseline.**

The exact-role requested-identity lane is a real improvement, but the five-deck replay still does not demonstrate sufficiently coherent Commander-specialist replacement quality across contrasting archetypes.

## Fixture review

### Quick Draw — clear improvement / locally acceptable

The prior Equipment drift is gone. The final additions are now strongly aligned with Stella Lee's spellslinger/control plan: Mental Misstep, Mystical Tutor, March of Swirling Mist, Pyroblast, Counterspell, Sanar, Eldritch Immunity, and Red Elemental Blast. Interaction, protection, curve and tutor density improve without turning the deck into Equipment/value soup.

This is positive evidence that the requested-role lane can materially improve a real deck.

### Virtue and Valor — improved but mixed

The final additions include direct enchantment/Aura support such as Sterling Grove and Sigarda's Aid, and the stock enchantress identity remains intact. However several generic value/combat additions still enter ahead of more obviously enchantment-centric replacements. The result is better than the rejected predecessor but not strong enough to prove the generic repair across archetypes.

### Explorers of the Deep — still rejected

Hakbal remains mostly coherent, but the upgrade package still includes off-plan or weakly aligned structural cards such as Essence Flux, Teferi's Time Twist, Sword of Fire and Ice and Aberrant. Those cards can satisfy generic protection/value/counter roles while being materially weaker Commander-specialist choices than Merfolk/explore/counter-mechanism alternatives.

### Elven Empire — still rejected

Typal recall improved: Fyndhorn Elves, Elvish Reclaimer, Elves of Deep Shadow, Formidable Speaker, Bloom Tender and Fauna Shaman are meaningful Elf-compatible additions. But the package still includes multiple non-Elf generic structural cards, including Flaxen Intruder, Culling the Weak, Dokuchi Silencer, Grist, Sword of Hearth and Home and Sword of Fire and Ice. This remains too much identity drift for a specialist precon optimizer.

### Animated Army — clear failure

Bello still receives very little direct MV4+ artifact/enchantment commander support. Vexing Puzzlebox is on-plan, but much of the remaining package is generic or poor. `Jet Medallion` is particularly revealing: it is Commander-legal in Gruul because it is colorless, but its black-spell cost-reduction text is functionally dead in a red-green deck. This shows that context-free structural-role truth can still admit a card whose nominal role does not actually function in the current deck.

## Cross-fixture conclusion

The current hierarchy successfully improves discovery and ordering when a strong requested-role candidate is found, but **generic structural fallback is still too permissive and too context-free**.

Two generic weaknesses remain visible:

1. **Fallback identity quality:** when no earlier requested/strategy lane yields an eligible printing, a generic role card is accepted with too little penalty for commander/requested-identity distance. This still produces typal and mechanic drift across Hakbal, Lathril and Bello.
2. **Context-sensitive role applicability:** role inference can treat text as satisfying a structural role even when the effect cannot function meaningfully in the deck context (for example a color-specific cost reducer for colors the deck cannot cast).

The next repair should not remove structural fallback. It should make fallback candidates prove that their structural role is actually applicable in the current deck and prefer identity-neutral fallbacks over identity-damaging ones. Do not add commander/card/fixture exceptions.

## Acceptance state

- `6686f289...`: formally validated and replay-complete, **manual whole-deck acceptance failed**.
- Accepted Commander baseline remains `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`.
- PR #29 remains unmerged.
- Stable/current remains V0.13.

## Exact next action

Implement the smallest generic **context-sensitive role applicability / fallback-quality** repair. Add synthetic regressions proving that structurally labeled but context-dead candidates do not outrank usable neutral/on-plan alternatives, while structural fallback remains available when it is genuinely functional. Then run focused + full immutable validation and freeze a new SHA only if green.
