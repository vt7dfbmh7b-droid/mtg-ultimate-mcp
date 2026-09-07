# BENCH-01 whole-deck verdict — 73d7e394

Frozen product source: `73d7e3944a7a4da51b9c5a87834eb6642a61a1c8`

Fixtures: Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire, Animated Army.

Formal state: focused + full immutable validation green before replay; frozen-source integrity green; replay execution green.

## Verdict

**Rejected as an accepted Commander product lineage, but materially better in typal candidate recall.**

Keeping requested/theme-compatible role discovery active after the minimum density is satisfied improved some actual candidate choices, especially Elven Empire, but the complete decks still fail the mandatory replacement-coherence gate across multiple contrasting Commander identities.

## Manual whole-deck review

### Quick Draw / Stella Lee — reject

The deck remains legal and structurally improved on curve/interaction, but `Sword of Once and Future` and `Sword of Wealth and Power` remain in the final additions alongside real spellslinger upgrades such as `Mental Misstep`, `Pyroblast`, `Flusterstorm`, `Red Elemental Blast`, and `Mystical Tutor`. Equipment continues to consume scarce upgrade slots in a deck whose requested identity is spellslinger/card-draw/countermagic. This is target movement, not Commander-quality target achievement.

### Virtue and Valor / Ellivere — reject

The stock enchantment/Aura core survives, but the additions still include several weakly identity-aligned cards (`Flaxen Intruder // Welcome Home`, `Sidequest: Raise a Chocobo // Black Chocobo`, `Springheart Nantuko`, `Reconnaissance`, `Reprieve`, `Hour of Promise`, `Intangible Virtue`, `Battle Menu`) instead of consistently selecting enchantment/Aura-compatible cards for equivalent structural needs. Strategy preservation is acceptable; replacement priority remains below specialist quality.

### Explorers of the Deep / Hakbal — reject, improved

The core Merfolk/explore/counter identity remains strong and the final deck is cleaner than earlier rejected lineages, but the additions still contain generic/off-axis cards such as `Titania's Command`, `Planar Incision`, `Teferi's Time Twist`, `Sword of Fire and Ice`, and `Aberrant`. `Aqueous Form`, `Delay`, and `Mystical Tutor` are defensible, but the complete replacement package is not consistently Merfolk/explore/counter-mechanism first.

### Elven Empire / Lathril — reject, materially improved

This fixture shows the repair is doing useful work. Many new cards are now Elf or directly typal-compatible (`Elves of Deep Shadow`, `Elvish Reclaimer`, `Llanowar Elves`, `Formidable Speaker`, `Bloom Tender`, `Fauna Shaman`), which is a clear improvement over the previous broad non-Elf drift. However `Deathspore Thallid`, `Haywire Mite`, `Sword of Hearth and Home`, and `Sword of Fire and Ice` still occupy replacement slots while strong Elf-role alternatives exist broadly. The lineage therefore has improved but has not crossed the whole-deck specialist gate.

### Animated Army / Bello — reject

The engine again makes only one outside-precon addition, `Sword of the Animist`, rather than finding a meaningful package of mana-value-4+ artifacts/enchantments that directly exploit Bello. This remains a commander-mechanism discovery/replacement-priority failure, not an expected restricted-pool ceiling because the fixture is unrestricted.

## Cross-fixture conclusion

The `73d7e394...` repair proves that keeping requested identity active in role discovery was necessary, but it is not sufficient. The repeated defect is now narrower:

**The engine still treats requested/theme identity primarily as candidate-pool membership and lane ordering, but does not sufficiently compare the strategic mechanism quality of the actual replacement against other candidates satisfying the same structural role. Generic cards therefore remain eligible fallback too early, and unusual commander incentives can still fail to produce enough directly mechanism-compatible candidates.**

This appears in spellslinger, enchantment-combat, Merfolk typal, Elf typal, and high-MV artifact/enchantment decks, so a generic repair threshold is met.

## Next justified product action

Implement the smallest generic same-role replacement-quality preference that rewards direct requested/commander mechanism affinity over merely generic structural utility while preserving generic structural fallback when no compatible eligible printing exists. The preference must remain advisory among legal role-satisfying candidates; it must not create hard theme floors or card/commander exceptions.

For unusual commander incentives, ensure the same-role requested mechanism search can express numeric/type constraints such as `mana value >= 4` plus artifact/enchantment, rather than relying only on broad inferred archetype semantics.

Then require cross-archetype focused regressions, the complete immutable validation suite, one frozen-source contrasting replay, and manual complete-deck comparison before acceptance.

The accepted Commander baseline remains `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`. PR #29 and stable/current V0.13 remain unpromoted pending BENCH-01 promotion-grade evidence.
