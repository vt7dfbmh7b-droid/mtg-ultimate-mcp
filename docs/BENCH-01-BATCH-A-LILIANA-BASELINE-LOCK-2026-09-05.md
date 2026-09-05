# BENCH-01 Batch A — Independent Liliana NZ$500 baseline lock

Date: 2026-09-05

## Purpose

Freeze a strong general-purpose-AI Liliana comparison deck **before reading the specialist BENCH-01 Liliana output**. This prevents hindsight leakage and gives the Commander specialist a real external opponent rather than a comparison deck rewritten after seeing its choices.

This is a proposed comparison baseline, not a claim of budget validity until the repository's exact-printing NZD audit has run. If it exceeds NZ$500 or contains an invalid/unresolved card, that failure belongs to the general-AI baseline and must be recorded rather than silently hidden.

## Fixture

- Commander: `Liliana, Heretical Healer // Liliana, Defiant Necromancer`.
- Hard whole-deck budget: NZ$500.
- Mono-black Commander legality and singleton rules.
- No creature-type/tribal optimization credit.
- Primary identity: sacrifice/aristocrats plus graveyard recursion/reanimation.
- Secondary requirement: compact, verified winning routes with enough tutors/access and protection/resource support that the deck is more than a pile of individually strong black cards.
- Target Bracket 5 is an evaluation target, not a declared result.

## Locked 100-card general-AI deck

### Commander

1 Liliana, Heretical Healer // Liliana, Defiant Necromancer

### Creatures — 28

1 Accursed Marauder
1 Ayara, First of Locthwain
1 Blood Artist
1 Bloodghast
1 Braids, Arisen Nightmare
1 Carrion Feeder
1 Crypt Ghast
1 Dauthi Voidwalker
1 Forsaken Miner
1 Geralf's Messenger
1 Gravecrawler
1 Jadar, Ghoulcaller of Nephalia
1 Mikaeus, the Unhallowed
1 Morbid Opportunist
1 Nested Shambler
1 Ophiomancer
1 Pawn of Ulamog
1 Pitiless Plunderer
1 Plaguecrafter
1 Priest of Forgotten Gods
1 Putrid Goblin
1 Reassembling Skeleton
1 Syr Konrad, the Grim
1 Triskelion
1 Viscera Seer
1 Warren Soultrader
1 Yawgmoth, Thran Physician
1 Zulaport Cutthroat

### Artifacts — 11

1 Sol Ring
1 Arcane Signet
1 Jet Medallion
1 Skullclamp
1 Ashnod's Altar
1 Phyrexian Altar
1 Altar of Dementia
1 Bolas's Citadel
1 Sensei's Divining Top
1 Aetherflux Reservoir
1 Mind Stone

### Enchantments — 7

1 Animate Dead
1 Bastion of Remembrance
1 Necropotence
1 Phyrexian Arena
1 Grave Pact
1 Dance of the Dead
1 Necromancy

### Instants and sorceries — 23

1 Dark Ritual
1 Cabal Ritual
1 Culling the Weak
1 Deadly Dispute
1 Village Rites
1 Corrupted Conviction
1 Entomb
1 Buried Alive
1 Reanimate
1 Victimize
1 Living Death
1 Diabolic Intent
1 Beseech the Mirror
1 Wishclaw Talisman
1 Feed the Swarm
1 Bitter Triumph
1 Snuff Out
1 Toxic Deluge
1 Black Sun's Zenith
1 Malakir Rebirth // Malakir Mire
1 Unearth
1 Bone Shards
1 Eaten Alive

### Lands — 30

19 Swamp
1 Bojuka Bog
1 Takenuma, Abandoned Mire
1 Castle Locthwain
1 War Room
1 High Market
1 Cabal Coffers
1 Myriad Landscape
1 Demolition Field
1 Witch's Cottage
1 Mortuary Mire

## Deliberate strategic structure

- `Warren Soultrader + Gravecrawler + Blood Artist/Zulaport Cutthroat/Bastion of Remembrance/Ayara` supplies a compact sacrifice/death-loop family that fits the primary deck identity rather than sitting beside it.
- `Mikaeus, the Unhallowed + Triskelion` provides a structurally different high-mana infinite-damage route.
- `Bolas's Citadel + Sensei's Divining Top + Aetherflux Reservoir` provides another non-graveyard-dependent engine/finisher family.
- `Entomb`, `Buried Alive`, `Diabolic Intent`, `Beseech the Mirror` and `Wishclaw Talisman` provide access without spending a disproportionate fraction of the NZ$500 budget on a single premium tutor.
- `Animate Dead`, `Dance of the Dead`, `Necromancy`, `Reanimate`, `Victimize`, `Living Death`, Liliana and recursive creatures keep graveyard recursion central to normal play.
- `Carrion Feeder`, `Viscera Seer`, Warren Soultrader, the Altars, High Market and sacrifice spells give the deck multiple sacrifice outlets instead of relying on one combo-only card.
- `Blood Artist`, Zulaport, Bastion, Ayara, Syr Konrad and Grave Pact convert sacrifice/death activity into table pressure or control.
- `Skullclamp`, Necropotence, Phyrexian Arena, Braids and Morbid Opportunist provide persistent card flow around the sacrifice plan.

## Hard-truth verification required before scoring

Fail closed if any of the following are false:

- exact 100 cards;
- legal mono-black Commander color identity/singleton construction;
- exactly one Liliana commander;
- every exact selected physical printing resolves with a known price;
- audited whole-deck price is at or below NZ$500 using the repository's contemporaneous USD/NZD policy;
- claimed win routes are mechanically/provider verified as full-table winning routes where applicable;
- target bracket is assessed rather than assigned;
- the deck's aristocrats/graveyard identity is supported across the complete list rather than inferred from a few marquee cards.

## Anti-leak rule

Do not change the locked card list after reading the specialist Liliana result. If the exact budget audit makes this list illegal for the fixture, record that as a general-AI baseline loss. Any later corrected baseline must be separately versioned and cannot replace this pre-result record.
