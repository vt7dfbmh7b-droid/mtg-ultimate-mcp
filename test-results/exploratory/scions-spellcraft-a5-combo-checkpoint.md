# Scions & Spellcraft A5 — Accepted Exploratory Combo-Fit Checkpoint

Status: **accepted-exploratory-combo-fit**

This checkpoint evaluates the FINAL FANTASY-printing-only Y'shtola, Night's Blessed Scions & Spellcraft upgrade with an infinite combo permitted, while preserving the stock noncreature-spell/control identity.

## Non-combo upgrade shell retained

- Sage's Nouliths -> Rhystic Study
- Dancer's Chakrams -> Akroma's Will
- Summon: Good King Mog XII -> Force of Negation
- Astrologian's Planisphere -> Swiftfoot Boots
- Hildibrand Manderville -> Swallowed by Leviathan
- Temple of the False God -> Command Beacon
- Eye of Nidhogg -> Clever Concealment

The shell has 30 Y'shtola-qualifying MV3+ noncreature spells before combo-package changes.

## Preferred integrated combo package

- Ardbert, Warrior of Darkness -> The Destined White Mage
- Estinien Varlineau -> Walking Ballista
- Cut a Deal -> Diabolic Intent
- Hraesvelgr of the First Brood -> Ranger-Captain of Eos

### Why this package is preferred

- The Destined White Mage is not combo-only: Y'shtola gains 2 life from each qualifying-spell trigger, which triggers White Mage to place a +1/+1 counter on a creature. Other retained life-gain sources also support it.
- Walking Ballista is the weakest standalone combo piece, but White Mage can feed it counters and it provides scalable removal/finishing utility.
- Diabolic Intent finds either half and has ample token/creature fodder in the retained Scions shell.
- Ranger-Captain of Eos finds Walking Ballista and can sacrifice itself to stop opponents casting noncreature spells for the turn, protecting a combo attempt.

## A5 matched-simulation delta vs strongest non-combo shell

Preferred package (`old_pair_intent_ranger`):

- Functional keep delta: **+0.057**
- Commander battlefield uptime delta: **+0.871**
- Protection-when-challenged delta: **+2.014**
- Average spells cast delta: **-0.004**
- Average cards drawn by effects delta: **-0.114**
- Y'shtola-qualifying MV3+ noncreature spell delta: **-1** (30 -> 29)
- Average nonland mana value: **3.29**
- Ramp count: **21**
- Interaction count: **16**
- Protection count: **4**
- Early-play count: **20**

The combo package therefore adds deterministic closing power without materially degrading ordinary spellcraft play in the current simulator.

## Corrected combo-assembly access

Full 99-card library was used, including repeated basic lands. These are assembly-visibility proxies, not goldfish win rates and do not model mana, summoning sickness, interaction, or sacrifice-fodder availability.

Preferred White Mage + Ballista + Intent + Ranger package:

- By turn 5 (12 raw cards seen): **6.00%**
- By turn 7 (14 raw cards seen): **8.06%**
- By turn 9 (16 raw cards seen): **10.64%**

For comparison:

- Raw White Mage + Ballista pair: approximately **1.36% / 1.86% / 2.49%** by turns 5/7/9.
- Pair + Intent: approximately **3.86% / 5.24% / 6.93%** in the revised Hraesvelgr-cut test.
- Pair + Ranger: approximately **2.59% / 3.52% / 4.64%**.

The deck's actual draw engines can expose more cards than the raw one-draw-per-turn model, so these percentages are deliberately conservative assembly-access baselines rather than expected in-game completion rates.

## Ranger-Captain vs Delivery Moogle

Delivery Moogle produced the same raw assembly-access percentages when used as the Ballista-access card. Its matched simulation remained healthy, but Ranger-Captain was preferred because it is cheaper and its sacrifice ability protects the combo turn. Delivery Moogle remains a review/resilience option because it can retrieve Walking Ballista from either the library or graveyard.

## Combo execution boundary

The Destined White Mage must be able to tap to grant Walking Ballista lifelink. Swiftfoot Boots can provide haste for a same-turn attempt. Walking Ballista should begin the loop with at least two +1/+1 counters so that it survives after removing the first counter and White Mage can replace that counter from the lifegain trigger.

## Current judgment

**The White Mage + Walking Ballista infinite combo fits the Scions deck rather than fighting it.** The preferred four-card package remains an exploratory checkpoint, not the final 100-card product. Broader whole-list optimization and final high-sample validation should continue from this checkpoint rather than removing the combo or rebuilding the deck as generic Esper combo.
