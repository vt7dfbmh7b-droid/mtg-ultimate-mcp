# Counter Blitz / Tidus A21 — Finished Exploratory Benchmark

Status: **finished-exploratory-benchmark**

Source workflow run: `33298684565`
Validated source SHA: `8a4ad6b5d02164907c199efdbe97630e5491bb5b`

This checkpoint records the exact Final Fantasy-only Tidus, Yuna's Guardian deck that cleared the bounded A21 finalization gate. It is exploratory INTEL-02 evidence only. It does not promote `stable/current`, change V0.13, or authorize merging PR #29.

## Hard truth

- Exact deck size: 100
- Physical main deck: 99
- Commander legal: yes
- Final Fantasy printing policy: yes
- Unresolved physical slots: 0
- A21 failures: 0
- Full regression suite: 844/844 green

## Physical 99 audit

- Locked: 24
- Supported: 72
- Review: 3
- Challenge: 0

Remaining review lands:
- Path of Ancestry
- Starting Town
- Balamb Garden, SeeD Academy // Balamb Garden, Airborne

A18 challenged the eligible Final Fantasy Bant land pool and found no acceptable land replacement.

## Combo access

Verified win routes retained:
1. Gatta and Luzzu + Hardened Scales + Walking Ballista
2. Gatta and Luzzu + The Earth Crystal + Walking Ballista

Combo-access evidence:
- Weighted access score: 7.9
- Deterministic piece links: 1
- Bounded piece links: 3
- Directly accessible supplied pieces: Walking Ballista, Gatta and Luzzu, The Earth Crystal

## Structural metrics

A14:
- Average nonland mana value: 2.14
- Ramp: 18
- Cheap interaction: 12
- Free interaction: 2
- Persistent colored mana sources: 8

A16:
- Average nonland mana value: 2.13
- Ramp: 18
- Cheap interaction: 12
- Free interaction: 2
- Persistent colored mana sources: 8

Final A17/A21 deck:
- Average nonland mana value: 2.12
- Ramp: 19
- Cheap interaction: 12
- Free interaction: 2
- Persistent colored mana sources: 9

## Search saturation

- A18 land pressure: no accepted land swap
- A19 single-slot pressure: 968 structural candidates, 24 simulated finalists, no accepted swap
- A20 two-card package pressure: 49,140 structural candidates, 30 simulated finalists, no accepted package

## Final robustness stress

Seven scenarios × seven seeds, with upgraded / optimized / cEDH pressure and turn-5 / turn-7 / turn-9 horizons where applicable.

- Aggregate score vs A14: +1.054
- Aggregate score vs A16: +0.723
- Positive scenarios vs A14: 7/7
- Positive scenarios vs A16: 6/7
- Finalization failures: 0

Scenario composite scores:
- upgraded T5: +1.187 vs A14, +1.169 vs A16
- upgraded T7: +0.230 vs A14, +0.240 vs A16
- optimized T5: +0.939 vs A14, -0.122 vs A16
- optimized T7: +1.622 vs A14, +0.682 vs A16
- cEDH T5: +0.602 vs A14, +0.381 vs A16
- cEDH T7: +1.104 vs A14, +1.324 vs A16
- cEDH T9: +1.696 vs A14, +1.387 vs A16

The one slightly negative scenario against A16 did not cross any severe-regression threshold and was outweighed by positive results in the other six scenarios.

## Accepted development swaps

1. Archmage Emeritus -> The Earth Crystal
2. Conformer Shuriken -> Incubation Druid
3. Retrieve the Esper -> Everflowing Chalice
4. Garnet, Princess of Alexandria -> Arcane Signet
5. Sazh's Chocobo -> Endurance
6. From Father to Son -> Commune with Beavers
7. Mangara, the Diplomat -> Summon: Fenrir

## Final deck

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
1 Champions from Beyond (FIC) 11
1 Sphere Grid (FIC) 70
1 Key to the City (FIC) 348
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
1 The Earth Crystal (FIN) 184
1 Incubation Druid (FIC) 309
1 Everflowing Chalice (FIC) 343
1 Arcane Signet (FIC) 332
1 Endurance (SLD) 7008
1 Commune with Beavers (FIN) 182
1 Summon: Fenrir (FIN) 203
```

## Boundary

This deck is finished for the bounded Tidus exploratory benchmark. Future card releases, simulator improvements, or broader benchmark criteria can reopen it, but no further churn is justified under the current Final Fantasy-only card pool and A21 acceptance gate.
