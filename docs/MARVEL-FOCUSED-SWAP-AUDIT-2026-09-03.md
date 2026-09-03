# Focused Marvel swap audit — 2026-09-03

Source under review: `7265531610a7012f7940f591c99a2fc6ef3af06e` exact-source live evidence. The current semantic/resource rules produced a mechanically green result with six swaps across three accepted rounds, then stopped with `no-supported-swaps-found`. This document is a manual safety review, not a new checkpoint.

## Deck-level evidence

| Metric | Before | After | Review |
|---|---:|---:|---|
| Average nonland mana value | 2.71 | 2.58 | The only failed construction gate removed |
| Early plays | 41 | 45 | Improved |
| Fast mana | 2 | 2 | Still below the Bracket-5 floor of 3 |
| Tutors | 2 | 2 | Still below the floor of 4 |
| Interaction / cheap interaction | 20 / 13 | 19 / 13 | Total spot interaction fell by one; cheap floor stayed intact |
| Protection | 6 | 8 | Improved |
| Persistent colored mana sources | 11 | 10 | Above the floor of 8, but one source was spent |
| Ramp / conditional mana | 19 / 9 | 17 / 7 | Resource quality declined despite lower curve |
| Draw / treasure | 19 / 9 | 20 / 8 | Draw count rose while treasure capacity fell |
| Repeatable token engines | 12 | 12 | Aggregate token engine count held |

## Package-by-package review

| Round | Outgoing | Incoming | Mechanical rationale | Manual verdict |
|---:|---|---|---|---|
| 1 | Lethal Scheme | Spiders-Man, Heroic Horde | Curve reduction; token/creature affinity | **Reject pending surplus evidence.** Removes a spot-interaction card and a counters role for a token body. The cheap-interaction floor does not make the lost removal surplus. |
| 1 | Black Market Connections | The Astonishing Ant-Man | Curve reduction; combat-token/value-engine affinity | **Reject.** Black Market Connections is a repeatable card/token/treasure engine. Ant-Man retains card and token axes but does not replace treasure or the original engine's breadth; this is the compound-resource boundary. |
| 1 | Vibranium Mining Mech | Alicia Masters, Skilled Sculptor | Curve reduction; token/treasure affinity | **Reject.** Loses a mana rock, conditional acceleration and ETB bridge. A treasure role and token body are not equivalent to deployable mana infrastructure without a demonstrated surplus. |
| 1 | Sword of the Animist | Silkguard | Addresses protection deficit | **Reject.** Trades land ramp, land-tutor and a persistent colored source for protection/equipment. The source floor remains legal but the deck's mana development and color access are weakened. |
| 2 | Contract Hero | Spider-Ham, Peter Porker | Curve reduction; combat-token affinity | **Reject.** Loses conditional acceleration, treasure and sacrifice synergy for a go-wide payoff. The incoming token role is narrower than the outgoing resource bridge. |
| 3 | Venom's Hunger | Sword of Fire and Ice | Addresses protection deficit; adds draw | **Conditional only.** Spot interaction is retained and draw/protection improve, but cost reduction falls and the equipment is expensive. Accept only after showing cost-reduction surplus and a tempo-positive interaction package. |

## Decision

The result is mechanically green but remains **manually blocked**. The optimizer correctly reduced the average-MV deficit and preserved hard legality, printing, budget, and persistent-colored-mana floors, yet the six-card package spends meaningful infrastructure that coarse strategy affinity does not measure. No swap is accepted for checkpoint purposes. Do not add card-name exceptions; if the package is to become acceptable, strengthen generic resource-quality/engine-preservation policy, rerun focused and broad Marvel from one exact source, and repeat this audit. The accepted INTEL-02 checkpoint remains `77a5383fa7490aa91360b8186a4bda890f632157`.

