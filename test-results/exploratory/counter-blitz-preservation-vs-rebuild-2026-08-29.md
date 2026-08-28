# Counter Blitz / Tidus — Preservation Upgrade vs Full Rebuild

Date: 2026-08-29 NZST
Source baseline: `agent/v15-native-deck-intelligence` at `9487cd08aab76359db9bc44ee524fcc3221b0484`
Isolated test branch: `test/counter-blitz-ff-tidus-20260829`
Final preservation run commit: `d7752cb49db5b13664e039afd2a66998e74536fb`
Final preservation GitHub Actions run: `33172329845`

## Objective

Compare two distinct user intents under the same strict FINAL FANTASY physical-printing family:

- **A — Full rebuild:** maximize the strength of a Tidus, Yuna's Guardian Commander deck with no requirement to preserve the Counter Blitz factory deck.
- **B — Precon preservation:** start from Wizards' factory Counter Blitz 100-card deck, preserve its identity, and upgrade it as far as the current specialist can without silently turning it into a commander rebuild.

Both lanes allow matching FINAL FANTASY sets, promos, curated Secret Lair/special releases, and bonus/chase cards, while rejecting non-FF printings of the same Oracle cards.

This is an exploratory broader-condition benchmark, not accepted INTEL-02 milestone proof. Stable/current and PR #29 are unchanged.

## Preservation test definition

The preservation lane is deliberately measurable rather than subjective:

- start from the exact 100-card Wizards Counter Blitz factory list, resolved to exact FIC physical printings;
- finish with exactly 100 cards and pass Commander legality and FF printing-family checks;
- retain at least **80/100** cards from the factory deck;
- retain **25/25** test-defined bespoke FFX / Counter Blitz identity-core cards from the front of the official list, including Tidus, Yuna, Auron, Gatta and Luzzu, Sphere Grid, the FFX Guardians, and the deck's bespoke FFX support;
- preserve verified complete winning combos through later tuning;
- known weak false-positive upgrades `World Map` and `Magitek Infantry` are excluded from the corrected comparison.

The 80-card threshold and 25-card identity core are test definitions for this benchmark, not official Wizards Commander rules.

## Baseline factory Counter Blitz

- Stock retained: **100/100**
- Lands: **37**
- Average nonland mana value: **3.03**
- Early plays: **24**
- Fast mana: **2**
- Cheap interaction: **4**
- Protection: **0**
- Tutors: **0**
- Free interaction: **0**
- Verified winning combos: **1**
- Construction status: **not-yet-strong-competitive-construction-signals**

## First preservation pass exposed a structural optimizer gap

The existing V0.14 refinement path retained **86/100** factory cards and **25/25** identity-core cards. It also completed a second verified winning combo and improved several efficiency and mana-base slots.

However, it remained locked at **37 lands** because the existing mana optimizer is nonbasic-land-for-nonbasic-land. It could improve land quality but could not decide that an upgraded precon should structurally reduce excess lands and turn those slots into interaction, protection, tutors, or other spells.

That meant the ordinary preservation pass remained `cedh-oriented-refinement-incomplete`, despite successfully preserving the precon.

## Experimental preservation-aware structural fix

On the isolated test branch only, a new experimental `precon-structural-v15.ts` pass was added. Its behavior for this benchmark is constrained:

- only excess lands above the selected target can become spells;
- exact 100-card construction and Commander legality are rechecked;
- FF printing-family compliance is rechecked;
- existing complete combo count may not decrease;
- land slots already changed by the first mana pass are preferentially consumed first, avoiding unnecessary loss of original factory cards;
- additions must have strict competitive roles rather than merely low mana value;
- later efficiency tuning remains bounded by the 80/100 preservation floor.

The structural pass compressed the first-pass deck from **37 to 31 lands** while still retaining **86/100** original factory cards at that stage and preserving both verified winning combos.

### Structural swaps

1. `Starting Town` -> `Lunatic Pandora`
2. `Balamb Garden, SeeD Academy // Balamb Garden, Airborne` -> `Force of Negation`
3. `Zanarkand, Ancient Metropolis // Lasting Fayth` -> `Cyclonic Rift`
4. `Jidoor, Aristocratic Capital // Overture` -> `Restoration Magic`
5. `Ishgard, the Holy See // Faith & Grief` -> `Zack Fair`
6. `Demolition Field` -> `Magic Damper`

These land cuts were mostly lands introduced by the first mana-refinement pass, which is why stock retention stayed at 86/100 during structural compression.

## Final preservation efficiency pass

The remaining preservation budget was used for five strict-efficiency changes:

1. `Rampant Rejuvenator` -> `Cloud, Midgar Mercenary`
2. `Altered Ego` -> `Counterspell`
3. `Fathom Mage` -> `Swords to Plowshares`
4. `Forgotten Ancient` -> `Sidequest: Raise a Chocobo // Black Chocobo`
5. `Luminous Broodmoth` -> `From Father to Son`

## Final A/B result

| Metric | Stock Counter Blitz | B — Preservation upgrade | A — Full Tidus rebuild |
| --- | ---: | ---: | ---: |
| Factory cards retained | 100/100 | **81/100** | not constrained |
| Identity core retained | 25/25 | **25/25** | not constrained |
| Lands | 37 | **31** | **31** |
| Avg nonland MV | 3.03 | **2.45** | **2.17** |
| Early plays | 24 | **39** | **46** |
| Fast mana | 2 | **3** | **3** |
| Cheap interaction | 4 | **10** | **12** |
| Protection | 0 | **3** | **6** |
| Tutors | 0 | **3** | **4** |
| Free interaction | 0 | **1** | **1** |
| Verified winning combos | 1 | **2** | **1** |
| Competitive construction status | not yet strong | **strong** | **strong** |

### A — Full rebuild conclusion

The full rebuild remains the stronger deck if the only objective is maximum power. It matches the preservation deck on land count, fast mana, and free interaction while carrying a materially lower curve, more early plays, more cheap interaction, twice the measured protection, and one additional tutor.

Its benchmark metrics are: 31 lands, 2.17 average nonland MV, 46 early plays, 3 fast mana, 12 cheap interaction, 6 protection, 4 tutors, 1 free-interaction piece, and 1 verified winning combo.

### B — Preservation upgrade conclusion

The preservation version is the stronger answer to the instruction **"upgrade Counter Blitz"**. It retains **81% of the factory deck and 100% of the defined identity core**, remains recognisably Counter Blitz / FFX counters, reaches `strong-competitive-construction-signals`, and carries **two** verified infinite-damage packages:

1. `Gatta and Luzzu` + `Hardened Scales` + `Walking Ballista` — infinite damage and infinite +1/+1 counters.
2. `Gatta and Luzzu` + `Walking Ballista` + `The Earth Crystal` — infinite damage and infinite +1/+1 counters.

The second line is particularly appropriate to the preservation objective because it builds directly on cards already native to the Counter Blitz counter strategy rather than replacing the deck's identity wholesale.

## Specialist-intent verdict

**Raw-power winner: A — full rebuild.**

**Best actual Counter Blitz upgrade: B — preservation upgrade.**

The experiment demonstrates that the two intents should not be treated as synonyms. A commander rebuild should be free to replace most of the 99 to maximize strength. A precon upgrade should first understand the factory deck, protect its identity/core, spend a bounded replacement budget, and stop before becoming a different deck.

The original V0.14 precon refinement did not fully operationalize that distinction because it could improve lands only land-for-land. The isolated experimental structural pass closes that specific gap for this benchmark and allows the preservation version to reach strong competitive construction signals while remaining above the preservation floor.

Therefore the **experimental test branch passes this intent-distinction benchmark**, but this capability should not yet be attributed to stable/current: the structural fix has not been promoted or merged.

## Final preservation decklist

```text
// COMMANDER
1 Tidus, Yuna's Guardian (FIC) 5

// MAIN
1 Yuna, Grand Summoner (FIC) 8
1 Auron, Venerated Guardian (FIC) 10
1 Chocobo Knights (FIC) 12
1 Gatta and Luzzu (FIC) 19
1 Lord Jyscal Guado (FIC) 23
1 Protection Magic (FIC) 24
1 Summon: Ixion (FIC) 27
1 Summon: Yojimbo (FIC) 28
1 Summoner's Sending (FIC) 29
1 Blitzball Stadium (FIC) 34
1 Lulu, Stern Guardian (FIC) 38
1 O'aka, Traveling Merchant (FIC) 39
1 Rikku, Resourceful Guardian (FIC) 468
1 Summon: Valefor (FIC) 42
1 Maester Seymour (FIC) 68
1 Sphere Grid (FIC) 70
1 Summon: Magus Sisters (FIC) 71
1 Tromell, Seymour's Butler (FIC) 73
1 Yuna's Decision (FIC) 74
1 Yuna's Whistle (FIC) 75
1 Kimahri, Valiant Guardian (FIC) 85
1 Shelinda, Yevon Acolyte (FIC) 94
1 Sin, Unending Cataclysm (FIC) 95
1 Wakka, Devoted Guardian (FIC) 97
1 Collective Effort (FIC) 237
1 Resourceful Defense (FIC) 251
1 Scholar of New Horizons (FIC) 252
1 Together Forever (FIC) 257
1 Chasm Skulker (FIC) 262
1 Pull from Tomorrow (FIC) 269
1 Fight Rigging (FIC) 303
1 Generous Patron (FIC) 305
1 Gyre Sage (FIC) 306
1 Hardened Scales (FIC) 307
1 Incubation Druid (FIC) 309
1 Path of Discovery (FIC) 312
1 Tireless Tracker (FIC) 316
1 Endless Detour (FIC) 324
1 Walking Ballista (FIC) 371
1 Brushland (FIC) 377
1 Canopy Vista (FIC) 378
1 Exotic Orchard (FIC) 390
1 Flooded Grove (FIC) 393
1 Glacial Fortress (FIC) 400
1 Hinterland Harbor (FIC) 403
1 Overflowing Basin (FIC) 410
1 Prairie Stream (FIC) 413
1 Skycloud Expanse (FIC) 423
1 Sungrass Prairie (FIC) 428
1 Sunpetal Grove (FIC) 432
1 Temple of Enlightenment (FIC) 435
1 Destroy Evil (FIC) 240
1 Grateful Apparition (FIC) 244
1 Path to Exile (FIC) 248
1 An Offer You Can't Refuse (FIC) 267
1 Duskshell Crawler (FIC) 301
1 Farseek (FIC) 302
1 Inspiring Call (FIC) 310
1 Three Visits (FIC) 315
1 Bred for the Hunt (FIC) 321
1 Arcane Signet (FIC) 332
1 Everflowing Chalice (FIC) 343
1 Sol Ring (FIC) 356
1 Ash Barrens (FIC) 374
1 Evolving Wilds (FIC) 389
1 Forge of Heroes (FIC) 395
1 Spire of Industry (FIC) 426
1 Nesting Grounds (FIC) 408
1 Path of Ancestry (FIC) 411
1 Capital City (FIN) 274
1 Seaside Citadel (FIC) 420
1 Temple of the False God (FIC) 438
1 Command Tower (FIC) 382
3 Island (FIC) 479
3 Forest (FIC) 482
3 Plains (FIC) 478
1 The Earth Crystal (FIN) 184
1 Birds of Paradise (FIC) 483
1 Arcane Denial (RFIN) J2
1 Mind Stone (FIC) 353
1 Bugenhagen, Wise Elder (FIC) 66
1 Silence (SLD) 7003
1 Lunatic Pandora (FIN) 262
1 Force of Negation (RFIN) J1
1 Cyclonic Rift (SLD) 1869
1 Restoration Magic (FIN) 30
1 Zack Fair (FIN) 45
1 Magic Damper (FIN) 61
1 Cloud, Midgar Mercenary (FIN) 10
1 Counterspell (FCA) 4
1 Swords to Plowshares (FIC) 256
1 Sidequest: Raise a Chocobo // Black Chocobo (FIN) 201
1 From Father to Son (FIN) 20
```

## Caveats

- The preservation threshold and core definition are benchmark choices, not formal Commander rules.
- `strong-competitive-construction-signals` is a construction assessment, not proof of actual tournament cEDH performance.
- Neither list is mathematically proven globally optimal.
- The structural precon pass remains experimental and isolated; promotion requires separate validation and explicit approval.
