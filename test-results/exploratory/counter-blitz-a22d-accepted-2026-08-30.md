# Counter Blitz A22d — Accepted Exploratory Synergy Checkpoint

**Status:** accepted-exploratory-checkpoint  
**Final deck:** no  
**Exact validated source SHA:** `a326ecd5a600ed7638745e4fd7902c3c9c16a11e`  
**Dedicated validation run:** `33302376197` (`Counter Blitz A22d Synergy Repair`)  
**Dedicated gate conclusion:** success

## Purpose

A22d repairs synergy drift found during the full A21-versus-stock Counter Blitz audit. A21 was a strong FF-only Bant deck, but several slots supported generic Equipment/value patterns more than Tidus, counter movement, counter seeding, proliferate, and combat connection. A22d restores direct Counter Blitz bridges while retaining A21's high-power interaction, ramp, card access, and compact win routes.

## Accepted swaps from A21

1. `Sram, Senior Edificer` -> `The Destined White Mage`
2. `Puresteel Paladin` -> `Tromell, Seymour's Butler`
3. `Lunatic Pandora` -> `Rikku, Resourceful Guardian`
4. `Summoner's Sending` -> `Dovin's Veto`

## Why these swaps are accepted

### The Destined White Mage
- Restores the compact White Mage + Walking Ballista route.
- Is not a dead combo-only card: lifegain converts into +1/+1 counters, which supports Tidus's fair game plan.
- Replaces a narrow Equipment draw engine rather than a core counter card.

### Tromell, Seymour's Butler
- Replaces another Equipment-support card with direct counter seeding and proliferate scaling.
- Strengthens the deck's native counter engine rather than creating a separate subtheme.

### Rikku, Resourceful Guardian
- Directly bridges Tidus's beginning-of-combat counter movement to combat connection by making the newly countered creature difficult to block.
- Preserves the draw/proliferate loop Tidus is trying to create.
- Replaces Lunatic Pandora, whose expensive activated removal had little Counter Blitz synergy.

### Dovin's Veto
- Replaces a slower end-step token/value card with real two-mana stack interaction.
- Better protects Tidus, developed counter boards, and compact win attempts.
- Supports the stated dense-countershell objective without costing another card-flow engine.

## Exact-source hard validation

At `a326ecd5a600ed7638745e4fd7902c3c9c16a11e`:

- Exact 100 cards: pass
- Commander legality: pass
- Final Fantasy printing-only policy: pass
- Unresolved cards: 0
- Dedicated A22d gate: pass
- Failures: none

## A21 -> A22d structural metrics

- Average nonland mana value: `2.120 -> 2.170`
- Early plays: `46 -> 43`
- Ramp: `19 -> 19`
- Persistent colored mana sources: `9 -> 9`
- Raw cheap-interaction metric: `12 -> 10`
- Corrected A22d cheap interaction: `11`
- Combo-access weighted score: `7.9 -> 9.2`

The raw interaction count is not trustworthy for this comparison. A21 falsely counted Lunatic Pandora as cheap interaction because the metric uses card mana value rather than the six-mana activation cost of Pandora's removal ability. The same role parser fails to identify Dovin's Veto as countermagic because its text says "counter target noncreature spell" rather than the narrower regex form currently recognized by the engine.

## Matched simulation regression guard

Mean A22d minus A21 across seven matched scenarios:

- Functional keep rate: `-0.057`
- Commander battlefield uptime: `+0.414`
- Protection-when-challenged metric: `-6.986`
- Average spells cast: `-0.004`
- Average cards drawn by effects: `-0.361`
- Legacy Gatta + Hardened Scales + Walking Ballista ready rate: `-0.071`
- Legacy Gatta + The Earth Crystal + Walking Ballista ready rate: effectively unchanged

All bounded regression thresholds passed.

The protection delta is conservative because Dovin's Veto is not recognized as countermagic by the current role regex. Simulation is therefore a regression guard, not the final strategic verdict.

## Added White Mage route access

The new `The Destined White Mage + Walking Ballista` route was visible in every tested pressure/turn scenario. The A22d combo-access model also found:

- deterministic access: `Ranger-Captain of Eos -> Walking Ballista`
- bounded access: `Commune with Beavers -> The Destined White Mage / Walking Ballista / Gatta and Luzzu / The Earth Crystal`
- weighted combo-access score: `9.2`

## Manual synergy verdict

A22d is preferred to A21 as the current exploratory Counter Blitz checkpoint.

It improves the proportion of cards that directly reinforce Tidus's counters/combat/proliferate plan, removes two pieces of the incidental Equipment-support package, restores an independent Ballista line, and adds genuine stack interaction while preserving the deck's established ramp and mana infrastructure.

This does **not** mean the deck is final. The stock-deck audit also identified a second layer of potentially underrepresented Counter Blitz identity: counter preservation/movement and the Summon/lore-counter subtheme. Wizards' original design specifically linked Tidus's counter manipulation to the Saga-creature Summons, so those options should be tested rather than assumed unnecessary.

## Next isolated candidates

Do not add these blindly. Test individually and in bounded packages against A22d:

- `Yuna, Grand Summoner`
- `Resourceful Defense`
- `Grateful Apparition`
- `Summon: Ixion`

Secondary review candidates only if a clear cut exists:

- `Forgotten Ancient`
- `Scholar of New Horizons`

Any future change must preserve FF-printing legality, exact 100, the compact Ballista routes, mana/ramp floors, and the improved Tidus-specific synergy achieved here.
