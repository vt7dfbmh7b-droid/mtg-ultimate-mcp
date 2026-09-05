# BENCH-01 Batch A — Independent Counter Blitz baseline lock

Date: 2026-09-05

## Purpose

This file freezes the strong general-purpose-AI comparison plan **before reading the specialist Counter Blitz final swaps/result**. It exists to prevent hindsight leakage: the comparison deck must not be rewritten after seeing what the Commander specialist chose.

This is a comparison baseline, not a product change and not a claim that every proposed printing has already passed repository hard-truth verification. Exact legality and FINAL FANTASY printing-family truth must be checked mechanically before the baseline is scored.

## Fixture

- Product baseline: exact standard `Counter Blitz (FINAL FANTASY X)` precon.
- Commander: `Tidus, Yuna's Guardian`.
- Maximum changes: 20 cards; this baseline uses 18.
- Printing restriction: FINAL FANTASY physical printings only, including allowed promos/special releases.
- Strategic requirement: retain Bant +1/+1 counters/proliferate as a real game plan, retain meaningful creature/combat pressure, add a compact verified combo route, and raise countermagic density substantially.
- Target Bracket 5 is an evaluation target, not permission to call an under-target deck Bracket 5.

## Locked general-AI additions

1. The Destined White Mage
2. Ranger-Captain of Eos
3. Delivery Moogle
4. Search for Dagger
5. Counterspell
6. Dovin's Veto
7. Force of Negation
8. Arcane Denial
9. Syncopate
10. Louisoix's Sacrifice
11. Hypnotic Sprite
12. Rhystic Study
13. The Earth Crystal
14. Clever Concealment
15. Akroma's Will
16. Nature's Lore
17. Conqueror's Flail
18. Lightning Greaves

## Locked general-AI cuts

1. Temple of the False God
2. Rampant Rejuvenator
3. Collective Effort
4. Promise of Loyalty
5. Luminous Broodmoth
6. Sunscorch Regent
7. Together Forever
8. Pull from Tomorrow
9. Bane of Progress
10. Altered Ego
11. Lord Jyscal Guado
12. Tromell, Seymour's Butler
13. Shelinda, Yevon Acolyte
14. Summoner's Sending
15. Farewell
16. Summon: Valefor
17. Sin, Unending Cataclysm
18. Generous Patron

## Why this baseline is intentionally strong

The baseline does not merely add generic staples. It builds around the exact requested identity:

- `The Destined White Mage` plus the stock `Walking Ballista` supplies a compact lifelink/counter loop candidate that must still be verified by the project win-route truth layer.
- `Ranger-Captain of Eos` can find Walking Ballista because X is 0 when determining its mana value in the library; its sacrifice ability can also protect a combo turn.
- `Delivery Moogle` can find or recover Walking Ballista as an artifact with mana value 0.
- `Search for Dagger` gives repeated commander-triggered access to legendary-creature candidates such as The Destined White Mage.
- The stock `An Offer You Can't Refuse` is supplemented by seven proposed counterspell cards: Counterspell, Dovin's Veto, Force of Negation, Arcane Denial, Syncopate, Louisoix's Sacrifice and Hypnotic Sprite. This deliberately tests the user's dense-countermagic requirement rather than allowing the benchmark to pass on vague interaction density.
- `The Earth Crystal` doubles +1/+1-counter placement while preserving the counters plan.
- `Rhystic Study` raises persistent card-advantage quality.
- `Clever Concealment`, `Akroma's Will`, `Conqueror's Flail`, Ranger-Captain and `Lightning Greaves` create layered protection/finishing support without replacing the combat plan with a single combo line.
- `Nature's Lore` replaces slow infrastructure while keeping the deck's ramp structure intact.

## Hard-truth verification required before scoring

The baseline must fail closed if any of the following are false:

- exact 100 cards after swaps;
- Tidus remains the sole commander;
- Commander singleton/color-identity legality;
- every incoming card has an allowed physical FINAL FANTASY-family printing under the benchmark policy;
- no cut name is absent from the exact stock precon;
- the resulting deck does not silently lose the requested counters/proliferate/combat identity;
- claimed combo closure is provider/mechanics verified rather than inferred from card names;
- target bracket is assessed from evidence rather than assigned from the request.

## Anti-leak rule

Do not alter the above IN/OUT list in response to the specialist Counter Blitz result. If mechanical verification finds a hard invalidity, record the invalid proposal as a general-AI baseline error. A replacement may only be introduced as a separately versioned correction, never silently rewritten into this locked baseline.
