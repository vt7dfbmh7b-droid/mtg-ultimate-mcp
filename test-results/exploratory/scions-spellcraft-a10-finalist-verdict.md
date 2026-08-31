# Scions & Spellcraft A10 — Finalist Verdict

Status: **preferred-finalist-control**

Source run: `33347673898` at exact source `21194f7c2ad4912f7939d38ed1004ec8e218eb3e`.

All compared lists were exact 100, Commander legal, FINAL FANTASY-printing-only, and retained the locked combo package:
- The Destined White Mage
- Walking Ballista
- Diabolic Intent
- Ranger-Captain of Eos

## A5 baseline

- Y'shtola spell opportunities (Adventure-aware): 31
- True stack/combo-protection pieces: 4
- True wipes: 3
- Average nonland MV: 3.29

## Finalists vs A5

### Conservative
Swaps:
- Reaper's Scythe -> Arcane Denial
- Tome of Legends -> Dovin's Veto
- Crux of Fate -> Toxic Deluge

Higher-sample mean deltas vs A5:
- functional keep: +0.014
- commander uptime: +0.814
- protection when challenged: +7.557
- spells cast: -0.096
- effect-draws: -0.150
- Y'shtola opportunities: 30 (-1)
- true stack/protection pieces: 6
- true wipes: 3
- average nonland MV: 3.24

Manual judgment: excellent low-churn upgrade. Keeps Rite of Replication and one additional Y'shtola-triggering slot compared with Control.

### Control — **preferred**
Swaps:
- Reaper's Scythe -> Arcane Denial
- Tome of Legends -> Dovin's Veto
- Crux of Fate -> Toxic Deluge
- Rite of Replication -> Cyclonic Rift

Higher-sample mean deltas vs A5:
- functional keep: +0.057
- commander uptime: +0.829
- protection when challenged: +9.029
- spells cast: -0.129
- effect-draws: -0.139
- Y'shtola opportunities: 29 (-2)
- true stack/protection pieces: 6
- true wipes: 3
- average nonland MV: 3.21

Manual judgment: strongest whole-deck configuration. Compared with Conservative it gains about +1.47 points of protection, slightly improves functional keeps, and gives up only about 0.033 additional average spells and one Y'shtola-trigger opportunity. Cyclonic Rift is a substantially stronger high-power control/tempo tool than Rite of Replication in this shell, even though Rift itself does not trigger Y'shtola because its mana value remains 2 when overloaded.

### Control + Stroke of Midnight
Adds:
- Vindicate -> Stroke of Midnight

The current simulator produced the same aggregate values as Control and therefore did not establish a measurable gain. Manual judgment prefers **Vindicate retained** for now because it preserves the ability to answer problem lands. Stroke's instant timing is attractive and remains a review option, but it has not earned the slot clearly enough.

### Velocity
Swaps:
- Reaper's Scythe -> Arcane Denial
- Tome of Legends -> Brainstorm
- Crux of Fate -> Toxic Deluge

Raw simulator mean deltas vs A5:
- functional keep: +0.014
- commander uptime: +1.414
- protection when challenged: +9.500
- spells cast: +0.150
- effect-draws: +0.386
- Y'shtola opportunities: 30 (-1)
- true stack/protection pieces: 5
- true wipes: 3
- average nonland MV: 3.22

**Important simulator caveat:** Brainstorm draws three cards and then puts two cards from hand back on top. The current card-flow model rewards the draw event more than it charges the two-card replacement cost, so the +0.386 effect-draw and associated velocity result materially overstates Brainstorm's net card advantage. Brainstorm is strong selection and combo smoothing, but these raw numbers are not directly comparable with genuine card-advantage engines. For that reason Velocity is not promoted over Control on the raw score alone.

## Toxic Deluge conclusion

Crux of Fate -> Toxic Deluge is accepted in all preferred finalists. Toxic Deluge retains a mana value of 3 and therefore still triggers Y'shtola while providing a cheaper, scalable -X/-X wipe that can answer indestructible creatures. This is a genuine synergy-preserving power upgrade.

## Preferred A10 direction

**A10 Control** is the preferred finalist:
- Reaper's Scythe -> Arcane Denial
- Tome of Legends -> Dovin's Veto
- Crux of Fate -> Toxic Deluge
- Rite of Replication -> Cyclonic Rift

Retain Vindicate over Stroke of Midnight for now.

This leaves 29 Adventure-aware Y'shtola-triggering spell opportunities while materially increasing cheap stack interaction, combo protection, board-control efficiency, and high-power reset capability. The deck remains a Y'shtola Scions & Spellcraft control/spellslinger deck with an integrated deterministic combo, rather than becoming generic Esper combo.

Boundary: this is the preferred A10 finalist comparison checkpoint. It does not promote stable/current, merge PR #29, or alter the accepted Counter Blitz work.
