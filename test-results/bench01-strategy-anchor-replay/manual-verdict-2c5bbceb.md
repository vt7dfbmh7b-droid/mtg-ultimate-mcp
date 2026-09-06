# BENCH-01 manual verdict — advisory-theme replay

- Frozen executable source: `2c5bbcebb49c6dab23abcb84acf4968f9741db3b`
- Replay evidence commit: `36f6734e8f7b02dd24237aecb032379c0dd5cf4b`
- Prior rejected comparison source: `f65f4b7b77ee832e2ac66b2a7403f9dda603b84c`
- Fixtures: Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire, Animated Army
- Source frozen within batch: yes
- Formal validation before replay: green
- Manual Commander-quality verdict: **REJECTED**
- General-AI comparison for this repair replay: inconclusive/not newly run; this gate is a pre/post specialist-quality acceptance replay, not a claim of superiority over a new general-AI build.

## Batch-level conclusion

The generic change that keeps `matchesControlledTheme` as a binary advisory incoming-candidate preference after the aggregate theme floor is met does not solve the repeated strategy-preservation defect. It changes candidate selection, but `matches any requested component` is too coarse for compound themes: generic cards can satisfy broad components such as card draw, interaction, counters, combat, or value while diluting the defining enchantment/typal/spellslinger/artifact identity.

The repaired lineage must therefore **not** replace the accepted Commander baseline and must not be promoted. A second generic repair is justified only at the component-priority level: candidate ranking needs to distinguish the defining/underrepresented components of a compound requested theme rather than treating membership in the union of all components as equivalent. This must remain advisory and role-compatible; structural repairs still need a fallback when no identity-preserving candidate exists.

## Manual whole-deck review

### Quick Draw — reject

Legal and exactly 100 cards; commander/color identity and explicit compound theme remain formally satisfied. Structural metrics improve from MV 3.27 to 2.87, cheap interaction 3→5, tutors 0→2, draw 20→23, interaction 7→9, protection 0→3. However the finished list still drifts from Stella Lee spellslinger: `Sword of Once and Future`, `Sword of Wealth and Power`, and `Sword of Forge and Frontier` occupy upgrade slots while core spell-plan cards such as `Dig Through Time` and `Treasure Cruise` are cut. This is not a sufficiently strategy-preserving upgrade package, and the requested high target is not achieved (assessed bracket remains 3).

### Virtue and Valor — reject

Legal and exactly 100 cards; formal theme audit remains satisfied and structure improves to bracket 3. The actual replacements are still poor for Ellivere enchantment combat: `Angelic Destiny`→`Explore`, `Spectral Steel`→`Warping Wail`, `Celestial Archon`→`Mangara's Tome`, `Ancestral Mask`→`Sword of Fire and Ice`, plus other generic structural pieces. The deck gains counts but sacrifices defining enchantment/Aura density and role continuity. This is a strategy-preservation failure, not target achievement.

### Explorers of the Deep — reject

Legal and exactly 100 cards; structure improves from bracket 2 to 3 and cheap interaction reaches 6, but the complete list cuts multiple Merfolk/typal engines for off-type or generic cards: `Reflections of Littjara`→`Walking Ballista`, `Cold-Eyed Selkie`→`Essence Flux`, `Deeproot Waters`→`Archmage Ascension`, `Kopala, Warden of Waves`→`Worldly Tutor`, `Merfolk Cave-Diver`→`Sword of Fire and Ice`. The counters/card-draw components are being allowed to stand in for the defining Merfolk component. This remains a typal strategy-preservation/replacement-quality failure.

### Elven Empire — reject

Legal and exactly 100 cards; only three swaps are accepted and the deck remains bracket 2. `Ruthless Winnower`→`Llanowar Elves` is identity-consistent, but `Eyeblight Massacre`→`Giant Mana Cake` and `Twinblade Assassins`→`Deadly Dispute` demonstrate that token/aristocrats/interaction matches can still outrank Elf identity. The source moves some structural metrics but does not achieve the requested target and does not prove the generic defect resolved.

### Animated Army — reject / regression guard failed

Legal and exactly 100 cards, but the repaired source accepts **zero swaps** and remains bracket 2. The terminal reason is that every competing package would break a required compound-theme component. This avoids identity dilution, but it is not a successful upgrade and regresses the previous lineage's useful movement. The generic repair therefore does not generalize safely across the five-fixture family.

## Failure classification

- Harness/infrastructure: passed for this batch.
- Provider/source: available sufficiently for the persisted replay; no provider failure is used as a product verdict.
- Legality/constraint: pass on exact size, commander legality, resolution and formal compound-theme floors.
- Target achievement: fail for all five as high-power target achievement; some show target movement only.
- Deck-quality weakness: present.
- Strategy-preservation weakness: repeated across Quick Draw, Virtue and Valor, Explorers of the Deep and Elven Empire.
- Replacement-priority weakness: repeated.
- Generic defect isolated: binary union-level compound-theme candidate membership cannot preserve component identity once broad components dominate ranking.

## Exact next action

Do not patch individual cards or fixtures. Design the smallest generic **component-aware advisory theme affinity** signal: candidate ordering should reward role-compatible cards that support defining and/or currently underrepresented components of the requested compound theme, rather than assigning the same preference to any card that matches any component. Add focused generic regression tests spanning spellslinger, enchantment, Merfolk typal, Elf typal, and artifact/enchantment compound cases; then require full immutable validation before freezing a new SHA and replaying several contrasting fixtures from that unchanged source.
