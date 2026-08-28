# Counter Blitz / Tidus — FF-only strongest-build exploratory result

Date: 2026-08-29 NZST
Source baseline: `agent/v15-native-deck-intelligence` at `9487cd08aab76359db9bc44ee524fcc3221b0484`
Test branch: `test/counter-blitz-ff-tidus-20260829`
Aggressive test commit: `2049fef8b256b55c32f992801115d854454ddf87`
GitHub Actions run: `33170110639`

## Objective

Build the strongest Commander deck the current Ultimate MTG FF physical-printing pool can support with `Tidus, Yuna's Guardian` as commander. Allow matching FINAL FANTASY sets, promos, curated Secret Lair/special releases, and bonus/chase cards. Do not use non-FF printings of otherwise eligible Oracle cards.

This is an exploratory broader-condition benchmark, not accepted INTEL-02 milestone proof.

## Aggressive tuning parameters

- `printingFamily: Final Fantasy`
- `includePromos: true`
- `includeSpecialReleases: true`
- `requireVerifiedCombo: true`
- `maxCandidatesToVerify: 24` (standard control: 8)
- `maxEfficiencySwaps: 10` (standard control: 3)
- `maxManaBaseSwaps: 10` (standard control: 5)

## Result

- Final card count: **100**
- Commander legal: **true**
- FF printing policy: **PASS (84/84 exact printing entries eligible)**
- Current Game Changers: **2 — Cyclonic Rift, Rhystic Study**
- Build status: **built-with-strong-competitive-signals**
- Independent cEDH readiness: **strong-competitive-construction-signals**
- Complete Commander Spellbook combos: **1**
- Win-oriented combos: **1**
- Strategically relevant combos: **1**
- Ruthless combos: **0**
- Land count: **31**
- Average nonland mana value: **2.16**
- Early play count: **46**
- Fast mana count: **3**
- Cheap interaction count: **12**
- Protection count: **6**
- Tutor count: **6**
- Free interaction count: **1**
- Bracket-5 construction candidate: **true**
- Independent current competitive-metagame evidence: **false**
- Honest assessed bracket: **4**
- Assessed band: **high-bracket-4-cedh-construction-candidate**
- Bracket 5 target achieved: **false**
- Sole failed Bracket-5 threshold: **independent current competitive-metagame evidence**

The FF printing restriction did **not** cause a measured construction-gate failure: the finished list cleared all measured Bracket-5 construction gates. The conservative assessor refuses the Bracket-5 label without independent current metagame evidence.

## Accepted aggressive efficiency swaps

1. `Summon: Fenrir` -> `Silence` (SLD 7003)
2. `Fated Clash` -> `Counterspell` (FCA 4)
3. `Urza, Lord High Artificer` -> `Conqueror's Flail` (FIC 340)
4. `White Auracite` -> `Syncopate` (FIN 80)
5. `Magic Pot` -> `Nature's Claim` (FCA 47)

The cap was 10, but strict cEDH efficiency accepted only these 5 candidates.

## Mana-base swaps

1. `Crossroads Village` -> `Balamb Garden, SeeD Academy // Balamb Garden, Airborne` (FIN 272)
2. `Seaside Citadel` -> `Overflowing Basin` (FIC 410)

Land count remained 31 and the verified winning combo was preserved.

## Final decklist

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
1 From Father to Son (FIN) 20
1 Birds of Paradise (FIC) 483
1 Venat, Heart of Hydaelyn // Hydaelyn, the Mothercrystal (FIN) 39
1 Cyclonic Rift (SLD) 1869
1 Summoner's Sending (FIC) 29
1 Swords to Plowshares (FIC) 256
1 Loran of the Third Path (FCA) 24
1 Zack Fair (FIN) 45
1 Path to Exile (FIC) 248
1 World Map (FIN) 270
1 Swiftfoot Boots (FIC) 361
1 Cryptic Command (FCA) 29
1 Sword of Truth and Justice (SLD) 1867
1 Cloud, Midgar Mercenary (FIN) 10
1 Force of Negation (RFIN) J1
1 Ranger-Captain of Eos (FCA) 2
1 Lightning Greaves (FIC) 349
1 Tireless Tracker (FIC) 316
1 Magitek Infantry (FIN) 25
1 Tidus, Blitzball Star (FIN) 246
1 Heroic Intervention (SLD) 1872
1 An Offer You Can't Refuse (FIC) 267
1 Chasm Skulker (FIC) 262
1 Bred for the Hunt (FIC) 321
1 Conformer Shuriken (FIC) 98
1 Fathom Mage (FIC) 325
1 Warrior's Resolve (FIC) 465
1 Gyre Sage (FIC) 306
1 Inspiring Call (FIC) 310
1 Generous Patron (FIC) 305
1 Campsite Cuisine (FIC) 464
1 Tome of Legends (FIC) 369
1 Rhystic Study (FCA) 31
1 Hardened Scales (FIC) 307
1 Retrieve the Esper (FIN) 68
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
1 Archmage Emeritus (FIC) 261
1 Torgal, A Fine Hound (FIN) 208
1 Sazh's Chocobo (FIN) 200
1 Garnet, Princess of Alexandria (FIN) 222
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
```

## Primary verified win package

The final list contains the FF-printing package `Gatta and Luzzu` + `Hardened Scales` + `Walking Ballista`, which Commander Spellbook verifies as infinite damage / infinite +1/+1 counters when the prerequisites are met.

## Follow-up audit note

The final output still contains `World Map` and `Magitek Infantry`. The existing FF cEDH regression source explicitly names those cards as weak names that strict cEDH efficiency tuning must not *admit as upgrades*. Their persistence from the initial builder is worth a later optimizer audit before treating this exploratory list as globally optimal rather than the strongest output from the current algorithm.
