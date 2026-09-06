# BENCH-01 replacement-identity manual review

Reviewed frozen runtime source: `f65f4b7b77ee832e2ac66b2a7403f9dda603b84c`
Persisted replay evidence commit: `0322790fbe6f559a08b333df587a3eec0d447713`
Batch: Quick Draw / Virtue and Valor / Explorers of the Deep / Elven Empire / Animated Army

## Verdict

**Manual Commander-quality acceptance: REJECTED.** Formal validation and replay execution are green, but the frozen product does not fix the repeated identity-quality failure strongly enough to replace `e17b0a1cba659b229fd6f0b6e2df79c5e464a616` as the accepted Commander product baseline.

This is a deck-quality / strategy-preservation / replacement-priority failure, not a harness, provider, legality, exact-card-count, or frozen-source failure.

## Whole-deck findings

- **Quick Draw / Stella Lee — fail for replacement quality.** The deck improves curve, interaction and raw structural metrics, but the accepted additions include generic or weakly related cards such as Sword of Once and Future, Sword of Wealth and Power, Aether Spellbomb and Mangara's Tome. Those choices dilute the explicit spellslinger / card-draw / countermagic request instead of selecting role-equivalent cards that reinforce the requested plan.
- **Virtue and Valor / Ellivere — fail for replacement quality.** The enchantment/Aura core remains recognizable, but additions such as Ephemerate, Sword of Fire and Ice, Hour of Promise, Mangara's Tome and Prosperous Innkeeper are generic structural/value cards rather than strong Ellivere/enchantress identity upgrades. The repair therefore does not consistently preserve requested identity once the minimum theme floor is already satisfied.
- **Explorers of the Deep / Hakbal — clear fail for replacement quality.** The final deck retains the Merfolk/counters shell but accepts an off-plan artifact/value package including Sword of Fire and Ice, Aether Spellbomb, Tezzeret, Artifice Master and Padeem, Consul of Innovation. This is materially worse Commander specialization than choosing Merfolk/counter/explore-supporting cards for the same structural jobs.
- **Elven Empire / Lathril — clear fail for replacement quality.** The deck remains Elf-heavy overall, but additions such as Transmutation Font, Campsite Cuisine, Kura, Gyome, Dina and Savor consume upgrade slots that should preferentially reinforce Elf typal / token / aristocrat identity when compatible alternatives exist. The new replay changes some individual cards versus the previous lineage but does not eliminate the generic identity leak.
- **Animated Army / Bello — mixed, not sufficient to accept lineage.** The prior false Equipment/Voltron inference remains corrected and the final list is more coherent than the earlier bad lineage, but the five-fixture batch must be accepted as a whole. The repeated failures above prevent product acceptance.

## Cross-fixture generic diagnosis

The replay exposes a centralized ranking defect rather than isolated bad cards.

`upgrade.ts` ranks incoming role candidates with requested-theme membership only while `themeDeficit > 0`. Once the aggregate controlled-theme minimum is satisfied, incoming candidates are ranked primarily by broad commander-strategy and structural score. Meanwhile the new replacement-identity comparator in `deck-builder-v07.ts` is applied only while sorting candidate **cuts for an already-fixed incoming candidate**. It can choose a less identity-destructive OUT card, but it cannot prefer an on-theme IN candidate over an off-theme IN candidate in the same structural lane.

That explains why aggregate theme audits can remain green while Elves, Merfolk, enchantress and spellslinger upgrades still spend slots on generic/off-plan cards.

## Generic repair justified

Yes. The same failure appears across multiple contrasting archetypes, and the source path is centralized.

The smallest repair should keep requested-theme membership as an **advisory incoming-candidate ordering signal even after the minimum theme floor is satisfied**, within otherwise legal/role-compatible candidates. It must not make theme cards uncuttable, veto necessary structural repairs, weaken authoritative bracket gates, or prevent an off-theme candidate when no suitable on-theme alternative exists.

After the repair: run focused tests, full repository validation/build, freeze the exact green SHA, then replay the same five fixtures unchanged and manually compare complete decks against this rejected `f65f4b7...` batch before accepting the lineage.
