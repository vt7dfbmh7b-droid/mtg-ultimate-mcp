# Counter Blitz A23 — Accepted Exploratory Synergy Checkpoint

**Status:** accepted-exploratory-checkpoint  
**Final deck:** no  
**Exact validated source SHA:** `9e82ef54f28f9ca3263c8817e2aa13211d351954`  
**Dedicated validation run:** `33303791437` (`Counter Blitz A23 Synergy Checkpoint`)  
**Dedicated gate conclusion:** success

## Purpose

A23 continues the synergy repair begun in A22d. The A22d-vs-stock audit showed that Counter Blitz had become substantially stronger but had lost some Tidus-specific counter infrastructure. A23 focuses on restoring direct counter/mana/preservation synergy without stripping more card-flow engines from the high-power shell.

## Accepted swaps from A22d

1. `Sidequest: Raise a Chocobo // Black Chocobo` -> `Yuna, Grand Summoner`
2. `Key to the City` -> `Resourceful Defense`

## Why these swaps are accepted

### Yuna, Grand Summoner
- Provides real persistent colored mana instead of relying on Sidequest's unsupported back-face land-search condition.
- Causes the next creature to enter with two additional +1/+1 counters, directly feeding Tidus's Cheer/proliferate plan.
- Preserves counters when another countered permanent dies by moving that investment onto another creature.
- Improves functional mana infrastructure while increasing Counter Blitz synergy density.

### Resourceful Defense
- Preserves counters when a permanent with counters leaves the battlefield.
- Can deliberately move counters between permanents, which is directly aligned with Tidus's counter-manipulation identity.
- Replaces Key to the City after Rikku, Resourceful Guardian already supplied a more native Counter Blitz bridge from counter placement to combat connection.
- Keeps Smuggler's Copter, Staff of the Storyteller, Tome of Legends, Mask of Memory, Buster Sword, Campsite Cuisine, Collective Effort, and Champions from Beyond intact so the deck does not overpay in card flow.

## Sidequest semantic correction

A22d's static metrics credited `Sidequest: Raise a Chocobo // Black Chocobo` as both ramp and a persistent colored mana source because role inference reads the back face's land-search ability.

That credit is not functionally reliable in A22d. Sidequest only transforms if four or more Birds are controlled at the beginning of the first main phase, and this list does not contain a functional four-Bird package. Therefore its back-face land search should not be treated as dependable ramp for this deck.

Corrected A22d functional mana:
- Ramp: `18`
- Persistent colored mana sources: `8`

A23 functional mana:
- Ramp: `19`
- Persistent colored mana sources: `9`

A23 therefore fixes a real structural weakness rather than merely changing a metric label.

## Exact-source hard validation

At `9e82ef54f28f9ca3263c8817e2aa13211d351954`:

- Exact 100 cards: pass
- Commander legality: pass
- Final Fantasy printing-only policy: pass
- Unresolved cards: 0
- Dedicated A23 gate: pass
- Failures: none

## A23 structural and combo metrics

- Average nonland mana value: `2.22`
- Early plays: `41`
- Functional ramp: `19`
- Persistent colored mana sources: `9`
- Corrected cheap interaction: `11`
- Combo-access weighted score: `9.2`

Protected compact routes retained:
- `The Destined White Mage + Walking Ballista`
- `Gatta and Luzzu + Hardened Scales + Walking Ballista`
- `Gatta and Luzzu + The Earth Crystal + Walking Ballista`

Access retained:
- deterministic: `Ranger-Captain of Eos -> Walking Ballista`
- bounded selection: `Commune with Beavers -> The Destined White Mage / Walking Ballista / Gatta and Luzzu / The Earth Crystal`

## Higher-sample matched simulation guard

Mean A23 minus A22d across seven matched scenarios:

- Functional keep rate: `-0.057`
- Commander battlefield uptime: `+0.443`
- Protection-when-challenged: `+4.400`
- Average spells cast: `-0.200`
- Average cards drawn by effects: `-0.236`
- White Mage + Ballista ready rate: `-0.171`
- Gatta + Hardened Scales + Ballista ready rate: effectively unchanged
- Gatta + The Earth Crystal + Ballista ready rate: `+0.157`

All bounded regression thresholds passed.

## Manual synergy verdict

A23 is preferred to A22d as the current exploratory Counter Blitz checkpoint.

The key reason is not raw simulation score. It corrects a real mana-accounting weakness, adds Yuna as a direct mana/counter bridge, adds Resourceful Defense as counter preservation/movement, and removes two cards whose current contributions were less central after Rikku and the broader counter engine were restored.

The deck retains the high-power A22d shell, compact Ballista finishes, dense interaction, protection, card access, and Equipment pieces that still justify their slots.

This does **not** mean the deck is final.

## Candidates not accepted in this checkpoint

- `Grateful Apparition`: individually good, but the cleanest tested inclusion required giving up meaningful card selection/flow. Keep as a review candidate rather than forcing it in.
- `Summon: Ixion`: strategically attractive for lore-counter identity, but tested packages created a larger spell-flow cost than A23 justified. Keep as a review candidate.

Future testing should begin from A23 and only change another slot if a candidate clearly improves the whole deck rather than merely increasing visible counter-theme density.
