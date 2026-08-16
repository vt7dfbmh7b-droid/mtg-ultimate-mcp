# FINAL FANTASY-only Bracket 5 E2E — 2026-08-16

## Test goal

Build a Commander deck from scratch with the strongest practical settings available in V0.13 while enforcing **official FINAL FANTASY physical printings only**, then independently evaluate the finished list instead of assuming `targetBracket: 5` means success.

Commander Oracle identity: **Najeela, the Blade-Blossom**

Chosen physical commander printing: **Najeela, the Blade-Blossom (FCA) 42**

Build settings:

- target bracket: 5
- printing family: Final Fantasy
- include promos: yes
- include curated FINAL FANTASY special/Secret Lair releases: yes
- no per-card price cap
- maximum refinement rounds: 5
- maximum refinement swaps: 30
- swaps per round: 6
- candidate packages per round: 6
- simulation iterations: 750
- simulation turns: 7
- detailed result mode

## Observed result

- workflow: **PASS**
- final card count: **100**
- hard Commander legality: **PASS**
- FINAL FANTASY physical-printing policy: **PASS**
- exact unique resolved printing entries checked: **89 / 89** (basic-land quantities account for the difference from 100 total cards)
- target bracket requested: **5**
- Commander Spellbook bracket tag returned: **P**
- Commander Spellbook meaning of `P`: **Powerful**
- complete included Commander Spellbook combos: **0**
- almost-included combos: **29**
- strategically relevant included combos: **0**
- accepted refinement swaps: **0**
- refinement stop reason: **no-supported-swaps-found**
- Game Changers flagged by the estimator: **Cyclonic Rift**, **Rhystic Study**

## Conclusion

**Bracket 5 goal was not reached.**

This is an important test result: the current builder can successfully enforce a strict FINAL FANTASY-only physical-printing family and produce a legal 100-card five-color deck, but `targetBracket: 5` currently drives structural role targets more strongly than it drives actual cEDH construction.

The generated list has strong cards and interaction, but the independent evidence does not support calling it Bracket 5. It contains no complete Commander Spellbook combo, leaves 29 near-combos unfinished, and the refinement pass found no supported swaps despite the cEDH target.

The main engineering implication is that Bracket 5 construction needs a dedicated competitive loop rather than only higher role-count targets. A future pass should use Commander Spellbook near-combo completion, cEDH/tournament package evidence, stronger mana-base scoring, and iterative bracket re-evaluation as optimization inputs.

## Final decklist

```text
// COMMANDER
1 Najeela, the Blade-Blossom (FCA) 42

// MAIN
1 Farseek (FCA) 45
1 Rampant Growth (FIC) 313
1 Mind Stone (FIC) 353
1 Wayfarer's Bauble (FIC) 372
1 Arcane Denial (RFIN) J2
1 Deadly Dispute (FCA) 33
1 Venat, Heart of Hydaelyn // Hydaelyn, the Mothercrystal (FIN) 39
1 Solemn Simulacrum (FIC) 360
1 Sword of the Animist (FIC) 362
1 Scholar of New Horizons (FIC) 252
1 Golbez, Crystal Collector (FIN) 225
1 Rydia, Summoner of Mist (FIN) 239
1 Sidequest: Raise a Chocobo // Black Chocobo (FIN) 201
1 Swords to Plowshares (FIC) 256
1 Path to Exile (FIC) 248
1 Fated Clash (FIC) 449
1 Counterspell (FCA) 4
1 Vandalblast (FIC) 298
1 Summon: Fenrir (FIN) 203
1 Cyclonic Rift (SLD) 1869
1 Lethal Scheme (FIC) 277
1 Feed the Swarm (SLD) 7001
1 Cryptic Command (FCA) 29
1 Vanquish the Horde (FIC) 260
1 Inspiring Call (FIC) 310
1 Swiftfoot Boots (FIC) 361
1 Nature's Claim (FCA) 47
1 Yawgmoth, Thran Physician (FCA) 11
1 Sol Ring (FIC) 356
1 Mizzix's Mastery (FCA) 41
1 Force of Negation (RFIN) J1
1 Cultivate (FIC) 300
1 Winota, Joiner of Forces (FCA) 19
1 Snuff Out (FIC) 285
1 Heroic Intervention (SLD) 1872
1 Dark Ritual (FCA) 8
1 Damn (SLD) 1870
1 Birds of Paradise (FIC) 483
1 An Offer You Can't Refuse (FIC) 267
1 Skullclamp (FIC) 355
1 Nature's Lore (FIC) 311
1 Restoration Magic (FIN) 30
1 Arcane Signet (FIC) 332
1 Stroke of Midnight (FCA) 26
1 Lightning Greaves (FIC) 349
1 Thought Vessel (FIC) 368
1 Reanimate (FIC) 282
1 Stitch Together (FIC) 286
1 Brainstorm (FCA) 28
1 Three Visits (FIC) 315
1 Lightning Bolt (FCA) 40
1 Chaos Warp (FIC) 291
1 Hardened Scales (FIC) 307
1 Talisman of Dominance (FIC) 364
1 Rhystic Study (FCA) 31
1 Commander's Sphere (FIC) 339
1 Talisman of Indulgence (FIC) 366
1 Talisman of Hierarchy (FIC) 365
1 Talisman of Progress (FIC) 367
1 Talisman of Conviction (FIC) 363
1 Toxic Deluge (SLD) 1860
1 Night's Whisper (FIC) 280
1 Akroma's Will (FCA) 21
1 Chromatic Lantern (FCA) 61
1 Zack Fair (FIN) 45
1 Magic Damper (FIN) 61
1 Dovin's Veto (FCA) 51
1 Diabolic Intent (FCA) 34
1 Command Tower (FIC) 382
1 Exotic Orchard (FIC) 390
1 Spire of Industry (FIC) 426
1 Path of Ancestry (FIC) 411
1 Jungle Shrine (FIC) 406
1 Arcane Sanctum (FIC) 373
1 Nomad Outpost (FIC) 409
1 Seaside Citadel (FIC) 420
1 Battlefield Forge (FIC) 375
1 Underground River (FIC) 439
1 Sulfurous Springs (FIC) 427
1 Brushland (FIC) 377
1 Rugged Prairie (FIC) 417
1 Flooded Grove (FIC) 393
1 Darkwater Catacombs (FIC) 384
1 Fetid Heath (FIC) 391
4 Swamp (FIC) 480
4 Mountain (FIC) 481
4 Island (FIC) 479
3 Plains (FIC) 478
```

## Regression expectation

This test should continue to pass legality and FINAL FANTASY-printing checks. A later builder improvement should be considered meaningful if the independent competitive evidence improves from this baseline without weakening those hard constraints.
