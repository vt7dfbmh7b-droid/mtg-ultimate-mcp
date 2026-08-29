# Counter Blitz A16 — Accepted Exploratory Champion

Date: 2026-08-29
Branch: `test/counter-blitz-a16-combo-selection-20260829`
Source SHA: `1840f42526dcf69ce230af6a5d148cc430d983b8`
Workflow run: `33229569436`
Status: **accepted exploratory champion**
Stable/current: unchanged at V0.13
PR #29: not merged

## Decision

Accept the following single swap over the A14 exploratory champion:

**OUT**
- From Father to Son (FIN) 20

**IN**
- Commune with Beavers (FIN) 182

This creates the A16 exploratory Tidus champion.

## Why this swap is accepted

The corrected physical-99 purpose audit identified From Father to Son as a review slot with purpose score 0. In the exact A14 99, its Vehicle search has only one legal library target: Smuggler's Copter. Its flashback mode is therefore narrow and expensive rather than meaningful combo access.

Commune with Beavers is a one-mana bounded selector. It looks at the top three cards and can take an artifact, creature, or land. Under the corrected library-visible-card semantics it reaches three of the four supplied combo pieces:
- Walking Ballista
- Gatta and Luzzu
- The Earth Crystal

It does not reach Hardened Scales.

In the A14 physical 99, 72 slots have a library-visible front-face type of artifact, creature, or land. As a raw composition sanity check, if Commune is the card being cast and no other information is known, the chance that its top three contain at least one eligible card is approximately 98.3%. This is not treated as a gameplay simulation result; it only confirms that the selector is structurally live in this deck.

## Effective combo-access evidence

Baseline A14 effective access:
- deterministic sources: Ranger-Captain of Eos -> Walking Ballista
- bounded sources: none
- accessible supplied combo pieces: Walking Ballista only
- weighted access score: 4.0

A16 after the accepted swap:
- deterministic source retained: Ranger-Captain of Eos -> Walking Ballista
- bounded source added: Commune with Beavers -> Walking Ballista / Gatta and Luzzu / The Earth Crystal
- weighted access score: 7.9
- access-score delta: +3.9
- generic tutor count: 4 -> 3, deliberately not used as a hard gate because the removed tutor did not access the supplied win package

## Simulation evidence

Five-seed cEDH-pressure V0.6 comparison versus A14:
- mean score delta: +0.445
- minimum seed delta: -1.145
- positive seeds: 3/5
- regression gate: PASS

Per-seed scores:
- 20260829: +1.552 (no regression)
- 20260901: -0.158 (no regression)
- 20260917: -1.145 (no regression)
- 20261003: +1.548 (no regression)
- 20261111: +0.427 (no regression)

The simulation is supportive but not the sole reason for acceptance. The strategic case is stronger: a narrow one-target Vehicle tutor is replaced by cheaper selection that reaches three actual win pieces while remaining useful across a large share of the deck.

## Full-99 audit context

Corrected A14 physical-99 audit before this swap:
- locked: 19
- supported: 74
- review: 6
- challenge: 0

The six review cards were:
- Sidequest: Raise a Chocobo // Black Chocobo
- From Father to Son
- Cloud, Midgar Mercenary
- Path of Ancestry
- Starting Town
- Balamb Garden, SeeD Academy // Balamb Garden, Airborne

This acceptance does **not** imply the remaining 98 cards are optimal. Supported means an identifiable purpose exists. Best-in-slot pressure remains active.

## Generalized intelligence learned in A16

A16 is not only a deck swap. It added reusable Commander intelligence for:
- physical 99-slot auditing rather than deduplicated-card auditing;
- evidence-backed slot purpose and removal consequence;
- deterministic win-piece access separated from bounded top-N selection;
- effective combo-access quality separated from generic tutor count;
- counter/proliferate commanders recognizing +1/+1-counter engines;
- Delve reminder text not masquerading as graveyard recursion/hate;
- double-faced cards using library-visible front-face characteristics for library search and selection;
- narrow package dependency warnings;
- explicit permission for the optimizer to keep a deck unchanged when no defensible improvement survives.

## Exact A16 exploratory champion

```text
// COMMANDER
1 Tidus, Yuna's Guardian (FIC) 5

// MAIN
1 Esper Origins // Summon: Esper Maduin (FIN) 185
1 Bugenhagen, Wise Elder (FIC) 66
1 Mind Stone (FIC) 353
1 Arcane Denial (RFIN) J2
1 Kinnan, Bonder Prodigy (FCA) 55
1 Sidequest: Raise a Chocobo // Black Chocobo (FIN) 201
1 Lunatic Pandora (FIN) 262
1 Dreams of Laguna (FIN) 50
1 Sol Ring (FIC) 356
1 Walking Ballista (FIC) 371
1 Blitzball Stadium (FIC) 34
1 Commune with Beavers (FIN) 182
1 Birds of Paradise (FIC) 483
1 Venat, Heart of Hydaelyn // Hydaelyn, the Mothercrystal (FIN) 39
1 Cyclonic Rift (SLD) 1869
1 Summoner's Sending (FIC) 29
1 Swords to Plowshares (FIC) 256
1 Loran of the Third Path (FCA) 24
1 Zack Fair (FIN) 45
1 Path to Exile (FIC) 248
1 Cloud, Midgar Mercenary (FIN) 10
1 Swiftfoot Boots (FIC) 361
1 Cryptic Command (FCA) 29
1 Sword of Truth and Justice (SLD) 1867
1 Ranger-Captain of Eos (FCA) 2
1 Force of Negation (RFIN) J1
1 Lightning Greaves (FIC) 349
1 Tireless Tracker (FIC) 316
1 Tidus, Blitzball Star (FIN) 246
1 Heroic Intervention (SLD) 1872
1 An Offer You Can't Refuse (FIC) 267
1 Chasm Skulker (FIC) 262
1 Bred for the Hunt (FIC) 321
1 Fathom Mage (FIC) 325
1 Warrior's Resolve (FIC) 465
1 Gyre Sage (FIC) 306
1 Inspiring Call (FIC) 310
1 Generous Patron (FIC) 305
1 Campsite Cuisine (FIC) 464
1 Tome of Legends (FIC) 369
1 Rhystic Study (FCA) 31
1 Hardened Scales (FIC) 307
1 Mask of Memory (FIC) 350
1 Collective Effort (FIC) 237
1 Sram, Senior Edificer (FCA) 3
1 Fight Rigging (FIC) 303
1 Smuggler's Copter (FCA) 62
1 Puresteel Paladin (FIC) 250
1 Buster Sword (FIN) 255
1 Staff of the Storyteller (SLD) 1863
1 Mangara, the Diplomat (FCA) 25
1 Champions from Beyond (FIC) 11
1 Sphere Grid (FIC) 70
1 Key to the City (FIC) 348
1 The Earth Crystal (FIN) 184
1 Torgal, A Fine Hound (FIN) 208
1 Skullclamp (FIC) 355
1 Lord Jyscal Guado (FIC) 23
1 Command Tower (FIC) 382
1 Exotic Orchard (FIC) 390
1 Spire of Industry (FIC) 426
1 Path of Ancestry (FIC) 411
1 Capital City (FIN) 274
1 Starting Town (FIN) 289
1 Overflowing Basin (FIC) 410
1 Balamb Garden, SeeD Academy // Balamb Garden, Airborne (FIN) 272
1 Brushland (FIC) 377
1 Flooded Grove (FIC) 393
1 Skycloud Expanse (FIC) 423
1 Sungrass Prairie (FIC) 428
7 Forest (FIC) 482
6 Island (FIC) 479
6 Plains (FIC) 478
1 Gatta and Luzzu (FIC) 19
1 Silence (SLD) 7003
1 Counterspell (FCA) 4
1 Conqueror's Flail (FIC) 340
1 Syncopate (FIN) 80
1 Nature's Claim (FCA) 47
1 Incubation Druid (FIC) 309
1 Everflowing Chalice (FIC) 343
1 Arcane Signet (FIC) 332
1 Endurance (SLD) 7008
```

## Boundary

This is **exploratory Tidus evidence only**. It does not update the authoritative V0.15 development checkpoint, does not change stable/current, does not merge PR #29, and does not claim formal Bracket 5 validation.
