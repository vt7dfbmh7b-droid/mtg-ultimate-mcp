# Scions & Spellcraft A13 — The Destined Black Mage Verdict

Status: **ACCEPTED PREFERRED SCIONS CHECKPOINT**

Baseline: accepted A11 Control at `91142485993eb4087ec792757325e407b0f7c78f`
A13b validated source: `e609d7b1725528c426f4b76423d19977bf5584e1`
Accepted exact deck file commit: `e6f8a87f446c0ac04e199d4097b1baaefc41f12c`
Workflow run: `33373585298`

## Accepted swap

- OUT: Thancred Waters (FIC) 31
- IN: The Destined Black Mage (FIC) 447

## Higher-sample matched result: A13 minus A11

Across seven upgraded / optimized / cEDH-pressure scenarios at 3,600 iterations each:
- Functional keep: **+0.000**
- Commander uptime: **+0.029**
- Protection when challenged: **-0.686**
- Spells cast: **+0.079**
- Effect-based draws: **-0.010**

Structural state:
- lands: 37 -> 37
- ramp: 21 -> 21
- average nonland MV: 3.21 -> 3.17
- White Mage + Walking Ballista + Diabolic Intent + Ranger-Captain package remains intact
- Papalymo remains intact
- all existing MV3+ noncreature Y'shtola opportunities remain intact because this is a creature-for-creature swap
- exact 100, Commander legal, FINAL FANTASY-printing-only

## Manual synergy credit

The generic simulator does not model The Destined Black Mage's damage trigger or Y'shtola's four-life end-step threshold, so the raw comparison understates Black Mage.

With Y'shtola + Papalymo Totolymo + The Destined Black Mage on the battlefield, casting one MV3+ noncreature spell causes each opponent to lose:
- 2 from Y'shtola
- 1 from Papalymo
- 1 from The Destined Black Mage

Total: **4 life per opponent from one qualifying spell**, immediately satisfying Y'shtola's end-step draw condition.

Black Mage also triggers on every noncreature spell, including MV1-2 spells that do not trigger Y'shtola, giving the deck an additional persistent drain engine.

## Party clause

Current A13 party types include a Cleric (The Destined White Mage) and many Wizards, but no Rogue and no retained Warrior after the Thancred swap. Full party is therefore not naturally available. The Black Mage's 3-damage full-party mode receives **no acceptance credit** in this verdict.

## Why Thancred is the cut

Thancred is a useful five-mana flash protection piece that can give another legendary permanent — including Y'shtola or The Destined White Mage — indestructible for as long as Thancred remains under your control. However, the deck already has Swiftfoot Boots, Clever Concealment, Akroma's Will, Force of Negation, Arcane Denial, Dovin's Veto and Ranger-Captain-based combo protection, and Thancred cannot protect the nonlegendary Walking Ballista. Other tested creature cuts gave up more important Scions-engine functions such as cost reduction, recursion, card draw, token production or spellcasting payoffs.

## Verdict

**The Destined Black Mage is accepted as a real whole-deck upgrade, not generic Esper goodstuff.** The swap preserves the spellcraft identity, improves the drain engine, reduces average MV, keeps normal deck performance essentially flat-to-positive, and materially improves Y'shtola's ability to turn a single qualifying spell into end-step card advantage when paired with Papalymo.

A13 now replaces A11 as the preferred Scions & Spellcraft exploratory checkpoint. Stable/current, PR #29 and Counter Blitz remain untouched.
