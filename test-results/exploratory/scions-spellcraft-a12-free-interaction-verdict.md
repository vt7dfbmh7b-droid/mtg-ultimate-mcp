# Scions & Spellcraft A12 — Free Interaction Verdict

Status: **NO CHANGE — A11 REMAINS FINAL**

Higher-sample source: `0140de4b16d288c98f2ab0fe2fdb6b1ba893f0aa`
Workflow run: `33357562515`
Baseline: accepted A11 Control at `91142485993eb4087ec792757325e407b0f7c78f`

All finalists were exact 100, Commander legal, FINAL FANTASY-printing-only, and preserved the White Mage + Walking Ballista / Intent / Ranger package.

## Subtlety test
Swap: Thancred Waters -> Subtlety
- Δ spells cast: +0.066
- Δ effect-draws: +0.019
- Δ commander uptime: -0.014
- Δ protection when challenged: **-3.571**
- Blue pitch cards other than Subtlety: 24
- Conditional pitch readiness when Subtlety is seen: opening 82.4%, T3 93.0%, T5 96.3%, T7 98.1%

Manual judgment: Subtlety gives useful zero-mana creature/planeswalker stack interaction and is castable normally at flash speed, but it does not replace Thancred's persistent legendary-permanent protection strongly enough in the whole deck. The measured protection regression is already negative before charging the real card disadvantage of evoke.

## Solitude test
Swap: Krile Baldesion -> Solitude
- Δ spells cast: -0.093
- Δ effect-draws: ~0.000
- Δ commander uptime: 0.000
- Δ protection when challenged: **-1.700**
- White pitch cards other than Solitude: 22
- Conditional pitch readiness when Solitude is seen: opening 79.2%, T3 90.9%, T5 94.9%, T7 97.2%

Manual judgment: Solitude is powerful, but A11 already has dense creature removal. Cutting Krile loses a two-mana lifelink recursion engine that can recover White Mage, Ranger-Captain and other creatures when matching noncreature mana values are cast. The swap does not improve the whole deck.

## Both together
Swaps:
- Thancred Waters -> Subtlety
- Krile Baldesion -> Solitude

Higher-sample mean deltas:
- Δ spells cast: -0.033
- Δ effect-draws: +0.019
- Δ commander uptime: -0.014
- Δ protection when challenged: **-3.843**

Manual judgment: rejected. The pair adds free-interaction breadth but loses too much existing protection/engine value, and real evoke use costs an additional card from hand for each Elemental.

## Grief
Grief was screened in A12 isolation but not advanced. In multiplayer it spends two cards when evoked to remove one nonland card from one opponent. Ranger-Captain already supplies stronger table-wide noncreature-spell suppression for a combo turn. Grief does not earn a slot.

## Simulator correction
V0.6 recognizes mana-free evoke as alternative-cost free interaction and can select the evoke line. However, the payment state only checks a generic `alternativeResourceReady` condition; it does not remove the matching-color card that evoke requires exiling from hand. Therefore raw simulation values for these Elementals are an upper bound on their free-mode value, not a reason to override the negative higher-sample result.

## Verdict
**Keep A11 unchanged.**

The A11 free/near-free package is already well balanced:
- Force of Negation
- Snuff Out
- Clever Concealment
- Lethal Scheme

Additional Subtlety/Solitude/Grief copies do provide real tactical options, but under the current FINAL FANTASY-only Scions shell they are sidegrades or regressions rather than proven whole-deck upgrades. No A12 deck checkpoint is promoted.

Boundary: stable/current, PR #29, Counter Blitz checkpoints, and accepted A11 remain untouched.
