# Counter Blitz A2 — hard optimization of unrestricted FF-only Tidus

Date: 2026-08-29 NZST

Status: exploratory evidence on `test/counter-blitz-ff-tidus-20260829` only. This report does **not** promote V0.15, change `stable/current`, or merge PR #29.

Source baseline for the Commander-specialist code under test: `9487cd08aab76359db9bc44ee524fcc3221b0484` (`agent/v15-native-deck-intelligence`).

## Objective

Attack the corrected unrestricted Final Fantasy-only Tidus Version A rather than assuming the first build was optimal. Ordinary candidate packages had to pass the existing legality, printing-family, strategy-preservation and simulation-backed refinement gates. A separate verified win-package pass was then allowed to challenge the local optimum.

Final Fantasy policy used:
- physical Final Fantasy printing family only;
- promos included;
- curated special releases / Secret Lair printings included.

## Baseline Version A

Headline construction metrics:
- exact cards: 100
- lands: 31
- average nonland mana value: 2.17
- early plays: 46
- fast mana: 3
- cheap interaction: 12
- protection: 6
- tutors: 4
- free interaction: 1
- V0.14 verified winning combos: 1
- cEDH construction status: `strong-competitive-construction-signals`

Existing verified line:
- `Gatta and Luzzu + Hardened Scales + Walking Ballista`
- Commander Spellbook result: infinite damage / infinite +1/+1 counters.

## A2 iterative refinement result

Completed deterministic hard seed: `20260829`.

Settings:
- target bracket: 5
- max swaps: 20
- max rounds: 5
- swaps per round: 5
- competing candidate packages per round: 5
- same-seed simulation iterations: 750
- simulated turns: 7

Result: **zero ordinary swaps were accepted**.

Interpretation: Version A was a local optimum for the current iterative strategy-aware candidate generator under this completed seed. This is not proof of a mathematical/global optimum.

Attempts to complete the additional deterministic seeds were blocked by external Commander Spellbook throttling (`HTTP 429` / MCP error). Those incomplete repetitions are not counted as convergence evidence.

## Accepted A2 improvement

Independent verified win-package completion found one defensible improvement:

**OUT**
- `Archmage Emeritus (FIC) 261`

**IN**
- `The Earth Crystal (FIN) 184`

Why this survives the hard audit:
- exact 100 cards remains satisfied;
- Commander legality remains satisfied;
- Final Fantasy physical-printing policy remains satisfied;
- headline construction metrics do not regress;
- The Earth Crystal is directly aligned with the +1/+1-counter plan;
- the swap adds a second independently verified Ballista kill package while retaining the first.

Second verified line:
- `Gatta and Luzzu + The Earth Crystal + Walking Ballista`
- Commander Spellbook combo id: `3693-6593-6627`
- result: infinite damage / infinite +1/+1 counters on a creature.

## A2 headline metrics

After `Archmage Emeritus -> The Earth Crystal`:
- lands: 31
- average nonland MV: 2.17
- early plays: 46
- fast mana: 3
- cheap interaction: 12
- protection: 6
- tutors: 4
- free interaction: 1
- V0.14 verified winning combos: **2**
- cEDH construction status: `strong-competitive-construction-signals`

So the measurable gain is primarily **win-route redundancy**, not a cosmetic improvement to curve/role counts.

## V0.15 evaluator bug exposed and fixed on the isolated branch

A2 exposed a disagreement:
- V0.14 correctly treated the verified Ballista loops as winning combos;
- V0.15's stricter multiplayer-closure checker originally rejected them because Commander Spellbook's result label is only `Infinite damage`, without saying `each/all opponents` in the result field.

However, the verified Spellbook sequence explicitly says Walking Ballista repeatedly deals 1 damage to **any target** and then repeats the activation. That permits lethal damage to be distributed across the multiplayer table.

Isolated test-branch fix commit:
- `5262672e3004e2950436bb3989c064a566ffa228`

The fix remains conservative:
- generic unscoped `Infinite damage` by itself still does **not** count as a proven full-table win;
- repeatable unbounded damage only becomes full-table closure when the verified combo description explicitly proves a repeatable damage-to-any-target action;
- single-opponent kills and resource-only infinites remain non-full-table results.

Local regression passed after the TypeScript build:
- generic infinite damage: rejected as unscoped;
- repeatable any-target Ballista damage: accepted as `all-opponents-damage`;
- V0.15 synthetic post-build evidence recognizes Spellbook combo `3693-6593-6627` as a verified winning combo.

## Current A2 champion

Version A2 is Version A with exactly one change:

`Archmage Emeritus (FIC) 261 -> The Earth Crystal (FIN) 184`

This is the strongest plugin-backed improvement established by the completed A2 evidence so far. The exact outgoing slot should still be regarded as the best current optimizer choice rather than globally proven weakest-card truth; repeated-seed convergence was prevented by external throttling.

## Boundaries

- No `main` / V0.13 changes.
- No `stable/current` promotion.
- No PR #29 merge.
- No claim that the deck is an independently proven current cEDH metagame deck.
- No claim of global decklist optimality.
