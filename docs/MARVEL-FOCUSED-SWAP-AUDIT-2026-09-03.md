# Focused Marvel swap audit — 2026-09-03

Source under review: `07f36a74529a717cf6c6e85f00ea999f40dff098` live evidence, with the focused refinement payload persisted from executable source `e24829418f5cf9a31ba8d4135bfe1e7211959ed2`.

This is a manual safety review, not a new accepted checkpoint. The governing rule is to hold the deck's hand: a curve or generic-role gain must not erase a meaningful engine, tutor, interaction, or utility role without a demonstrated surplus.

| Outgoing | Incoming | Mechanical reason | Manual verdict | Reason |
|---|---|---|---|---|
| Venom's Hunger | Quicksilver, Brash Blur | Lowers curve; adds creature/haste/counters | Reject pending generic fix | The recorded package loses cost reduction and spot interaction. A combat/counter creature is not a like-for-like removal replacement. |
| Sun-Spider, Nimble Webber | Whispersilk Cloak | Adds equipment/protection | Reject pending generic fix | The recorded package loses a creature and narrow-tutor role. The deck already fails the tutor threshold, so the swap spends consistency for protection without proving surplus. |
| Silver Surfer, Galactus's Herald | Tome of Legends | Lowers curve; adds repeatable draw | Reject pending generic fix | The recorded package loses a creature and narrow-tutor role. Card draw is valuable, but it does not replace the lost tutor/creature access in this target-pressure lane. |
| Fantastic Bounce | Sword of Fire and Ice | Adds equipment/protection/draw and inferred damage interaction | Reject pending generic fix | The recorded package loses cost reduction and flexible spot interaction. A five-mana equipment investment is not automatically a stronger defensive or tempo exchange. |
| Doom's Time Platform | Spider-Punk | Lowers curve; adds creature/haste/counters | Conditional; retain only with surplus proof | The recorded package loses graveyard hate, graveyard interaction and graveyard utility. Najeela does not make those roles primary, but the selector must demonstrate they are surplus before cutting them. |

## Result

The five swaps should not be treated as manually accepted evidence yet. The next implementation target is generic semantic protection in the selector and package audit: preserve non-surplus tutors, spot interaction, cost-reduction infrastructure and graveyard utility, while still allowing genuinely redundant low-value cards to move. No card-name exception should be added. After that generic fix, rerun focused and broad Marvel from one exact executable source and repeat this audit.
