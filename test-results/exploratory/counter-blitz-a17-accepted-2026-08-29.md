# Counter Blitz A17 — accepted exploratory Tidus champion

Status: **accepted exploratory deck evidence only**. No stable/current promotion. PR #29 remains unmerged.

## Baseline
A16 exploratory champion.

Accepted A16 change:
- From Father to Son → Commune with Beavers

## A17 accepted change
- **OUT:** Mangara, the Diplomat
- **IN:** Summon: Fenrir

## Why this swap survives manual review

Mangara is a strong generic reactive draw card, but in this exact Tidus shell its contribution is largely passive card advantage. It does not directly advance the deck's counter movement, proliferate, mana development, combo access, or combat-conversion engines.

Summon: Fenrir has multiple exact-deck jobs:
- Chapter I searches a basic land onto the battlefield tapped, improving mana development.
- Chapter II gives the next creature an additional +1/+1 counter, directly supporting Tidus's counter plan.
- Chapter III can replace itself with a card.
- As a creature Saga, Fenrir naturally carries lore counters. Tidus can move a counter from it at the beginning of combat, creating direct commander-plan interaction and allowing its chapter progression to be manipulated rather than merely treating Fenrir as generic ramp.

The previously proposed Cloud, Midgar Mercenary → Summon: Fenrir change was rejected after manual review because Cloud supports a healthy Equipment package. The purpose audit was repaired generically so non-combo tutor packages receive real package-access credit rather than being penalized simply because they do not tutor a supplied win piece.

## Corrected A17 evidence

Workflow run: `33231599571`
Source SHA: `cbb3eac79da4f7bde0b7e79e52a9c3a6ea6669fb`
Outcome: success

A16 baseline audit before the A17 swap:
- locked: 22
- supported: 74
- review: 3
- challenge: 0

A16 real combo access:
- deterministic: Ranger-Captain of Eos → Walking Ballista
- bounded: Commune with Beavers → Gatta and Luzzu / Walking Ballista / The Earth Crystal
- weighted access score: 7.9

A17 leader result:
- cut: Mangara, the Diplomat
- add: Summon: Fenrir
- purpose delta: +4
- role continuity: preserved
- combo-access delta: 0
- simulation mean: +2.386
- simulation minimum: +1.513
- positive seeds: 5/5
- regression flags: none

Resulting construction metrics:
- average nonland MV: 2.12
- ramp: 19
- cheap interaction: 12
- free interaction: 2
- persistent colored mana sources: 9
- generic tutor count: 3 (reported only; not used as a proxy for actual combo access)

## Manual acceptance decision

**Accept Mangara, the Diplomat → Summon: Fenrir as the A17 exploratory champion.**

This acceptance is based on whole-deck role fit plus corrected simulation evidence, not on a raw scalar score. The swap preserves verified win packages and real combo access while replacing generic reactive draw with a card that contributes to mana, counters, commander interaction, and card flow.

## Intelligence repairs discovered during A17

1. Deterministic tutor parsing now respects land subtypes and plural restrictions such as Plains cards and basic land cards.
2. Land-only tutors cannot impersonate unrestricted combo tutors.
3. Narrow non-combo tutors with a healthy supported package receive package-access credit.
4. Cloud-style Equipment tutoring is evaluated as a real package role rather than automatically penalized for not finding combo pieces.
5. One-target narrow tutor packages remain pressure candidates.

A17 remains isolated exploratory Commander-intelligence evidence and does not alter the V0.13 stable boundary.